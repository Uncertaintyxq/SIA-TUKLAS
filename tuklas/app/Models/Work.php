<?php

namespace App\Models;

use App\Enums\WorkStatus;
use App\Enums\WorkType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A student's research, literary or innovation work. Private until approved; see WorkPolicy.
 * Status, approval and removal fields are never mass-assignable: only review actions change them.
 */
#[Fillable(['type', 'title', 'abstract', 'tags', 'adviser_id'])]
class Work extends Model
{
    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['status' => 'draft'];

    protected function casts(): array
    {
        return [
            'type' => WorkType::class,
            'status' => WorkStatus::class,
            'tags' => 'array',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'removed_at' => 'datetime',
        ];
    }

    /** Approved and not removed by an admin: the only works anyone may see. */
    public function isPublic(): bool
    {
        return $this->status === WorkStatus::Approved && $this->removed_at === null;
    }

    /** Same meaning as isPublic(), for queries that list works. */
    public function scopePublic(Builder $query): void
    {
        $query->where('status', WorkStatus::Approved)->whereNull('removed_at');
    }

    /** Just enough of a work to run WorkPolicy: the work and its co-author ids. */
    public static function forAccess(int $id): ?self
    {
        return self::with(['coAuthors' => fn ($q) => $q->select('users.id')])->find($id);
    }

    /** @return list<int> The submitting author and co-authors. Needs `coAuthors` loaded. */
    public function authorIds(): array
    {
        return [$this->author_id, ...$this->coAuthors->pluck('id')->all()];
    }

    /** The submitting author or a co-author. */
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

    public function adviser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adviser_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_id');
    }

    /** Co-authors beyond the submitting author, in byline order. */
    public function coAuthors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'work_authors')->withPivot('order')->orderByPivot('order');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(WorkVersion::class)->orderBy('version');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class)->orderBy('created_at');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class);
    }

    public function savedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'saved_works')->withPivot('created_at');
    }

    public function defenseStages(): HasMany
    {
        return $this->hasMany(DefenseStage::class)->orderBy('date');
    }
}
