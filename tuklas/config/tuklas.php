<?php

return [

    // Enables POST /api/demo/reset and relaxes 2FA for seeded demo accounts.
    // AppServiceProvider refuses to boot with this on in production.
    'demo_mode' => (bool) env('DEMO_MODE', false),

    // Web Push (notifications on phones and browsers). VAPID keys identify this server to push
    // services: `php artisan tuklas:vapid-keys` makes a pair (deploy.sh does it on servers).
    'push' => [
        'public_key' => env('WEBPUSH_PUBLIC_KEY', ''),
        'private_key' => env('WEBPUSH_PRIVATE_KEY', ''),
        'subject' => env('WEBPUSH_SUBJECT', env('APP_URL', 'https://localhost')),
    ],

    // Google Scholar's citation_dissertation_institution (PageMeta) on a site without schools; with
    // schools, each author's own school is used. Also names the one school existing accounts join (docs/decisions/0002)
    'institution' => env('TUKLAS_INSTITUTION', ''),

    // Version of the privacy notice people accept at signup (Data Privacy Act consent).
    // Bump it when the notice changes; people who accepted an older version are asked again.
    'privacy_version' => '2026-10-30',

    // Upload limits, in kilobytes
    'uploads' => [
        'max_kb' => 20 * 1024,
        'image_max_kb' => 5 * 1024,
    ],

    // The built React app's page (npm run build writes it). routes/web.php returns it for every
    // page URL, and the React router takes it from there.
    'spa_index' => env('SPA_INDEX', public_path('build/index.html')),

    // Content-Security-Policy for the app page (the React build served by Laravel).
    // API responses get `default-src 'none'` instead (see App\Http\Middleware\SecurityHeaders).
    'csp' => implode('; ', array_filter([
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' ".env('CSP_CONNECT_EXTRA', ''),
        "object-src 'none'",
        // The service worker (/sw.js) and the install manifest, from this site only
        "worker-src 'self'",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        // Only on an HTTPS site: on plain HTTP (a server before its certificate) it would break every request.
        str_starts_with((string) env('APP_URL'), 'https://') ? 'upgrade-insecure-requests' : null,
    ])),

];
