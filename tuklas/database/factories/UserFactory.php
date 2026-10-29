<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;

/**
 * Students by default, with a verified email. Use ->educator(), ->admin(), ->withTwoFactor().
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /** Password for every factory user. */
    public const PASSWORD = 'correct horse battery staple';

    protected static ?string $passwordHash;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'username' => Str::lower(Str::random(12)),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$passwordHash ??= Hash::make(self::PASSWORD),
            'role' => Role::Student,
            'verified' => true,
            'program' => 'BS Computer Science',
            'privacy_accepted_at' => now(),
            'privacy_version' => config('tuklas.privacy_version'),
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }

    /** A verified educator with 2FA set up, ready to review. */
    public function educator(): static
    {
        return $this->state(fn () => ['role' => Role::Educator, 'program' => 'College of Engineering'])->withTwoFactor();
    }

    /** An educator an admin hasn't verified yet. */
    public function unverifiedEducator(): static
    {
        return $this->educator()->state(fn () => ['verified' => false]);
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => Role::Admin, 'program' => 'Office of Research & Publications'])->withTwoFactor();
    }

    public function withTwoFactor(): static
    {
        return $this->state(fn () => [
            'two_factor_secret' => encrypt(app(TwoFactorAuthenticationProvider::class)->generateSecretKey()),
            'two_factor_recovery_codes' => encrypt(json_encode([Str::random(10).'-'.Str::random(10)])),
            'two_factor_confirmed_at' => now(),
        ]);
    }

    public function withoutTwoFactor(): static
    {
        return $this->state(fn () => ['two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null]);
    }
}
