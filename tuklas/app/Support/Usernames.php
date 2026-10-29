<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Str;

/** Picks the public handle for a new account. */
class Usernames
{
    /** A free handle from an email's local part: "Andrea.V@tuklas.edu" → "andreav", then "andreav2", … */
    public static function unique(string $email): string
    {
        $base = substr(preg_replace('/[^a-z0-9]/', '', Str::lower(Str::before($email, '@'))) ?? '', 0, 30) ?: 'user';
        for ($n = 1; $n < 100; $n++) {
            $candidate = $n === 1 ? $base : $base.$n;
            if (! User::where('username', $candidate)->exists()) {
                return $candidate;
            }
        }

        return $base.base_convert((string) now()->getTimestampMs(), 10, 36);
    }
}
