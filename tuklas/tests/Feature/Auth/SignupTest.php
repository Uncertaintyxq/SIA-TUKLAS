<?php

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification as Notifications;
use Tests\TestCase;

class SignupTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function form(array $overrides = []): array
    {
        return [
            'name' => 'Andrea Villanueva',
            'email' => 'Andrea.V@tuklas.edu',
            'password' => 'a long enough passphrase',
            'role' => 'student',
            'program' => 'BS Computer Engineering',
            'privacy' => true,
            ...$overrides,
        ];
    }

    public function test_a_student_signs_up_and_must_confirm_their_email(): void
    {
        Notifications::fake();

        $this->postJson('/api/auth/register', $this->form())
            ->assertCreated()
            ->assertJsonPath('user.username', 'andreav')
            ->assertJsonPath('user.email', 'andrea.v@tuklas.edu')
            ->assertJsonPath('user.emailVerified', false);

        $user = User::firstWhere('email', 'andrea.v@tuklas.edu');
        $this->assertSame(Role::Student, $user->role);
        $this->assertNotNull($user->profile);
        $this->assertSame(config('tuklas.privacy_version'), $user->privacy_version);
        $this->assertStringStartsWith('$argon2id$', $user->password);
        Notifications::assertSentTo($user, VerifyEmail::class);
    }

    public function test_an_educator_starts_unverified_and_admins_are_told(): void
    {
        $admin = User::factory()->admin()->create();

        $this->postJson('/api/auth/register', $this->form(['role' => 'educator']))->assertCreated()->assertJsonPath('user.verified', false);

        $this->assertTrue(Notification::where('user_id', $admin->id)->where('type', 'educator_signup')->exists());
    }

    public function test_nobody_can_sign_up_as_an_admin(): void
    {
        $this->postJson('/api/auth/register', $this->form(['role' => 'admin']))->assertStatus(422)->assertJsonStructure(['error', 'issues' => ['role']]);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_the_privacy_notice_must_be_accepted(): void
    {
        $this->postJson('/api/auth/register', $this->form(['privacy' => false]))
            ->assertStatus(422)
            ->assertJsonPath('error', 'Please read and accept the privacy notice to create an account.');
    }

    public function test_short_passwords_are_refused(): void
    {
        $this->postJson('/api/auth/register', $this->form(['password' => 'tuklas123']))->assertStatus(422)->assertJsonStructure(['issues' => ['password']]);
    }

    public function test_a_taken_email_is_refused(): void
    {
        User::factory()->create(['email' => 'andrea.v@tuklas.edu']);

        $this->postJson('/api/auth/register', $this->form())->assertStatus(422)->assertJsonPath('error', 'That email already has an account. Try logging in.');
    }
}
