<?php

namespace Tests\Feature\Users;

use App\Actions\Account\DeleteAccount;
use App\Models\Follow;
use App\Models\Notification;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Following people, departments and keywords. People: 1 Andrea, 2 Paolo, 3 Kim (students),
 * 4 Santos and 5 Aquino (educators), 6 Lea (admin). Public works: 1, 2, 3 and 7; work 6 is Kim's,
 * in review with Santos. Publication 3 is Santos's draft.
 */
class FollowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function follow(int $as, string $kind, string|int $target): TestResponse
    {
        return $this->actingAs(User::find($as))->postJson('/api/follows', ['kind' => $kind, 'target' => (string) $target]);
    }

    /** @return list<int> the work ids in someone's Following feed */
    private function following(int $as): array
    {
        $items = $this->actingAs(User::find($as))->getJson('/api/feed?type=following')->assertOk()->json('items');

        return collect($items)->pluck('work.id')->sort()->values()->all();
    }

    public function test_following_and_unfollowing(): void
    {
        $department = (string) User::find(1)->profile->department_id;
        $this->follow(2, 'person', 1)->assertNoContent();
        $this->follow(2, 'person', 1)->assertNoContent();
        $this->follow(2, 'department', $department)->assertNoContent();
        $this->follow(2, 'tag', 'IoT')->assertNoContent();
        $this->follow(2, 'tag', 'iot')->assertNoContent();
        $this->assertSame(3, Follow::where('user_id', 2)->count());

        $this->actingAs(User::find(2))->getJson('/api/follows')->assertOk()
            ->assertJsonPath('people.0.id', 1)->assertJsonPath('departments.0.id', (int) $department)->assertJsonPath('departments.0.name', 'College of Computing')->assertJsonPath('tags', ['IoT']);
        $this->actingAs(User::find(2))->getJson('/api/users/andrea/portfolio')->assertJsonPath('followedByMe', true)->assertJsonPath('followers', 1);

        // Keywords unfollow ignoring case
        $this->actingAs(User::find(2))->deleteJson('/api/follows', ['kind' => 'tag', 'target' => 'IOT'])->assertNoContent();
        $this->actingAs(User::find(2))->deleteJson('/api/follows', ['kind' => 'person', 'target' => '1'])->assertNoContent();
        $this->assertSame([$department], Follow::where('user_id', 2)->pluck('target')->all());
    }

    public function test_what_cannot_be_followed(): void
    {
        $this->follow(2, 'person', 2)->assertStatus(400);
        $this->follow(2, 'person', 999)->assertNotFound();
        $this->follow(2, 'person', 'andrea')->assertStatus(400);
        $this->follow(2, 'department', 999)->assertNotFound();
        $this->follow(2, 'department', 'College of Computing')->assertStatus(400);
        $this->follow(2, 'tag', str_repeat('x', 41))->assertStatus(400);
        $this->follow(2, 'group', 'x')->assertUnprocessable();
        $this->signOut()->postJson('/api/follows', ['kind' => 'tag', 'target' => 'IoT'])->assertUnauthorized();
    }

    public function test_the_following_feed_shows_works_from_what_i_follow(): void
    {
        $this->assertSame([], $this->following(2));

        $andreas = Work::public()->where(fn ($q) => $q->where('author_id', 1)->orWhereHas('coAuthors', fn ($a) => $a->where('users.id', 1)))->pluck('id')->sort()->values()->all();
        $this->assertNotEmpty($andreas);
        $this->follow(2, 'person', 1);
        $this->assertSame($andreas, $this->following(2));

        $tagged = Work::public()->get()->filter(fn (Work $w) => in_array('IoT', $w->tags ?? [], true))->pluck('id');
        $this->follow(2, 'tag', 'IoT');
        $this->assertSame($tagged->merge($andreas)->unique()->sort()->values()->all(), $this->following(2));

        // Only works: no opportunities or events
        $kinds = collect($this->actingAs(User::find(2))->getJson('/api/feed?type=following')->json('items'))->pluck('kind')->unique()->values()->all();
        $this->assertSame(['work'], $kinds);
    }

    public function test_followers_hear_when_a_work_is_approved_and_not_before(): void
    {
        $this->follow(2, 'person', 3);
        $this->follow(1, 'department', User::find(3)->profile->department_id);
        $this->follow(5, 'tag', 'Weather');

        $id = $this->actingAs(User::find(3))->postJson('/api/works', [
            'type' => 'research', 'title' => 'Rain Gauge Network', 'abstract' => 'A low-cost rain gauge network for barangay flood warnings.',
            'tags' => ['weather'], 'adviserId' => 4, 'coAuthorIds' => [], 'submit' => true,
        ])->assertCreated()->json('id');
        $this->assertSame(0, Notification::where('type', 'follow_work')->count());

        $this->actingAs(User::find(4))->postJson("/api/works/{$id}/decision", ['decision' => 'approve'])->assertNoContent();
        $told = Notification::where('type', 'follow_work')->orderBy('user_id')->get();
        $this->assertSame([1, 2, 5], $told->pluck('user_id')->all());
        $this->assertSame('New on Tuklas: “Rain Gauge Network” by Kim Dela Cruz.', $told->first()->message);
        $this->assertSame("/works/{$id}", $told->first()->link);
    }

    public function test_followers_hear_once_when_research_leaves_draft(): void
    {
        $this->follow(1, 'person', 4);
        $form = ['title' => 'Barangay Alert Wording Study', 'abstract' => 'How the wording of flood alerts changes evacuation decisions in riverside barangays.',
            'keywords' => ['DRR'], 'methodology' => 'Survey', 'fullText' => '', 'coAuthorIds' => []];

        $this->actingAs(User::find(4))->putJson('/api/publications/3', [...$form, 'visibility' => 'draft'])->assertNoContent();
        $this->assertSame(0, Notification::where('type', 'follow_research')->count());
        $this->actingAs(User::find(4))->putJson('/api/publications/3', [...$form, 'visibility' => 'internal'])->assertNoContent();
        $this->actingAs(User::find(4))->putJson('/api/publications/3', [...$form, 'visibility' => 'public'])->assertNoContent();
        $this->assertSame([1], Notification::where('type', 'follow_research')->pluck('user_id')->all());
        $this->assertSame('/publications/3', Notification::where('type', 'follow_research')->value('link'));

        // A new one published straight away
        $id = $this->actingAs(User::find(4))->postJson('/api/publications', [...$form, 'title' => 'Second Study', 'visibility' => 'public'])->assertCreated()->json('id');
        $this->assertTrue(Notification::where('type', 'follow_research')->where('link', "/publications/{$id}")->where('user_id', 1)->exists());
    }

    public function test_follows_are_exported_and_go_with_the_account(): void
    {
        $this->follow(2, 'tag', 'IoT');
        $this->follow(1, 'person', 2);
        $this->actingAs(User::find(2))->getJson('/api/account/export')->assertOk()->assertJsonPath('following.tags', ['IoT']);

        app(DeleteAccount::class)(User::find(2));
        $this->assertSame(0, Follow::where('user_id', 2)->orWhere(fn ($f) => $f->where('kind', 'person')->where('target', '2'))->count());
    }
}
