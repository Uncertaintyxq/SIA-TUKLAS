<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What happened in a group: member_added, role_changed, file_shared, deadline_added, channel_created, … */
#[Fillable(['actor_id', 'action', 'detail'])]
class GroupActivity extends Model
{
    public const UPDATED_AT = null;

    public function group(): BelongsTo
    {
        return $this->belongsTo(ResearchGroup::class, 'research_group_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
