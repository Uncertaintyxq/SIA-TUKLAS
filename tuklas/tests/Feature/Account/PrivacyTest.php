<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Data Privacy Act rights: export, sessions, consent. */
class PrivacyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_the_export_holds_my_data_and_none_of_my_secrets(): void
    {
        $response = $this->actingAs(User::find(1))->get('/api/account/export')
            ->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="tuklas-data-andrea.json"');

        $data = $response->json();
        $this->assertSame('andrea@tuklas.edu', $data['account']['email']);
        $this->assertNotEmpty($data['messages']);
        $this->assertContains('Offline-First Flood Alert Mesh for Barangay Responders', array_column($data['works'], 'title'));
        $this->assertStringNotContainsString('$argon2id$', $response->getContent());
        $this->assertStringNotContainsString('two_factor_secret', $response->getContent());
    }

    public function test_signing_out_other_sessions_needs_the_password(): void
    {
        $me = User::factory()->create();
        DB::table('sessions')->insert(['id' => 'laptop', 'user_id' => $me->id, 'payload' => '', 'last_activity' => time(), 'user_agent' => 'Firefox']);

        $this->actingAs($me)->getJson('/api/account/sessions')->assertOk()->assertJsonPath('0.userAgent', 'Firefox')->assertJsonMissing(['id' => 'laptop']);
        $this->actingAs($me)->postJson('/api/account/sessions/logout-others', ['password' => 'wrong'])->assertStatus(422);
        $this->actingAs($me)->postJson('/api/account/sessions/logout-others', ['password' => UserFactory::PASSWORD])->assertNoContent();

        $this->assertDatabaseMissing('sessions', ['id' => 'laptop']);
    }

    public function test_consent_to_a_new_notice_is_recorded(): void
    {
        $me = User::factory()->create(['privacy_version' => 'old']);
        $this->actingAs($me)->getJson('/api/auth/me')->assertJsonPath('user.privacyAccepted', false);

        $this->actingAs($me)->postJson('/api/account/privacy', ['accept' => true])->assertNoContent();

        $this->actingAs($me)->getJson('/api/auth/me')->assertJsonPath('user.privacyAccepted', true);
    }
}
