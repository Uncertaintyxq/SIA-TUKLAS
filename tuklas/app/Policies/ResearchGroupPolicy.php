<?php

namespace App\Policies;

use App\Models\ResearchGroup;
use App\Models\User;

/**
 * Research groups. Seats are adviser, mentor, leader or member; admins can act on any group.
 * Load `members` before checking. Anyone who may not open a group gets 404.
 */
class ResearchGroupPolicy
{
    /** The adviser, any member, or an admin. */
    public function open(User $user, ResearchGroup $group): bool
    {
        return $user->isAdmin() || $group->seatOf($user) !== null;
    }

    /** Members, roles, settings, channels and deletion: the adviser while they hold the moderation right, or an admin. */
    public function manage(User $user, ResearchGroup $group): bool
    {
        return $user->isAdmin() || ($group->adviser_id === $user->id && $user->hasRight('moderateGroups'));
    }

    /** Removing other people's messages and files: managers, and mentors who hold the moderation right. */
    public function moderate(User $user, ResearchGroup $group): bool
    {
        return $this->manage($user, $group) || ($group->seatOf($user) === 'mentor' && $user->hasRight('moderateGroups'));
    }

    /** Deadlines and new channels: moderators and the student group leader. */
    public function organize(User $user, ResearchGroup $group): bool
    {
        return $this->moderate($user, $group) || $group->seatOf($user) === 'leader';
    }

    /** Group announcements: the adviser or a mentor who holds the broadcast right, or an admin. */
    public function announce(User $user, ResearchGroup $group): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return in_array($group->seatOf($user), ['adviser', 'mentor'], true) && $user->hasRight('broadcast');
    }
}
