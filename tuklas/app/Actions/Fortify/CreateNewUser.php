<?php

namespace App\Actions\Fortify;

use App\Enums\Role;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Usernames;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

/**
 * Signup for students and educators. Admin accounts are issued by the Office of Research, never
 * self-created. Educators can't approve work until an admin verifies them.
 */
class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function create(array $input): User
    {
        $input['name'] = trim((string) ($input['name'] ?? ''));
        $input['program'] = trim((string) ($input['program'] ?? ''));

        Validator::make($input, [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email:rfc', 'max:191', Rule::unique(User::class)],
            'password' => $this->passwordRules(confirmed: false),
            'role' => ['required', Rule::enum(Role::class)->only([Role::Student, Role::Educator])],
            'program' => ['required', 'string', 'min:2', 'max:160'],
            // Data Privacy Act: consent to the privacy notice is required to create an account
            'privacy' => ['accepted'],
        ], [
            'name.min' => 'Enter your full name',
            'email.unique' => 'That email already has an account. Try logging in.',
            'program.required' => 'Enter your program or department',
            'privacy.accepted' => 'Please read and accept the privacy notice to create an account.',
        ])->validate();

        return DB::transaction(function () use ($input) {
            $role = Role::from($input['role']);
            $user = new User([
                'name' => $input['name'],
                'username' => Usernames::unique($input['email']),
                'email' => $input['email'],
                'password' => $input['password'],
                'role' => $role,
                'program' => $input['program'],
                'privacy_accepted_at' => now(),
                'privacy_version' => config('tuklas.privacy_version'),
            ]);
            $user->verified = $role !== Role::Educator;
            $user->save();
            $user->profile()->create();

            if ($role === Role::Educator) {
                Notifier::notifyAdmins('educator_signup', "{$user->name} signed up as an educator and is waiting for verification.", '/admin?tab=educators');
            }

            return $user;
        });
    }
}
