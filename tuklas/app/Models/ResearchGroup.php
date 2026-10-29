<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An adviser-led research group with members, files, deadlines and chat channels.
 * Seats: adviser (owner), mentor (other educators), leader and member (students). See ResearchGroupPolicy.
 */
#[Fillable(['name', 'description'])]
class ResearchGroup extends Model
{
    public const UPDATED_AT = null;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['description' => ''];

    /** The viewer's seat ('adviser', 'leader', 'member', 'mentor'), or null when they aren't in it. */
    public function seatOf(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }
        if ($this->adviser_id === $user->id) {
            return 'adviser';
        }

        return $this->members->firstWhere('user_id', $user->id)?->role->value;
    }

    /** @return list<int> Everyone in the group, adviser first. */
    public function participantIds(): array
    {
        return [$this->adviser_id, ...$this->members->pluck('user_id')->all()];
    }

    public function adviser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adviser_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(GroupFile::class);
    }

    public function deadlines(): HasMany
    {
        return $this->hasMany(GroupDeadline::class)->orderBy('due_at');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(GroupActivity::class)->latest('created_at');
    }

    public function channels(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function announcements(): HasMany
    {
        return $this->hasMany(Announcement::class);
    }
}
