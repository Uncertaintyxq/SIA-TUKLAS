<?php

namespace App\Http\Controllers\Moderation;

use App\Enums\ApprovalStatus;
use App\Enums\ReportStatus;
use App\Enums\ReportTarget;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\Comment;
use App\Models\Event;
use App\Models\Message;
use App\Models\Report;
use App\Models\User;
use App\Models\Work;
use App\Support\AdminScope;
use App\Support\Audit;
use App\Support\Cards;
use App\Support\Chat;
use App\Support\Notifier;
use App\Support\Reportables;
use App\Support\Uploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * The admins' Reports queue. Reports about the same thing are shown and resolved together: dismiss
 * (nothing wrong), remove the content, or warn the person. Every reporter hears the outcome, never
 * who else reported; the person reported never hears who reported them.
 */
class ReportQueueController extends Controller
{
    /** GET /api/admin/reports?status=open|closed&institution= — about this admin's school's people (super-admins: every school, or one) */
    public function index(Request $request): JsonResponse
    {
        $closed = $request->query('status') === 'closed';
        $school = AdminScope::school($request);
        $reports = AdminScope::apply(Report::query(), $school, through: 'owner')->with([...Cards::user('reporter'), ...Cards::user('owner'), ...Cards::user('resolver')])
            ->when($closed, fn ($q) => $q->where('status', '!=', ReportStatus::Open), fn ($q) => $q->where('status', ReportStatus::Open))
            ->latest('id')
            ->limit(300)
            ->get();

        $items = $reports->groupBy(fn (Report $r) => "{$r->target_type->value}:{$r->target_id}")
            ->take(100)
            ->map(fn (Collection $group) => $this->item($group))
            ->values();

        return response()->json([
            'items' => $items,
            // Reported things, not reports: distinct (type, id) pairs, counted in SQL (works on SQLite and MySQL)
            'openCount' => DB::query()->fromSub(AdminScope::apply(Report::query(), $school, through: 'owner')->where('status', ReportStatus::Open)->select('target_type', 'target_id')->distinct(), 'open_targets')->count(),
        ]);
    }

    /** POST /api/admin/reports/{type}/{id}/resolve {action: dismiss|remove|warn, note?} */
    public function resolve(Request $request, string $type, int $id): Response
    {
        $me = $request->user();
        $input = $request->validate([
            'action' => ['required', Rule::in(['dismiss', 'remove', 'warn'])],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $target = ReportTarget::tryFrom($type) ?? throw new HttpException(404, 'Not found');
        $reports = Report::where('target_type', $target)->where('target_id', $id)->where('status', ReportStatus::Open)->get();
        if ($reports->isEmpty()) {
            throw new HttpException(404, 'Those reports were already handled.');
        }
        $owner = $reports->first()->target_owner_id;
        AdminScope::check($me, $owner !== null ? User::whereKey($owner)->value('institution_id') : null);
        $owner = $reports->first()->target_owner_id;
        if ($owner === $me->id) {
            throw new HttpException(403, 'Another admin should handle a report about you.');
        }
        $action = $input['action'];
        $note = trim((string) ($input['note'] ?? ''));
        $name = Reportables::nameFor($target, $reports->first()->snapshot);

        if ($action === 'remove') {
            $this->takeDown($target, $id, $note, $me->id);
        } elseif ($action === 'warn' && $owner !== null) {
            Notifier::notify($owner, 'report_warning',
                "An admin reviewed a report about {$name}".($note !== '' ? ": {$note}" : '. Please keep Tuklas academic and respectful.'),
                Reportables::describe($target, $id)['link'] ?? '/feed', $me->id);
        }

        Report::whereKey($reports->modelKeys())->update([
            'status' => $action === 'dismiss' ? ReportStatus::Dismissed : ReportStatus::Actioned,
            'action' => $action === 'dismiss' ? null : $action,
            'note' => $note === '' ? null : $note,
            'resolved_by_id' => $me->id,
            'resolved_at' => now(),
        ]);
        Audit::log("report_{$action}", $me, $reports->first(), ['target' => $target->value, 'targetId' => $id, 'reports' => $reports->count()]);

        Notifier::notify($reports->pluck('reporter_id')->unique()->values()->all(), 'report_resolved',
            $action === 'dismiss'
                ? 'Thanks for your report. An admin looked at it and found nothing against Tuklas’s rules.'
                : 'Thanks for your report. An admin looked at it and took action.',
            '/feed', $me->id);

        return response()->noContent();
    }

    /** One row of the queue: what was reported, how it stands now, and every report about it. */
    private function item(Collection $group): array
    {
        /** @var Report $first */
        $first = $group->first();

        return [
            'key' => "{$first->target_type->value}:{$first->target_id}",
            'type' => $first->target_type->value,
            'id' => $first->target_id,
            'snapshot' => $first->snapshot,
            'owner' => $first->owner ? new UserCardResource($first->owner) : null,
            ...Reportables::describe($first->target_type, $first->target_id),
            'status' => $first->status->value,
            'action' => $first->action,
            'note' => $first->note,
            'resolvedBy' => $first->resolver ? new UserCardResource($first->resolver) : null,
            'resolvedAt' => $first->resolved_at?->toISOString(),
            'reports' => $group->map(fn (Report $r) => [
                'id' => $r->id,
                'reporter' => new UserCardResource($r->reporter),
                'reason' => $r->reason->value,
                'details' => $r->details,
                'createdAt' => $r->created_at->toISOString(),
            ])->values(),
        ];
    }

    /** Removes the reported content the way its own screen would, and tells the person why. */
    private function takeDown(ReportTarget $target, int $id, string $note, int $adminId): void
    {
        $why = $note !== '' ? ": {$note}" : '.';
        switch ($target) {
            case ReportTarget::Work:
                $work = Work::forAccess($id) ?? throw new HttpException(404, 'That work no longer exists.');
                $work->forceFill(['removed_at' => now()])->save();
                Notifier::notify($work->authorIds(), 'work_removed', "An admin removed “{$work->title}” from the feed{$why}", "/works/{$work->id}", $adminId);
                break;

            case ReportTarget::Comment:
                $comment = Comment::find($id) ?? throw new HttpException(404, 'That comment was already deleted.');
                $comment->delete();
                Notifier::notify($comment->author_id, 'comment_removed', "An admin removed your comment{$why}", "/works/{$comment->work_id}", $adminId);
                break;

            case ReportTarget::Message:
                $message = Message::whereNull('deleted_at')->find($id) ?? throw new HttpException(404, 'That message was already deleted.');
                $file = $message->file;
                $message->forceFill(['deleted_at' => now(), 'text' => '', 'file' => null, 'file_name' => null, 'file_type' => null, 'file_size' => null, 'group_file_id' => null])->save();
                Uploads::delete($file);
                Chat::announce($message->conversation_id, $message->id, $message->parent_id, deleted: true);
                Notifier::notify($message->sender_id, 'message_removed', "An admin removed one of your messages{$why}", "/messages/{$message->conversation_id}", $adminId);
                break;

            case ReportTarget::Event:
                // Rejected rather than deleted, so registrations and ads stay on record
                $event = Event::find($id) ?? throw new HttpException(404, 'That event no longer exists.');
                $event->forceFill(['status' => ApprovalStatus::Rejected])->save();
                Notifier::notify($event->posted_by_id, 'event_rejected', "An admin took “{$event->title}” off the events list{$why}", "/events/{$event->id}", $adminId);
                break;

            case ReportTarget::User:
                throw new HttpException(422, 'People can’t be removed from here. Warn them, or change their role in Users & roles.');
        }
    }
}
