<?php

namespace Tests\Feature\Works;

use App\Enums\WorkStatus;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\RevisionItem;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** PLAN.md rule 2: who decides, and which transitions are allowed. People as in WorkPrivacyTest. */
class ReviewFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function newWork(array $overrides = []): array
    {
        return [
            'type' => 'research', 'title' => 'Rainfall Nowcasting with Low-Cost Radar',
            'abstract' => 'We test whether a low-cost X-band radar can nowcast rainfall at barangay scale.',
            'tags' => ['Weather', 'Radar'], 'adviserId' => 4, 'coAuthorIds' => [], ...$overrides,
        ];
    }

    public function test_a_student_submits_and_the_adviser_approves_it_into_public_view(): void
    {
        $kim = User::find(3);
        $id = $this->actingAs($kim)->postJson('/api/works', $this->newWork(['submit' => true]))->assertCreated()->json('id');

        $this->assertSame(WorkStatus::Submitted, Work::find($id)->status);
        $this->assertTrue(Notification::where('user_id', 4)->where('type', 'work_submitted')->where('link', "/works/{$id}")->exists());
        $this->signOut()->getJson("/api/works/{$id}")->assertNotFound();

        $this->actingAs(User::find(4))->postJson("/api/works/{$id}/decision", ['decision' => 'approve', 'comment' => 'Well done'])->assertNoContent();

        $this->signOut()->getJson("/api/works/{$id}")->assertOk()->assertJsonPath('status', 'approved');
        $this->assertTrue(Notification::where('user_id', 3)->where('type', 'work_approved')->exists());
        $this->assertTrue(AuditLog::where('action', 'work_approve')->where('subject_id', $id)->exists());
        $this->assertContains($id, array_column($this->getJson('/api/users/kim/portfolio')->json('works'), 'id'));
    }

    public function test_an_unverified_educator_cannot_be_chosen_or_decide(): void
    {
        $this->actingAs(User::find(3))->postJson('/api/works', $this->newWork(['adviserId' => 7]))
            ->assertStatus(400)->assertJsonPath('error', 'Choose a verified research adviser.');
    }

    public function test_only_the_assigned_adviser_or_an_admin_decides(): void
    {
        // Aquino isn't the adviser of work 4, so he can't even see it
        $this->actingAs(User::find(5))->postJson('/api/works/4/decision', ['decision' => 'approve'])->assertNotFound();
        // The author can't decide on their own work
        $this->actingAs(User::find(1))->postJson('/api/works/4/decision', ['decision' => 'approve'])->assertForbidden();
        // The admin acts as the academic panel
        $this->actingAs(User::find(6))->postJson('/api/works/4/decision', ['decision' => 'start_review'])->assertNoContent();
        $this->assertSame(WorkStatus::UnderReview, Work::find(4)->status);
    }

    public function test_approved_works_are_final(): void
    {
        $this->actingAs(User::find(4))->postJson('/api/works/1/decision', ['decision' => 'reject'])->assertStatus(409);
        $this->assertSame(WorkStatus::Approved, Work::find(1)->status);
    }

    public function test_a_revision_needs_something_to_revise(): void
    {
        $this->actingAs(User::find(4))->postJson('/api/works/4/decision', ['decision' => 'revise'])
            ->assertStatus(400)->assertJsonPath('error', 'Tell the author what to revise: add a comment or checklist items.');
    }

    public function test_approval_waits_for_every_checklist_item_to_be_confirmed(): void
    {
        $aquino = User::find(5);
        $paolo = User::find(2);
        $this->actingAs($aquino)->postJson('/api/works/5/decision', ['decision' => 'approve'])
            ->assertStatus(409)->assertJsonPath('error', 'Confirm the 3 open revision checklist items before approving.');

        foreach (RevisionItem::all() as $item) {
            // The reviewer can't confirm what the author hasn't ticked
            if (! $item->done_by_student) {
                $this->actingAs($aquino)->patchJson("/api/works/5/items/{$item->id}", ['confirmed' => true])->assertStatus(409);
                $this->actingAs($paolo)->patchJson("/api/works/5/items/{$item->id}", ['done' => true])->assertNoContent();
            }
            $this->actingAs($aquino)->patchJson("/api/works/5/items/{$item->id}", ['confirmed' => true])->assertNoContent();
        }

        $this->actingAs($aquino)->postJson('/api/works/5/decision', ['decision' => 'approve'])->assertNoContent();
    }

    public function test_only_the_main_author_edits_and_only_drafts_or_revisions(): void
    {
        $edit = $this->newWork(['adviserId' => 5]);
        $this->actingAs(User::find(2))->putJson('/api/works/5', $edit)->assertNoContent();
        $this->actingAs(User::find(1))->putJson('/api/works/1', $this->newWork())->assertStatus(409);
        // Kim co-authored nothing of Paolo's and can't see work 5
        $this->actingAs(User::find(3))->putJson('/api/works/5', $edit)->assertNotFound();
    }

    public function test_resubmitting_keeps_every_version(): void
    {
        $this->actingAs(User::find(2))->postJson('/api/works/5/submit', ['note' => 'Cut the market scene'])->assertNoContent();

        $versions = $this->actingAs(User::find(2))->getJson('/api/works/5')->json('versions');
        $this->assertSame([2, 1], array_column($versions, 'version'));
        $this->assertSame('Cut the market scene', $versions[0]['note']);
        $this->assertTrue(Notification::where('user_id', 5)->where('type', 'work_resubmitted')->exists());
    }

    public function test_nobody_adds_themselves_twice(): void
    {
        $this->actingAs(User::find(3))->postJson('/api/works', $this->newWork(['coAuthorIds' => [3]]))->assertStatus(400);
        $this->actingAs(User::find(3))->postJson('/api/works', $this->newWork(['coAuthorIds' => [4]]))->assertStatus(400);
        $this->actingAs(User::find(4))->postJson('/api/works', $this->newWork())->assertStatus(400)
            ->assertJsonPath('error', 'You can’t be your own adviser. Choose another research adviser.');
    }

    public function test_the_topic_overlap_check_finds_related_approved_works(): void
    {
        $response = $this->actingAs(User::find(3))->getJson('/api/works/similar?title='.urlencode('Flood alert sensors for barangays').'&keywords=LoRa')->assertOk();

        $this->assertContains(1, array_column($response->json(), 'id'));
        $this->assertArrayNotHasKey('score', $response->json()[0]);
    }
}
