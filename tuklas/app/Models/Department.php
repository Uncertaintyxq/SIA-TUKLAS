<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Once;

/**
 * A department of one school (docs/decisions/0002), so "College of Computing" at two schools stays
 * two departments. Admins keep each school's list; people pick theirs on their portfolio.
 */
#[Fillable(['institution_id', 'name'])]
class Department extends Model
{
    protected static function booted(): void
    {
        // Person and work cards read departments through byId(); a change must show at once
        static::saved(fn () => Once::flush());
        static::deleted(fn () => Once::flush());
    }

    /** @return BelongsTo<Institution, $this> */
    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class);
    }

    /** @return HasMany<Announcement, $this> */
    public function announcements(): HasMany
    {
        return $this->hasMany(Announcement::class);
    }

    /** @return HasMany<Profile, $this> */
    public function profiles(): HasMany
    {
        return $this->hasMany(Profile::class);
    }

    /** @return array{id: int, name: string, institution: array{id: int, name: string, shortName: string}|null} */
    public function card(): array
    {
        $school = $this->institution_id !== null ? Institution::byId()->get($this->institution_id) : null;

        return ['id' => $this->id, 'name' => $this->name, 'institution' => $school?->card()];
    }

    /**
     * Every department by id, read once per request (cards show one on every row).
     *
     * @return Collection<int, Department>
     */
    public static function byId(): Collection
    {
        return once(fn () => self::orderBy('name')->get()->keyBy('id'));
    }
}
