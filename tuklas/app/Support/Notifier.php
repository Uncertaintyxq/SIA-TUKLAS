<?php

namespace App\Support;

use App\Enums\Role;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Writes in-app notifications and pushes them to open tabs. The actor never notifies themselves.
 *
 * Types, so the client can pick an icon: work_submitted, work_resubmitted, work_under_review,
 * work_revision, work_approved, work_rejected, work_comment, work_removed, educator_signup,
 * educator_verified, educator_rights, event_proposed, event_approved, event_rejected,
 * event_cancelled, ad_requested, ad_approved, ad_rejected, honor_claimed, honor_verified,
 * honor_declined, group_added, group_role, group_deadline, opportunity_application, announcement.
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
    }

    /** Notifies every admin account, skipping the actor. */
    public static function notifyAdmins(string $type, string $message, string $link, ?int $actorId = null): void
    {
        self::notify(User::where('role', Role::Admin)->pluck('id')->all(), $type, $message, $link, $actorId);
    }
}
