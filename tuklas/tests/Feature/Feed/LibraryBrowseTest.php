<?php

namespace Tests\Feature\Feed;

use App\Enums\PublicationVisibility;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Browsing research by year, department, adviser and keyword. People: 1 Andrea, 2 Paolo, 3 Kim
 * (students), 4 Santos and 5 Aquino (educators). Public works: 1, 2, 3 and 7; Aquino advised work 2.
 */
class LibraryBrowseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    /** @return list<int> the work ids in a feed response */
    private function works(array $query): array
    {
        $items = $this->actingAs(User::find(2))->getJson('/api/feed?'.http_build_query($query))->assertOk()->json('items');

        return collect($items)->where('kind', 'work')->pluck('work.id')->sort()->values()->all();
    }

    public function test_the_feed_filters_works_by_year_adviser_and_keyword(): void
    {
        Work::whereKey(3)->update(['approved_at' => '2025-03-01 10:00:00']);
        $this->assertSame([3], $this->works(['year' => 2025]));
        $this->assertSame([2], $this->works(['adviser' => 5]));

        $tagged = Work::public()->get()->filter(fn (Work $w) => in_array('IoT', $w->tags ?? [], true))->pluck('id')->sort()->values()->all();
        $this->assertNotEmpty($tagged);
        $this->assertSame($tagged, $this->works(['tag' => 'IoT']));

        // These describe works, so opportunities and events step aside
        $kinds = collect($this->actingAs(User::find(2))->getJson('/api/feed?year=2025')->json('items'))->pluck('kind')->unique()->values()->all();
        $this->assertSame(['work'], $kinds);
        // A year that isn't one is ignored
        $this->assertSame(Work::public()->pluck('id')->sort()->values()->all(), $this->works(['year' => 'soon']));
    }

    public function test_the_feed_offers_only_values_that_public_works_have(): void
    {
        Work::whereKey(3)->update(['approved_at' => '2025-03-01 10:00:00']);
        $feed = $this->actingAs(User::find(2))->getJson('/api/feed')->assertOk();

        // Newest first, each once (demo works are approved "N days ago", so which years depends on today)
        $expected = Work::public()->get()->map(fn (Work $w) => $w->approved_at->year)->unique()->sortDesc()->values()->all();
        $this->assertSame($expected, $feed->json('years'));
        $this->assertContains(2025, $feed->json('years'));
        $this->assertEqualsCanonicalizing([4, 5], array_column($feed->json('advisers'), 'id'));
        // The draft (work 8) has a "Mobile" keyword; it isn't public, so it isn't offered
        $names = array_column($feed->json('tags'), 'name');
        $this->assertContains('IoT', $names);
        $this->assertNotContains('Mobile', $names);
        $counts = array_column($feed->json('tags'), 'count', 'name');
        $this->assertSame(Work::public()->get()->filter(fn (Work $w) => in_array('Disaster Risk Reduction', $w->tags ?? [], true))->count(), $counts['Disaster Risk Reduction']);
    }

    public function test_the_library_filters_research_by_year_department_and_keyword(): void
    {
        $public = Publication::where('visibility', PublicationVisibility::Public)->with('author.profile')->first();
        $public->forceFill(['published_at' => '2024-06-01 09:00:00', 'keywords' => ['Flood mapping']])->save();
        $department = $public->author->profile->department;

        $ids = fn (array $q) => array_column($this->actingAs(User::find(2))->getJson('/api/publications?'.http_build_query($q))->assertOk()->json(), 'id');
        $this->assertSame([$public->id], $ids(['year' => 2024]));
        $this->assertSame([$public->id], $ids(['keyword' => 'Flood mapping']));
        $this->assertContains($public->id, $ids(['dept' => $department]));
        $this->assertSame([], $ids(['dept' => 'No Such Department']));
    }

    public function test_browse_by_department_counts_what_the_viewer_may_read(): void
    {
        $signedIn = $this->actingAs(User::find(2))->getJson('/api/publications/browse')->assertOk();
        $readable = Publication::whereIn('visibility', [PublicationVisibility::Public, PublicationVisibility::Internal])->with('author.profile')->get();
        $works = Work::public()->with('author.profile')->get();

        foreach ($signedIn->json('departments') as $d) {
            $this->assertSame($readable->filter(fn ($p) => $p->author->profile?->department === $d['name'])->count(), $d['research'], $d['name']);
            $this->assertSame($works->filter(fn ($w) => $w->author->profile?->department === $d['name'])->count(), $d['works'], $d['name']);
        }
        $this->assertSame($readable->count(), array_sum(array_column($signedIn->json('departments'), 'research')));

        // Signed out, internal research isn't counted
        $public = Publication::where('visibility', PublicationVisibility::Public)->count();
        $this->signOut()->getJson('/api/publications/browse')->assertOk()
            ->assertJsonPath('departments', fn ($ds) => array_sum(array_column($ds, 'research')) === $public);
    }
}
