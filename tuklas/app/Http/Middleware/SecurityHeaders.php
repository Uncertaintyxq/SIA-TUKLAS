<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Hardening headers on every response. API responses and files are never rendered as a page,
 * so they get the strictest policy; the app page gets config('tuklas.csp').
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $headers = $response->headers;
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $headers->set('Cross-Origin-Resource-Policy', 'same-origin');
        $headers->remove('X-Powered-By');

        $type = (string) $headers->get('Content-Type');
        if (str_starts_with($type, 'application/pdf')) {
            // Work and publication pages embed PDFs in a same-origin iframe, and the browser's PDF viewer
            // doesn't run under `sandbox`. The type is fixed by the server and nosniff is on.
            $headers->set('X-Frame-Options', 'SAMEORIGIN');
            $headers->set('Content-Security-Policy', "frame-ancestors 'self'");
        } elseif (str_contains($type, 'text/html') && ! $request->is('api/*')) {
            $headers->set('Content-Security-Policy', config('tuklas.csp'));
        } else {
            $headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
        }

        if ($request->isSecure() && app()->isProduction()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
