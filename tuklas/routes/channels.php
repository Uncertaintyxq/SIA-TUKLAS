<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
 * Real-time channels (Laravel Reverb). Events only say what changed; the React app refetches
 * through the API, so every access rule still runs there. Authorized at /api/broadcasting/auth.
 */

// Each person's own live updates (App\Events\RealtimePush)
Broadcast::channel('users.{id}', fn (User $user, int $id) => $user->id === $id);

// Who is online, for chat. Shares only the id and name of signed-in people.
Broadcast::channel('online', fn (User $user) => ['id' => $user->id, 'name' => $user->name]);
