<?php

namespace Tests\Feature\Discovery;

use App\Enums\PublicationVisibility;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchIndexingTest extends TestCase
{
    use RefreshDatabase;

    private string $index;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
        // The shape of the built index.html (client/index.html)
        $this->index = tempnam(sys_get_temp_dir(), 'spa');
        file_put_contents($this->index, "<!doctype html>\n<html>\n  <head>\n    <meta name=\"description\" content=\"Tuklas — a hub.\" />\n    <title>Tuklas — From Defense to Discovery</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n  </body>\n</html>\n");
        config(['tuklas.spa_index' => $this->index, 'app.url' => 'https://tuklas.example', 'tuklas.institution' => 'Example University']);
    }

    protected function tearDown(): void
    {
        @unlink($this->index);
        parent::tearDown();
    }

    public function test_a_public_work_page_carries_its_details_for_google_scholar_and_link_previews(): void
    {
        $work = Work::public()->with('coAuthors')->first();
        $work->forceFill(['pdf_file' => 'paper.pdf', 'title' => 'Flood <maps> & "rain"'])->save();

        $html = $this->get("/works/{$work->id}")->assertOk()->getContent();

        $this->assertStringContainsString('<title>Flood &lt;maps&gt; &amp; &quot;rain&quot; · Tuklas</title>', $html);
        $this->assertStringNotContainsString('<maps>', $html);
        $this->assertStringContainsString('<meta name="citation_title" content="Flood &lt;maps&gt; &amp; &quot;rain&quot;">', $html);
        $this->assertStringContainsString('<meta name="citation_author" content="'.e($work->author->name).'">', $html);
        foreach ($work->coAuthors as $co) {
            $this->assertStringContainsString('<meta name="citation_author" content="'.e($co->name).'">', $html);
        }
        $this->assertStringContainsString('<meta name="citation_publication_date" content="'.$work->approved_at->format('Y/m/d').'">', $html);
        $this->assertStringContainsString("<meta name=\"citation_pdf_url\" content=\"https://tuklas.example/api/works/{$work->id}/pdf\">", $html);
        $this->assertStringContainsString("<link rel=\"canonical\" href=\"https://tuklas.example/works/{$work->id}\">", $html);
        $this->assertStringContainsString('<meta property="og:type" content="article">', $html);
        // A plain copy for crawlers that don't run JavaScript; React replaces it
        $this->assertStringContainsString('<div id="root"><article class="prerender"><h1>Flood &lt;maps&gt;', $html);
        $this->assertStringNotContainsString('noindex', $html);
    }

    public function test_pages_that_arent_public_get_the_plain_page_marked_noindex(): void
    {
        $draft = Work::where('status', 'draft')->first();
        $removed = Work::public()->first();
        $removed->forceFill(['removed_at' => now()])->save();
        $internal = Publication::where('visibility', PublicationVisibility::Internal)->first()
            ?? tap(Publication::first())->forceFill(['visibility' => PublicationVisibility::Internal])->save();

        foreach (["/works/{$draft->id}", "/works/{$removed->id}", "/publications/{$internal->id}", '/feed', '/u/nobody-here'] as $url) {
            $html = $this->get($url)->assertOk()->getContent();
            $this->assertStringContainsString('<meta name="robots" content="noindex">', $html, $url);
            $this->assertStringNotContainsString('citation_title', $html, $url);
            $this->assertStringContainsString('<div id="root"></div>', $html, $url);
        }
        $this->assertStringNotContainsString(e($draft->title), $this->get("/works/{$draft->id}")->getContent());
        // The home page stays indexable
        $this->assertStringNotContainsString('noindex', $this->get('/')->getContent());
    }

    public function test_public_publications_and_portfolios_have_their_own_details(): void
    {
        $pub = Publication::where('visibility', PublicationVisibility::Public)->first();
        $this->get("/publications/{$pub->id}")->assertOk()->assertSee('<meta name="citation_title" content="'.e($pub->title).'">', false);

        $andrea = User::find(1);
        $this->get("/u/{$andrea->username}")
            ->assertOk()
            ->assertSee('<meta property="og:type" content="profile">', false)
            ->assertSee('<title>'.e($andrea->name).' · Tuklas</title>', false);
    }

    public function test_the_sitemap_lists_public_pages_only(): void
    {
        $public = Work::public()->first();
        $draft = Work::where('status', 'draft')->first();

        $xml = $this->get('/sitemap.xml')->assertOk()->assertHeader('Content-Type', 'application/xml; charset=UTF-8')->getContent();

        $this->assertStringContainsString("<loc>https://tuklas.example/works/{$public->id}</loc>", $xml);
        $this->assertStringNotContainsString("/works/{$draft->id}<", $xml);
        $this->assertStringContainsString('<loc>https://tuklas.example/u/'.User::find($public->author_id)->username.'</loc>', $xml);
        // Kim has no public research, so her portfolio isn't put in front of search engines
        $kim = User::find(3);
        if (! Work::public()->where('author_id', 3)->exists() && ! Work::public()->whereHas('coAuthors', fn ($q) => $q->whereKey(3))->exists()) {
            $this->assertStringNotContainsString("/u/{$kim->username}<", $xml);
        }
    }

    public function test_robots_txt_keeps_crawlers_out_of_the_api_but_lets_them_read_public_pdfs(): void
    {
        $this->get('/robots.txt')
            ->assertOk()
            ->assertSee('Allow: /api/works/*/pdf')
            ->assertSee('Disallow: /api/')
            ->assertSee('Sitemap: https://tuklas.example/sitemap.xml');
    }
}
