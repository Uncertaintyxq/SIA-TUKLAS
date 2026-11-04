<?php

namespace Tests\Feature\Admin;

use App\Models\Department;
use App\Models\Institution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The commands that set up a fresh production server (docs/PRODUCTION_SERVER.md): schools, the first admins, the launch check. */
class ServerCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_adding_a_school_with_its_domains_and_departments(): void
    {
        $this->artisan('tuklas:school', ['name' => 'University of the Immaculate Conception', '--short' => 'UIC', '--domain' => ['@UIC.edu.ph'], '--department' => ['College of Computing', 'College of Nursing']])
            ->expectsOutputToContain('Added University of the Immaculate Conception')
            ->assertSuccessful();
        $school = Institution::where('short_name', 'UIC')->firstOrFail();
        $this->assertSame(['uic.edu.ph'], $school->email_domains);
        $this->assertSame(2, Department::where('institution_id', $school->id)->count());

        // Running it again adds what's new and keeps the rest
        $this->artisan('tuklas:school', ['name' => 'University of the Immaculate Conception', '--domain' => ['students.uic.edu.ph'], '--department' => ['College of Nursing', 'College of Law']])->assertSuccessful();
        $this->assertSame(['uic.edu.ph', 'students.uic.edu.ph'], $school->fresh()->email_domains);
        $this->assertSame('UIC', $school->fresh()->short_name);
        $this->assertSame(3, Department::where('institution_id', $school->id)->count());

        // A domain belongs to one school
        $this->artisan('tuklas:school', ['name' => 'Another School', '--domain' => ['uic.edu.ph']])->expectsOutputToContain('already belongs to')->assertFailed();
        $this->artisan('tuklas:school', ['name' => 'Another School', '--domain' => ['not a domain']])->assertFailed();
    }

    public function test_making_the_first_super_admin_and_a_school_admin(): void
    {
        $this->artisan('tuklas:school', ['name' => 'University of the Immaculate Conception', '--short' => 'UIC'])->assertSuccessful();

        $this->artisan('tuklas:admin', ['email' => 'office@uic.edu.ph', '--name' => 'Research Office', '--super' => true])
            ->expectsQuestion('Password (12 characters or more; they can change it later)', 'a long enough passphrase')
            ->expectsOutputToContain('is a super-admin')
            ->assertSuccessful();
        $super = User::where('email', 'office@uic.edu.ph')->firstOrFail();
        $this->assertTrue($super->isSuperAdmin());
        $this->assertNotNull($super->email_verified_at);
        $this->assertTrue($super->mustUseTwoFactor());

        // A school admin needs a school; a short password is refused
        $this->artisan('tuklas:admin', ['email' => 'dean@uic.edu.ph', '--name' => 'Dean'])->expectsOutputToContain('Say which school')->assertFailed();
        $this->artisan('tuklas:admin', ['email' => 'dean@uic.edu.ph', '--name' => 'Dean', '--school' => 'UIC'])->expectsOutputToContain('There\'s no school')->assertFailed();
        $this->artisan('tuklas:admin', ['email' => 'dean@uic.edu.ph', '--name' => 'Dean', '--school' => 'University of the Immaculate Conception'])
            ->expectsQuestion('Password (12 characters or more; they can change it later)', 'short')
            ->assertFailed();

        // An existing account is promoted
        $student = User::factory()->create(['email' => 'teacher@uic.edu.ph']);
        $id = Institution::value('id');
        $this->artisan('tuklas:admin', ['email' => 'teacher@uic.edu.ph', '--school' => (string) $id])->expectsOutputToContain('is an admin of University of the Immaculate Conception')->assertSuccessful();
        $this->assertTrue($student->fresh()->isAdmin());
        $this->assertFalse($student->fresh()->isSuperAdmin());
    }

    public function test_the_launch_check_blocks_a_demo_site(): void
    {
        $this->seedDemo();
        $this->artisan('tuklas:launch-check')
            ->expectsOutputToContain('APP_ENV is production')
            ->expectsOutputToContain('No demo accounts')
            ->assertFailed();
    }
}
