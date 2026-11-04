<?php

namespace Tests\Feature\Admin;

use App\Models\Institution;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Several schools on one site (docs/decisions/0002). Schools: 1 Tuklas University (tuklas.edu),
 * 2 Bayan State College (bayan.edu.ph). People: 1 Andrea (student, TU), 6 Lea (admin and
 * super-admin, TU), 8 Miguel Torres (student, Bayan), 10 Rina Cruz (student, picked Bayan with a
 * personal email, not confirmed yet).
 */
class InstitutionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    private function signup(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/auth/register', [
            'name' => 'Nina Bautista', 'email' => 'nina@bayan.edu.ph', 'password' => 'a long enough passphrase',
            'role' => 'student', 'program' => 'BS Agriculture', 'privacy' => true, ...$overrides,
        ]);
    }

    public function test_signup_with_a_school_email_joins_that_school(): void
    {
        $this->getJson('/api/institutions')->assertOk()->assertJsonCount(2)->assertJsonPath('0.name', 'Bayan State College');

        $this->signup(['email' => 'nina@students.bayan.edu.ph'])->assertCreated()
            ->assertJsonPath('user.institution.id', 2)->assertJsonPath('user.schoolConfirmationRequired', false);
        $this->assertNotNull(User::where('username', 'nina')->value('institution_confirmed_at'));
    }

    public function test_without_a_school_email_the_school_confirms_the_account(): void
    {
        $this->signup(['email' => 'nina@gmail.com'])->assertUnprocessable()->assertJsonValidationErrors('institutionId', 'issues');
        $this->signup(['email' => 'nina@gmail.com', 'institutionId' => 99])->assertUnprocessable()->assertJsonValidationErrors('institutionId', 'issues');

        $this->signup(['email' => 'nina@gmail.com', 'institutionId' => 2])->assertCreated()
            ->assertJsonPath('user.institution.shortName', 'BSC')->assertJsonPath('user.schoolConfirmationRequired', true);
        $nina = User::where('email', 'nina@gmail.com')->first();
        $this->assertTrue(Notification::where('user_id', 6)->where('type', 'school_signup')->exists());

        // Until then she can't use Tuklas
        $nina->forceFill(['email_verified_at' => now()])->save();
        $this->actingAs($nina)->getJson('/api/feed')->assertForbidden()->assertJsonPath('code', 'school_unconfirmed');
        $this->actingAs($nina)->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.schoolConfirmationRequired', true);
    }

    public function test_picking_another_school_than_the_email_says_also_waits(): void
    {
        $this->signup(['email' => 'nina@tuklas.edu', 'institutionId' => 2])->assertCreated()
            ->assertJsonPath('user.institution.id', 2)->assertJsonPath('user.schoolConfirmationRequired', true);
    }

    public function test_an_admin_confirms_someone_waiting(): void
    {
        $queue = $this->actingAs(User::find(6))->getJson('/api/admin/queue')->assertOk();
        $this->assertSame([10], array_column($queue->json('schools'), 'id'));
        $this->actingAs(User::find(6))->getJson('/api/admin/stats')->assertJsonPath('unconfirmedSchools', 1);

        $this->actingAs(User::find(6))->patchJson('/api/admin/users/10', ['schoolConfirmed' => true])->assertNoContent();
        $this->assertSame('Bayan State College confirmed your account. Welcome to Tuklas.', Notification::where('user_id', 10)->where('type', 'school_confirmed')->value('message'));
        $this->actingAs(User::find(10))->getJson('/api/feed')->assertOk();
        $this->assertSame([], $this->actingAs(User::find(6))->getJson('/api/admin/queue')->json('schools'));
    }

    public function test_only_super_admins_move_people_and_manage_schools(): void
    {
        User::find(6)->forceFill(['is_super_admin' => false])->save();
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/8', ['institutionId' => 1])->assertForbidden();
        $this->actingAs(User::find(6))->getJson('/api/admin/institutions')->assertForbidden();
        $this->actingAs(User::find(1))->getJson('/api/admin/institutions')->assertForbidden();

        User::find(6)->forceFill(['is_super_admin' => true])->save();
        $this->actingAs(User::find(6))->patchJson('/api/admin/users/8', ['institutionId' => 1])->assertNoContent();
        $this->assertSame(1, User::find(8)->institution_id);
        $this->assertTrue(Notification::where('user_id', 8)->where('type', 'school_changed')->exists());
        $this->actingAs(User::find(6))->getJson('/api/admin/institutions')->assertOk()
            ->assertJsonPath('0.name', 'Bayan State College')->assertJsonPath('0.people', 3)->assertJsonPath('1.people', 8);
    }

    public function test_super_admins_add_and_edit_schools(): void
    {
        $lea = User::find(6);
        $id = $this->actingAs($lea)->postJson('/api/admin/institutions', ['name' => 'Ilog Institute', 'shortName' => 'II', 'emailDomains' => ['ILOG.edu.ph']])
            ->assertCreated()->json('id');
        $this->assertSame(['ilog.edu.ph'], Institution::find($id)->email_domains);

        // A domain belongs to one school; names are unique; domains look like domains
        $this->actingAs($lea)->postJson('/api/admin/institutions', ['name' => 'Other', 'emailDomains' => ['bayan.edu.ph']])->assertUnprocessable()->assertJsonValidationErrors('emailDomains', 'issues');
        $this->actingAs($lea)->postJson('/api/admin/institutions', ['name' => 'Ilog Institute', 'emailDomains' => []])->assertUnprocessable()->assertJsonValidationErrors('name', 'issues');
        $this->actingAs($lea)->postJson('/api/admin/institutions', ['name' => 'Bad', 'emailDomains' => ['@bad']])->assertUnprocessable();

        // Renaming shows at once on person cards; a school turned off takes no signups
        $this->actingAs($lea)->putJson('/api/admin/institutions/2', ['name' => 'Bayan University', 'shortName' => 'BU', 'emailDomains' => ['bayan.edu.ph'], 'active' => false])->assertNoContent();
        $this->actingAs($lea)->getJson('/api/users/mtorres/portfolio')->assertJsonPath('user.institution.name', 'Bayan University');
        $this->signOut();
        $this->signup()->assertUnprocessable()->assertJsonValidationErrors('institutionId', 'issues');
    }

    public function test_person_cards_pages_and_the_export_carry_the_school(): void
    {
        $this->getJson('/api/users/andrea/portfolio')->assertOk()->assertJsonPath('user.institution', ['id' => 1, 'name' => 'Tuklas University', 'shortName' => 'TU']);
        $this->actingAs(User::find(8))->getJson('/api/account/export')->assertOk()->assertJsonPath('account.institution', 'Bayan State College');

        config(['tuklas.spa_index' => $index = tempnam(sys_get_temp_dir(), 'spa')]);
        file_put_contents($index, "<!doctype html>\n<html>\n  <head>\n    <title>Tuklas</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n  </body>\n</html>\n");
        $this->signOut()->get('/works/1')->assertOk()->assertSee('<meta name="citation_dissertation_institution" content="Tuklas University">', false);
        unlink($index);
    }
}
