<?php

namespace App\Policies;

use App\Models\Publication;
use App\Models\User;

/** Educator research. Load `coAuthors` before checking. Anyone who may not read it gets 404. */
class PublicationPolicy
{
    /** Public: anyone, signed in or not. School only: its school's members. Draft: its authors only (Publication::canBeReadBy). */
    public function view(?User $user, Publication $publication): bool
    {
        return $publication->canBeReadBy($user);
    }

    /** Only the main author edits. */
    public function update(User $user, Publication $publication): bool
    {
        return $publication->author_id === $user->id;
    }

    /** The main author removes their research; an admin of its school can take it down. */
    public function delete(User $user, Publication $publication): bool
    {
        return $publication->author_id === $user->id || $user->administers($publication->institution_id);
    }
}
