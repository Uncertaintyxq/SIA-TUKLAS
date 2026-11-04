<?php

namespace App\Models;

use App\Enums\PublicationVisibility;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Research an educator drafts and publishes directly; the publishing right is the gate.
 * `institution_id` is the main author's school when it was started: School only research stays with it.
 */
#[Fillable(['title', 'abstract', 'keywords', 'methodology', 'full_text', 'visibility'])]
class Publication extends Model
{
    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['visibility' => 'draft'];

    protected $casts = [
        'keywords' => 'array',
        'visibility' => PublicationVisibility::class,
        'published_at' => 'datetime',
    ];

    /** Public: anyone. School only (Internal): signed-in members of its school, its authors and admins. Draft: its authors. */
    public function canBeReadBy(?User $user): bool
    {
        return match ($this->visibility) {
            PublicationVisibility::Public => true,
            PublicationVisibility::Internal => $user !== null && ($user->isAdmin() || $user->institution_id === $this->institution_id || $this->isAuthor($user)),
            PublicationVisibility::Draft => $this->isAuthor($user),
        };
    }

    /** Published research this person may read (canBeReadBy() for lists; drafts never). */
    public function scopeReadableBy(Builder $query, ?User $user): void
    {
        if ($user?->isAdmin()) {
            $query->whereIn('visibility', [PublicationVisibility::Internal, PublicationVisibility::Public]);

            return;
        }
        $query->where(fn (Builder $q) => $q
            ->where('visibility', PublicationVisibility::Public)
            ->when($user, fn (Builder $w) => $w->orWhere(fn (Builder $s) => $s
                ->where('visibility', PublicationVisibility::Internal)
                ->where(fn (Builder $who) => $who
                    ->where(fn (Builder $i) => $user->institution_id === null ? $i->whereNull('institution_id') : $i->where('institution_id', $user->institution_id))
                    ->orWhere('author_id', $user->id)
                    ->orWhereHas('coAuthors', fn ($a) => $a->where('users.id', $user->id))))));
    }

    public function isAuthor(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $this->author_id === $user->id || $this->coAuthors->contains('id', $user->id);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Co-authors beyond the main author, in byline order.
     *
     * @return BelongsToMany<User, $this>
     */
    public function coAuthors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'publication_authors')->withPivot('order')->orderByPivot('order');
    }
}
