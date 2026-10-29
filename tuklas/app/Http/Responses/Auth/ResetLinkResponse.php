<?php

namespace App\Http\Responses\Auth;

use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;

/**
 * "Forgot password" answers the same whether or not the email has an account, so the form can't
 * be used to find out who is on Tuklas. Fortify's default says "We can't find a user…".
 */
class ResetLinkResponse implements FailedPasswordResetLinkRequestResponse, SuccessfulPasswordResetLinkRequestResponse
{
    public function __construct(protected string $status = '') {}

    public function toResponse($request)
    {
        return response()->json(['status' => 'If that email has a Tuklas account, we sent it a link to reset the password.']);
    }
}
