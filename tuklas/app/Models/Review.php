<?php

namespace App\Models;

use App\Enums\ReviewDecision;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One adviser or admin decision on a work. The comment is encrypted at rest. */
#[Fillable(['reviewer_id', 'decision', 'comment', 'version'])]
class Review extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'decision' => ReviewDecision::class,
            'comment' => 'encrypted',
        ];
    }

    public function work(): BelongsTo
    {
        return $this->belongsTo(Work::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function revisionItems(): HasMany
    {
        return $this->hasMany(RevisionItem::class);
    }
}
