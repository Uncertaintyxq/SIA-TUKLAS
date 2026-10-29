<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A file in a research group's repository. `file` is the random stored name on the private disk. */
#[Fillable(['uploaded_by_id', 'name', 'file', 'type', 'size'])]
class GroupFile extends Model
{
    public const UPDATED_AT = null;

    public function group(): BelongsTo
    {
        return $this->belongsTo(ResearchGroup::class, 'research_group_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }
}
