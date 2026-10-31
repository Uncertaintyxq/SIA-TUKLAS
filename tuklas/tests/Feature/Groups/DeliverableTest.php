<?php

namespace Tests\Feature\Groups;

use App\Models\Conversation;
use App\Models\DeliverableSubmission;
use App\Models\DeliverableVersion;
use App\Models\GroupDeadline;
use App\Models\Message;
use App\Models\Notification;
use App\Models\ResearchGroup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Deliverables in the demo's Disaster Informatics Lab (group 1: adviser Santos 4; Andrea 1 leader,
 * Kim 3 member, Aquino 5 mentor). Seeded: "Chapter 3" (each student; Andrea handed in, revision
 * asked) and "Chapter 2" (one for the group, accepted). Paolo 2 is in group 2 only.
 */
class DeliverableTest extends TestCase
{
    use RefreshDatabase;

    private const PDF = "%PDF-1.4\n%test\n";

    private int $chapter3;

    private int $chapter2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
        $this->chapter3 = GroupDeadline::where('title', 'like', 'Chapter 3%')->value('id');
        $this->chapter2 = GroupDeadline::where('title', 'like', 'Chapter 2%')->value('id');
    }

    private function handIn(int $userId, int $deadlineId, string $bytes = self::PDF, string $name = 'draft.pdf'): TestResponse
    {
        return $this->actingAs(User::find($userId))
            ->call('PUT', "/api/groups/1/deadlines/{$deadlineId}/submission", [], [], [], ['HTTP_X_FILE_NAME' => $name, 'CONTENT_TYPE' => 'application/pdf', 'HTTP_ACCEPT' => 'application/json'], $bytes);
    }

    public function test_a_student_hands_in_and_the_reviewers_are_told(): void
    {
        $this->handIn(3, $this->chapter3)
            ->assertCreated()
            ->assertJsonPath('status', 'submitted')
            ->assertJsonPath('version', 1)
            ->assertJsonPath('late', false)
            ->assertJsonPath('submittedBy.id', 3);

        $this->assertSame(1, Notification::where('user_id', 4)->where('type', 'group_deliverable')->count());
        $this->assertSame(1, Notification::where('user_id', 5)->where('type', 'group_deliverable')->count());
        $this->assertSame(0, Notification::where('user_id', 1)->where('type', 'group_deliverable')->count());
        $this->actingAs(User::find(4))->getJson('/api/groups/1')
            ->assertJsonPath('deadlines.2.handedIn', 2)
            ->assertJsonPath('deadlines.2.expected', 2);
    }

    public function test_handing_in_still_works_when_the_live_update_server_is_down(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test', 'broadcasting.connections.reverb.secret' => 'test', 'broadcasting.connections.reverb.app_id' => '1',
            'broadcasting.connections.reverb.options' => ['host' => '127.0.0.1', 'port' => 1, 'scheme' => 'http', 'useTLS' => false],
        ]);
        Broadcast::forgetDrivers();

        $this->handIn(3, $this->chapter3)->assertCreated();
        $this->assertSame(1, Notification::where('user_id', 4)->where('type', 'group_deliverable')->count());
    }

    public function test_handing_in_again_keeps_the_earlier_version_with_its_review(): void
    {
        $old = DeliverableSubmission::where('student_id', 1)->where('group_deadline_id', $this->chapter3)->first();

        $res = $this->handIn(1, $this->chapter3, name: 'chapter3-v2.pdf')
            ->assertOk()
            ->assertJsonPath('version', 2)
            ->assertJsonPath('status', 'submitted')
            ->assertJsonPath('feedback', null)
            ->assertJsonPath('name', 'chapter3-v2.pdf')
            ->assertJsonCount(1, 'history')
            ->assertJsonPath('history.0.version', 1)
            ->assertJsonPath('history.0.status', 'needs_revision')
            ->assertJsonPath('history.0.feedback', 'Good start. Add how you will choose the households, and attach the consent form in Filipino as well.');

        Storage::disk('local')->assertExists('uploads/'.$old->file);
        $this->assertSame(1, DeliverableSubmission::where('group_deadline_id', $this->chapter3)->where('student_id', 1)->count());

        // The earlier file opens for its student and the reviewers, not for classmates
        $earlier = $res->json('history.0.fileUrl');
        $this->assertStringEndsWith('/versions/1/file', $earlier);
        $this->actingAs(User::find(1))->get($earlier)->assertOk();
        $this->actingAs(User::find(4))->get($earlier)->assertOk();
        $this->actingAs(User::find(3))->get($earlier)->assertNotFound();
        $this->actingAs(User::find(1))->get(str_replace('/versions/1/', '/versions/9/', $earlier))->assertNotFound();
    }

    public function test_hand_ins_are_posted_in_general_without_the_file(): void
    {
        $general = Conversation::where('research_group_id', 1)->where('name', 'general')->first();

        $this->handIn(3, $this->chapter3)->assertCreated();

        $message = Message::where('conversation_id', $general->id)->latest('id')->first();
        $this->assertSame(3, $message->sender_id);
        $this->assertSame('Handed in “Chapter 3 (Methodology) draft due”.', $message->text);
        $this->assertNull($message->file);
        $this->assertNull($message->group_file_id);
        $this->actingAs(User::find(1))->getJson('/api/groups/1')->assertJsonPath('channels.0.unread', fn ($n) => $n >= 1);
    }

    public function test_work_handed_in_after_the_deadline_is_marked_late(): void
    {
        GroupDeadline::whereKey($this->chapter3)->update(['due_at' => now()->subDay()]);

        $this->handIn(3, $this->chapter3)->assertCreated()->assertJsonPath('late', true);
        $this->assertStringContainsString('(late)', Notification::where('user_id', 4)->where('type', 'group_deliverable')->value('message'));
    }

    public function test_students_see_only_their_own_work_and_reviewers_see_everyone(): void
    {
        $andrea = DeliverableSubmission::where('student_id', 1)->where('group_deadline_id', $this->chapter3)->value('id');
        $file = "/api/groups/1/deadlines/{$this->chapter3}/submissions/{$andrea}/file";

        $this->actingAs(User::find(3))->getJson("/api/groups/1/deadlines/{$this->chapter3}")
            ->assertOk()
            ->assertJsonPath('mine', null)
            ->assertJsonPath('can.submit', true)
            ->assertJsonMissingPath('submissions');
        $this->actingAs(User::find(3))->get($file)->assertNotFound();
        $this->actingAs(User::find(2))->getJson("/api/groups/1/deadlines/{$this->chapter3}")->assertNotFound();

        $this->actingAs(User::find(1))->get($file)->assertOk();
        $this->actingAs(User::find(5))->getJson("/api/groups/1/deadlines/{$this->chapter3}")
            ->assertOk()
            ->assertJsonPath('can.review', true)
            ->assertJsonPath('can.submit', false)
            ->assertJsonCount(1, 'submissions')
            ->assertJsonPath('submissions.0.note', 'I still need to finalise the sample size with the barangay captain.')
            ->assertJsonPath('missing.0.id', 3);
        $this->actingAs(User::find(5))->get($file)->assertOk();
    }

    public function test_only_students_hand_in(): void
    {
        $this->handIn(4, $this->chapter3)->assertNotFound();
        $this->handIn(5, $this->chapter3)->assertNotFound();
        $this->handIn(2, $this->chapter3)->assertNotFound();

        $reminder = GroupDeadline::where('research_group_id', 1)->where('submission_mode', 'none')->value('id');
        $this->handIn(1, $reminder)->assertStatus(409);
    }

    public function test_a_group_deliverable_has_one_shared_submission(): void
    {
        $this->actingAs(User::find(3))->getJson("/api/groups/1/deadlines/{$this->chapter2}")
            ->assertJsonPath('mine.status', 'accepted')
            ->assertJsonPath('mine.submittedBy.id', 1)
            ->assertJsonPath('can.submit', false);
        // Accepted work stays as it is
        $this->handIn(3, $this->chapter2)->assertStatus(409);

        $fresh = ResearchGroup::find(1)->deadlines()->create(['title' => 'Poster', 'due_at' => now()->addWeek(), 'submission_mode' => 'group']);
        $this->handIn(1, $fresh->id)->assertCreated();
        $this->handIn(3, $fresh->id)->assertOk()->assertJsonPath('version', 2)->assertJsonPath('submittedBy.id', 3);
        $this->assertSame(1, DeliverableSubmission::where('group_deadline_id', $fresh->id)->count());
    }

    public function test_reviewers_accept_or_ask_for_a_revision_with_feedback(): void
    {
        $kim = $this->handIn(3, $this->chapter3)->json('id');
        $review = "/api/groups/1/deadlines/{$this->chapter3}/submissions/{$kim}/review";

        $this->actingAs(User::find(1))->postJson($review, ['status' => 'accepted'])->assertNotFound();
        $this->actingAs(User::find(4))->postJson($review, ['status' => 'needs_revision'])
            ->assertStatus(422)->assertJsonPath('error', 'Say what needs to change.');
        $this->actingAs(User::find(4))->postJson($review, ['status' => 'submitted'])->assertStatus(422);

        $this->actingAs(User::find(5))->postJson($review, ['status' => 'needs_revision', 'feedback' => 'Cite the 2023 PAGASA data.'])
            ->assertOk()
            ->assertJsonPath('status', 'needs_revision')
            ->assertJsonPath('reviewedBy.id', 5);
        $this->assertSame(1, Notification::where('user_id', 3)->where('type', 'group_deliverable')->count());

        $this->actingAs(User::find(4))->postJson($review, ['status' => 'accepted'])->assertOk()->assertJsonPath('status', 'accepted');
        $this->actingAs(User::find(3))->getJson("/api/groups/1/deadlines/{$this->chapter3}")->assertJsonPath('can.submit', false);
        $this->actingAs(User::find(3))->getJson('/api/groups/1')->assertJsonPath('deadlines.2.myStatus', 'accepted');
    }

    public function test_notes_and_feedback_are_encrypted_in_the_database(): void
    {
        $row = DB::table('deliverable_submissions')->where('student_id', 1)->where('group_deadline_id', $this->chapter3)->first();
        $this->assertStringNotContainsString('barangay', (string) $row->note);
        $this->assertStringNotContainsString('households', (string) $row->feedback);

        $this->handIn(3, $this->chapter3);
        $this->actingAs(User::find(3))->patchJson("/api/groups/1/deadlines/{$this->chapter3}/submission", ['note' => 'Interview guide is in the appendix.'])
            ->assertOk()->assertJsonPath('note', 'Interview guide is in the appendix.');
    }

    public function test_deleting_a_deliverable_removes_every_version_handed_in(): void
    {
        $first = DeliverableSubmission::where('group_deadline_id', $this->chapter3)->value('file');
        $this->handIn(1, $this->chapter3);
        $latest = DeliverableSubmission::where('group_deadline_id', $this->chapter3)->value('file');

        $this->actingAs(User::find(4))->deleteJson("/api/groups/1/deadlines/{$this->chapter3}")->assertNoContent();

        Storage::disk('local')->assertMissing('uploads/'.$first);
        Storage::disk('local')->assertMissing('uploads/'.$latest);
        $this->assertSame(0, DeliverableSubmission::where('group_deadline_id', $this->chapter3)->count());
        // Only Chapter 2's earlier version is left
        $this->assertSame(1, DeliverableVersion::count());
    }

    public function test_deleting_the_group_removes_deliverable_files(): void
    {
        $files = [...DeliverableSubmission::pluck('file')->all(), ...DeliverableVersion::pluck('file')->all()];
        $this->assertCount(3, $files);

        $this->actingAs(User::find(4))->deleteJson('/api/groups/1')->assertNoContent();

        foreach ($files as $file) {
            Storage::disk('local')->assertMissing('uploads/'.$file);
        }
    }

    public function test_organizers_create_deliverables(): void
    {
        $this->actingAs(User::find(1))->postJson('/api/groups/1/deadlines', [
            'title' => 'Survey instrument', 'dueAt' => now()->addDays(5)->toISOString(), 'submissionMode' => 'each', 'instructions' => 'Upload the questionnaire.',
        ])->assertCreated();
        $this->actingAs(User::find(1))->postJson('/api/groups/1/deadlines', ['title' => 'Bad', 'dueAt' => now()->toISOString(), 'submissionMode' => 'everyone'])->assertStatus(422);

        $this->actingAs(User::find(3))->getJson('/api/groups/1')
            ->assertJsonPath('can.submit', true)
            ->assertJsonFragment(['title' => 'Survey instrument', 'submissionMode' => 'each', 'instructions' => 'Upload the questionnaire.', 'myStatus' => null]);
        $this->assertStringContainsString('New deliverable', Notification::where('user_id', 3)->latest('id')->value('message'));
    }
}
