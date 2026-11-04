<?php

namespace Tests\Feature\Admin;

use App\Models\Department;
use App\Models\Institution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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

    private const SHOWCASE_PASSWORD_PROMPT = 'Password for every persona (12 characters or more, not in a known breach)';

    public function test_the_showcase_loads_the_demo_under_production_rules(): void
    {
        config(['tuklas.demo_mode' => false]);
        $this->artisan('tuklas:showcase', ['--domain' => 'Tuklas-UIC.me'])
            ->expectsQuestion(self::SHOWCASE_PASSWORD_PROMPT, 'a presentation passphrase')
            ->expectsConfirmation('This replaces everything on the site with the showcase. Continue?', 'yes')
            ->expectsOutputToContain('Showcase loaded')
            ->assertSuccessful();

        // Addresses on the team's domain, and each school takes its own subdomain's signups
        $andrea = User::where('email', 'andrea@tu.tuklas-uic.me')->firstOrFail();
        $this->assertTrue(User::where('email', 'alim@bsc.tuklas-uic.me')->exists());
        $this->assertTrue(User::where('email', 'rina.cruz.demo@tuklas-uic.me')->exists());
        $this->assertSame(0, User::where('email', 'like', '%@tuklas.edu')->count());
        $this->assertSame('Tuklas University', Institution::forEmail('new@tu.tuklas-uic.me')?->name);
        $this->assertSame('Bayan State College', Institution::forEmail('new@bsc.tuklas-uic.me')?->name);
        $this->assertNull(Institution::forEmail('admin@tuklas-uic.me'));
        $this->assertTrue(Hash::check('a presentation passphrase', $andrea->password));

        // Privacy notice and two-factor set-up wait for the first sign-in, as on a real site
        $this->assertNull($andrea->privacy_accepted_at);
        $santos = User::where('email', 'msantos@tu.tuklas-uic.me')->firstOrFail();
        $this->assertTrue($santos->mustUseTwoFactor() && ! $santos->hasTwoFactorEnabled());

        // The launch check still blocks real data going in while the showcase is loaded
        $this->artisan('tuklas:launch-check')->expectsOutputToContain('No showcase data is left')->assertFailed();

        // Loading it again replaces it: only its own personas exist
        $this->artisan('tuklas:showcase', ['--domain' => 'tuklas-uic.me'])
            ->expectsQuestion(self::SHOWCASE_PASSWORD_PROMPT, 'another presentation passphrase')
            ->expectsConfirmation('This replaces everything on the site with the showcase. Continue?', 'yes')
            ->assertSuccessful();
        $this->assertTrue(Hash::check('another presentation passphrase', $andrea->fresh()->password));
    }

    public function test_the_showcase_never_replaces_other_accounts(): void
    {
        config(['tuklas.demo_mode' => false]);
        User::factory()->create(['email' => 'office@uic.edu.ph']);
        $this->artisan('tuklas:showcase', ['--domain' => 'tuklas-uic.me'])
            ->expectsOutputToContain('1 other account on this site would be deleted')
            ->assertFailed();
        $this->assertTrue(User::where('email', 'office@uic.edu.ph')->exists());
        $this->assertFalse(Institution::where('name', 'Tuklas University')->exists());
    }

    public function test_the_showcase_refuses_a_weak_password_a_missing_domain_and_demo_mode(): void
    {
        config(['tuklas.demo_mode' => false]);
        $this->artisan('tuklas:showcase')->expectsOutputToContain('Give the team\'s own domain')->assertFailed();
        $this->artisan('tuklas:showcase', ['--domain' => 'tuklas-uic.me'])
            ->expectsQuestion(self::SHOWCASE_PASSWORD_PROMPT, 'tuklas123')
            ->assertFailed();
        $this->assertSame(0, User::count());

        config(['tuklas.demo_mode' => true]);
        $this->artisan('tuklas:showcase', ['--domain' => 'tuklas-uic.me'])->expectsOutputToContain('DEMO_MODE is on')->assertFailed();
    }
}
