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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The community feed: approved works, open opportunities and approved academic events only.
 * Every query filters on approval in SQL, so nothing private can slip into a page.
 */
class FeedController extends Controller
{
    private const FILTERS = ['all', 'research', 'literary', 'innovation', 'opportunities', 'events', 'saved'];

    /** GET /api/feed?type=&dept=&q=&sort=newest|discussed */
    public function index(Request $request): JsonResponse
    {
        $me = $request->user();
        $type = in_array($request->query('type'), self::FILTERS, true) ? $request->query('type') : 'all';
        $dept = mb_substr(trim((string) $request->query('dept', '')), 0, 160);
        $q = mb_substr(trim((string) $request->query('q', '')), 0, 100);
        $sort = $request->query('sort') === 'discussed' ? 'discussed' : 'newest';
        $like = '%'.addcslashes($q, '%_\\').'%';
        $workType = WorkType::tryFrom($type);
        $items = collect();

        if ($type === 'all' || $type === 'saved' || $workType) {
            $works = Cards::works(Work::public(), $me->id)
                ->when($workType, fn ($query) => $query->where('type', $workType))
                ->when($type === 'saved', fn ($query) => $query->whereHas('savedBy', fn ($s) => $s->where('users.id', $me->id)))
                ->when($dept !== '', fn ($query) => $query->whereHas('author.profile', fn ($p) => $p->where('department', $dept)))
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

        // Opportunities and events have no department; a department filter shows works only.
        if (($type === 'all' && $dept === '') || $type === 'opportunities') {
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

        if (($type === 'all' && $dept === '') || $type === 'events') {
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

        $people = $q === '' ? collect() : User::with('profile')
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

        return response()->json([
            'items' => $items,
            'people' => UserCardResource::collection($people),
            'departments' => $departments,
        ]);
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

    /** Keywords are a JSON array; search its text, case-insensitively, on MySQL and SQLite alike. */
    private function tagsLike(Builder $query, string $q): void
    {
        $text = DB::connection()->getDriverName() === 'mysql' ? 'LOWER(CAST(tags AS CHAR))' : 'LOWER(tags)';
        $query->whereRaw("{$text} LIKE ?", ['%'.addcslashes(mb_strtolower($q), '%_\\').'%']);
    }
}
