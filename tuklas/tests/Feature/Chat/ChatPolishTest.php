<?php

namespace Tests\Feature\Chat;

use App\Events\RealtimePush;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** Editing, reactions and "Seen by". Chat 1 is Andrea (1) and Kim (3); Paolo (2) isn't in it. */
class ChatPolishTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function send(int $userId, string $text): int
    {
        return $this->actingAs(User::find($userId))->postJson('/api/chat/conversations/1/messages', ['text' => $text])->assertCreated()->json('id');
    }

    public function test_the_sender_can_edit_their_message_and_it_shows_edited(): void
    {
        Event::fake([RealtimePush::class]);
        $id = $this->send(1, 'Meet at 3?');

        $this->actingAs(User::find(1))->patchJson("/api/chat/messages/{$id}", ['text' => 'Meet at 4?'])
            ->assertOk()->assertJsonPath('text', 'Meet at 4?')->assertJsonPath('canEdit', true);
        $this->assertNotNull(Message::find($id)->edited_at);
        // Still encrypted at rest
        $this->assertStringNotContainsString('Meet', DB::table('messages')->where('id', $id)->value('text'));
        Event::assertDispatched(RealtimePush::class, fn (RealtimePush $e) => $e->event === ['type' => 'message_changed', 'conversationId' => 1, 'messageId' => $id]);

        $latest = collect($this->actingAs(User::find(3))->getJson('/api/chat/conversations/1')->assertOk()->json('messages'))->last();
        $this->assertSame($id, $latest['id']);
        $this->assertNotNull($latest['editedAt']);
        $this->assertFalse($latest['canEdit'], 'Kim can’t edit Andrea’s message');
    }

    public function test_only_the_sender_edits_and_only_while_the_message_is_there(): void
    {
        $id = $this->send(1, 'Draft is up');

        $this->actingAs(User::find(3))->patchJson("/api/chat/messages/{$id}", ['text' => 'Changed'])->assertForbidden();
        $this->actingAs(User::find(2))->patchJson("/api/chat/messages/{$id}", ['text' => 'Changed'])->assertNotFound();
        $this->actingAs(User::find(1))->patchJson("/api/chat/messages/{$id}", ['text' => '  '])->assertStatus(422);

        $this->actingAs(User::find(1))->deleteJson("/api/chat/messages/{$id}")->assertNoContent();
        $this->actingAs(User::find(1))->patchJson("/api/chat/messages/{$id}", ['text' => 'Back'])->assertNotFound();
    }

    public function test_reactions_toggle_and_show_who_reacted(): void
    {
        $id = $this->send(1, 'Chapter 3 is done!');

        $this->actingAs(User::find(3))->postJson("/api/chat/messages/{$id}/reactions", ['emoji' => '🎉'])
            ->assertOk()->assertJsonPath('reactions.0.emoji', '🎉')->assertJsonPath('reactions.0.count', 1)->assertJsonPath('reactions.0.mine', true);
        $both = $this->actingAs(User::find(1))->postJson("/api/chat/messages/{$id}/reactions", ['emoji' => '🎉'])->assertJsonPath('reactions.0.count', 2);
        $this->assertEqualsCanonicalizing([User::find(3)->name, User::find(1)->name], $both->json('reactions.0.people'));
        // Again takes it back
        $this->actingAs(User::find(3))->postJson("/api/chat/messages/{$id}/reactions", ['emoji' => '🎉'])
            ->assertJsonPath('reactions.0.count', 1)->assertJsonPath('reactions.0.mine', false);

        $this->actingAs(User::find(3))->postJson("/api/chat/messages/{$id}/reactions", ['emoji' => '💩'])->assertStatus(422);
        $this->actingAs(User::find(2))->postJson("/api/chat/messages/{$id}/reactions", ['emoji' => '👍'])->assertNotFound();
    }

    public function test_seen_by_follows_the_read_marker_and_only_announces_real_reads(): void
    {
        $this->travel(-1)->minutes();
        $this->actingAs(User::find(3))->postJson('/api/chat/conversations/1/read')->assertNoContent();
        $this->travelBack();
        $id = $this->send(1, 'Did you see the comments?');

        $readers = $this->actingAs(User::find(1))->getJson('/api/chat/conversations/1')->assertOk()->json('readers');
        $this->assertSame([3], array_column($readers, 'id'));
        $sentAt = Message::find($id)->created_at;
        $this->assertTrue(now()->parse($readers[0]['readAt'])->lt($sentAt), 'Kim hasn’t read it yet');

        Event::fake([RealtimePush::class]);
        $this->travel(5)->seconds();
        $this->actingAs(User::find(3))->postJson('/api/chat/conversations/1/read')->assertNoContent();
        Event::assertDispatched(RealtimePush::class, fn (RealtimePush $e) => $e->event['type'] === 'conversation_read' && $e->userIds === [1]);

        // Reading again with nothing new tells nobody, so two open tabs can't keep waking each other
        Event::fake([RealtimePush::class]);
        $this->actingAs(User::find(3))->postJson('/api/chat/conversations/1/read')->assertNoContent();
        Event::assertNotDispatched(RealtimePush::class);

        $readAt = $this->actingAs(User::find(1))->getJson('/api/chat/conversations/1')->json('readers.0.readAt');
        $this->assertTrue(now()->parse($readAt)->gte($sentAt));
    }
}
