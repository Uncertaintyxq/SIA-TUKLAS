<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use App\Enums\EventCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An academic event. A non-admin's event is always saved as pending; only approved events are listed.
 * `status` is never mass-assignable.
 */
#[Fillable(['category', 'title', 'description', 'venue', 'date', 'capacity'])]
class Event extends Model
{
    public const UPDATED_AT = null;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['status' => 'pending'];

    protected function casts(): array
    {
        return [
            'category' => EventCategory::class,
            'status' => ApprovalStatus::class,
            'date' => 'datetime',
        ];
    }

    public function postedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by_id');
    }

    public function attendees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'event_registrations')->withPivot('created_at');
    }

    public function ads(): HasMany
    {
        return $this->hasMany(Ad::class);
    }
}
