<?php

namespace App\Http\Controllers\Feed;

use App\Enums\ApprovalStatus;
use App\Enums\WorkType;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdCardResource;
use App\Http\Resources\EventCardResource;
use App\Http\Resources\OpportunityCardResource;
use App\Http\Resources\UserCardResource;
use App\Http\Resources\WorkCardResource;
use App\Models\Ad;
use App\Models\Event;
use App\Models\Opportunity;
use App\Models\Profile;
use App\Models\User;
use App\Models\Work;
use App\Support\Cards;
use App\Support\Followers;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The community feed: approved works, open opportunities and approved academic events only.
 * Every query filters on approval in SQL, so nothing private can slip into a page.
 */
class FeedController extends Controller
{
    private const FILTERS = ['all', 'research', 'literary', 'innovation', 'opportunities', 'events', 'saved', 'following'];

    /** GET /api/feed?type=(…|saved|following)&dept=&year=&adviser=&tag=&q=&sort=newest|discussed */
    public function index(Request $request): JsonResponse
    {
        $me = $request->user();
        $type = in_array($request->query('type'), self::FILTERS, true) ? $request->query('type') : 'all';
        $dept = mb_substr(trim((string) $request->query('dept', '')), 0, 160);
        $year = self::year($request->query('year'));
        $adviser = max(0, (int) $request->query('adviser', 0));
        $tag = mb_substr(trim((string) $request->query('tag', '')), 0, 40);
        $q = mb_substr(trim((string) $request->query('q', '')), 0, 100);
        $sort = $request->query('sort') === 'discussed' ? 'discussed' : 'newest';
        $like = '%'.addcslashes($q, '%_\\').'%';
        $workType = WorkType::tryFrom($type);
        // Department, year, adviser and keyword describe works; opportunities and events have none of them
        $worksOnly = $dept !== '' || $year !== null || $adviser > 0 || $tag !== '';
        $items = collect();

        if ($type === 'all' || $type === 'saved' || $type === 'following' || $workType) {
            $works = Cards::works(Work::public(), $me->id)
                ->when($workType, fn ($query) => $query->where('type', $workType))
                ->when($type === 'saved', fn ($query) => $query->whereHas('savedBy', fn ($s) => $s->where('users.id', $me->id)))
                ->when($type === 'following', fn ($query) => $this->followedBy($query, $me))
                ->when($dept !== '', fn ($query) => $query->whereHas('author.profile', fn ($p) => $p->where('department', $dept)))
                ->when($year !== null, fn ($query) => $query->whereYear('approved_at', $year))
                ->when($adviser > 0, fn ($query) => $query->where('adviser_id', $adviser))
                ->when($tag !== '', fn ($query) => $query->whereJsonContains('tags', $tag))
                ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                    ->where('title', 'like', $like)
                    ->orWhere('abstract', 'like', $like)
                    ->orWhereHas('author', fn ($a) => $a->where('name', 'like', $like))
                    ->orWhereHas('coAuthors', fn ($a) => $a->where('name', 'like', $like))
                    ->orWhere(fn ($t) => $this->tagsLike($t, $q))))
                ->orderByDesc('approved_at')
                ->limit(100)
                ->get();
            foreach ($works as $w) {
                $items->push(['kind' => 'work', 'at' => $w->approved_at->toISOString(), 'work' => (new WorkCardResource($w))->resolve($request)]);
            }
        }

        // Opportunities and events have no department, year, adviser or keyword: those filters show works only.
        if (($type === 'all' && ! $worksOnly) || $type === 'opportunities') {
            $opportunities = Cards::opportunities(Opportunity::query(), $me->id)
                ->where('deadline', '>=', now()->subDay())
                ->when($q !== '', fn ($query) => $query->where(fn ($o) => $o
                    ->where('title', 'like', $like)->orWhere('description', 'like', $like)
                    ->orWhereHas('adviser', fn ($a) => $a->where('name', 'like', $like))))
                ->latest('created_at')
                ->limit(50)
                ->get();
            foreach ($opportunities as $o) {
                $items->push(['kind' => 'opportunity', 'at' => $o->created_at->toISOString(), 'opportunity' => (new OpportunityCardResource($o))->resolve($request)]);
            }
        }

        if (($type === 'all' && ! $worksOnly) || $type === 'events') {
            $events = Cards::events(Event::query(), $me->id)
                ->where('status', ApprovalStatus::Approved)
                ->where('date', '>=', now()->subDay())
                ->when($q !== '', fn ($query) => $query->where(fn ($e) => $e
                    ->where('title', 'like', $like)->orWhere('description', 'like', $like)->orWhere('venue', 'like', $like)))
                ->latest('created_at')
                ->limit(50)
                ->get();
            foreach ($events as $e) {
                $items->push(['kind' => 'event', 'at' => $e->created_at->toISOString(), 'event' => (new EventCardResource($e))->resolve($request)]);
            }
        }

        $discussion = fn (array $i) => $i['kind'] === 'work' ? $i['work']['commentCount'] * 2 + $i['work']['reactionCount'] : -1;
        $items = $items->sort(fn ($a, $b) => ($sort === 'discussed' ? $discussion($b) <=> $discussion($a) : 0) ?: strcmp($b['at'], $a['at']))->values();

        $people = $q === '' ? collect() : User::with('profile')->active()
            ->where(fn ($u) => $u->where('name', 'like', $like)->orWhere('username', 'like', $like)->orWhere('program', 'like', $like)
                ->orWhere('headline', 'like', $like)->orWhereHas('profile', fn ($p) => $p->where('department', 'like', $like)))
            ->orderBy('name')
            ->limit(6)
            ->get();

        $departments = Profile::where('department', '!=', '')
            ->whereHas('user.works', fn ($w) => $w->public())
            ->distinct()
            ->orderBy('department')
            ->pluck('department');

        // What the other filters can offer: only values that public works actually have
        $public = Work::public()->get(['approved_at', 'adviser_id', 'tags']);
        $advisers = User::with('profile')->whereIn('id', $public->pluck('adviser_id')->unique())->orderBy('name')->get();

        return response()->json([
            'items' => $items,
            'people' => UserCardResource::collection($people),
            'departments' => $departments,
            'years' => $public->map(fn (Work $w) => (int) $w->approved_at->year)->unique()->sortDesc()->values(),
            'advisers' => UserCardResource::collection($advisers),
            'tags' => self::topKeywords($public->pluck('tags')),
        ]);
    }

    /** A year from the query string, or null when it isn't one. */
    public static function year(mixed $value): ?int
    {
        $year = (int) $value;

        return $year >= 1900 && $year <= 2200 ? $year : null;
    }

    /**
     * The most used keywords across these lists, most used first: [{name, count}]. Keywords are
     * grouped ignoring case, under the spelling used most.
     *
     * @param  Collection<int, mixed>  $lists
     * @return list<array{name: string, count: int}>
     */
    public static function topKeywords(Collection $lists, int $limit = 40): array
    {
        return $lists->flatten()->filter(fn ($k) => is_string($k) && trim($k) !== '')
            ->groupBy(fn (string $k) => mb_strtolower(trim($k)))
            ->map(fn (Collection $same) => ['name' => (string) $same->countBy()->sortDesc()->keys()->first(), 'count' => $same->count()])
            ->sortBy([['count', 'desc'], ['name', 'asc']])
            ->take($limit)
            ->values()
            ->all();
    }

    /** GET /api/feed/sidebar — approved academic ad slots running now, plus the next approved events. */
    public function sidebar(Request $request): JsonResponse
    {
        $now = now();
        $ads = Cards::ads(Ad::query())
            ->where('status', ApprovalStatus::Approved)
            ->where('starts_at', '<=', $now)
            ->where('ends_at', '>=', $now)
            ->whereHas('event', fn ($e) => $e->where('status', ApprovalStatus::Approved)->where('date', '>=', $now))
            ->orderBy('starts_at')
            ->limit(3)
            ->get();
        $upcoming = Cards::events(Event::query(), $request->user()->id)
            ->where('status', ApprovalStatus::Approved)
            ->where('date', '>=', $now)
            ->orderBy('date')
            ->limit(4)
            ->get();

        return response()->json(['ads' => AdCardResource::collection($ads), 'upcoming' => EventCardResource::collection($upcoming)]);
    }

    /**
     * Works from the people, departments and keywords this person follows (nothing when they follow
     * nothing).
     *
     * @param  Builder<Work>  $query
     */
    private function followedBy(Builder $query, User $me): void
    {
        $f = Followers::of($me);
        $query->where(function (Builder $w) use ($f) {
            $w->whereRaw('1 = 0')
                ->when($f['people'] !== [], fn ($q) => $q->orWhereIn('author_id', $f['people'])->orWhereHas('coAuthors', fn ($a) => $a->whereIn('users.id', $f['people'])))
                ->when($f['departments'] !== [], fn ($q) => $q->orWhereHas('author.profile', fn ($p) => $p->whereIn('department', $f['departments'])));
            foreach ($f['tags'] as $tag) {
                $w->orWhereJsonContains('tags', $tag);
            }
        });
    }

    /** Keywords are a JSON array; search its text, case-insensitively, on MySQL and SQLite alike. */
    private function tagsLike(Builder $query, string $q): void
    {
        $text = DB::connection()->getDriverName() === 'mysql' ? 'LOWER(CAST(tags AS CHAR))' : 'LOWER(tags)';
        $query->whereRaw("{$text} LIKE ?", ['%'.addcslashes(mb_strtolower($q), '%_\\').'%']);
    }
}
