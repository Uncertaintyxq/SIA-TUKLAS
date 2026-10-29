<?php

namespace App\Actions\Fortify;

use Illuminate\Contracts\Validation\Rule;
use Illuminate\Validation\Rules\Password;

trait PasswordValidationRules
{
    /**
     * Password::defaults() (AppServiceProvider): 12–128 characters, not in a known breach.
     * Changing or resetting a password asks for it twice; signup doesn't (NIST SP 800-63B).
     *
     * @return array<int, Rule|array<mixed>|string>
     */
    protected function passwordRules(bool $confirmed = true): array
    {
        return array_values(array_filter(['required', 'string', Password::defaults(), $confirmed ? 'confirmed' : null]));
    }
}
