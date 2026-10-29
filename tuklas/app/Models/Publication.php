<?php

namespace App\Models;

use App\Enums\PublicationVisibility;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Research an educator drafts and publishes directly; the publishing right is the gate. */
#[Fillable(['title', 'abstract', 'keywords', 'methodology', 'full_text', 'visibility'])]
class Publication extends Model
{
    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['visibility' => 'draft'];

    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'visibility' => PublicationVisibility::class,
            'published_at' => 'datetime',
        ];
    }

    public function isAuthor(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $this->author_id === $user->id || $this->coAuthors->contains('id', $user->id);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /** Co-authors beyond the main author, in byline order. */
    public function coAuthors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'publication_authors')->withPivot('order')->orderByPivot('order');
    }
}
