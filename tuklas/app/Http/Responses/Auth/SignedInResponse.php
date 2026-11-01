<?php

namespace App\Http\Responses\Auth;

use App\Http\Resources\Auth\AccountResource;
use Laravel\Fortify\Contracts\LoginResponse;
use Laravel\Fortify\Contracts\TwoFactorLoginResponse;

/**
 * After a successful login (or 2FA challenge): {user}, the shape the React app already reads.
 * When the account has 2FA, Fortify answers the login with {two_factor: true} first instead.
 * The password was just entered, so it counts as confirmed: setting up 2FA right after logging in
 * doesn't ask for it again (the usual password-confirmation timeout still applies afterwards).
 */
class SignedInResponse implements LoginResponse, TwoFactorLoginResponse
{
    public function toResponse($request)
    {
        $request->session()->passwordConfirmed();

        return response()->json(['user' => new AccountResource($request->user())]);
    }
}
