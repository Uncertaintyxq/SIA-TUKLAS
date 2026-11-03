<?php

namespace App\Models;

use App\Enums\FollowKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Someone following a person, a department or a keyword. `target` is the person's user id, the
 * department's name or the keyword as first followed (keywords match ignoring case).
 */
#[Fillable(['user_id', 'kind', 'target'])]
class Follow extends Model
{
    public const UPDATED_AT = null;

    /** How many things one person can follow */
    public const MAX = 200;

    protected $casts = ['kind' => FollowKind::class];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
