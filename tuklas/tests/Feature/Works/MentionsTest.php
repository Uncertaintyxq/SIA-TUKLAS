<?php

namespace Tests\Feature\Works;

use App\Models\Message;
use App\Models\Notification;
use App\Models\User;
use App\Models\Work;
use App\Support\Mentions;
use App\Support\Usernames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * @mentions. People (username): 1 Andrea (andrea), 2 Paolo (paolo), 3 Kim (kim), 4 Santos (msantos),
 * 5 Aquino (raquino), 6 Lea (lea, admin). Work 1 is Andrea's public work; work 6 is Kim's, in review
 * with Santos. Chat 1 is Andrea and Kim; chat 4 is #general of group 1 (Santos, Andrea, Kim, Aquino).
 */
class MentionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    /** @return list<int> who got a mention notification */
    private function mentioned(): array
    {
        return Notification::where('type', 'mention')->orderBy('user_id')->pluck('user_id')->all();
    }

    public function test_a_mention_in_a_public_discussion_notifies_the_people_named(): void
    {
        $this->actingAs(User::find(2))->postJson('/api/works/1/discussion', [
            'text' => 'Great work @andrea! @kim and @RAQUINO should read this. Email me at kim@tuklas.edu. @nobody @paolo',
        ])->assertCreated();

        // Andrea already hears about the comment as the author; Paolo wrote it; nobody doesn't exist
        $this->assertSame([3, 5], $this->mentioned());
        $note = Notification::where('type', 'mention')->where('user_id', 3)->first();
        $this->assertSame('Paolo Reyes mentioned you in the discussion on “'.Work::find(1)->title.'”.', $note->message);
        $this->assertSame('/works/1#discussion', $note->link);
    }

    public function test_a_review_thread_mention_only_reaches_people_who_can_read_the_thread(): void
    {
        $this->actingAs(User::find(4))->postJson('/api/works/6/comments', ['text' => 'Please check the sampling, @kim. cc @paolo @raquino @lea'])->assertCreated();

        // Kim (the author) is told about the comment already; Paolo and Aquino can't read the thread; Lea is an admin
        $this->assertSame([6], $this->mentioned());
        $this->assertStringNotContainsString('sampling', Notification::where('type', 'mention')->value('message'));
    }

    public function test_chat_mentions_reach_only_people_in_the_conversation(): void
    {
        $id = $this->actingAs(User::find(1))->postJson('/api/chat/conversations/1/messages', ['text' => '@kim @paolo look at this'])->assertCreated()->json('id');
        $this->assertSame([3], $this->mentioned());
        $this->assertSame("/messages/1?m={$id}", Notification::where('type', 'mention')->value('link'));
        $this->assertSame('Andrea Villanueva mentioned you in a message.', Notification::where('type', 'mention')->value('message'));

        Notification::query()->delete();
        $this->actingAs(User::find(3))->postJson('/api/chat/conversations/4/messages', ['text' => 'Ready, @msantos? (@paolo isn’t in the lab)'])->assertCreated();
        $this->assertSame([4], $this->mentioned());
        $this->assertStringStartsWith('Kim Dela Cruz mentioned you in #general (', Notification::where('type', 'mention')->value('message'));
    }

    public function test_editing_a_message_only_notifies_people_it_newly_mentions(): void
    {
        $id = $this->actingAs(User::find(3))->postJson('/api/chat/conversations/4/messages', ['text' => 'Meeting moved, @andrea'])->assertCreated()->json('id');
        $this->actingAs(User::find(3))->patchJson("/api/chat/messages/{$id}", ['text' => 'Meeting moved, @andrea and @raquino'])->assertOk();

        $this->assertSame([1, 5], $this->mentioned());
        $this->assertSame(1, Notification::where('type', 'mention')->where('user_id', 1)->count());

        // A reply links to the message it answers
        Notification::query()->delete();
        $this->actingAs(User::find(1))->postJson('/api/chat/conversations/4/messages', ['text' => 'Thanks @kim', 'parentId' => $id])->assertCreated();
        $this->assertSame("/messages/4?m={$id}", Notification::where('type', 'mention')->value('link'));
        $this->assertNotNull(Message::find($id));
    }

    public function test_everyone_in_a_group_channel_reaches_the_whole_group_once(): void
    {
        // Santos advises group 1 (Andrea leads it, Kim is a member, Aquino a mentor)
        $this->actingAs(User::find(4))->postJson('/api/chat/conversations/4/messages', ['text' => '@everyone lab meeting moved to 3 PM. @kim bring the kits'])->assertCreated();

        $this->assertSame([1, 3, 5], $this->mentioned());
        $this->assertSame(1, Notification::where('type', 'mention')->where('user_id', 3)->count());
        $this->assertStringStartsWith('Dr. Maria Santos mentioned everyone in #general (', Notification::where('type', 'mention')->value('message'));

        // The student leader may too ("@all" works the same)
        Notification::query()->delete();
        $this->actingAs(User::find(1))->postJson('/api/chat/conversations/4/messages', ['text' => 'Reminder for @all'])->assertCreated();
        $this->assertSame([3, 4, 5], $this->mentioned());
    }

    public function test_only_the_groups_organizers_can_mention_everyone(): void
    {
        // Kim is a plain member: her @everyone notifies no one, and the composer doesn't offer it
        $this->actingAs(User::find(3))->postJson('/api/chat/conversations/4/messages', ['text' => '@everyone hello'])->assertCreated();
        $this->assertSame([], $this->mentioned());
        $this->actingAs(User::find(3))->getJson('/api/chat/conversations/4')->assertJsonPath('conversation.canMentionAll', false);
        $this->actingAs(User::find(4))->getJson('/api/chat/conversations/4')->assertJsonPath('conversation.canMentionAll', true);

        // Never in a direct chat
        $this->actingAs(User::find(1))->postJson('/api/chat/conversations/1/messages', ['text' => '@everyone hi'])->assertCreated();
        $this->assertSame([], $this->mentioned());
        $this->actingAs(User::find(1))->getJson('/api/chat/conversations/1')->assertJsonPath('conversation.canMentionAll', false);
    }

    public function test_adding_everyone_in_an_edit_notifies_once_and_the_names_are_reserved(): void
    {
        $id = $this->actingAs(User::find(4))->postJson('/api/chat/conversations/4/messages', ['text' => 'Lab meeting moved'])->assertCreated()->json('id');
        $this->actingAs(User::find(4))->patchJson("/api/chat/messages/{$id}", ['text' => 'Lab meeting moved, @everyone'])->assertOk();
        $this->actingAs(User::find(4))->patchJson("/api/chat/messages/{$id}", ['text' => 'Lab meeting moved to Friday, @everyone'])->assertOk();
        $this->assertSame([1, 3, 5], $this->mentioned());

        $this->assertSame([], Mentions::usernames('@everyone @ALL'));
        $this->assertSame('everyone2', Usernames::unique('everyone@tuklas.edu'));
        $this->assertSame('all2', Usernames::unique('all@tuklas.edu'));
    }

    public function test_the_pattern_and_the_limit(): void
    {
        $this->assertSame(['andrea', 'former-member-12'], Mentions::usernames('@Andrea, (@former-member-12) andrea@school.edu x@andrea @a'));
        $twelve = implode(' ', array_map(fn ($i) => "@user{$i}", range(1, 12)));
        $this->assertCount(Mentions::MAX, Mentions::usernames($twelve));
    }

    public function test_mentions_have_their_own_notification_setting(): void
    {
        $this->actingAs(User::find(3))->getJson('/api/account/notifications')
            ->assertJsonPath('push.mentions', true)
            ->assertJsonPath('email.mentions', false);
    }
}
