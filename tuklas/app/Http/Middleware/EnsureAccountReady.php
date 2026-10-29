<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A signed-in account can use Tuklas only once its email is verified and, for admins and
 * educators, two-factor sign-in is set up (docs/CONVERSION.md D6). The `code` tells the React app
 * which setup screen to show. Signed-out requests pass through; routes that need a session add `auth`.
 */
class EnsureAccountReady
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();
        if ($user === null || config('tuklas.demo_mode')) {
            return $next($request);
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'error' => 'Confirm your email address first. We sent you a link.',
                'code' => 'email_unverified',
            ], 403);
        }

        if ($user->mustUseTwoFactor() && ! $user->hasTwoFactorEnabled()) {
            return response()->json([
                'error' => 'Set up two-factor sign-in to keep using your account.',
                'code' => 'two_factor_required',
            ], 403);
        }

        return $next($request);
    }
}
