<?php

namespace Tests\Feature\Chat;

use App\Events\RealtimePush;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Demo chats: 1 Andrea–Kim, 2 Andrea–Santos, 3 Santos–Aquino (direct); 4 #general and
 * 5 #chapter-3-methods (group 1); 6 #general (group 2).
 */
class ChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_direct_chats_are_private_to_their_two_people(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/chat/conversations/1')->assertOk()->assertJsonCount(5, 'messages');
        $this->actingAs(User::find(2))->getJson('/api/chat/conversations/1')->assertNotFound();
        $this->actingAs(User::find(6))->getJson('/api/chat/conversations/1')->assertNotFound();
    }

    public function test_channels_follow_group_membership(): void
    {
        $this->actingAs(User::find(3))->getJson('/api/chat/conversations/4')->assertOk();
        $this->actingAs(User::find(2))->getJson('/api/chat/conversations/4')->assertNotFound();
        // Admins can read any group's channels
        $this->actingAs(User::find(6))->getJson('/api/chat/conversations/4')->assertOk();
    }

    public function test_sending_stores_encrypted_text_and_pushes_a_notice_without_the_text(): void
    {
        Event::fake([RealtimePush::class]);

        $id = $this->actingAs(User::find(1))->postJson('/api/chat/conversations/1/messages', ['text' => 'Gateway is charged'])
            ->assertCreated()->assertJsonPath('text', 'Gateway is charged')->json('id');

        $this->assertStringNotContainsString('Gateway', DB::table('messages')->where('id', $id)->value('text'));
        Event::assertDispatched(RealtimePush::class, fn (RealtimePush $e) => $e->event === ['type' => 'message', 'conversationId' => 1, 'messageId' => $id, 'parentId' => null]
            && array_diff([1, 3], $e->userIds) === []);
    }

    public function test_unread_counts_follow_the_read_marker(): void
    {
        $this->actingAs(User::find(3))->postJson('/api/chat/conversations/1/messages', ['text' => 'Hello?'])->assertCreated();

        $before = $this->actingAs(User::find(1))->getJson('/api/chat/unread')->json('messages');
        $this->actingAs(User::find(1))->postJson('/api/chat/conversations/1/read')->assertNoContent();
        $this->assertLessThan($before, $this->actingAs(User::find(1))->getJson('/api/chat/unread')->json('messages'));
    }

    public function test_only_students_and_educators_open_direct_chats(): void
    {
        $this->actingAs(User::find(6))->postJson('/api/chat/direct', ['userId' => 1])->assertStatus(400);
        $this->actingAs(User::find(1))->postJson('/api/chat/direct', ['userId' => 1])->assertStatus(400);
        $this->assertSame(1, $this->actingAs(User::find(3))->postJson('/api/chat/direct', ['userId' => 1])->assertOk()->json('id'));
    }

    public function test_senders_and_group_moderators_remove_messages(): void
    {
        $kims = Message::where('conversation_id', 4)->where('sender_id', 3)->first();

        $this->actingAs(User::find(1))->deleteJson("/api/chat/messages/{$kims->id}")->assertForbidden();
        // Aquino mentors the lab and holds the moderation right
        $this->actingAs(User::find(5))->deleteJson("/api/chat/messages/{$kims->id}")->assertNoContent();
        $this->actingAs(User::find(3))->getJson('/api/chat/conversations/4')->assertJsonFragment(['id' => $kims->id, 'deleted' => true, 'text' => '']);
    }

    public function test_search_finds_conversations_by_person_or_channel(): void
    {
        $byPerson = $this->actingAs(User::find(1))->getJson('/api/chat/search?q=kim')->assertOk()->json();
        $this->assertSame([1], array_column(array_column($byPerson, 'conversation'), 'id'));

        $byChannel = $this->actingAs(User::find(1))->getJson('/api/chat/search?q=methods')->json();
        $this->assertSame([5], array_column(array_column($byChannel, 'conversation'), 'id'));
    }

    public function test_threads_hold_replies(): void
    {
        $question = Message::where('conversation_id', 5)->whereNull('parent_id')->orderByDesc('id')->first();

        $this->actingAs(User::find(3))->getJson("/api/chat/messages/{$question->id}/replies")->assertOk()->assertJsonCount(2, 'replies');
        $this->actingAs(User::find(2))->getJson("/api/chat/messages/{$question->id}/replies")->assertNotFound();
    }
}
