<?php

namespace App\Actions\Fortify;

use App\Models\User;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\UpdatesUserPasswords;

/** Changing a password signs the account out everywhere else. */
class UpdateUserPassword implements UpdatesUserPasswords
{
    use PasswordValidationRules;

    /**
     * @param  array<string, string>  $input
     *
     * @throws ValidationException
     */
    public function update(User $user, array $input): void
    {
        Validator::make($input, [
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => $this->passwordRules(),
        ], [
            'current_password.current_password' => 'That isn’t your current password.',
        ])->validate();

        $user->forceFill(['password' => $input['password']])->save();

        DB::table('sessions')->where('user_id', $user->id)->where('id', '!=', session()->getId())->delete();
        Audit::log('password_changed', $user, $user);
    }
}
