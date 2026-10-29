<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_answers_the_same_for_unknown_emails(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'andrea@tuklas.edu']);

        $known = $this->postJson('/api/auth/forgot-password', ['email' => 'andrea@tuklas.edu']);
        $unknown = $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@tuklas.edu']);

        $known->assertOk();
        $unknown->assertOk();
        $this->assertSame($known->json(), $unknown->json());
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use ($user) {
            return str_starts_with($n->toMail($user)->actionUrl, config('app.url').'/reset-password?token=');
        });
    }

    public function test_a_reset_sets_the_new_password_and_ends_old_sessions(): void
    {
        $user = User::factory()->create(['email' => 'andrea@tuklas.edu']);
        $token = Password::createToken($user);
        \DB::table('sessions')->insert(['id' => 'old', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => 'andrea@tuklas.edu',
            'password' => 'a brand new passphrase',
            'password_confirmation' => 'a brand new passphrase',
        ])->assertOk();

        $this->assertDatabaseMissing('sessions', ['id' => 'old']);
        $this->postJson('/api/auth/login', ['email' => 'andrea@tuklas.edu', 'password' => UserFactory::PASSWORD])->assertStatus(422);
        $this->postJson('/api/auth/login', ['email' => 'andrea@tuklas.edu', 'password' => 'a brand new passphrase'])->assertOk();
    }
}
