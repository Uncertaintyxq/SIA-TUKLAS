<?php

namespace Tests\Feature\Works;

use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "How we made this" (client Q&A 2a). People: 1 Andrea, 2 Paolo, 3 Kim (students), 4 Santos (adviser),
 * 6 Lea (admin). Work 1 is Andrea's approved flood mesh (it has a story in the demo data).
 */
class ResearchStoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function entry(array $overrides = []): array
    {
        return [
            'type' => 'research', 'title' => 'River sensors for every school', 'adviserId' => 4,
            'abstract' => 'We built a low-cost river level sensor that science classes can assemble and maintain.',
            'tags' => ['STEM'], ...$overrides,
        ];
    }

    public function test_a_story_is_written_with_the_draft_and_kept_in_the_submitted_version(): void
    {
        $id = $this->actingAs(User::find(3))->postJson('/api/works', $this->entry(['story' => "  It began with a flooded classroom.  \n\nThen the kit.  "]))
            ->assertCreated()->json('id');
        $this->assertSame("It began with a flooded classroom.  \n\nThen the kit.", Work::find($id)->story);

        $this->actingAs(User::find(3))->putJson("/api/works/{$id}", $this->entry(['story' => 'A clearer version.']))->assertNoContent();
        $this->actingAs(User::find(3))->postJson("/api/works/{$id}/submit")->assertSuccessful();

        $this->assertSame('A clearer version.', Work::find($id)->versions()->first()->story);
        $this->actingAs(User::find(3))->getJson('/api/works/mine')->assertJsonFragment(['id' => $id, 'story' => 'A clearer version.']);
    }

    public function test_it_is_optional_and_has_a_length_limit(): void
    {
        $id = $this->actingAs(User::find(3))->postJson('/api/works', $this->entry(['story' => '   ']))->assertCreated()->json('id');
        $this->assertNull(Work::find($id)->story);

        $this->actingAs(User::find(3))->postJson('/api/works', $this->entry(['story' => str_repeat('a', 3001)]))
            ->assertStatus(422)->assertJsonPath('error', 'Keep “How we made this” under 3,000 characters');
    }

    public function test_the_panel_reads_it_during_review_and_everyone_once_the_work_is_public(): void
    {
        $id = $this->actingAs(User::find(3))->postJson('/api/works', $this->entry(['story' => 'Our story.', 'submit' => true]))->assertCreated()->json('id');

        // In review: the author and the adviser see it
        $this->actingAs(User::find(3))->getJson("/api/works/{$id}")->assertJsonPath('story', 'Our story.');
        $this->actingAs(User::find(4))->getJson("/api/works/{$id}")->assertJsonPath('story', 'Our story.');

        // Public: anyone, signed in or not
        $this->actingAs(User::find(2))->getJson('/api/works/1')->assertJsonPath('story', fn ($s) => str_starts_with($s, 'It started during a typhoon'));
        $this->signOut()->getJson('/api/works/1')->assertOk()->assertJsonPath('story', fn ($s) => str_contains($s, 'the cooler'));
    }

    public function test_it_is_in_the_authors_data_export(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/account/export')
            ->assertOk()->assertJsonFragment(['id' => 1, 'story' => Work::find(1)->story]);
    }
}
