<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ApprovalStatus;
use App\Enums\PublicationVisibility;
use App\Enums\Role;
use App\Enums\WorkStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdCardResource;
use App\Http\Resources\EventCardResource;
use App\Http\Resources\MyWorkResource;
use App\Http\Resources\UserCardResource;
use App\Models\Ad;
use App\Models\Announcement;
use App\Models\Event;
use App\Models\Honor;
use App\Models\Publication;
use App\Models\ResearchGroup;
use App\Models\User;
use App\Models\Work;
use App\Support\AdminScope;
use App\Support\Cards;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The admin dashboard: stats and the approval queue. Admins only (routes/modules/admin.php); each
 * sees their own school's, super-admins every school's or the one they pick (?institution=).
 */
class DashboardController extends Controller
{
    /** GET /api/admin/stats?institution= */
    public function stats(Request $request): JsonResponse
    {
        $now = now();
        $school = AdminScope::school($request);
        $people = fn () => AdminScope::apply(User::query(), $school);
        $roles = $people()->selectRaw('role, count(*) as n')->groupBy('role')->pluck('n', 'role');
        $workCounts = AdminScope::apply(Work::query(), $school)->whereNull('removed_at')->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $events = AdminScope::apply(Event::query(), $school, through: 'postedBy')->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $publications = AdminScope::apply(Publication::query(), $school)->selectRaw('visibility, count(*) as n')->groupBy('visibility')->pluck('n', 'visibility');
        $works = fn (WorkStatus ...$s) => (int) collect($s)->sum(fn (WorkStatus $x) => $workCounts[$x->value] ?? 0);

        return response()->json([
            'users' => collect(Role::cases())->mapWithKeys(fn (Role $r) => [$r->value => (int) ($roles[$r->value] ?? 0)]),
            'unverifiedEducators' => $people()->active()->where('role', Role::Educator)->where('verified', false)->count(),
            'unconfirmedSchools' => AdminScope::apply(self::awaitingSchool(), $school)->count(),
            'works' => [
                'published' => $works(WorkStatus::Approved),
                'inReview' => $works(WorkStatus::Submitted, WorkStatus::UnderReview, WorkStatus::Revision),
                'drafts' => $works(WorkStatus::Draft),
                'rejected' => $works(WorkStatus::Rejected),
                'removed' => AdminScope::apply(Work::query(), $school)->whereNotNull('removed_at')->count(),
            ],
            'events' => [
                'approved' => (int) ($events[ApprovalStatus::Approved->value] ?? 0),
                'pending' => (int) ($events[ApprovalStatus::Pending->value] ?? 0),
                'registrations' => DB::table('event_registrations')->whereIn('event_id', AdminScope::apply(Event::query(), $school, through: 'postedBy')->select('id'))->count(),
            ],
            'ads' => [
                'live' => AdminScope::apply(Ad::query(), $school, through: 'createdBy')->where('status', ApprovalStatus::Approved)->where('starts_at', '<=', $now)->where('ends_at', '>=', $now)->count(),
                'pending' => AdminScope::apply(Ad::query(), $school, through: 'createdBy')->where('status', ApprovalStatus::Pending)->count(),
            ],
            'honorsPending' => AdminScope::apply(Honor::query(), $school, through: 'user')->where('verified', false)->count(),
            'groups' => AdminScope::apply(ResearchGroup::query(), $school, through: 'adviser')->count(),
            'publications' => [
                'published' => (int) (($publications[PublicationVisibility::Internal->value] ?? 0) + ($publications[PublicationVisibility::Public->value] ?? 0)),
                'drafts' => (int) ($publications[PublicationVisibility::Draft->value] ?? 0),
            ],
            'announcements' => AdminScope::apply(Announcement::query(), $school, through: 'author')->count(),
        ]);
    }

    /** @return Builder<User> People waiting for their school's admins to confirm them */
    private static function awaitingSchool(): Builder
    {
        return User::active()->whereNotNull('institution_id')->whereNull('institution_confirmed_at')->where('role', '!=', Role::Admin);
    }

    /** GET /api/admin/queue?institution= — everything waiting for this admin's school (or every school, for super-admins) */
    public function queue(Request $request): JsonResponse
    {
        $me = $request->user();
        $school = AdminScope::school($request);

        return response()->json([
            'works' => MyWorkResource::collection(Cards::myWorks(AdminScope::apply(Work::query(), $school)->whereIn('status', [WorkStatus::Submitted, WorkStatus::UnderReview, WorkStatus::Revision])->whereNull('removed_at'), $me->id)->orderBy('submitted_at')->get()),
            'educators' => AdminScope::apply(User::query(), $school)->with('profile')->active()->where('role', Role::Educator)->where('verified', false)->orderBy('created_at')->get()
                ->map(fn (User $u) => [...(new UserCardResource($u))->resolve($request), 'email' => $u->email, 'createdAt' => $u->created_at->toISOString()]),
            // Signed up without their school's email domain (docs/decisions/0002)
            'schools' => AdminScope::apply(self::awaitingSchool(), $school)->with('profile')->orderBy('created_at')->get()
                ->map(fn (User $u) => [...(new UserCardResource($u))->resolve($request), 'email' => $u->email, 'createdAt' => $u->created_at->toISOString()]),
            'events' => EventCardResource::collection(Cards::events(AdminScope::apply(Event::query(), $school, through: 'postedBy')->where('status', ApprovalStatus::Pending), $me->id)->orderBy('date')->get()),
            'ads' => AdCardResource::collection(Cards::ads(AdminScope::apply(Ad::query(), $school, through: 'createdBy')->where('status', ApprovalStatus::Pending))->orderBy('created_at')->get()),
            'honors' => AdminScope::apply(Honor::query(), $school, through: 'user')->with(Cards::user('user'))->where('verified', false)->orderBy('created_at')->get()
                ->map(fn (Honor $h) => [...$h->only(['id', 'kind', 'title', 'issuer', 'year', 'verified']), 'owner' => new UserCardResource($h->user)]),
        ]);
    }
}
