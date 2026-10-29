<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_the_account_without_secrets(): void
    {
        $user = User::factory()->create(['email' => 'andrea@tuklas.edu']);

        $response = $this->postJson('/api/auth/login', ['email' => 'andrea@tuklas.edu', 'password' => UserFactory::PASSWORD]);

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'student')
            ->assertJsonPath('user.rights', ['publish' => false, 'moderateGroups' => false, 'broadcast' => false])
            ->assertJsonMissingPath('user.password')
            ->assertJsonMissingPath('user.two_factor_secret');
        $this->assertAuthenticatedAs($user);
        $this->assertTrue(AuditLog::where('action', 'login')->where('actor_id', $user->id)->exists());
    }

    public function test_wrong_password_and_unknown_email_get_the_same_answer(): void
    {
        User::factory()->create(['email' => 'andrea@tuklas.edu']);

        $wrong = $this->postJson('/api/auth/login', ['email' => 'andrea@tuklas.edu', 'password' => 'not the password']);
        $unknown = $this->postJson('/api/auth/login', ['email' => 'nobody@tuklas.edu', 'password' => 'not the password']);

        $wrong->assertStatus(422);
        $unknown->assertStatus(422);
        $this->assertSame($wrong->json('error'), $unknown->json('error'));
        $this->assertGuest();
    }

    public function test_repeated_failures_are_rate_limited(): void
    {
        User::factory()->create(['email' => 'andrea@tuklas.edu']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'andrea@tuklas.edu', 'password' => 'wrong'])->assertStatus(422);
        }

        $this->postJson('/api/auth/login', ['email' => 'andrea@tuklas.edu', 'password' => UserFactory::PASSWORD])
            ->assertStatus(429);
        $this->assertGuest();
    }

    public function test_an_account_with_two_factor_must_pass_the_challenge(): void
    {
        $educator = User::factory()->educator()->create(['email' => 'msantos@tuklas.edu']);

        $this->postJson('/api/auth/login', ['email' => 'msantos@tuklas.edu', 'password' => UserFactory::PASSWORD])
            ->assertOk()
            ->assertExactJson(['two_factor' => true]);

        $this->assertGuest();
        $this->postJson('/api/auth/two-factor-challenge', ['code' => '000000'])->assertStatus(422);
        $this->assertGuest();
    }

    public function test_me_is_401_when_signed_out(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401)->assertExactJson(['error' => 'Please log in to continue.']);
    }

    public function test_me_reports_what_setup_is_still_needed(): void
    {
        $educator = User::factory()->educator()->withoutTwoFactor()->unverified()->create();

        $this->actingAs($educator)->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.emailVerified', false)
            ->assertJsonPath('user.twoFactorEnabled', false)
            ->assertJsonPath('user.twoFactorRequired', true);
    }

    public function test_logout_ends_the_session(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/auth/logout')->assertNoContent();

        $this->assertGuest('web');
    }
}
