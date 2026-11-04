<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\Institution;
use App\Models\User;
use Dotenv\Dotenv;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * The parts of the launch checklist the app can see for itself (docs/DEPLOYMENT.md, "Security
 * checklist" and docs/PRODUCTION_SERVER.md). It reports whether each setting is there, never its
 * value. Exits with an error while anything must still be fixed; warnings are for a person to judge.
 */
#[Signature('tuklas:launch-check')]
#[Description('Check the production settings and first accounts before real data goes in')]
class LaunchCheck extends Command
{
    private int $failed = 0;

    public function handle(): int
    {
        // Backups are run by deploy/backup.sh from the .env file, not through Laravel's config
        $env = is_file(base_path('.env')) ? Dotenv::parse((string) file_get_contents(base_path('.env'))) : [];

        $this->line('<options=bold>Settings</>');
        $this->check(app()->environment('production'), 'APP_ENV is production');
        $this->check(! config('app.debug'), 'APP_DEBUG is off');
        $this->check(str_starts_with((string) config('app.url'), 'https://'), 'APP_URL is https://');
        $this->check(! config('tuklas.demo_mode'), 'DEMO_MODE is off');
        $this->check((bool) config('session.secure'), 'SESSION_SECURE_COOKIE is on');
        $this->check((bool) config('session.encrypt'), 'SESSION_ENCRYPT is on');
        $this->check(! in_array(config('mail.default'), ['log', 'array', null], true), 'Mail goes out through a real provider (MAIL_MAILER is not log)');
        $this->check(! str_ends_with((string) config('mail.from.address'), '@example.com') && (string) config('mail.from.address') !== '', 'MAIL_FROM_ADDRESS is set');
        $this->check(config('tuklas.push.public_key') !== '' && config('tuklas.push.private_key') !== '', 'Push notification keys are set (WEBPUSH_*)');
        $this->check(in_array($env['LOG_LEVEL'] ?? '', ['warning', 'error', 'critical'], true), 'LOG_LEVEL is warning or quieter', warn: true);

        $this->check(($env['BACKUP_AGE_RECIPIENT'] ?? '') !== '', 'Backups are encrypted (BACKUP_AGE_RECIPIENT)');
        $this->check(($env['BACKUP_RCLONE_REMOTE'] ?? '') !== '', 'Backups are copied off the server (BACKUP_RCLONE_REMOTE)');

        $this->line('');
        $this->line('<options=bold>People and schools</>');
        $supers = User::active()->where('role', Role::Admin)->where('is_super_admin', true)->get();
        $this->check($supers->isNotEmpty(), 'There is a super-admin (php artisan tuklas:admin <email> --super)');
        $this->check($supers->count() >= 2, 'At least two super-admins, so access isn\'t lost if one leaves', warn: true);
        $this->check($supers->isNotEmpty() && $supers->every(fn (User $u) => $u->hasTwoFactorEnabled()), 'Every super-admin has two-factor sign-in on', warn: true);
        $schools = Institution::active()->get();
        $this->check($schools->isNotEmpty(), 'There is at least one school (php artisan tuklas:school "<name>" --domain=…)');
        foreach ($schools as $school) {
            $this->check(($school->email_domains ?? []) !== [], "{$school->name} has an email domain (otherwise every signup waits for an admin)", warn: true);
            $this->check(User::active()->where('role', Role::Admin)->where('institution_id', $school->id)->exists(), "{$school->name} has its own admin (php artisan tuklas:admin <email> --school={$school->id})", warn: true);
        }
        $this->check(! User::where('email', 'like', '%@tuklas.edu')->exists(), 'No demo accounts (@tuklas.edu) are left');

        $this->line('');
        $this->line('<options=bold>By hand</> (the app can\'t see these; tick them in docs/DEPLOYMENT.md)');
        $this->check(config('tuklas.privacy_version') !== '2026-10-30', 'The approved privacy notice replaced the 2026-10-30 draft (PRIVACY_VERSION bumped)', warn: true);
        foreach (['HTTPS grades A on SSL Labs and securityheaders.com', 'SPF, DKIM and DMARC records for the mail domain', 'Firewall: only 22, 80 and 443 open; SSH by key only',
            'One restore tested from the off-server backup copy', 'A data processing agreement signed with each school'] as $manual) {
            $this->line("  <fg=gray>[ ]</> {$manual}");
        }

        $this->line('');
        if ($this->failed > 0) {
            $this->error("{$this->failed} thing".($this->failed === 1 ? '' : 's').' to fix before real data goes in.');

            return self::FAILURE;
        }
        $this->info('Nothing the app can see is blocking launch. Finish the by-hand items too.');

        return self::SUCCESS;
    }

    private function check(bool $ok, string $label, bool $warn = false): void
    {
        if ($ok) {
            $this->line("  <fg=green>ok</>   {$label}");

            return;
        }
        if ($warn) {
            $this->line("  <fg=yellow>warn</> {$label}");

            return;
        }
        $this->failed++;
        $this->line("  <fg=red>fix</>  {$label}");
    }
}
