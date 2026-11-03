<?php

namespace Tests\Feature\Works;

use App\Enums\PublicationVisibility;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use App\Support\Reach;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Views and downloads (App\Support\Reach). People: 1 Andrea, 2 Paolo, 3 Kim (students), 4 Santos (educator). */
class ReachTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    /** A public work none of $userIds wrote, with a PDF on the fake disk. */
    private function publicWorkNotBy(int ...$userIds): Work
    {
        $work = Work::public()->with('coAuthors:id')->get()->first(fn (Work $w) => array_intersect($userIds, $w->authorIds()) === []);
        $file = Str::uuid()->toString().'.pdf';
        Storage::disk('local')->put("uploads/{$file}", '%PDF-1.4');
        $work->forceFill(['pdf_file' => $file, 'pdf_name' => 'paper.pdf'])->save();

        return $work->fresh(['coAuthors']);
    }

    public function test_a_view_counts_once_per_person_per_day(): void
    {
        $work = $this->publicWorkNotBy(2, 3);
        $updated = $work->updated_at;

        $this->actingAs(User::find(2))->getJson("/api/works/{$work->id}")->assertOk();
        $this->actingAs(User::find(2))->getJson("/api/works/{$work->id}")->assertOk();
        $this->actingAs(User::find(3))->getJson("/api/works/{$work->id}")->assertOk()->assertJsonPath('views', 1);

        $this->assertSame(2, $work->fresh()->view_count);
        // Counting doesn't make the work look edited
        $this->assertEquals($updated, $work->fresh()->updated_at);

        $this->travel(1)->days();
        $this->actingAs(User::find(2))->getJson("/api/works/{$work->id}")->assertOk();
        $this->assertSame(3, $work->fresh()->view_count);
    }

    public function test_visitors_count_too_and_nothing_personal_is_kept(): void
    {
        $work = $this->publicWorkNotBy();

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])->getJson("/api/works/{$work->id}")->assertOk();
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])->getJson("/api/works/{$work->id}")->assertOk();
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.2'])->getJson("/api/works/{$work->id}")->assertOk();

        $this->assertSame(2, $work->fresh()->view_count);
        $stored = DB::table('content_hits')->pluck('visitor')->implode(' ');
        $this->assertStringNotContainsString('203.0.113.7', $stored);
        $this->assertStringNotContainsString('Symfony', $stored);

        // The next day, yesterday's "already counted" rows go; the totals stay
        $this->travel(1)->days();
        $this->assertSame(2, Reach::forgetYesterday());
        $this->assertSame(0, DB::table('content_hits')->count());
        $this->assertSame(2, $work->fresh()->view_count);
    }

    public function test_authors_and_works_that_arent_public_dont_count(): void
    {
        $work = $this->publicWorkNotBy();
        $this->actingAs(User::find($work->author_id))->getJson("/api/works/{$work->id}")->assertOk();
        foreach ($work->coAuthors as $co) {
            $this->actingAs($co)->getJson("/api/works/{$work->id}")->assertOk();
        }
        $this->assertSame(0, $work->fresh()->view_count);

        // A draft its author opens, and a removed work its adviser opens
        $draft = Work::where('status', 'draft')->first();
        $this->actingAs(User::find($draft->author_id))->getJson("/api/works/{$draft->id}")->assertOk();
        $work->forceFill(['removed_at' => now()])->save();
        $this->actingAs(User::find($work->adviser_id))->getJson("/api/works/{$work->id}")->assertOk();

        $this->assertSame(0, $draft->fresh()->view_count);
        $this->assertSame(0, $work->fresh()->view_count);
    }

    public function test_opening_the_pdf_counts_as_a_download_but_the_embedded_viewer_doesnt(): void
    {
        $work = $this->publicWorkNotBy(2);

        // The PDF inside the work page loads in a frame
        $this->actingAs(User::find(2))->withHeader('Sec-Fetch-Dest', 'iframe')->get("/api/works/{$work->id}/pdf")->assertOk();
        // Scripts and crawlers send no Sec-Fetch-Dest
        $this->actingAs(User::find(2))->get("/api/works/{$work->id}/pdf")->assertOk();
        $this->assertSame(0, $work->fresh()->download_count);

        // "Open" and "Download" open it as a page of its own
        $this->actingAs(User::find(2))->withHeader('Sec-Fetch-Dest', 'document')->get("/api/works/{$work->id}/pdf")->assertOk();
        $this->actingAs(User::find(2))->withHeader('Sec-Fetch-Dest', 'document')->get("/api/works/{$work->id}/pdf?download=1")->assertOk();
        $this->assertSame(1, $work->fresh()->download_count);
        $this->assertSame(0, $work->fresh()->view_count, 'A download is not a view');
    }

    public function test_publications_count_once_published_and_not_for_their_authors(): void
    {
        $public = Publication::where('visibility', PublicationVisibility::Public)->first();
        $draft = Publication::where('visibility', PublicationVisibility::Draft)->first()
            ?? tap(Publication::where('id', '!=', $public->id)->first())->forceFill(['visibility' => PublicationVisibility::Draft])->save();
        $reader = User::whereNotIn('id', [$public->author_id, ...$public->coAuthors()->pluck('users.id')])->where('role', 'student')->first();

        $this->actingAs($reader)->getJson("/api/publications/{$public->id}")->assertOk();
        $this->actingAs(User::find($public->author_id))->getJson("/api/publications/{$public->id}")->assertOk();
        $this->actingAs(User::find($draft->author_id))->getJson("/api/publications/{$draft->id}")->assertOk();

        $this->assertSame(1, $public->fresh()->view_count);
        $this->assertSame(0, $draft->fresh()->view_count);
        $this->actingAs($reader)->getJson('/api/publications')->assertOk()
            ->assertJsonFragment(['id' => $public->id, 'views' => 1, 'downloads' => 0]);
    }

    public function test_the_portfolio_adds_up_the_reach_of_its_own_works(): void
    {
        $work = $this->publicWorkNotBy(2);
        $work->forceFill(['view_count' => 12, 'download_count' => 5])->save();
        $author = User::find($work->author_id);
        $theirs = Work::public()->where(fn ($q) => $q->where('author_id', $author->id)->orWhereHas('coAuthors', fn ($c) => $c->whereKey($author->id)))->get();

        $this->actingAs(User::find(2))->getJson("/api/users/{$author->username}/portfolio")
            ->assertOk()
            ->assertJsonPath('stats.views', $theirs->sum('view_count'))
            ->assertJsonPath('stats.downloads', $theirs->sum('download_count'))
            ->assertJsonFragment(['id' => $work->id, 'views' => 12, 'downloads' => 5]);
    }

    public function test_yesterdays_rows_are_forgotten_every_hour(): void
    {
        Artisan::call('schedule:list');

        $this->assertStringContainsString('reach:forget-yesterday', Artisan::output());
    }
}
