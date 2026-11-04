<?php

namespace Tests\Feature\Admin;

use App\Enums\FollowKind;
use App\Models\Announcement;
use App\Models\Department;
use App\Models\Follow;
use App\Models\Notification;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What stays inside a school (docs/decisions/0002). Schools: 1 Tuklas University, 2 Bayan State
 * College. People: 1 Andrea, 2 Paolo, 3 Kim (TU students), 4 Santos, 5 Aquino (TU educators),
 * 6 Lea (admin), 8 Miguel Torres (Bayan student), 9 Dr. Ana Lim (Bayan educator). Work 9 is
 * Miguel's, School only, approved; works 1, 2, 3, 7 are TU's and Public. Publication 5 is Aquino's,
 * School only (stored as "internal").
 */
class SchoolScopingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    /** @return list<int> the work ids in someone's feed */
    private function feed(int $as, array $query = []): array
    {
        $items = $this->actingAs(User::find($as))->getJson('/api/feed?'.http_build_query($query))->assertOk()->json('items');

        return collect($items)->where('kind', 'work')->pluck('work.id')->sort()->values()->all();
    }

    public function test_school_only_work_is_read_by_its_school_and_its_people_only(): void
    {
        $this->assertContains(9, $this->feed(9));
        $this->assertNotContains(9, $this->feed(2));
        $this->assertContains(9, $this->feed(6));
        // Bayan's people see TU's Public works too
        $this->assertSame([1, 2, 3, 7, 9], $this->feed(9));

        $this->actingAs(User::find(9))->getJson('/api/works/9')->assertOk()->assertJsonPath('visibility', 'school')->assertJsonPath('institution.shortName', 'BSC');
        $this->actingAs(User::find(2))->getJson('/api/works/9')->assertNotFound();
        $this->signOut()->getJson('/api/works/9')->assertNotFound();
        $this->actingAs(User::find(2))->putJson('/api/works/9/reaction', ['kind' => 'useful'])->assertNotFound();
        $this->actingAs(User::find(2))->getJson('/api/users/mtorres/portfolio')->assertOk()->assertJsonPath('works', []);
        $this->actingAs(User::find(9))->getJson('/api/users/mtorres/portfolio')->assertJsonPath('works.0.id', 9);
        $this->signOut()->get('/sitemap.xml')->assertOk()->assertDontSee('/works/9');
    }

    public function test_authors_choose_who_reads_their_work_even_after_approval(): void
    {
        $this->actingAs(User::find(2))->putJson('/api/works/1/visibility', ['visibility' => 'school'])->assertForbidden();
        $this->actingAs(User::find(1))->putJson('/api/works/1/visibility', ['visibility' => 'school'])->assertNoContent();
        $this->actingAs(User::find(8))->getJson('/api/works/1')->assertNotFound();
        $this->signOut()->getJson('/api/works/1')->assertNotFound();
        $this->actingAs(User::find(3))->getJson('/api/works/1')->assertOk();
        $this->actingAs(User::find(1))->putJson('/api/works/1/visibility', ['visibility' => 'everyone'])->assertUnprocessable();

        // Chosen on the form too; the school is the submitting author's
        $id = $this->actingAs(User::find(8))->postJson('/api/works', [
            'type' => 'research', 'title' => 'Rice Terrace Soil Moisture', 'abstract' => 'Measuring soil moisture across upland rice terraces with low-cost probes.',
            'tags' => [], 'adviserId' => 9, 'coAuthorIds' => [3], 'visibility' => 'school',
        ])->assertCreated()->json('id');
        $work = Work::find($id);
        $this->assertSame('school', $work->visibility->value);
        $this->assertSame(2, $work->institution_id);
    }

    public function test_a_student_picks_an_adviser_from_their_own_school(): void
    {
        $this->actingAs(User::find(8))->postJson('/api/works', [
            'type' => 'research', 'title' => 'Rice Terrace Soil Moisture', 'abstract' => 'Measuring soil moisture across upland rice terraces with low-cost probes.',
            'tags' => [], 'adviserId' => 4, 'coAuthorIds' => [],
        ])->assertStatus(400)->assertJsonPath('error', 'Choose a research adviser from your own school.');
    }

    public function test_school_only_research_stays_with_its_school(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/publications/5')->assertOk();
        $this->actingAs(User::find(8))->getJson('/api/publications/5')->assertNotFound();
        $this->assertNotContains(5, array_column($this->actingAs(User::find(8))->getJson('/api/publications')->json(), 'id'));
        $this->assertContains(5, array_column($this->actingAs(User::find(1))->getJson('/api/publications')->json(), 'id'));
        $this->assertContains(5, array_column($this->actingAs(User::find(6))->getJson('/api/publications')->json(), 'id'));
    }

    public function test_departments_belong_to_one_school(): void
    {
        $tuComputing = Department::where('institution_id', 1)->where('name', 'College of Computing')->value('id');
        $bayanComputing = Department::where('institution_id', 2)->where('name', 'College of Computing')->value('id');
        $this->assertNotSame($tuComputing, $bayanComputing);

        // People pick from their own school's list
        $form = ['name' => 'Miguel Torres', 'program' => 'BS Information Technology'];
        $this->actingAs(User::find(8))->patchJson('/api/profile', [...$form, 'departmentId' => $tuComputing])->assertUnprocessable();
        $this->actingAs(User::find(8))->patchJson('/api/profile', [...$form, 'departmentId' => $bayanComputing])->assertOk()->assertJsonPath('user.id', 8);
        $this->assertSame(['College of Agriculture', 'College of Computing', 'College of Information Technology'],
            array_column($this->actingAs(User::find(8))->getJson('/api/departments')->json(), 'name'));

        // A TU College of Computing announcement doesn't reach Bayan's College of Computing
        $this->actingAs(User::find(6))->postJson('/api/announcements', ['scope' => 'department', 'departmentId' => $tuComputing, 'title' => 'Defense week', 'body' => 'Rooms are posted.'])->assertCreated();
        $audience = Announcement::latest('id')->first()->audienceIds();
        $this->assertContains(1, $audience);
        $this->assertNotContains(8, $audience);

        // The feed's department filter is one school's department
        // By the main author's department (work 7 is Kim's, Biology, with Andrea as co-author)
        $this->assertSame([1], $this->feed(2, ['dept' => $tuComputing]));
        $this->assertSame([9], $this->feed(9, ['institution' => 2]));
        $this->assertSame([2, 1], array_column($this->actingAs(User::find(9))->getJson('/api/feed')->json('institutions'), 'id'));
    }

    public function test_admins_keep_each_schools_department_list(): void
    {
        $lea = User::find(6);
        $this->actingAs(User::find(1))->postJson('/api/admin/departments', ['institutionId' => 2, 'name' => 'College of Nursing'])->assertForbidden();
        $id = $this->actingAs($lea)->postJson('/api/admin/departments', ['institutionId' => 2, 'name' => 'College of Nursing'])->assertCreated()->json('id');
        $this->actingAs($lea)->postJson('/api/admin/departments', ['institutionId' => 2, 'name' => 'College of Nursing'])->assertUnprocessable();
        $this->actingAs($lea)->postJson('/api/admin/departments', ['institutionId' => 1, 'name' => 'College of Nursing'])->assertCreated();

        $this->actingAs($lea)->putJson("/api/admin/departments/{$id}", ['name' => 'College of Health Sciences'])->assertNoContent();
        $this->actingAs($lea)->getJson('/api/admin/departments?institution=2')->assertOk()->assertJsonFragment(['name' => 'College of Health Sciences', 'people' => 0]);

        $inUse = Department::where('institution_id', 2)->where('name', 'College of Information Technology')->value('id');
        $this->actingAs($lea)->deleteJson("/api/admin/departments/{$inUse}")->assertStatus(409);
        $this->actingAs($lea)->deleteJson("/api/admin/departments/{$id}")->assertNoContent();
    }

    public function test_followers_at_other_schools_arent_told_about_school_only_work(): void
    {
        Follow::create(['user_id' => 2, 'kind' => FollowKind::Person, 'target' => '8']);
        Follow::create(['user_id' => 9, 'kind' => FollowKind::Tag, 'target' => 'agriculture']);
        $id = $this->actingAs(User::find(8))->postJson('/api/works', [
            'type' => 'research', 'title' => 'Rice Terrace Soil Moisture', 'abstract' => 'Measuring soil moisture across upland rice terraces with low-cost probes.',
            'tags' => ['Agriculture'], 'adviserId' => 9, 'coAuthorIds' => [], 'visibility' => 'school', 'submit' => true,
        ])->assertCreated()->json('id');
        $this->actingAs(User::find(9))->postJson("/api/works/{$id}/decision", ['decision' => 'approve'])->assertNoContent();

        // Lim approved it (she isn't told about her own action); Paolo is at TU
        $this->assertSame([], Notification::where('type', 'follow_work')->pluck('user_id')->all());
        Follow::create(['user_id' => 10, 'kind' => FollowKind::Person, 'target' => '8']);
        Work::find($id)->forceFill(['status' => 'under_review', 'approved_at' => null])->save();
        $this->actingAs(User::find(9))->postJson("/api/works/{$id}/decision", ['decision' => 'approve'])->assertNoContent();
        $this->assertSame([10], Notification::where('type', 'follow_work')->pluck('user_id')->all());
    }
}
