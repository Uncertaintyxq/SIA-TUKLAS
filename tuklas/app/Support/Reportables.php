<?php

namespace App\Support;

use App\Enums\ApprovalStatus;
use App\Enums\CommentScope;
use App\Enums\ConversationKind;
use App\Enums\ReportTarget;
use App\Models\Comment;
use App\Models\ConversationMember;
use App\Models\Event;
use App\Models\Message;
use App\Models\User;
use App\Models\Work;
use Illuminate\Support\Facades\Gate;

/** The things people can report: finding them as the reporter sees them, and describing them for admins. */
class Reportables
{
    /**
     * What's being reported, if the reporter can see it (null otherwise: hidden and missing look the same).
     *
     * @return array{owner: ?int, snapshot: string}|null
     */
    public static function find(ReportTarget $type, int $id, User $viewer): ?array
    {
        switch ($type) {
            case ReportTarget::Work:
                $work = Work::forAccess($id);

                return $work && Gate::forUser($viewer)->allows('view', $work) ? ['owner' => $work->author_id, 'snapshot' => $work->title] : null;

            case ReportTarget::Comment:
                // Only the public discussion: review comments stay between the student and the panel
                $comment = Comment::where('scope', CommentScope::Public)->find($id);
                $work = $comment ? Work::forAccess($comment->work_id) : null;

                return $work && Gate::forUser($viewer)->allows('view', $work) ? ['owner' => $comment->author_id, 'snapshot' => $comment->text] : null;

            case ReportTarget::Message:
                $message = Message::with('conversation.group')->whereNull('deleted_at')->find($id);
                if ($message === null) {
                    return null;
                }
                $c = $message->conversation;
                $sees = $c->kind === ConversationKind::Direct
                    ? ConversationMember::where('conversation_id', $c->id)->where('user_id', $viewer->id)->exists()
                    : $c->group !== null && Gate::forUser($viewer)->allows('open', $c->group);

                return $sees ? ['owner' => $message->sender_id, 'snapshot' => $message->text !== '' ? $message->text : "File: {$message->file_name}"] : null;

            case ReportTarget::Event:
                $event = Event::find($id);

                return $event && ($event->status === ApprovalStatus::Approved || $event->posted_by_id === $viewer->id)
                    ? ['owner' => $event->posted_by_id, 'snapshot' => $event->title] : null;

            case ReportTarget::User:
                $user = User::active()->find($id);

                return $user ? ['owner' => $user->id, 'snapshot' => $user->name] : null;
        }
    }

    /**
     * How a reported thing stands now, for the admin queue: still there, already taken down, and
     * where to look at it (null when admins can't open it, like a direct chat).
     *
     * @return array{exists: bool, removed: bool, link: ?string}
     */
    public static function describe(ReportTarget $type, int $id): array
    {
        $gone = ['exists' => false, 'removed' => false, 'link' => null];

        switch ($type) {
            case ReportTarget::Work:
                $work = Work::find($id, ['id', 'removed_at']);

                return $work ? ['exists' => true, 'removed' => $work->removed_at !== null, 'link' => "/works/{$id}"] : $gone;

            case ReportTarget::Comment:
                $comment = Comment::find($id, ['id', 'work_id']);

                return $comment ? ['exists' => true, 'removed' => false, 'link' => "/works/{$comment->work_id}"] : $gone;

            case ReportTarget::Message:
                $message = Message::with('conversation:id,kind')->find($id, ['id', 'conversation_id', 'deleted_at']);
                if ($message === null) {
                    return $gone;
                }

                return [
                    'exists' => $message->deleted_at === null,
                    'removed' => $message->deleted_at !== null,
                    'link' => $message->conversation->kind === ConversationKind::Channel ? "/messages/{$message->conversation_id}" : null,
                ];

            case ReportTarget::Event:
                $event = Event::find($id, ['id', 'status']);

                return $event ? ['exists' => true, 'removed' => $event->status === ApprovalStatus::Rejected, 'link' => "/events/{$id}"] : $gone;

            case ReportTarget::User:
                $user = User::find($id, ['id', 'username', 'account_deleted_at']);

                return $user && ! $user->isDeleted() ? ['exists' => true, 'removed' => false, 'link' => "/u/{$user->username}"] : $gone;
        }
    }

    /** How the person whose content it is hears about it: "your comment", "“Title”". */
    public static function nameFor(ReportTarget $type, string $snapshot): string
    {
        return match ($type) {
            ReportTarget::Work, ReportTarget::Event => '“'.mb_strimwidth($snapshot, 0, 80, '…').'”',
            ReportTarget::Comment => 'your comment',
            ReportTarget::Message => 'your message',
            ReportTarget::User => 'your account',
        };
    }
}
