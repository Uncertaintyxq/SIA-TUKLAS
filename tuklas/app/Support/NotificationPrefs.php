<?php

namespace App\Support;

use App\Enums\Role;
use App\Models\User;

/**
 * Which updates also arrive by email or as a push notification on a phone or browser. In-app
 * notifications always arrive; each person chooses email and push per category
 * (users.notification_settings), plus an optional weekly digest. A category nobody has chosen for
 * uses its defaults. Push only reaches devices that turned it on (push_subscriptions).
 */
class NotificationPrefs
{
    /** key => [label, description, email default, push default, roles that see it (null: everyone)] */
    public const CATEGORIES = [
        'research' => ['Your research and reviews', 'Submissions, review decisions, comments from your panel, defense stages.', true, true, null],
        'groups' => ['Research groups', 'Being added to a group, new deadlines, deliverables handed in or reviewed.', true, true, null],
        'announcements' => ['Announcements', 'Announcements for your department, your groups or everyone.', true, false, null],
        'events' => ['Events and opportunities', 'Your events and ads approved or cancelled, applications to your opportunities.', false, false, null],
        'account' => ['Your account', 'Verification, rights, honors, and moderation outcomes such as reports you made.', true, true, null],
        'queue' => ['Approval queue', 'New educators, events, ads, honors and reports waiting for an admin.', false, false, [Role::Admin]],
    ];

    /** The category a notification type belongs to (Notifier's types). */
    public static function categoryOf(string $type): string
    {
        return match (true) {
            in_array($type, ['educator_signup', 'event_proposed', 'ad_requested', 'honor_claimed', 'report_new'], true) => 'queue',
            str_starts_with($type, 'work_'), $type === 'adviser_left' => 'research',
            str_starts_with($type, 'group_') => 'groups',
            $type === 'announcement' => 'announcements',
            str_starts_with($type, 'event_'), str_starts_with($type, 'ad_'), str_starts_with($type, 'opportunity_') => 'events',
            default => 'account',
        };
    }

    /**
     * Someone's settings with the defaults filled in, limited to the categories their role sees.
     *
     * @return array{email: array<string, bool>, push: array<string, bool>, digest: bool}
     */
    public static function for(User $user): array
    {
        $saved = $user->notification_settings ?? [];
        $email = $push = [];
        foreach (self::visibleTo($user) as $key => [, , $emailDefault, $pushDefault]) {
            $email[$key] = (bool) ($saved['email'][$key] ?? $emailDefault);
            $push[$key] = (bool) ($saved['push'][$key] ?? $pushDefault);
        }

        return ['email' => $email, 'push' => $push, 'digest' => (bool) ($saved['digest'] ?? false)];
    }

    /** @return array<string, array{0: string, 1: string, 2: bool, 3: bool, 4: ?list<Role>}> */
    public static function visibleTo(User $user): array
    {
        return array_filter(self::CATEGORIES, fn ($c) => $c[4] === null || in_array($user->role, $c[4], true));
    }

    /** Whether this person wants an email for this type. Only confirmed addresses get email. */
    public static function wantsEmail(User $user, string $type): bool
    {
        return $user->email_verified_at !== null && ! $user->isDeleted()
            && (self::for($user)['email'][self::categoryOf($type)] ?? false);
    }

    /** Whether this person wants a push notification for this type (on the devices they turned it on for). */
    public static function wantsPush(User $user, string $type): bool
    {
        return ! $user->isDeleted() && (self::for($user)['push'][self::categoryOf($type)] ?? false);
    }
}
