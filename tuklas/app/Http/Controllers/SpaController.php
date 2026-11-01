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
}
