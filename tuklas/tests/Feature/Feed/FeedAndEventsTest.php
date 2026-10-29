<?php

namespace Tests\Feature\Feed;

use App\Enums\ApprovalStatus;
use App\Models\Ad;
use App\Models\Event;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PLAN.md rule 3 (ads are academic only, need an admin) and the feed's "approved only" rule.
 * Demo events: 1, 2, 3, 5, 6 approved; 4 pending (Aquino). Ads: two approved, one pending (event 5).
 */
class FeedAndEventsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function event(array $overrides = []): array
    {
        return [
            'category' => 'colloquium', 'title' => 'Research Methods Clinic',
            'description' => 'Bring your methodology chapter and get feedback from faculty.',
            'venue' => 'Library Room 2', 'date' => now()->addDays(10)->toISOString(), 'capacity' => 30, ...$overrides,
        ];
    }

    public function test_the_feed_holds_approved_content_only(): void
    {
        $items = collect($this->actingAs(User::find(3))->getJson('/api/feed')->assertOk()->json('items'));

        $this->assertEqualsCanonicalizing([1, 2, 3, 7], $items->where('kind', 'work')->pluck('work.id')->all());
        $this->assertNotContains(4, $items->where('kind', 'event')->pluck('event.id')->all());
        $this->assertEqualsCanonicalizing([1, 2], $items->where('kind', 'opportunity')->pluck('opportunity.id')->all());
    }

    public function test_the_feed_searches_titles_and_keywords(): void
    {
        $byKeyword = $this->actingAs(User::find(3))->getJson('/api/feed?type=research&q=lora')->assertOk();
        $this->assertSame([1], array_column(array_column($byKeyword->json('items'), 'work'), 'id'));

        $people = $this->actingAs(User::find(3))->getJson('/api/feed?q=santos')->json('people');
        $this->assertSame(['msantos'], array_column($people, 'username'));
    }

    public function test_the_sidebar_shows_running_approved_ads_only(): void
    {
        $ads = $this->actingAs(User::find(1))->getJson('/api/feed/sidebar')->assertOk()->json('ads');

        $this->assertCount(2, $ads);
        $this->assertSame(['approved', 'approved'], array_column($ads, 'status'));
    }

    public function test_non_academic_events_are_refused(): void
    {
        $this->actingAs(User::find(4))->postJson('/api/events', $this->event(['category' => 'concert']))
            ->assertStatus(422)->assertJsonPath('error', 'Only academic events can be posted on Tuklas.');
    }

    public function test_students_and_unverified_educators_cannot_post_events(): void
    {
        $this->actingAs(User::find(2))->postJson('/api/events', $this->event())->assertForbidden();
        $this->actingAs(User::find(7))->postJson('/api/events', $this->event())
            ->assertForbidden()->assertJsonPath('error', 'An admin needs to verify your educator account first.');
    }

    public function test_an_educators_event_waits_for_an_admin_and_stays_hidden(): void
    {
        $response = $this->actingAs(User::find(4))->postJson('/api/events', $this->event(['status' => 'approved']))->assertCreated();
        $id = $response->json('id');

        $response->assertJsonPath('status', 'pending');
        $this->assertTrue(Notification::where('user_id', 6)->where('type', 'event_proposed')->exists());
        $this->actingAs(User::find(1))->getJson("/api/events/{$id}")->assertNotFound();
        $this->actingAs(User::find(1))->postJson("/api/events/{$id}/register")->assertNotFound();
        $this->actingAs(User::find(4))->getJson("/api/events/{$id}")->assertOk()->assertJsonPath('attendees', []);
    }

    public function test_an_admins_event_is_approved_straight_away(): void
    {
        $this->actingAs(User::find(6))->postJson('/api/events', $this->event())->assertCreated()->assertJsonPath('status', 'approved');
    }

    public function test_registration_respects_capacity(): void
    {
        Event::find(1)->update(['capacity' => 2]);

        $this->actingAs(User::find(2))->postJson('/api/events/1/register')->assertStatus(409)->assertJsonPath('error', 'This event is full.');
        $this->actingAs(User::find(1))->getJson('/api/events/1')->assertJsonPath('registered', true)->assertJsonPath('attendees', null);
    }

    public function test_an_ad_request_is_pending_and_its_image_private(): void
    {
        $id = $this->actingAs(User::find(4))->postJson('/api/events/1/ads', [
            'headline' => 'Come see the theses', 'startsAt' => now()->toISOString(), 'endsAt' => now()->addDays(30)->toISOString(),
        ])->assertCreated()->assertJsonPath('status', 'pending')->json('id');

        $png = "\x89PNG\r\n\x1a\n".str_repeat("\0", 32);
        $this->actingAs(User::find(4))
            ->call('PUT', "/api/ads/{$id}/image", [], [], [], ['HTTP_X_FILE_NAME' => 'ad.png', 'HTTP_ACCEPT' => 'application/json'], $png)
            ->assertNoContent();

        $this->actingAs(User::find(1))->get("/api/ads/{$id}/image")->assertNotFound();
        $this->signOut()->get("/api/ads/{$id}/image")->assertNotFound();
        $this->assertSame(ApprovalStatus::Pending, Ad::find($id)->status);
    }

    public function test_only_students_and_educators_apply_and_never_to_their_own_posting(): void
    {
        $this->actingAs(User::find(4))->postJson('/api/opportunities/1/apply', ['message' => 'Applying to myself'])->assertStatus(409);
        $this->actingAs(User::find(1))->postJson('/api/opportunities/1/apply', ['message' => 'I build LoRa meshes'])->assertCreated();
        $this->actingAs(User::find(1))->postJson('/api/opportunities/1/apply', ['message' => 'Again please'])->assertStatus(409);

        $mine = $this->actingAs(User::find(4))->getJson('/api/opportunities/mine')->assertOk()->json();
        $this->assertCount(2, $mine[array_search(1, array_column($mine, 'id'))]['applications']);
    }
}
