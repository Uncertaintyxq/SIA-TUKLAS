<?php

use App\Http\Controllers\Events\AdController;
use App\Http\Controllers\Events\EventController;
use Illuminate\Support\Facades\Route;

// Ad images show in the feed sidebar; approved ones are public (AdController::image)
Route::get('/ads/{id}/image', [AdController::class, 'image'])->whereNumber('id')->name('ads.image');

Route::middleware(['auth:sanctum', 'account.ready'])->group(function () {
    Route::prefix('events')->name('events.')->group(function () {
        Route::get('/', [EventController::class, 'index'])->name('index');
        Route::get('/{id}', [EventController::class, 'show'])->whereNumber('id')->name('show');
        Route::post('/', [EventController::class, 'store'])->middleware('throttle:posting')->name('store');
        Route::delete('/{id}', [EventController::class, 'destroy'])->whereNumber('id')->name('destroy');
        Route::post('/{id}/register', [EventController::class, 'register'])->whereNumber('id')->name('register');
        Route::delete('/{id}/register', [EventController::class, 'unregister'])->whereNumber('id')->name('unregister');
        Route::post('/{id}/ads', [EventController::class, 'storeAd'])->whereNumber('id')->middleware('throttle:posting')->name('ads.store');
    });

    Route::put('/ads/{id}/image', [AdController::class, 'uploadImage'])->whereNumber('id')->middleware('throttle:uploads')->name('ads.image.store');
    Route::delete('/ads/{id}', [AdController::class, 'destroy'])->whereNumber('id')->name('ads.destroy');
});
