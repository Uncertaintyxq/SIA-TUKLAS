<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One fix from a "return with comments": the student ticks it, the adviser confirms it before re-approval.
 * The text is encrypted at rest.
 */
#[Fillable(['text'])]
class RevisionItem extends Model
{
    public $timestamps = false;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['done_by_student' => false, 'confirmed_by_adviser' => false];

    protected function casts(): array
    {
        return [
            'text' => 'encrypted',
            'done_by_student' => 'boolean',
            'confirmed_by_adviser' => 'boolean',
        ];
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class);
    }
}
