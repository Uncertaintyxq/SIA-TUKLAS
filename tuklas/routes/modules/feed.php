<?php

use App\Http\Controllers\Feed\FeedController;
use App\Http\Controllers\Feed\OpportunityController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'account.ready'])->group(function () {
    Route::get('/feed', [FeedController::class, 'index'])->name('feed');
    Route::get('/feed/sidebar', [FeedController::class, 'sidebar'])->name('feed.sidebar');

    Route::prefix('opportunities')->name('opportunities.')->group(function () {
        Route::get('/mine', [OpportunityController::class, 'mine'])->middleware('can:review-works')->name('mine');
        Route::post('/', [OpportunityController::class, 'store'])->middleware('throttle:posting')->name('store');
        Route::delete('/{id}', [OpportunityController::class, 'destroy'])->whereNumber('id')->name('destroy');
        Route::post('/{id}/apply', [OpportunityController::class, 'apply'])->whereNumber('id')->middleware('throttle:posting')->name('apply');
        Route::delete('/{id}/apply', [OpportunityController::class, 'withdraw'])->whereNumber('id')->name('withdraw');
    });
});
