<?php

namespace Tests\Feature\Security;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/** EnsureAccountReady: confirmed email for everyone, 2FA for admins and educators (D6). */
class AccountReadyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['api', 'auth:sanctum', 'account.ready'])->get('/api/_probe', fn () => ['ok' => true]);
    }

    public function test_a_ready_student_gets_through(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/_probe')->assertOk();
    }

    public function test_an_unconfirmed_email_is_stopped(): void
    {
        $this->actingAs(User::factory()->unverified()->create())->getJson('/api/_probe')
            ->assertForbidden()
            ->assertJsonPath('code', 'email_unverified');
    }

    public function test_an_educator_without_two_factor_is_stopped(): void
    {
        $this->actingAs(User::factory()->educator()->withoutTwoFactor()->create())->getJson('/api/_probe')
            ->assertForbidden()
            ->assertJsonPath('code', 'two_factor_required');
    }

    public function test_an_admin_without_two_factor_is_stopped(): void
    {
        $this->actingAs(User::factory()->admin()->withoutTwoFactor()->create())->getJson('/api/_probe')
            ->assertForbidden()
            ->assertJsonPath('code', 'two_factor_required');
    }

    public function test_students_may_skip_two_factor(): void
    {
        $this->actingAs(User::factory()->withoutTwoFactor()->create())->getJson('/api/_probe')->assertOk();
    }

    public function test_demo_mode_relaxes_the_checks(): void
    {
        config(['tuklas.demo_mode' => true]);

        $this->actingAs(User::factory()->admin()->withoutTwoFactor()->unverified()->create())->getJson('/api/_probe')->assertOk();
    }
}
