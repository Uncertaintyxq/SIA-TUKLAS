<?php

namespace Tests\Feature\Announcements;

use App\Models\User;
use App\Notifications\AnnouncementPosted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Demo announcements: 1–2 system (Lea), 3 College of Computing department (Santos),
 * 4 group 1 (Santos), 5 group 2 (Aquino). Andrea and Santos are in the College of Computing.
 */
class AnnouncementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_people_see_system_their_department_and_their_groups_only(): void
    {
        $ids = fn (int $user) => array_column($this->actingAs(User::find($user))->getJson('/api/announcements')->assertOk()->json('items'), 'id');

        $this->assertEqualsCanonicalizing([1, 2, 3, 4], $ids(1)); // Andrea: computing + lab
        $this->assertEqualsCanonicalizing([1, 2, 5], $ids(2));    // Paolo: literature + writers circle
        $this->assertEqualsCanonicalizing([1, 2, 3, 4, 5], $ids(6)); // admin
        $this->actingAs(User::find(2))->getJson('/api/announcements/4/receipts')->assertNotFound();
    }

    public function test_only_admins_post_to_everyone(): void
    {
        $this->actingAs(User::find(4))->postJson('/api/announcements', ['scope' => 'system', 'title' => 'Hello all', 'body' => 'Hi'])
            ->assertForbidden()->assertJsonPath('error', 'Only admins can post to everyone.');
        $this->actingAs(User::find(1))->postJson('/api/announcements', ['scope' => 'group', 'groupId' => 1, 'title' => 'Hello lab', 'body' => 'Hi'])
            ->assertForbidden();
    }

    public function test_an_educator_announces_to_their_own_department_whatever_they_ask_for(): void
    {
        Notification::fake();

        $id = $this->actingAs(User::find(4))->postJson('/api/announcements', [
            'scope' => 'department', 'department' => 'Department of Literature', 'title' => 'Colloquium rooms', 'body' => 'Rooms 301–304.',
        ])->assertCreated()->json('id');

        $this->assertNotContains($id, array_column($this->actingAs(User::find(2))->getJson('/api/announcements')->json('items'), 'id'));
        $this->assertContains($id, array_column($this->actingAs(User::find(1))->getJson('/api/announcements')->json('items'), 'id'));
        Notification::assertSentTo(User::find(1), AnnouncementPosted::class);
        Notification::assertNotSentTo(User::find(2), AnnouncementPosted::class);
    }

    public function test_read_receipts_count_the_audience(): void
    {
        $this->actingAs(User::find(3))->postJson('/api/announcements/4/read')->assertNoContent();
        $this->actingAs(User::find(1))->postJson('/api/announcements/4/read')->assertNoContent();

        $receipts = $this->actingAs(User::find(4))->getJson('/api/announcements/4/receipts')->assertOk()->json();
        $this->assertEqualsCanonicalizing(['andrea', 'kim'], array_column($receipts['read'], 'username'));
        $this->assertSame(['raquino'], array_column($receipts['unread'], 'username'));
    }

    public function test_only_the_author_or_an_admin_edits(): void
    {
        $this->actingAs(User::find(1))->patchJson('/api/announcements/4', ['title' => 'Changed'])->assertNotFound();
        $this->actingAs(User::find(4))->patchJson('/api/announcements/4', ['pinned' => false])->assertNoContent();
        $this->actingAs(User::find(6))->deleteJson('/api/announcements/4')->assertNoContent();
    }
}
