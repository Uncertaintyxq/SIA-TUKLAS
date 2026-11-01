<?php

namespace Tests\Feature\Account;

use App\Console\Commands\MakeVapidKeys;
use App\Jobs\SendPushNotifications;
use App\Models\PushSubscription;
use App\Models\User;
use App\Support\Notifier;
use App\Support\PushSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Minishlink\WebPush\ContentEncoding;
use Minishlink\WebPush\VAPID;
use Tests\TestCase;

/** People: 1 Andrea, 2 Paolo, 3 Kim (students). */
class PushNotificationsTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
        config(['tuklas.push.public_key' => 'BPublicKeyForTests', 'tuklas.push.private_key' => 'private']);
    }

    private function subscribe(int $userId, string $endpoint = self::ENDPOINT)
    {
        return $this->actingAs(User::find($userId))
            ->withHeader('User-Agent', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')
            ->postJson('/api/account/push', ['endpoint' => $endpoint, 'keys' => ['p256dh' => 'BKey', 'auth' => 'secret'], 'contentEncoding' => 'aes128gcm']);
    }

    public function test_turning_push_on_and_off_for_a_device(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/account/push?endpoint='.urlencode(self::ENDPOINT))
            ->assertOk()->assertJsonPath('available', true)->assertJsonPath('publicKey', 'BPublicKeyForTests')->assertJsonPath('thisDevice', false);

        $this->subscribe(1)->assertNoContent();
        $this->actingAs(User::find(1))->getJson('/api/account/push?endpoint='.urlencode(self::ENDPOINT))
            ->assertJsonPath('thisDevice', true)->assertJsonPath('devices.0.device', 'Chrome on Android');

        $this->actingAs(User::find(1))->deleteJson('/api/account/push', ['endpoint' => self::ENDPOINT])->assertNoContent();
        $this->assertSame(0, PushSubscription::count());
    }

    public function test_only_real_push_addresses_are_accepted_and_a_device_follows_whoever_signs_in(): void
    {
        $this->subscribe(1, 'http://evil.example/push')->assertStatus(422);

        $this->subscribe(1)->assertNoContent();
        $this->subscribe(2)->assertNoContent();
        $this->assertSame([2], PushSubscription::pluck('user_id')->all());
        // Someone else can't turn off a device that isn't theirs
        $this->actingAs(User::find(3))->deleteJson('/api/account/push', ['endpoint' => self::ENDPOINT])->assertNoContent();
        $this->assertSame(1, PushSubscription::count());
    }

    public function test_notifications_go_to_devices_of_people_who_want_that_kind(): void
    {
        $this->subscribe(1)->assertNoContent();
        $this->subscribe(2, self::ENDPOINT.'-paolo')->assertNoContent();
        User::find(2)->forceFill(['notification_settings' => ['email' => [], 'push' => ['research' => false], 'digest' => false]])->save();
        Queue::fake();

        Notifier::notify([1, 2, 3], 'work_approved', 'Your work was approved.', '/works/1');
        Notifier::notify([1], 'event_approved', 'Your event was approved.', '/events/1');

        // Kim has no device; Paolo turned research off; events are off by default
        Queue::assertPushed(SendPushNotifications::class, 1);
        Queue::assertPushed(SendPushNotifications::class, fn ($job) => $job->userIds === [1] && $job->link === '/works/1');
    }

    public function test_devices_that_unsubscribed_are_forgotten(): void
    {
        $this->subscribe(1)->assertNoContent();
        $this->subscribe(1, self::ENDPOINT.'-old')->assertNoContent();
        $gone = PushSubscription::where('endpoint', self::ENDPOINT.'-old')->value('id');
        $this->app->instance(PushSender::class, new class($gone) extends PushSender
        {
            public array $sent = [];

            public function __construct(private int $gone) {}

            public function send(Collection $subscriptions, array $payload): array
            {
                $this->sent[] = [$subscriptions->count(), $payload];

                return [$this->gone];
            }
        });

        (new SendPushNotifications([1], 'New deadline.', '/groups/1'))->handle(app(PushSender::class));

        $this->assertSame([[2, ['title' => 'Tuklas', 'body' => 'New deadline.', 'url' => '/groups/1']]], app(PushSender::class)->sent);
        $this->assertSame([self::ENDPOINT], PushSubscription::pluck('endpoint')->all());
    }

    public function test_push_choices_are_saved_with_the_email_ones(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/account/notifications')->assertJsonPath('push.research', true)->assertJsonPath('push.events', false);
        $this->actingAs(User::find(1))->putJson('/api/account/notifications', ['email' => [], 'push' => ['research' => false], 'digest' => false])
            ->assertOk()->assertJsonPath('push.research', false)->assertJsonPath('email.research', true);
    }

    public function test_the_service_worker_is_served_from_the_root_with_the_app_policy(): void
    {
        $dir = sys_get_temp_dir().'/tuklas-build-'.uniqid();
        mkdir($dir);
        file_put_contents("{$dir}/index.html", '<div id="root"></div>');
        file_put_contents("{$dir}/sw.js", 'self.addEventListener("push", () => {});');
        config(['tuklas.spa_index' => "{$dir}/index.html"]);

        $this->get('/sw.js')->assertOk()
            ->assertHeader('Service-Worker-Allowed', '/')
            ->assertHeader('Content-Security-Policy', config('tuklas.csp'))
            ->assertSee('addEventListener', false);
        $this->assertStringContainsString('no-cache', $this->get('/sw.js')->headers->get('Cache-Control'));

        unlink("{$dir}/sw.js");
        $this->get('/sw.js')->assertNotFound();
        unlink("{$dir}/index.html");
        rmdir($dir);
    }

    public function test_the_key_command_writes_a_pair_once(): void
    {
        $env = tempnam(sys_get_temp_dir(), 'env');
        file_put_contents($env, "APP_NAME=Tuklas\nWEBPUSH_PUBLIC_KEY=\nWEBPUSH_PRIVATE_KEY=\n");

        Artisan::call('tuklas:vapid-keys', ['--write' => $env]);
        $first = file_get_contents($env);
        Artisan::call('tuklas:vapid-keys', ['--write' => $env]);

        $this->assertMatchesRegularExpression('/^WEBPUSH_PUBLIC_KEY=\S{80,}$/m', $first);
        $this->assertSame(1, substr_count($first, 'WEBPUSH_PUBLIC_KEY='));
        $this->assertSame($first, file_get_contents($env), 'The second run keeps the existing pair');
        unlink($env);

        // The web-push library accepts them, and can sign with them
        $keys = MakeVapidKeys::createKeys();
        $vapid = VAPID::validate(['subject' => 'https://tuklas.example', ...$keys]);
        $headers = VAPID::getVapidHeaders('https://fcm.googleapis.com', $vapid['subject'], $vapid['publicKey'], $vapid['privateKey'], ContentEncoding::aes128gcm);
        $this->assertStringStartsWith('vapid t=', $headers['Authorization']);
    }

    public function test_devices_go_with_a_deleted_account(): void
    {
        $this->subscribe(1)->assertNoContent();
        $this->actingAs(User::find(1))->deleteJson('/api/account', ['password' => 'tuklas123'])->assertNoContent();

        $this->assertSame(0, PushSubscription::count());
    }
}
