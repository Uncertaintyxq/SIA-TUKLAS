<?php

namespace App\Http\Controllers;

use App\Support\PageMeta;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Serves the built React app's index.html for any page URL (/groups/4, /login, …), with the page's
 * own title and search details for public works, publications and portfolios (PageMeta).
 * SecurityHeaders adds the app page's Content-Security-Policy. The scripts and styles it loads are files under
 * public/build/, served straight from disk.
 */
class SpaController
{
    public function __invoke(Request $request): Response
    {
        // A missing file (/logo.png) stays a 404 instead of becoming the app page
        if (pathinfo($request->path(), PATHINFO_EXTENSION) !== '') {
            throw new NotFoundHttpException;
        }

        $index = config('tuklas.spa_index');
        if (! is_file($index)) {
            return response(
                "The React app isn't built yet. In development open http://localhost:5173 (npm run dev); on a server run npm run build.",
                503,
                ['Content-Type' => 'text/plain; charset=UTF-8'],
            );
        }

        $path = $request->path();
        $html = PageMeta::apply((string) file_get_contents($index), PageMeta::for($path), $path);

        // Never cached: it names the current build's files, so a new release must be picked up at once
        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, must-revalidate',
        ]);
    }

    /**
     * GET /sw.js — the service worker from the build (client/public/sw.js). The build lives under
     * /build/, but a worker only looks after pages below its own address, so it's served from the
     * root. Never cached, so browsers pick up a new one with each release.
     */
    public function serviceWorker(): Response
    {
        $file = dirname((string) config('tuklas.spa_index')).'/sw.js';
        if (! is_file($file)) {
            throw new NotFoundHttpException;
        }

        return response((string) file_get_contents($file), 200, [
            'Content-Type' => 'text/javascript; charset=UTF-8',
            'Cache-Control' => 'no-cache, must-revalidate',
            'Service-Worker-Allowed' => '/',
        ]);
    }
}
