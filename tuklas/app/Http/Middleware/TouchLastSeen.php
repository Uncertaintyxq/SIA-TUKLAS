<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records when a signed-in person was last active, at most once a minute, for chat's
 * "online" / "last seen". Live presence comes from the Reverb presence channel in the React app.
 */
class TouchLastSeen
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        /** @var User|null $user */
        $user = $request->user();
        if ($user !== null && ($user->last_seen_at === null || $user->last_seen_at->lt(now()->subMinute()))) {
            User::whereKey($user->id)->update(['last_seen_at' => now()]);
        }

        return $response;
    }
}
