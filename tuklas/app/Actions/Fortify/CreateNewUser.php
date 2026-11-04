<?php

namespace App\Actions\Fortify;

use App\Enums\Role;
use App\Models\Institution;
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
 *
 * The school comes from the email domain. Without a school email, the person picks their school
 * and waits until its admins confirm them (docs/decisions/0002). A site with no schools yet skips this.
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
            'institutionId' => ['nullable', 'integer'],
        ], [
            'name.min' => 'Enter your full name',
            'email.unique' => 'That email already has an account. Try logging in.',
            'program.required' => 'Enter your program or department',
            'privacy.accepted' => 'Please read and accept the privacy notice to create an account.',
        ])->validate();

        [$school, $confirmed] = $this->school((string) $input['email'], $input['institutionId'] ?? null);

        return DB::transaction(function () use ($input, $school, $confirmed) {
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
            $user->forceFill(['institution_id' => $school?->id, 'institution_confirmed_at' => $school && $confirmed ? now() : null]);
            $user->save();
            $user->profile()->create();

            if ($role === Role::Educator) {
                Notifier::notifyAdmins('educator_signup', "{$user->name} signed up as an educator and is waiting for verification.", '/admin?tab=educators');
            }

            if ($school && ! $confirmed) {
                Notifier::notifyAdmins('school_signup', "{$user->name} signed up to {$school->name} without a school email and is waiting for you to confirm them.", '/admin?tab=schools');
            }

            return $user;
        });
    }

    /**
     * The school and whether it's confirmed already: a matching email domain confirms it; a school
     * picked by hand waits for its admins.
     *
     * @return array{0: ?Institution, 1: bool}
     *
     * @throws ValidationException
     */
    private function school(string $email, mixed $chosen): array
    {
        if (! Institution::active()->exists()) {
            return [null, true];
        }
        $matched = Institution::forEmail($email);
        $picked = $chosen !== null && $chosen !== '' ? Institution::active()->find((int) $chosen) : null;
        if ($chosen !== null && $chosen !== '' && $picked === null) {
            throw ValidationException::withMessages(['institutionId' => 'That school isn’t on Tuklas.']);
        }
        if ($picked !== null && $picked->id !== $matched?->id) {
            return [$picked, false];
        }
        if ($matched !== null) {
            return [$matched, true];
        }

        throw ValidationException::withMessages(['institutionId' => 'Choose your school. Without a school email, its admins confirm your account.']);
    }
}
