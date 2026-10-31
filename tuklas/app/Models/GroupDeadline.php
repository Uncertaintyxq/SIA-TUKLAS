<?php

namespace App\Models;

use App\Enums\SubmissionMode;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A date in a research group. With `submission_mode` set it's a deliverable students hand work in for. */
#[Fillable(['title', 'due_at', 'submission_mode', 'instructions'])]
class GroupDeadline extends Model
{
    public const UPDATED_AT = null;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['submission_mode' => 'none', 'instructions' => ''];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'submission_mode' => SubmissionMode::class,
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ResearchGroup::class, 'research_group_id');
    }

    public function deliverables(): HasMany
    {
        return $this->hasMany(DeliverableSubmission::class);
    }

    public function collectsWork(): bool
    {
        return $this->submission_mode !== SubmissionMode::None;
    }
}
