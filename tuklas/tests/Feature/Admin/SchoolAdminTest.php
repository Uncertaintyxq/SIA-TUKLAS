<?php

namespace Tests\Feature\Admin;

use App\Models\Honor;
use App\Models\Notification;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admins per school (docs/decisions/0002). Schools: 1 Tuklas University, 2 Bayan State College.
 * People: 1 Andrea, 3 Kim (TU students), 4 Santos (TU educator), 6 Lea (TU admin, super-admin),
 * 7 Javier (TU educator, unverified), 8 Miguel, 9 Dr. Lim (Bayan), 10 Rina (Bayan, waiting to be
 * confirmed), 11 Jose Ramos (Bayan admin). Work 6 is Kim's, in review; work 9 is Miguel's,
 * School only.
 */
class SchoolAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_a_school_admin_sees_their_schools_queue_only(): void
    {
        $queue = $this->actingAs(User::find(11))->getJson('/api/admin/queue')->assertOk();
        $this->assertSame([10], array_column($queue->json('schools'), 'id'));
        $this->assertSame([], array_column($queue->json('educators'), 'id'));
        $this->assertSame([], $queue->json('works'));
        $this->actingAs(User::find(11))->getJson('/api/admin/stats')->assertJsonPath('unconfirmedSchools', 1)->assertJsonPath('unverifiedEducators', 0)->assertJsonPath('users.admin', 1);
        $this->assertEqualsCanonicalizing([8, 9, 10, 11], array_column($this->actingAs(User::find(11))->getJson('/api/admin/users')->json(), 'id'));

        // Super-admins see every school, or the one they pick
        $all = $this->actingAs(User::find(6))->getJson('/api/admin/queue')->assertOk();
        $this->assertSame([7], array_column($all->json('educators'), 'id'));
        $this->assertSame([10], array_column($all->json('schools'), 'id'));
        $this->assertSame([], $this->actingAs(User::find(6))->getJson('/api/admin/queue?institution=2')->json('educators'));
        // A school admin can't widen their view
        $this->assertSame([], $this->actingAs(User::find(11))->getJson('/api/admin/queue?institution=1')->json('educators'));
    }

    public function test_a_school_admin_decides_only_for_their_school(): void
    {
        $jose = User::find(11);
        $this->actingAs($jose)->patchJson('/api/admin/users/7', ['verified' => true])->assertForbidden();
        $this->actingAs($jose)->patchJson('/api/admin/users/10', ['schoolConfirmed' => true])->assertNoContent();
        $this->actingAs($jose)->postJson('/api/works/6/decision', ['decision' => 'approve'])->assertNotFound();
        $this->actingAs($jose)->getJson('/api/works/9')->assertOk();
        $this->actingAs($jose)->postJson('/api/admin/works/1/remove')->assertForbidden();
        $this->actingAs($jose)->postJson('/api/admin/departments', ['institutionId' => 1, 'name' => 'College of Nursing'])->assertForbidden();
        $this->actingAs($jose)->postJson('/api/admin/departments', ['institutionId' => 2, 'name' => 'College of Nursing'])->assertCreated();

        $honor = Honor::forceCreate(['user_id' => 3, 'kind' => 'award', 'title' => 'Best Thesis', 'issuer' => 'TU', 'year' => 2026]);
        $this->actingAs($jose)->postJson("/api/admin/honors/{$honor->id}/verify")->assertForbidden();
        $this->actingAs(User::find(6))->postJson("/api/admin/honors/{$honor->id}/verify")->assertNoContent();
    }

    public function test_admin_notices_go_to_that_schools_admins_and_super_admins(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Nina Bautista', 'email' => 'nina@gmail.com', 'password' => 'a long enough passphrase',
            'role' => 'student', 'program' => 'BS Agriculture', 'privacy' => true, 'institutionId' => 2])->assertCreated();
        $this->assertEqualsCanonicalizing([6, 11], Notification::where('type', 'school_signup')->pluck('user_id')->all());

        $this->flushSession();
        $this->signOut()->postJson('/api/auth/register', ['name' => 'Rafael Tan', 'email' => 'rtan@tuklas.edu', 'password' => 'a long enough passphrase',
            'role' => 'educator', 'program' => 'Instructor', 'privacy' => true])->assertCreated();
        $this->assertSame([6], Notification::where('type', 'educator_signup')->where('message', 'like', 'Rafael Tan%')->pluck('user_id')->all());
    }

    public function test_reports_go_to_the_reported_persons_school(): void
    {
        $this->actingAs(User::find(1))->postJson('/api/reports', ['type' => 'user', 'id' => 8, 'reason' => 'spam'])->assertCreated();
        $this->assertEqualsCanonicalizing([6, 11], Notification::where('type', 'report_new')->pluck('user_id')->all());
        $this->assertCount(1, $this->actingAs(User::find(11))->getJson('/api/admin/reports')->json('items'));

        $this->actingAs(User::find(8))->postJson('/api/reports', ['type' => 'user', 'id' => 3, 'reason' => 'spam'])->assertCreated();
        $this->assertCount(1, $this->actingAs(User::find(11))->getJson('/api/admin/reports')->json('items'));
        $this->assertCount(2, $this->actingAs(User::find(6))->getJson('/api/admin/reports')->json('items'));
        $this->actingAs(User::find(11))->postJson('/api/admin/reports/user/3/resolve', ['action' => 'dismiss'])->assertForbidden();
        $this->actingAs(User::find(11))->postJson('/api/admin/reports/user/8/resolve', ['action' => 'dismiss'])->assertNoContent();
        $this->assertSame(1, Report::where('status', 'open')->count());
    }

    public function test_only_super_admins_appoint_super_admins(): void
    {
        $this->actingAs(User::find(11))->patchJson('/api/admin/users/11', ['superAdmin' => true])->assertForbidden();
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/8', ['superAdmin' => true])->assertStatus(409);
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/6', ['superAdmin' => false])->assertStatus(409);
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/11', ['superAdmin' => true])->assertNoContent();
        $this->assertTrue(User::find(11)->isSuperAdmin());
        $this->assertSame([7], array_column($this->actingAs(User::find(11))->getJson('/api/admin/queue')->json('educators'), 'id'));

        // Losing the admin role ends super-admin too
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/11', ['role' => 'educator'])->assertNoContent();
        $this->assertFalse((bool) User::find(11)->is_super_admin);
    }
}
