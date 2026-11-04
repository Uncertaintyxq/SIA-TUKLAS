<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\Institution;
use App\Models\User;
use App\Support\Audit;
use App\Support\Usernames;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Makes an admin on the server: the first super-admin at launch, or a school's admin (admin
 * accounts are never self-created, docs/decisions/0002). An existing account is promoted;
 * otherwise one is created and the password asked for here (never on the command line). They set
 * up two-factor sign-in and accept the privacy notice the first time they sign in.
 */
#[Signature('tuklas:admin {email : Their email address}
    {--name= : Full name (for a new account)}
    {--school= : The school they act for: its id or exact name}
    {--super : A super-admin: acts for every school}')]
#[Description('Make an admin or super-admin (the first one at launch)')]
class MakeAdmin extends Command
{
    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->argument('email')));
        if (Validator::make(['email' => $email], ['email' => ['required', 'email:rfc']])->fails()) {
            $this->error('Enter a valid email address.');

            return self::FAILURE;
        }
        $schoolOption = trim((string) $this->option('school'));
        $school = $schoolOption === '' ? null : (ctype_digit($schoolOption) ? Institution::find((int) $schoolOption) : Institution::where('name', $schoolOption)->first());
        if ($schoolOption !== '' && $school === null) {
            $this->error("There's no school \"{$schoolOption}\". Add it first: php artisan tuklas:school \"<name>\".");

            return self::FAILURE;
        }
        if ($school === null && ! $this->option('super') && Institution::exists()) {
            $this->error('Say which school they act for (--school=), or make them a super-admin (--super).');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if ($user === null) {
            $name = trim((string) ($this->option('name') ?: $this->ask('Full name')));
            $password = (string) $this->secret('Password (12 characters or more; they can change it later)');
            $check = Validator::make(['name' => $name, 'password' => $password], ['name' => ['required', 'string', 'min:2', 'max:120'], 'password' => ['required', Password::min(12)]]);
            if ($check->fails()) {
                $this->error((string) $check->errors()->first());

                return self::FAILURE;
            }
            $user = DB::transaction(function () use ($name, $email, $password) {
                $user = new User(['name' => $name, 'username' => Usernames::unique($email), 'email' => $email, 'password' => $password, 'role' => Role::Admin, 'program' => 'Admin']);
                $user->forceFill(['email_verified_at' => now()])->save();
                $user->profile()->create();

                return $user;
            });
        }

        $user->forceFill([
            'role' => Role::Admin,
            'verified' => true,
            'institution_id' => $school->id ?? $user->institution_id,
            'institution_confirmed_at' => $user->institution_confirmed_at ?? now(),
            'is_super_admin' => (bool) $this->option('super'),
        ])->save();
        Audit::log('admin_made_on_server', null, $user, ['super' => (bool) $this->option('super')]);

        $what = $user->is_super_admin ? 'a super-admin (every school)' : 'an admin of '.($user->school()->name ?? 'this site');
        $this->info("{$user->name} <{$user->email}> is {$what}.");
        $this->line('On first sign-in they set up two-factor sign-in and accept the privacy notice.');

        return self::SUCCESS;
    }
}
