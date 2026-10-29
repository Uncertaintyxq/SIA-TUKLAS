<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * A Tuklas account. The role always comes from this row, never from anything the client sends.
 */
#[Fillable(['name', 'username', 'email', 'password', 'role', 'verified', 'program', 'headline', 'privacy_accepted_at', 'privacy_version'])]
#[Hidden(['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /** Educator rights an admin can grant or revoke from the admin dashboard. */
    public const RIGHTS = ['publish' => 'can_publish', 'moderateGroups' => 'can_moderate_groups', 'broadcast' => 'can_broadcast'];

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = [
        'headline' => '', 'verified' => true, 'can_publish' => true, 'can_moderate_groups' => true, 'can_broadcast' => true,
        'last_seen_at' => null, 'two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null,
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'verified' => 'boolean',
            'can_publish' => 'boolean',
            'can_moderate_groups' => 'boolean',
            'can_broadcast' => 'boolean',
            'last_seen_at' => 'datetime',
            'privacy_accepted_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    public function isEducator(): bool
    {
        return $this->role === Role::Educator;
    }

    public function isStudent(): bool
    {
        return $this->role === Role::Student;
    }

    /**
     * Admins hold every right. An educator holds a right once an admin has verified them,
     * unless an admin has revoked it. Students hold none.
     *
     * @param  'publish'|'moderateGroups'|'broadcast'  $right
     */
    public function hasRight(string $right): bool
    {
        if ($this->isAdmin()) {
            return true;
        }
        if (! $this->isEducator() || ! $this->verified) {
            return false;
        }

        return (bool) $this->{self::RIGHTS[$right]};
    }

    /** @return array{publish: bool, moderateGroups: bool, broadcast: bool} */
    public function rights(): array
    {
        return [
            'publish' => $this->hasRight('publish'),
            'moderateGroups' => $this->hasRight('moderateGroups'),
            'broadcast' => $this->hasRight('broadcast'),
        ];
    }

    /** Admins and educators must use two-factor sign-in (docs/CONVERSION.md D6). */
    public function mustUseTwoFactor(): bool
    {
        return $this->isAdmin() || $this->isEducator();
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_secret !== null && $this->two_factor_confirmed_at !== null;
    }

    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class);
    }

    public function links(): HasMany
    {
        return $this->hasMany(AcademicLink::class);
    }

    public function backgrounds(): HasMany
    {
        return $this->hasMany(Background::class);
    }

    public function honors(): HasMany
    {
        return $this->hasMany(Honor::class);
    }

    /** Works this person submitted. */
    public function works(): HasMany
    {
        return $this->hasMany(Work::class, 'author_id');
    }

    /** Works where this person is a co-author. */
    public function coAuthoredWorks(): BelongsToMany
    {
        return $this->belongsToMany(Work::class, 'work_authors')->withPivot('order');
    }

    public function advisedWorks(): HasMany
    {
        return $this->hasMany(Work::class, 'adviser_id');
    }

    public function savedWorks(): BelongsToMany
    {
        return $this->belongsToMany(Work::class, 'saved_works')->withPivot('created_at');
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(Opportunity::class, 'adviser_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class, 'posted_by_id');
    }

    public function advisedGroups(): HasMany
    {
        return $this->hasMany(ResearchGroup::class, 'adviser_id');
    }

    public function groupMemberships(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    /** Tuklas's in-app notifications (the bell). Laravel's notifications() is the unrelated mail/database channel. */
    public function appNotifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function publications(): HasMany
    {
        return $this->hasMany(Publication::class, 'author_id');
    }

    public function announcements(): HasMany
    {
        return $this->hasMany(Announcement::class, 'author_id');
    }

    /** Review decisions this person made on works. */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class, 'reviewer_id');
    }
}
