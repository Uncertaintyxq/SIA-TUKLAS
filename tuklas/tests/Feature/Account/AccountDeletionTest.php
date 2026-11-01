<?php

namespace Tests\Feature\Account;

use App\Models\DeliverableSubmission;
use App\Models\GroupMember;
use App\Models\Message;
use App\Models\Notification;
use App\Models\ResearchGroup;
use App\Models\Review;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Deleting an account (D13). Demo people: 1 Andrea (student, leads group 1), 3 Kim (student),
 * 4 Santos (educator, advises group 1), 6 Lea (admin).
 */
class AccountDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function deleteAccount(int $userId, string $password = 'tuklas123')
    {
        return $this->actingAs(User::find($userId))->deleteJson('/api/account', ['password' => $password]);
    }

    public function test_it_needs_the_password_and_admins_cannot_delete_themselves(): void
    {
        $this->deleteAccount(1, 'wrong password')->assertStatus(422)->assertJsonPath('error', 'That isn’t your current password.');
        $this->signOut();
        $this->deleteAccount(6)->assertForbidden();
        $this->assertNull(User::find(1)->account_deleted_at);
        $this->assertNull(User::find(6)->account_deleted_at);
    }

    public function test_the_account_becomes_a_former_member_that_cannot_sign_in(): void
    {
        $email = User::find(1)->email;

        $this->deleteAccount(1)->assertNoContent();
        $this->assertGuest('web');

        $former = User::find(1);
        $this->assertSame('Former member', $former->name);
        $this->assertSame('former-member-1', $former->username);
        $this->assertNotNull($former->account_deleted_at);
        $this->assertSame(0, User::where('email', $email)->count());
        $this->assertSame(0, DB::table('sessions')->where('user_id', 1)->count());

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'tuklas123'])->assertStatus(422);
        $this->postJson('/api/auth/login', ['email' => 'former-member-1@deleted.invalid', 'password' => 'tuklas123'])->assertStatus(422);
    }

    public function test_personal_data_goes_and_approved_work_stays_as_former_member(): void
    {
        $approved = Work::where('author_id', 1)->where('status', 'approved')->pluck('id');
        $unfinished = Work::where('author_id', 1)->where('status', '!=', 'approved')->pluck('id');
        $this->assertNotEmpty($approved);

        $this->deleteAccount(1)->assertNoContent();

        $this->assertSame(0, DB::table('profiles')->where('user_id', 1)->count());
        $this->assertSame(0, Work::whereIn('id', $unfinished)->count());
        $this->assertSame($approved->count(), Work::whereIn('id', $approved)->count());
        $this->assertSame(0, DB::table('comments')->where('author_id', 1)->count());
        $this->assertSame(0, Notification::where('user_id', 1)->count());

        $this->signOut();
        $work = $this->getJson("/api/works/{$approved->first()}")->assertOk();
        $this->assertSame('Former member', $work->json('authors.0.name'));
        $this->getJson('/api/users/andrea/portfolio')->assertNotFound();
        $this->getJson('/api/users/former-member-1/portfolio')->assertNotFound();
    }

    public function test_messages_are_removed_and_groups_left(): void
    {
        $sent = Message::where('sender_id', 1)->count();
        $this->assertGreaterThan(0, $sent);

        $this->deleteAccount(1)->assertNoContent();

        $this->assertSame($sent, Message::where('sender_id', 1)->whereNotNull('deleted_at')->count());
        $this->assertSame('', Message::where('sender_id', 1)->first()->text);
        $this->assertSame(0, GroupMember::where('user_id', 1)->count());
        $this->assertSame(0, DB::table('conversation_members')->where('user_id', 1)->count());
        // Their own Chapter 3 hand-in goes; the group's shared Chapter 2 stays
        $this->assertSame(0, DeliverableSubmission::where('student_id', 1)->whereHas('deadline', fn ($d) => $d->where('submission_mode', 'each'))->count());
        $this->assertSame(1, DeliverableSubmission::whereHas('deadline', fn ($d) => $d->where('submission_mode', 'group'))->count());
        // Their name is gone from the group log
        $this->assertSame(0, DB::table('group_activities')->where('detail', 'like', '%Andrea Villanueva%')->count());
    }

    public function test_their_files_are_removed_from_the_disk(): void
    {
        $file = DeliverableSubmission::where('student_id', 1)->whereHas('deadline', fn ($d) => $d->where('submission_mode', 'each'))->value('file');
        Storage::disk('local')->assertExists('uploads/'.$file);

        $this->deleteAccount(1)->assertNoContent();

        Storage::disk('local')->assertMissing('uploads/'.$file);
    }

    public function test_former_members_are_left_out_of_people_lists_and_notifications(): void
    {
        $this->deleteAccount(3)->assertNoContent();
        $this->signOut();

        $this->actingAs(User::find(1))->getJson('/api/people/search?q=former')->assertOk()->assertJsonCount(0);
        $this->actingAs(User::find(1))->getJson('/api/people/search?q=Kim')->assertOk()->assertJsonCount(0);
        $this->assertNotContains(3, array_column($this->actingAs(User::find(6))->getJson('/api/admin/users')->json(), 'id'));

        // A group announcement or a deadline no longer notifies them
        $this->actingAs(User::find(4))->postJson('/api/groups/1/deadlines', ['title' => 'Poster draft', 'dueAt' => now()->addWeek()->toISOString()])->assertCreated();
        $this->assertSame(0, Notification::where('user_id', 3)->count());
    }

    public function test_an_adviser_leaving_keeps_their_group_reviews_and_tells_admins_and_students(): void
    {
        $reviews = Review::where('reviewer_id', 4)->count();
        // author => how many of their works wait on this adviser
        $waiting = Work::where('adviser_id', 4)->whereNotIn('status', ['approved', 'rejected'])->pluck('author_id')->countBy();

        $this->deleteAccount(4)->assertNoContent();

        $this->assertNotNull(ResearchGroup::find(1));
        $this->assertSame($reviews, Review::where('reviewer_id', 4)->count());
        $this->assertSame(1, Notification::where('user_id', 6)->where('type', 'group_orphaned')->count());
        foreach ($waiting as $studentId => $works) {
            $this->assertSame($works, Notification::where('user_id', $studentId)->where('type', 'adviser_left')->count());
        }
        // The group still opens for its members, with the adviser shown as Former member
        $this->signOut();
        $this->actingAs(User::find(3))->getJson('/api/groups/1')->assertOk()->assertJsonPath('adviser.name', 'Former member');
        // Students can't pick them as adviser any more
        $this->assertNotContains(4, array_column($this->actingAs(User::find(3))->getJson('/api/people/advisers')->json(), 'id'));
    }
}
