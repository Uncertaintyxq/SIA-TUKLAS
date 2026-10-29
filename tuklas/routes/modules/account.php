<?php

use App\Http\Controllers\Account\PrivacyController;
use Illuminate\Support\Facades\Route;

// My own account: data export, sessions and consent. No account.ready, so someone who still has
// to confirm their email or set up 2FA can also download their data or accept the privacy notice.
Route::middleware(['auth:sanctum', 'throttle:auth'])->prefix('account')->name('account.')->group(function () {
    Route::get('/export', [PrivacyController::class, 'export'])->name('export');
    Route::get('/sessions', [PrivacyController::class, 'sessions'])->name('sessions');
    Route::post('/sessions/logout-others', [PrivacyController::class, 'logoutOthers'])->name('sessions.logout-others');
    Route::post('/privacy', [PrivacyController::class, 'acceptPrivacy'])->name('privacy');
});
