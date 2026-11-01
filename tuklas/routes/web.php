<?php

use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

/*
 * No server-rendered pages: the React app (tuklas/client) draws every screen and talks to /api.
 * Every other page URL gets the built app's index.html, and the React router picks the screen.
 */
// Not for API, Sanctum, build or storage paths: those stay a 404 (and a POST to one isn't a 405).
Route::fallback(SpaController::class)
    ->where('fallbackPlaceholder', '(?!(api|sanctum|build|storage)(/|$)).*');
