<?php

namespace App\Http\Responses\Auth;

use App\Http\Resources\Auth\AccountResource;
use Laravel\Fortify\Contracts\RegisterResponse;

/** After signup: 201 {user}. The account still has to confirm its email before using Tuklas. */
class RegisteredResponse implements RegisterResponse
{
    public function toResponse($request)
    {
        return response()->json(['user' => new AccountResource($request->user())], 201);
    }
}
