<?php

namespace App\Models;

use App\Enums\HonorKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An award, grant or certification. Shown as "Pending verification" until an admin verifies it.
 * `verified` is never mass-assignable: only the admin verify action sets it.
 */
#[Fillable(['kind', 'title', 'issuer', 'year'])]
class Honor extends Model
{
    public const UPDATED_AT = null;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['verified' => false];

    protected $casts = [
        'kind' => HonorKind::class,
        'verified' => 'boolean',
        'verified_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by_id');
    }
}
