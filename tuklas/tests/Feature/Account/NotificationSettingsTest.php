<?php

namespace Tests\Feature\Account;

use App\Models\User;
use App\Notifications\ActivityEmail;
use App\Notifications\WeeklyDigest;
use App\Support\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** People: 1 Andrea, 2 Paolo, 3 Kim (students), 4 Santos (educator), 6 Lea (admin). */
class NotificationSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_settings_start_from_the_defaults_and_the_approval_queue_is_only_for_admins(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/account/notifications')
            ->assertOk()
            ->assertJsonPath('email.research', true)
            ->assertJsonPath('email.events', false)
            ->assertJsonPath('digest', false)
            ->assertJsonMissingPath('email.queue')
            ->assertJsonPath('categories.0.key', 'research');

        $this->actingAs(User::find(6))->getJson('/api/account/notifications')->assertJsonPath('email.queue', false);
    }

    public function test_saving_settings(): void
    {
        $this->actingAs(User::find(1))->putJson('/api/account/notifications', ['email' => ['research' => false, 'events' => true], 'digest' => true])
            ->assertOk()
            ->assertJsonPath('email.research', false)
            ->assertJsonPath('email.events', true)
            // Categories not sent keep their value
            ->assertJsonPath('email.groups', true)
            ->assertJsonPath('digest', true);

        // A student can't switch on the admins' category, or anything unknown
        $this->actingAs(User::find(1))->putJson('/api/account/notifications', ['email' => ['queue' => true], 'digest' => false])->assertStatus(422);
        $this->actingAs(User::find(1))->putJson('/api/account/notifications', ['email' => ['nonsense' => true], 'digest' => false])->assertStatus(422);
    }

    public function test_notifications_are_emailed_only_for_the_categories_people_chose(): void
    {
        Notification::fake();
        User::find(2)->forceFill(['notification_settings' => ['email' => ['research' => false], 'digest' => false]])->save();

        Notifier::notify([1, 2], 'work_approved', 'Your work was approved.', '/works/1');
        Notifier::notify([1], 'event_approved', 'Your event was approved.', '/events/1');

        Notification::assertSentTo(User::find(1), ActivityEmail::class, fn ($n) => $n->message === 'Your work was approved.' && $n->link === '/works/1');
        Notification::assertNotSentTo(User::find(2), ActivityEmail::class);
        // Events are off by default
        Notification::assertSentToTimes(User::find(1), ActivityEmail::class, 1);
    }

    public function test_unconfirmed_addresses_and_the_actor_get_no_email(): void
    {
        Notification::fake();
        User::find(3)->forceFill(['email_verified_at' => null])->save();

        Notifier::notify([1, 3], 'group_deadline', 'New deadline.', '/groups/1', actorId: 1);

        Notification::assertNothingSent();
    }

    public function test_the_weekly_digest_goes_only_to_people_who_turned_it_on_and_have_something_new(): void
    {
        Notification::fake();
        User::find(1)->forceFill(['notification_settings' => ['email' => [], 'digest' => true]])->save();
        User::find(2)->forceFill(['notification_settings' => ['email' => [], 'digest' => true]])->save();
        User::find(2)->appNotifications()->update(['read' => true]);
        Notifier::notify([1], 'work_comment', 'Dr. Santos commented on your work.', '/works/1');

        Artisan::call('tuklas:weekly-digest');

        Notification::assertSentTo(User::find(1), WeeklyDigest::class, fn ($n) => in_array('Dr. Santos commented on your work.', $n->sections['Updates you haven’t read'], true));
        Notification::assertNotSentTo(User::find(3), WeeklyDigest::class);
        $this->assertStringContainsString('tuklas:weekly-digest', $this->scheduleList());
    }

    public function test_the_emails_render(): void
    {
        $user = User::find(1);

        $activity = (new ActivityEmail('Your work was approved.', '/works/1'))->toMail($user)->render();
        $this->assertStringContainsString('Your work was approved.', (string) $activity);
        $this->assertStringContainsString(url('/works/1'), (string) $activity);

        $digest = (new WeeklyDigest(['Group deadlines this week' => ['Chapter 3 draft (Flood group), due Mon, Nov 9, 5:00 PM']]))->toMail($user)->render();
        $this->assertStringContainsString('Chapter 3 draft', (string) $digest);
        $this->assertStringContainsString('Hello, '.e($user->name), (string) $digest);
    }

    private function scheduleList(): string
    {
        Artisan::call('schedule:list');

        return Artisan::output();
    }
}
