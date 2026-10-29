<?php

namespace App\Models;

use App\Enums\DefenseStageKind;
use App\Enums\Verdict;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A stage on a work's defense tracker: proposal, colloquium, final defense, revisions, published. */
#[Fillable(['stage', 'date', 'panel', 'verdict', 'notes'])]
class DefenseStage extends Model
{
    public const UPDATED_AT = null;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['panel' => '', 'verdict' => 'pending', 'notes' => ''];

    protected function casts(): array
    {
        return [
            'stage' => DefenseStageKind::class,
            'verdict' => Verdict::class,
            'date' => 'datetime',
        ];
    }

    public function work(): BelongsTo
    {
        return $this->belongsTo(Work::class);
    }
}
