<?php

namespace App\Providers;

use App\Models\User;
use App\Support\Audit;
use Illuminate\Auth\Access\Response;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Events\Verified;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Events\RecoveryCodesGenerated;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if ($this->app->isProduction() && config('tuklas.demo_mode')) {
            throw new RuntimeException('DEMO_MODE must be off in production: it allows resetting all data and relaxes 2FA.');
        }

        // Catch lazy loading (N+1 queries), unknown attributes and silently dropped mass assignment while developing.
        Model::shouldBeStrict(! $this->app->isProduction());
        // API Resources return the object itself, not {data: …}, matching the existing API.
        JsonResource::withoutWrapping();

        // NIST SP 800-63B: length over composition rules, and no passwords from known breaches.
        // The breach check sends only the first 5 characters of the password's SHA-1 hash.
        Password::defaults(function () {
            $rule = Password::min(12)->max(128);

            return $this->app->runningUnitTests() ? $rule : $rule->uncompromised();
        });

        $this->rateLimits();
        $this->auditTrail();

        // Role gates for whole screens. Rules about one record live in app/Policies.
        Gate::define('review-works', fn (User $user) => $user->isEducator() || $user->isAdmin());
        Gate::define('admin', fn (User $user) => $user->isAdmin());
        // Posting events, ads and opportunities: admins, and educators once an admin has verified them.
        Gate::define('organize', fn (User $user) => match (true) {
            $user->isAdmin(), $user->isEducator() && $user->verified => Response::allow(),
            $user->isEducator() => Response::deny('An admin needs to verify your educator account first.'),
            default => Response::deny('You don’t have access to this.'),
        });
    }

    private function rateLimits(): void
    {
        $byUser = fn (Request $request) => $request->user()?->id ?: $request->ip();

        // Every API request (bootstrap/app.php throttleApi)
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($byUser($request)));
        // Fortify routes and /api/account: signup, forgot password, verification emails, 2FA setup,
        // sessions. Signed in, per account: setting up 2FA alone takes about eight requests. Signed
        // out, per IP, but loose enough for a campus behind one address; guessing passwords and
        // codes is held back per account by the `login` and `two-factor` limiters.
        RateLimiter::for('auth', fn (Request $request) => $request->user()
            ? Limit::perMinute(40)->by('user:'.$request->user()->id)
            : Limit::perMinute(20)->by('ip:'.$request->ip()));
        // Creating content: works, comments, events, opportunities, announcements, publications
        RateLimiter::for('posting', fn (Request $request) => Limit::perMinute(20)->by($byUser($request)));
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(20)->by($byUser($request)));
        RateLimiter::for('messages', fn (Request $request) => Limit::perMinute(40)->by($byUser($request)));
    }

    /** Security events in audit_logs. Admin actions are logged where they happen. */
    private function auditTrail(): void
    {
        Event::listen(Login::class, fn (Login $e) => Audit::log('login', $e->user));
        Event::listen(Logout::class, fn (Logout $e) => $e->user && Audit::log('logout', $e->user));
        // The attempted email is personal data and isn't stored; the account is linked when it exists.
        Event::listen(Failed::class, fn (Failed $e) => Audit::log('login_failed', null, $e->user instanceof User ? $e->user : null));
        Event::listen(Lockout::class, fn () => Audit::log('login_locked'));
        Event::listen(Registered::class, fn (Registered $e) => Audit::log('signup', $e->user, $e->user));
        Event::listen(Verified::class, fn (Verified $e) => Audit::log('email_verified', $e->user, $e->user));
        Event::listen(PasswordReset::class, fn (PasswordReset $e) => Audit::log('password_reset', $e->user, $e->user));
        Event::listen(TwoFactorAuthenticationConfirmed::class, fn ($e) => Audit::log('two_factor_enabled', $e->user, $e->user));
        Event::listen(TwoFactorAuthenticationDisabled::class, fn ($e) => Audit::log('two_factor_disabled', $e->user, $e->user));
        Event::listen(TwoFactorAuthenticationFailed::class, fn ($e) => Audit::log('two_factor_failed', null, $e->user));
        Event::listen(RecoveryCodesGenerated::class, fn ($e) => Audit::log('recovery_codes_regenerated', $e->user, $e->user));
    }
}
