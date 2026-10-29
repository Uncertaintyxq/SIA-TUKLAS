<?php

use App\Http\Controllers\Auth\AccountController;
use Illuminate\Support\Facades\Route;

// The signed-in account. No account.ready here: the React app reads it to find out whether the
// email still needs confirming or 2FA still needs setting up.
Route::middleware('auth:sanctum')->prefix('auth')->group(function () {
    Route::get('/me', [AccountController::class, 'show'])->name('auth.me');
});
