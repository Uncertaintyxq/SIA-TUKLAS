<?php

namespace App\Models;

use App\Enums\GroupRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A seat in a research group. Keyed by (research_group_id, user_id). */
#[Fillable(['research_group_id', 'user_id', 'role'])]
class GroupMember extends Model
{
    public $timestamps = false;

    protected $primaryKey = null;

    public $incrementing = false;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['role' => 'member'];

    protected function casts(): array
    {
        return [
            'role' => GroupRole::class,
            'added_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ResearchGroup::class, 'research_group_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
