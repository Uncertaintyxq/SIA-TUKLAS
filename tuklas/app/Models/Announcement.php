<?php

namespace App\Models;

use App\Enums\AnnouncementScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A system, department or group announcement. The body uses Tuklas's light markup (App\Support\Markup).
 *
 * @property-read bool|null $read_by_me Whether the viewer has read it (AnnouncementController)
 */
#[Fillable(['scope', 'department', 'research_group_id', 'title', 'body', 'pinned'])]
class Announcement extends Model
{
    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['pinned' => false];

    protected $casts = [
        'scope' => AnnouncementScope::class,
        'pinned' => 'boolean',
    ];

    /** What someone may read: everything for admins; otherwise system-wide, their department, their groups, their own. */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        if ($user->isAdmin()) {
            return;
        }
        $department = trim((string) $user->profile?->department);
        $groupIds = ResearchGroup::where('adviser_id', $user->id)->orWhereHas('members', fn ($m) => $m->where('user_id', $user->id))->pluck('id');

        $query->where(fn ($q) => $q
            ->where('scope', AnnouncementScope::System)
            ->when($department !== '', fn ($w) => $w->orWhere(fn ($d) => $d->where('scope', AnnouncementScope::Department)->where('department', $department)))
            ->orWhere(fn ($g) => $g->where('scope', AnnouncementScope::Group)->whereIn('research_group_id', $groupIds))
            ->orWhere('author_id', $user->id));
    }

    /** @return list<int> Everyone this announcement is for. */
    public function audienceIds(): array
    {
        return match ($this->scope) {
            AnnouncementScope::System => User::active()->pluck('id')->all(),
            AnnouncementScope::Department => Profile::where('department', $this->department ?? '')->pluck('user_id')->all(),
            AnnouncementScope::Group => ResearchGroup::with('members')->find($this->research_group_id)?->participantIds() ?? [],
        };
    }

    /** "Everyone", the department, or the group's name. Needs `group` loaded. */
    public function audienceLabel(): string
    {
        return match ($this->scope) {
            AnnouncementScope::System => 'Everyone',
            AnnouncementScope::Department => $this->department ?? 'Department',
            AnnouncementScope::Group => $this->group->name ?? 'Research group',
        };
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /** @return BelongsTo<ResearchGroup, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(ResearchGroup::class, 'research_group_id');
    }

    /** @return HasMany<AnnouncementAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(AnnouncementAttachment::class);
    }

    /** @return BelongsToMany<User, $this> */
    public function readers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'announcement_reads')->withPivot('read_at');
    }
}
