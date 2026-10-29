<?php

namespace Tests\Feature\Works;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PLAN.md rule 1: private until approved, and hidden looks like missing.
 * Demo: work 1 approved (Andrea, adviser Santos), 4 submitted (Andrea → Santos), 5 revision (Paolo → Aquino), 8 draft (Andrea).
 * People: 1 Andrea, 2 Paolo, 3 Kim, 4 Santos, 5 Aquino, 6 Lea (admin), 7 Javier (unverified educator).
 */
class WorkPrivacyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_an_approved_work_is_public_without_its_private_parts(): void
    {
        $this->getJson('/api/works/1')
            ->assertOk()
            ->assertJsonPath('title', 'Offline-First Flood Alert Mesh for Barangay Responders')
            ->assertJsonPath('reviews', [])
            ->assertJsonPath('thread', [])
            ->assertJsonPath('versions', [])
            ->assertJsonCount(2, 'discussion')
            ->assertJsonPath('approval.approverName', 'Dr. Maria Santos');
    }

    public function test_a_submitted_work_is_hidden_from_everyone_but_insiders(): void
    {
        $this->getJson('/api/works/4')->assertNotFound()->assertJsonPath('error', 'That work doesn’t exist or isn’t public yet.');
        $this->actingAs(User::find(2))->getJson('/api/works/4')->assertNotFound();
        $this->actingAs(User::find(5))->getJson('/api/works/4')->assertNotFound();

        $this->actingAs(User::find(1))->getJson('/api/works/4')->assertOk();
        $this->actingAs(User::find(4))->getJson('/api/works/4')->assertOk()->assertJsonPath('can.decide', ['start_review', 'revise', 'approve', 'reject']);
        $this->actingAs(User::find(6))->getJson('/api/works/4')->assertOk();
    }

    public function test_a_draft_is_hidden_even_from_its_adviser(): void
    {
        $this->actingAs(User::find(4))->getJson('/api/works/8')->assertNotFound();
        $this->actingAs(User::find(6))->getJson('/api/works/8')->assertNotFound();
        $this->actingAs(User::find(1))->getJson('/api/works/8')->assertOk()->assertJsonPath('can.delete', true);
    }

    public function test_insiders_see_the_review_history(): void
    {
        $this->actingAs(User::find(2))->getJson('/api/works/5')
            ->assertOk()
            ->assertJsonCount(1, 'reviews')
            ->assertJsonCount(3, 'reviews.0.items')
            ->assertJsonPath('reviews.0.comment', 'The opening is beautiful but the middle section loses the thread. Work through the checklist and resubmit.')
            ->assertJsonPath('openItems', 3)
            ->assertJsonPath('can.tickItems', true);
    }

    public function test_the_private_pdf_is_as_private_as_the_work(): void
    {
        $this->get('/api/works/4/pdf')->assertNotFound();
    }

    public function test_reactions_and_saves_only_work_on_public_works(): void
    {
        $kim = User::find(3);

        $this->actingAs($kim)->putJson('/api/works/4/reaction', ['kind' => 'useful'])->assertNotFound();
        $this->actingAs($kim)->putJson('/api/works/2/reaction', ['kind' => 'useful'])->assertNoContent();
        $this->actingAs($kim)->putJson('/api/works/2/save')->assertNoContent();

        $this->actingAs($kim)->getJson('/api/works/2')->assertJsonPath('myReaction', 'useful')->assertJsonPath('saved', true);
    }

    public function test_only_insiders_write_in_the_private_thread(): void
    {
        $this->actingAs(User::find(3))->postJson('/api/works/5/comments', ['text' => 'Hi'])->assertNotFound();
        $this->actingAs(User::find(2))->postJson('/api/works/5/comments', ['text' => 'Revised the middle'])->assertCreated();
        // Approved works close the thread
        $this->actingAs(User::find(1))->postJson('/api/works/1/comments', ['text' => 'Late note'])->assertStatus(409);
    }

    public function test_my_research_lists_my_works_and_co_authored_ones(): void
    {
        $response = $this->actingAs(User::find(1))->getJson('/api/works/mine')->assertOk();

        $this->assertEqualsCanonicalizing([1, 4, 7, 8], array_column($response->json(), 'id'));
    }

    public function test_the_review_queue_is_for_educators_and_admins(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/works/review-queue')->assertForbidden();

        $santos = $this->actingAs(User::find(4))->getJson('/api/works/review-queue')->assertOk();
        $this->assertEqualsCanonicalizing([1, 3, 4, 6, 7], array_column($santos->json(), 'id'));
    }
}
