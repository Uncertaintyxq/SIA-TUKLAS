<?php

namespace Tests\Feature\Publications;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Demo publications: 1 public, 2 internal, 3 draft (Santos); 4 public, 5 internal (Aquino). */
class PublicationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function form(array $overrides = []): array
    {
        return [
            'title' => 'Barangay Alert Wording Study', 'abstract' => 'How the wording of flood alerts changes evacuation decisions in riverside barangays.',
            'keywords' => ['DRR'], 'methodology' => 'Survey', 'fullText' => '', 'coAuthorIds' => [], 'visibility' => 'public', ...$overrides,
        ];
    }

    public function test_the_library_shows_public_research_to_visitors_and_internal_to_members(): void
    {
        $this->assertEqualsCanonicalizing([1, 4], array_column($this->getJson('/api/publications')->assertOk()->json(), 'id'));
        $this->assertEqualsCanonicalizing([1, 2, 4, 5], array_column($this->actingAs(User::find(1))->getJson('/api/publications')->json(), 'id'));
    }

    public function test_drafts_are_the_authors_alone(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/publications/3')->assertNotFound();
        $this->actingAs(User::find(6))->getJson('/api/publications/3')->assertNotFound();
        $this->actingAs(User::find(4))->getJson('/api/publications/3')->assertOk()->assertJsonPath('can.publish', true);
        $this->signOut()->getJson('/api/publications/2')->assertNotFound();
    }

    public function test_only_verified_educators_with_the_right_publish(): void
    {
        $this->actingAs(User::find(1))->postJson('/api/publications', $this->form())->assertForbidden();
        $this->actingAs(User::find(7))->postJson('/api/publications', $this->form())->assertForbidden()
            ->assertJsonPath('error', 'An admin needs to verify your educator account first.');

        User::find(5)->forceFill(['can_publish' => false])->save();
        $this->actingAs(User::find(5))->postJson('/api/publications', $this->form())->assertForbidden()
            ->assertJsonPath('error', 'An admin has turned off your publishing right. You can still save drafts.');
        $this->actingAs(User::find(5))->postJson('/api/publications', $this->form(['visibility' => 'draft']))->assertCreated();
    }

    public function test_only_the_main_author_edits(): void
    {
        // Andrea is a co-author of publication 1
        $this->actingAs(User::find(1))->putJson('/api/publications/1', $this->form())->assertForbidden();
        $this->actingAs(User::find(4))->putJson('/api/publications/3', $this->form())->assertNoContent();
        $this->assertNotNull($this->signOut()->getJson('/api/publications/3')->assertOk()->json('publishedAt'));
    }

    public function test_notifications_are_the_owners_alone(): void
    {
        $andrea = User::find(1);
        $response = $this->actingAs($andrea)->getJson('/api/notifications')->assertOk();
        $this->assertSame(Notification::where('user_id', 1)->where('read', false)->count(), $response->json('unread'));

        $someoneElses = Notification::where('user_id', 4)->value('id');
        $this->actingAs($andrea)->postJson('/api/notifications/read', ['ids' => [$someoneElses]])->assertNoContent();
        $this->assertFalse(Notification::find($someoneElses)->read);

        $this->actingAs($andrea)->postJson('/api/notifications/read')->assertNoContent();
        $this->actingAs($andrea)->getJson('/api/notifications')->assertJsonPath('unread', 0);
    }
}
