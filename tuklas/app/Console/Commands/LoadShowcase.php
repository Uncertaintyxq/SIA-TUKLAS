<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Audit;
use Database\Seeders\DemoSeeder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Loads the demo people, works, groups and chat on a production site that's shown to the client
 * before real data goes in (docs/PRODUCTION_SERVER.md, "Showcase data"). Production rules still
 * hold: the personas get addresses on the team's own domain, one strong password asked for here
 * (never on the command line), and they set up two-factor sign-in and accept the privacy notice at
 * first sign-in. It replaces all the app's data, so it refuses while any other account exists.
 */
#[Signature('tuklas:showcase {--domain= : The team\'s domain: personas get addresses on tu.<domain> and bsc.<domain>}')]
#[Description('Load the demo people and their work on a production site, for a presentation')]
class LoadShowcase extends Command
{
    public function handle(DemoSeeder $seeder): int
    {
        if (config('tuklas.demo_mode')) {
            $this->error('DEMO_MODE is on, so this site has the demo already ("Reset demo data" in the user menu).');

            return self::FAILURE;
        }
        $domain = mb_strtolower(trim((string) $this->option('domain')));
        if (! preg_match('/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/', $domain)) {
            $this->error('Give the team\'s own domain, e.g. --domain=tuklas-uic.me (its emails must reach the team).');

            return self::FAILURE;
        }

        $addresses = $seeder->forShowcase($domain, '')->addresses();
        $others = User::whereNotIn('email', $addresses)->count();
        if ($others > 0) {
            $this->error("{$others} other account".($others === 1 ? '' : 's').' on this site would be deleted. The showcase only loads on a site without real data:');
            $this->line('  empty it first with php artisan migrate:fresh --force, then load the showcase, then make the team\'s admins (tuklas:admin).');

            return self::FAILURE;
        }

        $password = (string) $this->secret('Password for every persona (12 characters or more, not in a known breach)');
        $check = Validator::make(['password' => $password], ['password' => ['required', Password::defaults()]]);
        if ($check->fails()) {
            $this->error((string) $check->errors()->first());

            return self::FAILURE;
        }
        if (! $this->confirm('This replaces everything on the site with the showcase. Continue?')) {
            return self::FAILURE;
        }

        $seeder->forShowcase($domain, $password)->run();
        Audit::log('showcase_loaded', null, null, ['domain' => $domain]);

        $this->info('Showcase loaded. The personas (the password is the one you just typed):');
        $this->table(['Name', 'Email', 'Role'], User::orderBy('id')->get()->map(fn (User $u) => [$u->name, $u->email, $u->is_super_admin ? 'super-admin' : $u->role->value])->all());
        $this->line('Before the presentation: sign in once as each admin and educator to set up two-factor sign-in.');
        $this->line('Before real data: php artisan migrate:fresh --force (tuklas:launch-check fails while the showcase is loaded).');

        return self::SUCCESS;
    }
}
