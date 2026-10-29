<?php

namespace App\Policies;

use App\Enums\PublicationVisibility;
use App\Models\Publication;
use App\Models\User;

/** Educator research. Load `coAuthors` before checking. Anyone who may not read it gets 404. */
class PublicationPolicy
{
    /** Public: anyone, signed in or not. Internal: anyone signed in. Draft: its authors only. */
    public function view(?User $user, Publication $publication): bool
    {
        if ($publication->visibility === PublicationVisibility::Public) {
            return true;
        }
        if ($user === null) {
            return false;
        }

        return $publication->visibility === PublicationVisibility::Internal || $publication->isAuthor($user);
    }

    /** Only the main author edits. */
    public function update(User $user, Publication $publication): bool
    {
        return $publication->author_id === $user->id;
    }

    /** The main author removes their research; an admin can take it down. */
    public function delete(User $user, Publication $publication): bool
    {
        return $publication->author_id === $user->id || $user->isAdmin();
    }
}
