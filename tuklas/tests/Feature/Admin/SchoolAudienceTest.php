<?php

namespace Tests\Feature\Admin;

use App\Models\Announcement;
use App\Models\Department;
use App\Models\Event;
use App\Models\Opportunity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Who sees opportunities, events and announcements (docs/decisions/0002). Schools: 1 Tuklas
 * University, 2 Bayan State College. People: 1 Andrea (TU student), 4 Santos (TU educator), 6 Lea
 * (TU admin, super-admin), 8 Miguel (Bayan student), 9 Dr. Lim (Bayan educator), 11 Jose Ramos
 * (Bayan admin). The demo's events and opportunities are TU's, open to every school.
 */
class SchoolAudienceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    /** @return list<string> the kinds and ids in someone's feed, e.g. "opportunity:3" */
    private function feed(int $as): array
    {
        return collect($this->actingAs(User::find($as))->getJson('/api/feed')->assertOk()->json('items'))
            ->map(fn ($i) => $i['kind'].':'.$i[$i['kind']]['id'])->all();
    }

    public function test_a_school_only_opportunity_reaches_its_school_only(): void
    {
        $id = $this->actingAs(User::find(9))->postJson('/api/opportunities', [
            'kind' => 'mentorship', 'title' => 'Field assistants for crop surveys', 'description' => 'Help survey upland farms this semester.',
            'deadline' => now()->addMonth()->toDateString(),
        ])->assertCreated()->json('id');
        $this->assertSame('school', Opportunity::find($id)->audience->value);
        $this->assertSame(2, Opportunity::find($id)->institution_id);

        $this->assertContains("opportunity:{$id}", $this->feed(8));
        $this->assertNotContains("opportunity:{$id}", $this->feed(1));
        $this->assertContains("opportunity:{$id}", $this->feed(6));
        $this->actingAs(User::find(1))->postJson("/api/opportunities/{$id}/apply", ['message' => 'I would love to help with this.'])->assertNotFound();
        $this->actingAs(User::find(8))->postJson("/api/opportunities/{$id}/apply", ['message' => 'I would love to help with this.'])->assertCreated();

        // Open to every school
        $open = $this->actingAs(User::find(9))->postJson('/api/opportunities', [
            'kind' => 'mentorship', 'title' => 'Open call for co-researchers', 'description' => 'Any school is welcome to join this project.',
            'deadline' => now()->addMonth()->toDateString(), 'audience' => 'all',
        ])->assertCreated()->json('id');
        $this->assertContains("opportunity:{$open}", $this->feed(1));
    }

    public function test_a_school_only_event_and_its_ad_stay_with_its_school(): void
    {
        $event = Event::forceCreate([
            'category' => 'colloquium', 'title' => 'Bayan research colloquium', 'description' => 'Faculty and students present ongoing research.',
            'venue' => 'Bayan Hall', 'date' => now()->addWeek(), 'status' => 'approved', 'posted_by_id' => 9, 'institution_id' => 2, 'audience' => 'school',
        ]);
        $this->actingAs(User::find(8))->getJson("/api/events/{$event->id}")->assertOk()->assertJsonPath('audience', 'school')->assertJsonPath('institution.shortName', 'BSC');
        $this->actingAs(User::find(1))->getJson("/api/events/{$event->id}")->assertNotFound();
        $this->actingAs(User::find(1))->postJson("/api/events/{$event->id}/register")->assertNotFound();
        $this->assertNotContains($event->id, array_column($this->actingAs(User::find(1))->getJson('/api/events')->json('upcoming'), 'id'));
        $this->assertContains($event->id, array_column($this->actingAs(User::find(8))->getJson('/api/events')->json('upcoming'), 'id'));
        $this->assertNotContains($event->id, array_column($this->actingAs(User::find(1))->getJson('/api/feed/sidebar')->json('upcoming'), 'id'));
    }

    public function test_only_super_admins_post_to_every_school_and_school_admins_to_their_school(): void
    {
        $post = fn (int $as, array $body) => $this->actingAs(User::find($as))->postJson('/api/announcements', ['title' => 'Library hours', 'body' => 'Open until 9 PM.', ...$body]);

        $post(11, ['scope' => 'system'])->assertForbidden();
        $post(4, ['scope' => 'school'])->assertForbidden();
        $post(11, ['scope' => 'school'])->assertCreated();
        $school = Announcement::latest('id')->first();
        $this->assertSame(2, $school->institution_id);
        $this->assertEqualsCanonicalizing([8, 9, 10], array_diff($school->audienceIds(), [11]));

        $this->assertContains($school->id, array_column($this->actingAs(User::find(8))->getJson('/api/announcements')->json('items'), 'id'));
        $this->assertNotContains($school->id, array_column($this->actingAs(User::find(1))->getJson('/api/announcements')->json('items'), 'id'));
        $mine = collect($this->actingAs(User::find(8))->getJson('/api/announcements')->json('items'))->firstWhere('id', $school->id);
        $this->assertSame('Everyone at Bayan State College', $mine['audience']);

        // A super-admin picks the school, or posts to every school
        $post(6, ['scope' => 'school', 'institutionId' => 1])->assertCreated();
        $this->assertSame(1, Announcement::latest('id')->first()->institution_id);
        $post(6, ['scope' => 'system'])->assertCreated();

        // A school's admin only posts to their own school's departments
        $tuComputing = Department::where('institution_id', 1)->where('name', 'College of Computing')->value('id');
        $post(11, ['scope' => 'department', 'departmentId' => $tuComputing])->assertForbidden();
        $this->actingAs(User::find(11))->getJson('/api/announcements')->assertOk()
            ->assertJsonPath('audiences.system', false)->assertJsonPath('audiences.schools.0.id', 2)->assertJsonCount(1, 'audiences.schools');
    }
}
