<?php

namespace Tests;

use App\Enums\Role;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Requests come from the React app's origin, so Sanctum treats them as a cookie session (SPA auth).
        $this->withHeaders(['Referer' => config('app.url').'/']);
        // Uploads and seeded files go to a throwaway disk, never storage/app/private
        Storage::fake('local');
        // Emails aren't rendered unless a test asks: almost every action notifies someone, and rendering
        // each email triples the suite's time. Tests about email fake again and assert (and the email
        // templates have their own rendering test in NotificationSettingsTest).
        Notification::fake();
    }

    /**
     * The demo data, with 2FA set up for the educators and admin (tests run with demo mode off, so
     * EnsureAccountReady applies). People: 1 Andrea, 2 Paolo, 3 Kim (students), 4 Santos, 5 Aquino
     * (educators), 6 Lea (admin), 7 Javier (educator awaiting verification).
     */
    protected function seedDemo(): void
    {
        $this->seed(DemoSeeder::class);
        User::whereIn('role', [Role::Educator, Role::Admin])->get()->each(fn (User $u) => $u->forceFill([
            'two_factor_secret' => encrypt(app(TwoFactorAuthenticationProvider::class)->generateSecretKey()),
            'two_factor_recovery_codes' => encrypt('[]'),
            'two_factor_confirmed_at' => now(),
        ])->save());
    }

    /** Ends the session set by actingAs(), so the next request is a signed-out visitor. */
    protected function signOut(): static
    {
        $this->app['auth']->forgetGuards();

        return $this;
    }
}
