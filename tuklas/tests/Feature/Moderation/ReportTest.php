<?php

namespace Tests\Feature\Moderation;

use App\Enums\ApprovalStatus;
use App\Enums\CommentScope;
use App\Enums\ReportStatus;
use App\Models\Comment;
use App\Models\Event;
use App\Models\Message;
use App\Models\Notification;
use App\Models\Report;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** People: 1 Andrea, 2 Paolo, 3 Kim (students), 4 Santos, 5 Aquino (educators), 6 Lea (admin). Chat 1 is Andrea–Kim. */
class ReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function publicWorkNotBy(int $userId): Work
    {
        return Work::public()->with('coAuthors:id')->get()->first(fn (Work $w) => ! in_array($userId, $w->authorIds(), true));
    }

    public function test_reporting_a_work_tells_the_admins_once_and_repeats_update_the_same_report(): void
    {
        $work = $this->publicWorkNotBy(3);

        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'work', 'id' => $work->id, 'reason' => 'plagiarism', 'details' => 'Same as a 2019 thesis'])->assertCreated();
        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'work', 'id' => $work->id, 'reason' => 'spam'])->assertCreated();

        $this->assertSame(1, Report::count());
        $this->assertSame('spam', Report::first()->reason->value);
        $this->assertSame(1, Notification::where('user_id', 6)->where('type', 'report_new')->count());
        // The author isn't told anything at this point
        $this->assertSame(0, Notification::whereIn('user_id', $work->authorIds())->where('type', 'like', 'report%')->count());
    }

    public function test_people_cant_report_what_they_cant_see_or_their_own_things(): void
    {
        $draft = Work::where('status', 'draft')->first();
        $this->actingAs(User::find($draft->author_id === 2 ? 3 : 2))->postJson('/api/reports', ['type' => 'work', 'id' => $draft->id, 'reason' => 'spam'])->assertNotFound();

        // Paolo isn't in Andrea and Kim's chat
        $message = Message::where('conversation_id', 1)->first();
        $this->actingAs(User::find(2))->postJson('/api/reports', ['type' => 'message', 'id' => $message->id, 'reason' => 'harassment'])->assertNotFound();

        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'user', 'id' => 3, 'reason' => 'spam'])->assertStatus(422);
        $this->assertSame(0, Report::count());
    }

    public function test_the_queue_is_for_admins_and_groups_reports_about_the_same_thing(): void
    {
        $work = Work::public()->with('coAuthors:id')->get()->first(fn (Work $w) => array_intersect([2, 3], $w->authorIds()) === []);
        $this->actingAs(User::find(2))->postJson('/api/reports', ['type' => 'work', 'id' => $work->id, 'reason' => 'plagiarism'])->assertCreated();
        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'work', 'id' => $work->id, 'reason' => 'inappropriate'])->assertCreated();

        $this->actingAs(User::find(4))->getJson('/api/admin/reports')->assertForbidden();
        $this->actingAs(User::find(6))->getJson('/api/admin/reports')
            ->assertOk()
            ->assertJsonPath('openCount', 1)
            ->assertJsonCount(1, 'items')
            ->assertJsonCount(2, 'items.0.reports')
            ->assertJsonPath('items.0.snapshot', $work->title)
            ->assertJsonPath('items.0.link', "/works/{$work->id}");
    }

    public function test_removing_a_reported_work_takes_it_off_the_feed_and_tells_everyone_involved(): void
    {
        $work = $this->publicWorkNotBy(3);
        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'work', 'id' => $work->id, 'reason' => 'plagiarism'])->assertCreated();

        $this->actingAs(User::find(6))->postJson("/api/admin/reports/work/{$work->id}/resolve", ['action' => 'remove', 'note' => 'Copied from another thesis'])->assertNoContent();

        $this->assertNotNull($work->fresh()->removed_at);
        $this->assertSame(ReportStatus::Actioned, Report::first()->status);
        $this->assertSame(1, Notification::where('user_id', 3)->where('type', 'report_resolved')->count());
        $this->assertSame(1, Notification::where('user_id', $work->author_id)->where('type', 'work_removed')->count());
        $this->actingAs(User::find(6))->getJson('/api/admin/reports')->assertJsonPath('openCount', 0)->assertJsonCount(0, 'items');
        $this->actingAs(User::find(6))->getJson('/api/admin/reports?status=closed')->assertJsonPath('items.0.removed', true);
    }

    public function test_a_removed_message_stays_readable_in_the_report_but_not_in_the_chat(): void
    {
        $message = Message::where('conversation_id', 1)->where('sender_id', 1)->first();
        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'message', 'id' => $message->id, 'reason' => 'harassment'])->assertCreated();

        $this->actingAs(User::find(6))->postJson("/api/admin/reports/message/{$message->id}/resolve", ['action' => 'remove'])->assertNoContent();

        $this->assertNotNull($message->fresh()->deleted_at);
        $this->assertSame('', $message->fresh()->text);
        $this->actingAs(User::find(6))->getJson('/api/admin/reports?status=closed')
            ->assertJsonPath('items.0.snapshot', $message->text)
            // Admins can't open direct chats, so there's no link
            ->assertJsonPath('items.0.link', null);
    }

    public function test_warning_and_dismissing(): void
    {
        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'user', 'id' => 2, 'reason' => 'harassment'])->assertCreated();
        $this->actingAs(User::find(6))->postJson('/api/admin/reports/user/2/resolve', ['action' => 'remove'])->assertStatus(422);
        $this->actingAs(User::find(6))->postJson('/api/admin/reports/user/2/resolve', ['action' => 'warn', 'note' => 'Keep chats respectful.'])->assertNoContent();
        $this->assertSame(1, Notification::where('user_id', 2)->where('type', 'report_warning')->count());

        $comment = Comment::where('scope', CommentScope::Public)->where('author_id', '!=', 3)->first();
        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'comment', 'id' => $comment->id, 'reason' => 'spam'])->assertCreated();
        $this->actingAs(User::find(6))->postJson("/api/admin/reports/comment/{$comment->id}/resolve", ['action' => 'dismiss'])->assertNoContent();
        $this->assertNotNull($comment->fresh());
        $this->assertSame(ReportStatus::Dismissed, Report::where('target_type', 'comment')->first()->status);
        $this->actingAs(User::find(6))->postJson("/api/admin/reports/comment/{$comment->id}/resolve", ['action' => 'dismiss'])->assertNotFound();
    }

    public function test_reports_are_in_the_data_export_and_go_with_a_deleted_account(): void
    {
        $message = Message::where('conversation_id', 1)->where('sender_id', 1)->first();
        $this->actingAs(User::find(3))->postJson('/api/reports', ['type' => 'message', 'id' => $message->id, 'reason' => 'harassment', 'details' => 'Rude'])->assertCreated();
        $this->actingAs(User::find(1))->postJson('/api/reports', ['type' => 'user', 'id' => 2, 'reason' => 'spam'])->assertCreated();

        $this->actingAs(User::find(3))->getJson('/api/account/export')->assertJsonPath('reports.0.details', 'Rude')->assertJsonMissingPath('reports.0.snapshot');

        // Andrea deletes her account: her own report goes, and the copy of her message in Kim's report is blanked
        $this->actingAs(User::find(1))->deleteJson('/api/account', ['password' => 'tuklas123'])->assertNoContent();
        $this->assertSame(0, Report::where('reporter_id', 1)->count());
        $this->assertSame('(deleted account)', Report::where('reporter_id', 3)->first()->snapshot);
    }

    public function test_reported_events_are_taken_off_the_list_and_admins_dont_judge_reports_about_themselves(): void
    {
        $event = Event::where('status', ApprovalStatus::Approved)->where('posted_by_id', 4)->first();
        $this->actingAs(User::find(1))->postJson('/api/reports', ['type' => 'event', 'id' => $event->id, 'reason' => 'inappropriate'])->assertCreated();
        $this->actingAs(User::find(6))->postJson("/api/admin/reports/event/{$event->id}/resolve", ['action' => 'remove'])->assertNoContent();
        $this->assertSame(ApprovalStatus::Rejected, $event->fresh()->status);

        $this->actingAs(User::find(1))->postJson('/api/reports', ['type' => 'user', 'id' => 6, 'reason' => 'other', 'details' => 'Test'])->assertCreated();
        $this->actingAs(User::find(6))->postJson('/api/admin/reports/user/6/resolve', ['action' => 'dismiss'])->assertForbidden();
    }
}
