<?php

namespace Tests\Feature\Users;

use App\Models\Honor;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Portfolios on the demo data: Andrea (student), Dr. Santos (educator), Lea (admin). */
class PortfolioTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_the_public_sees_approved_works_and_verified_honors_only(): void
    {
        $response = $this->getJson('/api/users/andrea/portfolio')->assertOk();

        // Andrea authored works 1 (approved), 4 (submitted), 8 (draft) and co-authored 7 (approved)
        $this->assertEqualsCanonicalizing([1, 7], array_column($response->json('works'), 'id'));
        $this->assertSame([true, true], array_column($response->json('honors'), 'verified'));
        $response->assertJsonPath('isOwner', false)
            ->assertJsonPath('user.username', 'andrea')
            ->assertJsonMissingPath('user.email');
        $this->assertStringNotContainsString('andrea@tuklas.edu', $response->getContent());
    }

    public function test_the_owner_also_sees_pending_honors(): void
    {
        $this->actingAs(User::find(1))->getJson('/api/users/andrea/portfolio')
            ->assertOk()
            ->assertJsonPath('isOwner', true)
            ->assertJsonCount(3, 'honors');
    }

    public function test_internal_publications_need_a_sign_in(): void
    {
        $public = $this->getJson('/api/users/msantos/portfolio')->assertOk();
        $this->assertSame([1], array_column($public->json('publications'), 'id'));

        $signedIn = $this->actingAs(User::find(2))->getJson('/api/users/msantos/portfolio');
        $this->assertEqualsCanonicalizing([1, 2], array_column($signedIn->json('publications'), 'id'));
    }

    public function test_an_unknown_username_is_404(): void
    {
        $this->getJson('/api/users/nobody/portfolio')->assertNotFound();
    }

    public function test_a_student_cannot_verify_their_own_honor(): void
    {
        $this->actingAs(User::find(3))->postJson('/api/profile/honors', [
            'kind' => 'award', 'title' => 'Best Poster', 'issuer' => 'Research Fair', 'year' => '2026', 'verified' => true,
        ])->assertCreated()->assertJsonPath('verified', false);

        $this->assertFalse(Honor::where('title', 'Best Poster')->value('verified'));
    }

    public function test_editing_a_verified_honor_sends_it_back_for_verification(): void
    {
        $honor = Honor::where('user_id', 1)->where('verified', true)->first();

        $this->actingAs(User::find(1))->putJson("/api/profile/honors/{$honor->id}", [
            'kind' => 'award', 'title' => 'Best Paper (edited)', 'issuer' => $honor->issuer, 'year' => $honor->year,
        ])->assertNoContent();

        $this->assertFalse($honor->fresh()->verified);
    }

    public function test_nobody_can_edit_someone_elses_background(): void
    {
        $santosDegree = User::find(4)->backgrounds()->first();

        $this->actingAs(User::find(1))->putJson("/api/profile/background/{$santosDegree->id}", ['degree' => 'Hacked', 'school' => 'Nowhere', 'year' => '2026'])
            ->assertNotFound();
        $this->actingAs(User::find(1))->deleteJson("/api/profile/background/{$santosDegree->id}")->assertNoContent();

        $this->assertSame($santosDegree->degree, $santosDegree->fresh()->degree);
    }

    public function test_links_must_be_web_addresses(): void
    {
        $this->actingAs(User::find(1))->putJson('/api/profile/links', [
            'links' => [['type' => 'other', 'url' => 'javascript:alert(document.cookie)', 'label' => 'Click me']],
        ])->assertStatus(422);
    }

    public function test_a_photo_upload_is_judged_by_its_bytes(): void
    {
        $this->actingAs(User::find(1))
            ->call('PUT', '/api/profile/photo', [], [], [], ['HTTP_X_FILE_NAME' => 'me.png', 'CONTENT_TYPE' => 'image/png', 'HTTP_ACCEPT' => 'application/json'], '<script>alert(1)</script>')
            ->assertStatus(400)
            ->assertJsonPath('error', 'That file isn’t a PNG, JPEG or WebP image.');

        $png = "\x89PNG\r\n\x1a\n".str_repeat("\0", 32);
        $this->actingAs(User::find(1))
            ->call('PUT', '/api/profile/photo', [], [], [], ['HTTP_X_FILE_NAME' => 'me.png', 'CONTENT_TYPE' => 'image/png', 'HTTP_ACCEPT' => 'application/json'], $png)
            ->assertNoContent();

        $this->get('/api/users/andrea/photo')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_people_search_finds_people_without_their_emails(): void
    {
        $response = $this->actingAs(User::find(1))->getJson('/api/people/search?q=santos')->assertOk();

        $this->assertSame(['msantos'], array_column($response->json(), 'username'));
        $this->assertStringNotContainsString('@tuklas.edu', $response->getContent());
    }

    public function test_only_verified_educators_are_offered_as_advisers(): void
    {
        $response = $this->actingAs(User::find(1))->getJson('/api/people/advisers')->assertOk();

        $this->assertEqualsCanonicalizing(['msantos', 'raquino'], array_column($response->json(), 'username'));
    }
}
