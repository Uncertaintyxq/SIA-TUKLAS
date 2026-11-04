<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Once;

/**
 * A school or university on this Tuklas site (docs/decisions/0002). Super-admins add and edit them;
 * a school is turned off (active = false), never deleted, because its people and work point at it.
 */
#[Fillable(['name', 'short_name', 'email_domains', 'active'])]
class Institution extends Model
{
    protected $casts = ['email_domains' => 'array', 'active' => 'boolean'];

    protected static function booted(): void
    {
        // Person cards read schools through all(); a change must show at once
        static::saved(fn () => Once::flush());
    }

    /** Schools people can still sign up to. */
    public function scopeActive(Builder $query): void
    {
        $query->where('active', true);
    }

    /** @return HasMany<User, $this> */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** The label person cards show: the short name, or the name when there's none. */
    public function label(): string
    {
        return $this->short_name !== '' ? $this->short_name : $this->name;
    }

    /** @return array{id: int, name: string, shortName: string} */
    public function card(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'shortName' => $this->short_name];
    }

    /**
     * Every school by id, read once per request (person cards show one on every row).
     *
     * @return Collection<int, Institution>
     */
    public static function byId(): Collection
    {
        return once(fn () => self::all()->keyBy('id'));
    }

    /** The active school an email address belongs to by its domain (subdomains count), if any. */
    public static function forEmail(string $email): ?self
    {
        $domain = mb_strtolower((string) substr(strrchr($email, '@') ?: '', 1));
        if ($domain === '') {
            return null;
        }

        return self::active()->get()->first(fn (self $i) => collect($i->email_domains ?? [])
            ->contains(fn ($d) => $domain === $d || str_ends_with($domain, '.'.$d)));
    }
}
