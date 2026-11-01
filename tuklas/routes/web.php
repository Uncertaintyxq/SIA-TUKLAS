<?php

use App\Http\Controllers\SitemapController;
use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

/*
 * No server-rendered pages: the React app (tuklas/client) draws every screen and talks to /api.
 * Every other page URL gets the built app's index.html, and the React router picks the screen.
 */
// For search engines (SitemapController)
Route::get('/sitemap.xml', [SitemapController::class, 'sitemap'])->name('sitemap');
Route::get('/robots.txt', [SitemapController::class, 'robots'])->name('robots');

// The service worker must be served from the site's root to look after every page (offline, push)
Route::get('/sw.js', [SpaController::class, 'serviceWorker'])->name('service-worker');

// Not for API, Sanctum, build or storage paths: those stay a 404 (and a POST to one isn't a 405).
Route::fallback(SpaController::class)
    ->where('fallbackPlaceholder', '(?!(api|sanctum|build|storage)(/|$)).*');
