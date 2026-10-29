<?php

namespace App\Policies;

use App\Enums\Role;
use App\Enums\WorkStatus;
use App\Models\User;
use App\Models\Work;

/**
 * Student works (PLAN.md §2, rules 1 and 2). Load the work with Work::forAccess() so `coAuthors`
 * is there. Anyone who may not see a work gets 404, the same as a missing work.
 */
class WorkPolicy
{
    /** Public once approved and not removed. Drafts are the authors' alone; from submission on, the adviser and admins too. */
    public function view(?User $user, Work $work): bool
    {
        if ($work->isPublic()) {
            return true;
        }
        if ($user === null) {
            return false;
        }
        if ($work->isAuthor($user)) {
            return true;
        }
        if ($work->status === WorkStatus::Draft) {
            return false;
        }

        return $work->adviser_id === $user->id || $user->isAdmin();
    }

    /** Authors, the adviser and admins: the people who see versions, reviews and the private thread. */
    public function insider(?User $user, Work $work): bool
    {
        if ($user === null) {
            return false;
        }

        return $work->isAuthor($user)
            || ($work->status !== WorkStatus::Draft && ($work->adviser_id === $user->id || $user->isAdmin()));
    }

    /** The assigned adviser once an admin has verified them, or an admin acting as the panel. Never on your own work. */
    public function review(?User $user, Work $work): bool
    {
        if ($user === null || $work->isAuthor($user)) {
            return false;
        }
        if ($user->isAdmin()) {
            return true;
        }

        return $user->role === Role::Educator && $user->verified && $work->adviser_id === $user->id;
    }

    /** Only the submitting author edits and submits, and only while it's a draft or sent back. */
    public function edit(?User $user, Work $work): bool
    {
        return $user !== null
            && $work->author_id === $user->id
            && in_array($work->status, [WorkStatus::Draft, WorkStatus::Revision], true);
    }
}
