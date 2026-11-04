<?php

namespace App\Support;

use App\Enums\Role;
use App\Jobs\SendPushNotifications;
use App\Models\Notification;
use App\Models\User;
use App\Notifications\ActivityEmail;
use Illuminate\Support\Facades\Notification as MailNotifications;
use Illuminate\Support\Str;

/**
 * Writes in-app notifications, pushes them to open tabs, and emails a copy to people who asked for
 * that category (NotificationPrefs). The actor never notifies themselves.
 *
 * Types, so the client can pick an icon: work_submitted, work_resubmitted, work_under_review,
 * work_revision, work_approved, work_rejected, work_comment, work_removed, educator_signup,
 * educator_verified, educator_rights, event_proposed, event_approved, event_rejected,
 * event_cancelled, ad_requested, ad_approved, ad_rejected, honor_claimed, honor_verified,
 * honor_declined, group_added, group_role, group_deadline, group_deliverable, group_orphaned, adviser_left, opportunity_application, announcement, mention.
 */
class Notifier
{
    /** @param int|list<int> $userIds */
    public static function notify(int|array $userIds, string $type, string $message, string $link, ?int $actorId = null): void
    {
        $ids = array_values(array_unique(array_filter((array) $userIds, fn (int $id) => $id !== $actorId)));
        if ($ids === []) {
            return;
        }
        // Deleted accounts ("Former member") get nothing
        $ids = User::active()->whereIn('id', $ids)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if ($ids === []) {
            return;
        }

        $now = now();
        Notification::insert(array_map(fn (int $userId) => [
            'user_id' => $userId,
            'type' => $type,
            'message' => Str::limit($message, 297),
            'link' => $link,
            'read' => false,
            'created_at' => $now,
        ], $ids));

        // Open tabs refresh their updates (and announcements) right away.
        Realtime::pushTo($ids, ['type' => 'notification', 'kind' => $type]);

        // An email copy for people who chose email for this kind of update. Announcements send their
        // own, fuller email (AnnouncementPosted).
        if ($type !== 'announcement') {
            $emailTo = User::whereIn('id', $ids)->whereNotNull('email_verified_at')->get()->filter(fn (User $u) => NotificationPrefs::wantsEmail($u, $type));
            MailNotifications::send($emailTo, new ActivityEmail(Str::limit($message, 297), $link));
        }

        // A push notification on the phones and browsers of people who turned it on for this kind
        $pushTo = User::whereIn('id', $ids)->whereHas('pushSubscriptions')->get()
            ->filter(fn (User $u) => NotificationPrefs::wantsPush($u, $type))->modelKeys();
        if ($pushTo !== []) {
            SendPushNotifications::dispatch(array_values($pushTo), Str::limit($message, 297), $link);
        }
    }

    /**
     * Tell the admins: of one school (plus super-admins) when it's about that school's people or
     * content, or every admin when $institutionId is null (docs/decisions/0002).
     */
    public static function notifyAdmins(string $type, string $message, string $link, ?int $actorId = null, ?int $institutionId = null): void
    {
        $admins = User::active()->where('role', Role::Admin)
            ->when($institutionId !== null, fn ($q) => $q->where(fn ($w) => $w->where('is_super_admin', true)->orWhereNull('institution_id')->orWhere('institution_id', $institutionId)));
        self::notify($admins->pluck('id')->all(), $type, $message, $link, $actorId);
    }
}
