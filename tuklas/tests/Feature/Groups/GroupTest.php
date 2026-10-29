<?php

namespace Tests\Feature\Groups;

use App\Enums\GroupRole;
use App\Models\ConversationMember;
use App\Models\GroupMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Demo groups: 1 Disaster Informatics Lab (adviser Santos; Andrea leader, Kim member, Aquino mentor),
 * 2 Tinig Writers Circle (adviser Aquino; Paolo leader).
 */
class GroupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_only_people_in_a_group_and_admins_open_it(): void
    {
        $this->actingAs(User::find(2))->getJson('/api/groups/1')->assertNotFound();
        $this->actingAs(User::find(3))->getJson('/api/groups/1')
            ->assertOk()
            ->assertJsonPath('mySeat', 'member')
            ->assertJsonPath('can', ['manage' => false, 'moderate' => false, 'organize' => false, 'announce' => false])
            ->assertJsonPath('channels.0.name', 'general');
        $this->actingAs(User::find(6))->getJson('/api/groups/1')->assertOk()->assertJsonPath('mySeat', null)->assertJsonPath('can.manage', true);

        $this->assertSame([2], array_column($this->actingAs(User::find(2))->getJson('/api/groups')->json(), 'id'));
    }

    public function test_seats_decide_what_people_can_do(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/groups/1')->assertJsonPath('can.organize', true)->assertJsonPath('can.manage', false);
        $this->actingAs(User::find(5))->getJson('/api/groups/1')->assertJsonPath('can.moderate', true)->assertJsonPath('can.announce', true);
        $this->actingAs(User::find(4))->getJson('/api/groups/1')->assertJsonPath('can.manage', true);
    }

    public function test_students_cannot_start_groups_and_unverified_educators_are_told_why(): void
    {
        $this->actingAs(User::find(1))->postJson('/api/groups', ['name' => 'My Group'])->assertForbidden();
        $this->actingAs(User::find(7))->postJson('/api/groups', ['name' => 'My Group'])
            ->assertForbidden()->assertJsonPath('error', 'An admin needs to verify your educator account first.');

        $id = $this->actingAs(User::find(5))->postJson('/api/groups', ['name' => 'Poetry Lab'])->assertCreated()->json('id');
        $this->actingAs(User::find(5))->getJson("/api/groups/{$id}")->assertJsonPath('mySeat', 'adviser')->assertJsonCount(1, 'channels');
    }

    public function test_adding_a_member_joins_them_to_every_channel(): void
    {
        $this->actingAs(User::find(4))->postJson('/api/groups/1/members', ['userId' => 2])->assertCreated();

        $this->assertSame(GroupRole::Member, GroupMember::where('research_group_id', 1)->where('user_id', 2)->first()->role);
        $this->assertSame(2, ConversationMember::where('user_id', 2)->whereIn('conversation_id', [4, 5])->count());
        $this->actingAs(User::find(2))->getJson('/api/groups/1')->assertOk();
    }

    public function test_only_managers_add_members_and_unverified_educators_cannot_join(): void
    {
        $this->actingAs(User::find(1))->postJson('/api/groups/1/members', ['userId' => 2])->assertNotFound();
        $this->actingAs(User::find(4))->postJson('/api/groups/1/members', ['userId' => 7])->assertStatus(400);
    }

    public function test_a_group_has_one_leader(): void
    {
        $this->actingAs(User::find(4))->patchJson('/api/groups/1/members/3', ['role' => 'leader'])->assertNoContent();

        $this->assertSame(GroupRole::Member, GroupMember::where('research_group_id', 1)->where('user_id', 1)->first()->role);
        $this->assertSame(GroupRole::Leader, GroupMember::where('research_group_id', 1)->where('user_id', 3)->first()->role);
        $this->actingAs(User::find(4))->patchJson('/api/groups/1/members/5', ['role' => 'leader'])->assertStatus(400);
    }

    public function test_a_member_can_leave_and_loses_the_channels(): void
    {
        $this->actingAs(User::find(3))->deleteJson('/api/groups/1/members/3')->assertNoContent();

        $this->actingAs(User::find(3))->getJson('/api/groups/1')->assertNotFound();
        $this->assertSame(0, ConversationMember::where('user_id', 3)->whereIn('conversation_id', [4, 5])->count());
    }

    public function test_group_files_are_private_to_the_group_and_never_run_as_pages(): void
    {
        $this->actingAs(User::find(3))
            ->call('POST', '/api/groups/1/files', [], [], [], ['HTTP_X_FILE_NAME' => 'notes.html', 'CONTENT_TYPE' => 'text/html', 'HTTP_ACCEPT' => 'application/json'], '<html><script>alert(1)</script></html>')
            ->assertCreated();
        $fileId = $this->actingAs(User::find(3))->getJson('/api/groups/1')->json('files.0.id');

        $this->actingAs(User::find(3))->get("/api/groups/1/files/{$fileId}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/octet-stream')
            ->assertHeader('Content-Disposition', 'attachment; filename="notes.html"; filename*=UTF-8\'\'notes.html');
        $this->actingAs(User::find(2))->get("/api/groups/1/files/{$fileId}")->assertNotFound();
    }

    public function test_leaders_add_deadlines_and_everyone_is_told(): void
    {
        $this->actingAs(User::find(1))->postJson('/api/groups/1/deadlines', ['title' => 'Poster draft', 'dueAt' => now()->addWeek()->toISOString()])->assertCreated();
        $this->actingAs(User::find(3))->postJson('/api/groups/1/deadlines', ['title' => 'Nope', 'dueAt' => now()->addWeek()->toISOString()])->assertNotFound();

        $this->assertTrue(User::find(3)->appNotifications()->where('type', 'group_deadline')->where('message', 'like', '%Poster draft%')->exists());
    }

    public function test_channel_names_are_cleaned_up_and_general_stays(): void
    {
        $id = $this->actingAs(User::find(1))->postJson('/api/groups/1/channels', ['name' => 'Field Work'])->assertCreated()->json('id');
        $this->actingAs(User::find(1))->postJson('/api/groups/1/channels', ['name' => 'field work'])->assertStatus(409);
        $this->actingAs(User::find(1))->postJson('/api/groups/1/channels', ['name' => '<b>'])->assertStatus(422);

        $this->actingAs(User::find(4))->deleteJson('/api/groups/1/channels/4')->assertStatus(409);
        $this->actingAs(User::find(4))->deleteJson("/api/groups/1/channels/{$id}")->assertNoContent();
    }
}
