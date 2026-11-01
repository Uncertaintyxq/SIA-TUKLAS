<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SpaPageTest extends TestCase
{
    // The page looks up public works and portfolios for their search details (PageMeta)
    use RefreshDatabase;

    private string $index;

    protected function setUp(): void
    {
        parent::setUp();
        $this->index = tempnam(sys_get_temp_dir(), 'spa');
        file_put_contents($this->index, '<!doctype html><title>Tuklas</title><div id="root"></div>');
        config(['tuklas.spa_index' => $this->index]);
    }

    protected function tearDown(): void
    {
        @unlink($this->index);
        parent::tearDown();
    }

    public function test_page_urls_get_the_app_page_with_its_content_security_policy(): void
    {
        foreach (['/', '/login', '/groups/4', '/u/maria', '/reset-password?token=abc'] as $url) {
            $response = $this->get($url)->assertOk()->assertSee('<div id="root"></div>', false);
            $this->assertStringStartsWith('text/html', $response->headers->get('Content-Type'));
            $this->assertSame(config('tuklas.csp'), $response->headers->get('Content-Security-Policy'));
            $this->assertStringContainsString('no-cache', $response->headers->get('Cache-Control'));
        }
        $this->assertStringContainsString("script-src 'self'", config('tuklas.csp'));
    }

    public function test_api_paths_and_files_are_never_answered_with_the_app_page(): void
    {
        $this->getJson('/api/no-such-thing')->assertNotFound()->assertExactJson(['error' => 'Not found']);
        $this->get('/api/no-such-thing')->assertNotFound()->assertDontSee('id="root"', false);
        $this->postJson('/api/no-such-thing')->assertNotFound();
        $this->get('/build/assets/missing.js')->assertNotFound();
        $this->get('/logo.png')->assertNotFound();
    }

    public function test_a_missing_build_says_how_to_make_one(): void
    {
        config(['tuklas.spa_index' => $this->index.'-missing']);

        $this->get('/feed')->assertStatus(503)->assertSee('npm run build');
    }
}
