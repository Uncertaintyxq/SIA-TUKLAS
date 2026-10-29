<?php

use Illuminate\Support\Facades\Broadcast;

/*
 * Every route here is under /api. Each module keeps its routes in routes/modules/<module>.php;
 * this file only loads them, so two people rarely edit it at once. Append new modules at the end.
 *
 * Login, logout, signup, 2FA, email verification and password reset are Fortify's routes, also
 * under /api/auth (config/fortify.php).
 */

require __DIR__.'/modules/auth.php';
require __DIR__.'/modules/users.php';
require __DIR__.'/modules/works.php';
require __DIR__.'/modules/feed.php';
require __DIR__.'/modules/events.php';
require __DIR__.'/modules/publications.php';
require __DIR__.'/modules/notifications.php';
require __DIR__.'/modules/groups.php';
require __DIR__.'/modules/announcements.php';
require __DIR__.'/modules/chat.php';
require __DIR__.'/modules/admin.php';
require __DIR__.'/modules/account.php';

// Real-time: POST /api/broadcasting/auth signs Reverb channel subscriptions (routes/channels.php)
Broadcast::routes(['middleware' => ['auth:sanctum', 'account.ready']]);
require __DIR__.'/channels.php';
