<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['title', 'due_at'])]
class GroupDeadline extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['due_at' => 'datetime'];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ResearchGroup::class, 'research_group_id');
    }
}
