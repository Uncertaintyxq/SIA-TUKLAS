<?php

return [

    // Enables POST /api/demo/reset and relaxes 2FA for seeded demo accounts.
    // AppServiceProvider refuses to boot with this on in production.
    'demo_mode' => (bool) env('DEMO_MODE', false),

    // Version of the privacy notice people accept at signup (Data Privacy Act consent).
    // Bump it when the notice changes; people who accepted an older version are asked again.
    'privacy_version' => '2026-10-30',

    // Upload limits, in kilobytes
    'uploads' => [
        'max_kb' => 20 * 1024,
        'image_max_kb' => 5 * 1024,
    ],

    // Content-Security-Policy for the app page (the React build served by Laravel).
    // API responses get `default-src 'none'` instead (see App\Http\Middleware\SecurityHeaders).
    'csp' => implode('; ', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' ".env('CSP_CONNECT_EXTRA', ''),
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
    ]),

];
