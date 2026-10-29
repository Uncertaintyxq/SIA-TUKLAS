<?php

namespace Tests\Feature\Chat;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Tests\TestCase;

/** Reverb channel authorization: nobody can listen to someone else's updates. */
class RealtimeChannelsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test',
        ]);
        // Channels register on the driver that was active at boot (null in tests): register them on Reverb's.
        Broadcast::forgetDrivers();
        require base_path('routes/channels.php');
    }

    public function test_people_subscribe_to_their_own_channel_only(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($me)->postJson('/api/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-users.{$me->id}"])->assertOk();
        $this->actingAs($me)->postJson('/api/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-users.{$other->id}"])->assertForbidden();
    }

    public function test_signed_out_visitors_get_no_channels(): void
    {
        $this->postJson('/api/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-online'])->assertUnauthorized();
    }
}
