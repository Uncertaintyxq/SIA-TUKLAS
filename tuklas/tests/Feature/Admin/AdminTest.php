<?php

namespace Tests\Feature\Admin;

use App\Enums\ApprovalStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Event;
use App\Models\Honor;
use App\Models\User;
use App\Models\Work;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** PLAN.md rules 3–5 from the admin side. Lea (6) is the admin. */
class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_the_back_office_is_for_admins_only(): void
    {
        foreach (['/api/admin/stats', '/api/admin/queue', '/api/admin/users', '/api/admin/educators', '/api/admin/posts'] as $path) {
            $this->actingAs(User::find(4))->getJson($path)->assertForbidden();
            $this->actingAs(User::find(6))->getJson($path)->assertOk();
        }
    }

    public function test_the_queue_lists_what_waits_for_an_admin(): void
    {
        $queue = $this->actingAs(User::find(6))->getJson('/api/admin/queue')->assertOk()->json();

        $this->assertSame(['cjavier'], array_column($queue['educators'], 'username'));
        $this->assertSame([4], array_column($queue['events'], 'id'));
        $this->assertCount(1, $queue['ads']);
        $this->assertCount(2, $queue['honors']);
        $this->assertEqualsCanonicalizing([4, 5, 6], array_column($queue['works'], 'id'));
    }

    public function test_verifying_an_educator_unlocks_their_rights_and_is_audited(): void
    {
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/7', ['verified' => true])->assertNoContent();

        $this->assertTrue(User::find(7)->verified);
        $this->assertTrue(User::find(7)->appNotifications()->where('type', 'educator_verified')->exists());
        $this->assertTrue(AuditLog::where('action', 'account_changed')->where('subject_id', 7)->where('actor_id', 6)->exists());
    }

    public function test_an_admin_cannot_demote_themselves(): void
    {
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/6', ['role' => 'student'])->assertStatus(409);
        $this->assertSame(Role::Admin, User::find(6)->role);
    }

    public function test_approving_an_event_lists_it(): void
    {
        $this->actingAs(User::find(6))->postJson('/api/admin/events/4/approve')->assertNoContent();

        $this->assertSame(ApprovalStatus::Approved, Event::find(4)->status);
        $this->actingAs(User::find(2))->getJson('/api/events/4')->assertOk();
        $this->actingAs(User::find(6))->postJson('/api/admin/events/4/maybe')->assertNotFound();
    }

    public function test_verifying_an_honor_puts_it_on_the_public_portfolio(): void
    {
        $honor = Honor::where('user_id', 1)->where('verified', false)->first();
        $this->actingAs(User::find(6))->postJson("/api/admin/honors/{$honor->id}/verify")->assertNoContent();

        $this->signOut();
        $this->assertContains($honor->id, array_column($this->getJson('/api/users/andrea/portfolio')->json('honors'), 'id'));
    }

    public function test_a_removed_work_leaves_the_feed_but_its_authors_still_see_it(): void
    {
        $this->actingAs(User::find(6))->postJson('/api/admin/works/2/remove', ['reason' => 'Duplicate upload'])->assertNoContent();

        $this->assertNotNull(Work::find(2)->removed_at);
        $this->signOut()->getJson('/api/works/2')->assertNotFound();
        $this->actingAs(User::find(2))->getJson('/api/works/2')->assertOk()->assertJsonPath('removed', true);
        $this->assertTrue(AuditLog::where('action', 'work_removed')->where('subject_id', 2)->exists());

        $this->actingAs(User::find(6))->postJson('/api/admin/works/2/restore')->assertNoContent();
        $this->signOut()->getJson('/api/works/2')->assertOk();
    }

    public function test_demo_reset_only_exists_in_demo_mode(): void
    {
        $this->actingAs(User::find(1))->postJson('/api/demo/reset')->assertNotFound();

        config(['tuklas.demo_mode' => true]);
        User::factory()->create(['email' => 'someone@new.edu']);
        $this->actingAs(User::find(1))->postJson('/api/demo/reset')->assertNoContent();
        $this->assertSame(7, User::count());
    }
}
