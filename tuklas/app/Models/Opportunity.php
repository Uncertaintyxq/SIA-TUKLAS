<?php

namespace App\Models;

use App\Enums\OpportunityKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A mentorship, research grant or call for submissions an educator posts.
 *
 * @property-read bool|null $applied Whether the viewer applied (Cards::opportunities)
 */
#[Fillable(['kind', 'title', 'description', 'deadline', 'slots'])]
class Opportunity extends Model
{
    public const UPDATED_AT = null;

    protected $casts = [
        'kind' => OpportunityKind::class,
        'deadline' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function adviser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adviser_id');
    }

    /** @return HasMany<OpportunityApplication, $this> */
    public function applications(): HasMany
    {
        return $this->hasMany(OpportunityApplication::class);
    }
}
