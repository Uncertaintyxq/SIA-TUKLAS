<?php

namespace App\Models\Concerns;

use App\Enums\Audience;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * An opportunity or event posted for its school or for every school (docs/decisions/0002).
 * `institution_id` is the poster's school when it was posted; the poster column is posterKey().
 */
trait HasAudience
{
    /** The column holding who posted it */
    abstract protected function posterKey(): string;

    /** Every school, or this person's school, or they posted it, or they're its school's admin. */
    public function canBeSeenBy(?User $user): bool
    {
        if ($this->audience === Audience::All) {
            return true;
        }

        return $user !== null && ($user->institution_id === $this->institution_id
            || $this->{$this->posterKey()} === $user->id || $user->administers($this->institution_id));
    }

    /** Same meaning as canBeSeenBy(), for queries. */
    public function scopeVisibleTo(Builder $query, ?User $user): void
    {
        if ($user?->isSuperAdmin()) {
            return;
        }
        $query->where(fn (Builder $q) => $q
            ->where('audience', Audience::All)
            ->when($user, fn (Builder $w) => $w
                ->orWhere(fn (Builder $s) => $user->institution_id === null ? $s->whereNull('institution_id') : $s->where('institution_id', $user->institution_id))
                ->orWhere($this->posterKey(), $user->id)));
    }
}
