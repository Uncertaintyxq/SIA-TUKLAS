<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PublicationVisibility;
use App\Enums\ReviewDecision;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\Announcement;
use App\Models\Publication;
use App\Models\ResearchGroup;
use App\Models\Review;
use App\Models\User;
use App\Support\Audit;
use App\Support\Cards;
use App\Support\Chat;
use App\Support\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Accounts: roles, educator verification and rights, and educator monitoring. Admins only. */
class PeopleController extends Controller
{
    private const RIGHTS = ['canPublish' => ['can_publish', 'research publishing'], 'canModerateGroups' => ['can_moderate_groups', 'group moderation'], 'canBroadcast' => ['can_broadcast', 'announcement']];

    /** GET /api/admin/users?q=&role= */
    public function index(Request $request): JsonResponse
    {
        $q = mb_substr(trim((string) $request->query('q', '')), 0, 80);
        $like = '%'.addcslashes($q, '%_\\').'%';
        $users = User::with('profile')->withCount('works')
            ->when(Role::tryFrom((string) $request->query('role')), fn ($query, $role) => $query->where('role', $role))
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('username', 'like', $like)))
            ->orderBy('role')->orderBy('name')
            ->limit(200)
            ->get();

        return response()->json($users->map(fn (User $u) => [
            ...(new UserCardResource($u))->resolve($request), 'email' => $u->email, 'createdAt' => $u->created_at->toISOString(), 'works' => (int) $u->works_count,
        ]));
    }

    /** PATCH /api/admin/users/{id} {role?, verified?, canPublish?, canModerateGroups?, canBroadcast?} — making someone an educator vouches for them. */
    public function update(Request $request, int $id): Response
    {
        $patch = $request->validate([
            'role' => ['sometimes', Rule::enum(Role::class)],
            'verified' => ['sometimes', 'boolean'],
            'canPublish' => ['sometimes', 'boolean'],
            'canModerateGroups' => ['sometimes', 'boolean'],
            'canBroadcast' => ['sometimes', 'boolean'],
        ]);
        /** @var User $me */
        $me = $request->user();
        $role = isset($patch['role']) ? Role::from($patch['role']) : null;
        if ($id === $me->id && $role !== null && $role !== Role::Admin) {
            throw new HttpException(409, 'You can’t remove your own admin role.');
        }
        $user = User::find($id) ?? throw new HttpException(404, 'That account no longer exists.');
        $before = $user->only(['role', 'verified', 'can_publish', 'can_moderate_groups', 'can_broadcast']);

        if ($role !== null) {
            $user->role = $role;
        }
        if (array_key_exists('verified', $patch)) {
            $user->verified = (bool) $patch['verified'];
        } elseif ($role === Role::Educator && $before['role'] !== Role::Educator) {
            $user->verified = true;
        }
        foreach (self::RIGHTS as $key => [$column]) {
            if (array_key_exists($key, $patch)) {
                $user->{$column} = (bool) $patch[$key];
            }
        }
        $user->save();

        $changes = array_diff_assoc(
            array_map(fn ($v) => $v instanceof Role ? $v->value : $v, $user->only(array_keys($before))),
            array_map(fn ($v) => $v instanceof Role ? $v->value : $v, $before),
        );
        if ($changes !== []) {
            Audit::log('account_changed', $me, $user, ['changes' => $changes]);
        }

        if ($user->isEducator() && $user->verified && ! ($before['role'] === Role::Educator && $before['verified'])) {
            Notifier::notify($id, 'educator_verified', 'Your educator account is verified. You can now review work, publish research and post announcements.', '/review', $me->id);
        }
        foreach (self::RIGHTS as $key => [$column, $name]) {
            if (array_key_exists($key, $patch) && (bool) $patch[$key] !== (bool) $before[$column]) {
                Notifier::notify($id, 'educator_rights', $patch[$key] ? "An admin gave you the {$name} right." : "An admin turned off your {$name} right.", '/portfolio', $me->id);
            }
        }

        return response()->noContent();
    }

    /** GET /api/admin/educators — every educator with their rights and output, plus what educators did lately */
    public function educators(Request $request): JsonResponse
    {
        $educators = User::with('profile')->where('role', Role::Educator)
            ->withCount(['advisedGroups', 'announcements', 'reviews'])
            ->orderBy('name')
            ->get();
        $ids = $educators->pluck('id');
        // toBase(): plain rows, so `visibility` stays a string key instead of an enum
        $byVisibility = Publication::whereIn('author_id', $ids)->selectRaw('author_id, visibility, count(*) as n')->groupBy('author_id', 'visibility')->toBase()->get()
            ->groupBy('author_id')->map(fn ($rows) => $rows->pluck('n', 'visibility'));
        $card = fn (User $u) => new UserCardResource($u);
        $verb = ['revise' => 'returned', 'approve' => 'approved', 'reject' => 'did not approve'];

        $recent = collect()
            ->concat(Publication::with(Cards::user('author'))->whereIn('author_id', $ids)->where('visibility', '!=', PublicationVisibility::Draft)->orderByDesc('published_at')->limit(15)->get()
                ->map(fn ($p) => ['key' => "p{$p->id}", 'kind' => 'publication', 'educator' => $card($p->author),
                    'text' => "published “{$p->title}” (".($p->visibility === PublicationVisibility::Public ? 'Public' : 'Internal').')',
                    'link' => "/publications/{$p->id}", 'at' => ($p->published_at ?? now()->setTimestamp(0))->toISOString()]))
            ->concat(Announcement::with(Cards::user('author'))->whereIn('author_id', $ids)->latest('created_at')->limit(15)->get()
                ->map(fn ($a) => ['key' => "a{$a->id}", 'kind' => 'announcement', 'educator' => $card($a->author),
                    'text' => "posted the announcement “{$a->title}”", 'link' => "/announcements#a-{$a->id}", 'at' => $a->created_at->toISOString()]))
            ->concat(Review::with([...Cards::user('reviewer'), 'work:id,title'])->whereIn('reviewer_id', $ids)->where('decision', '!=', ReviewDecision::StartReview)->latest('created_at')->limit(15)->get()
                ->map(fn ($r) => ['key' => "r{$r->id}", 'kind' => 'review', 'educator' => $card($r->reviewer),
                    'text' => ($verb[$r->decision->value] ?? 'reviewed')." “{$r->work->title}”", 'link' => "/works/{$r->work->id}", 'at' => $r->created_at->toISOString()]))
            ->concat(ResearchGroup::with(Cards::user('adviser'))->whereIn('adviser_id', $ids)->latest('created_at')->limit(10)->get()
                ->map(fn ($g) => ['key' => "g{$g->id}", 'kind' => 'group', 'educator' => $card($g->adviser),
                    'text' => "started the research group “{$g->name}”", 'link' => "/groups/{$g->id}", 'at' => $g->created_at->toISOString()]))
            ->sortByDesc('at')->take(25)->values();

        return response()->json([
            'educators' => $educators->map(function (User $e) use ($request, $byVisibility) {
                $online = Chat::isOnline($e->last_seen_at);
                $counts = $byVisibility[$e->id] ?? collect();

                return [
                    ...(new UserCardResource($e))->resolve($request),
                    'email' => $e->email,
                    'createdAt' => $e->created_at->toISOString(),
                    'online' => $online,
                    'lastSeenAt' => $e->last_seen_at?->toISOString(),
                    // The switches an admin flips (stored values; an unverified educator holds none of them yet)
                    'rights' => ['publish' => $e->can_publish, 'moderateGroups' => $e->can_moderate_groups, 'broadcast' => $e->can_broadcast],
                    'counts' => [
                        'publications' => collect(PublicationVisibility::cases())->mapWithKeys(fn ($v) => [$v->value => (int) ($counts[$v->value] ?? 0)]),
                        'groups' => (int) $e->advised_groups_count,
                        'announcements' => (int) $e->announcements_count,
                        'reviews' => (int) $e->reviews_count,
                    ],
                ];
            }),
            'recent' => $recent,
        ]);
    }
}
