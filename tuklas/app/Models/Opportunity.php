<?php

namespace App\Models;

use App\Enums\Audience;
use App\Enums\OpportunityKind;
use App\Models\Concerns\HasAudience;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A mentorship, research grant or call for submissions an educator posts.
 *
 * @property-read bool|null $applied Whether the viewer applied (Cards::opportunities)
 */
#[Fillable(['kind', 'title', 'description', 'deadline', 'slots', 'audience'])]
class Opportunity extends Model
{
    use HasAudience;

    public const UPDATED_AT = null;

    protected $casts = [
        'audience' => Audience::class,
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

    protected function posterKey(): string
    {
        return 'adviser_id';
    }
}
