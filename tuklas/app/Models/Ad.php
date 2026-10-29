<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An academic ad slot: a promo for an approved event, shown in the feed sidebar between
 * starts_at and ends_at once an admin approves it. `status` is never mass-assignable.
 */
#[Fillable(['event_id', 'headline', 'starts_at', 'ends_at'])]
class Ad extends Model
{
    public const UPDATED_AT = null;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['status' => 'pending'];

    protected function casts(): array
    {
        return [
            'status' => ApprovalStatus::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }
}
