<?php

namespace App\Models;

use App\Enums\ReactionKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One reaction per reader per work. The key is (user_id, work_id), so change rows with
 * Reaction::upsert() or a where()->delete(), not save() on a loaded model.
 */
#[Fillable(['user_id', 'work_id', 'kind'])]
class Reaction extends Model
{
    public const UPDATED_AT = null;

    protected $primaryKey = null;

    public $incrementing = false;

    protected function casts(): array
    {
        return ['kind' => ReactionKind::class];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function work(): BelongsTo
    {
        return $this->belongsTo(Work::class);
    }
}
