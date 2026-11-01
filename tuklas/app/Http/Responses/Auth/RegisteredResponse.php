<?php

namespace App\Http\Responses\Auth;

use App\Http\Resources\Auth\AccountResource;
use Laravel\Fortify\Contracts\RegisterResponse;

/**
 * After signup: 201 {user}. The account still has to confirm its email before using Tuklas.
 * The password was just chosen, so it counts as confirmed (an educator sets up 2FA next).
 */
class RegisteredResponse implements RegisterResponse
{
    public function toResponse($request)
    {
        $request->session()->passwordConfirmed();

        return response()->json(['user' => new AccountResource($request->user())], 201);
    }
}
