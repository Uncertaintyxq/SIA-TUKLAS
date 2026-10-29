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
use App\Support\Cards;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** The admin dashboard: platform stats and the approval queue. Admins only (routes/modules/admin.php). */
class DashboardController extends Controller
{
    /** GET /api/admin/stats */
    public function stats(): JsonResponse
    {
        $now = now();
        $roles = User::selectRaw('role, count(*) as n')->groupBy('role')->pluck('n', 'role');
        $workCounts = Work::whereNull('removed_at')->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $events = Event::selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $publications = Publication::selectRaw('visibility, count(*) as n')->groupBy('visibility')->pluck('n', 'visibility');
        $works = fn (WorkStatus ...$s) => (int) collect($s)->sum(fn (WorkStatus $x) => $workCounts[$x->value] ?? 0);

        return response()->json([
            'users' => collect(Role::cases())->mapWithKeys(fn (Role $r) => [$r->value => (int) ($roles[$r->value] ?? 0)]),
            'unverifiedEducators' => User::where('role', Role::Educator)->where('verified', false)->count(),
            'works' => [
                'published' => $works(WorkStatus::Approved),
                'inReview' => $works(WorkStatus::Submitted, WorkStatus::UnderReview, WorkStatus::Revision),
                'drafts' => $works(WorkStatus::Draft),
                'rejected' => $works(WorkStatus::Rejected),
                'removed' => Work::whereNotNull('removed_at')->count(),
            ],
            'events' => [
                'approved' => (int) ($events[ApprovalStatus::Approved->value] ?? 0),
                'pending' => (int) ($events[ApprovalStatus::Pending->value] ?? 0),
                'registrations' => DB::table('event_registrations')->count(),
            ],
            'ads' => [
                'live' => Ad::where('status', ApprovalStatus::Approved)->where('starts_at', '<=', $now)->where('ends_at', '>=', $now)->count(),
                'pending' => Ad::where('status', ApprovalStatus::Pending)->count(),
            ],
            'honorsPending' => Honor::where('verified', false)->count(),
            'groups' => ResearchGroup::count(),
            'publications' => [
                'published' => (int) (($publications[PublicationVisibility::Internal->value] ?? 0) + ($publications[PublicationVisibility::Public->value] ?? 0)),
                'drafts' => (int) ($publications[PublicationVisibility::Draft->value] ?? 0),
            ],
            'announcements' => Announcement::count(),
        ]);
    }

    /** GET /api/admin/queue — everything waiting for an admin */
    public function queue(Request $request): JsonResponse
    {
        $me = $request->user();

        return response()->json([
            'works' => MyWorkResource::collection(Cards::myWorks(Work::whereIn('status', [WorkStatus::Submitted, WorkStatus::UnderReview, WorkStatus::Revision])->whereNull('removed_at'), $me->id)->orderBy('submitted_at')->get()),
            'educators' => User::with('profile')->where('role', Role::Educator)->where('verified', false)->orderBy('created_at')->get()
                ->map(fn (User $u) => [...(new UserCardResource($u))->resolve($request), 'email' => $u->email, 'createdAt' => $u->created_at->toISOString()]),
            'events' => EventCardResource::collection(Cards::events(Event::where('status', ApprovalStatus::Pending), $me->id)->orderBy('date')->get()),
            'ads' => AdCardResource::collection(Cards::ads(Ad::where('status', ApprovalStatus::Pending))->orderBy('created_at')->get()),
            'honors' => Honor::with(Cards::user('user'))->where('verified', false)->orderBy('created_at')->get()
                ->map(fn (Honor $h) => [...$h->only(['id', 'kind', 'title', 'issuer', 'year', 'verified']), 'owner' => new UserCardResource($h->user)]),
        ]);
    }
}
