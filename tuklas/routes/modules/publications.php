<?php

use App\Http\Controllers\Publications\PublicationController;
use Illuminate\Support\Facades\Route;

Route::prefix('publications')->name('publications.')->group(function () {
    // Public research opens without signing in (PublicationPolicy::view)
    Route::get('/', [PublicationController::class, 'index'])->name('index');
    Route::get('/{id}', [PublicationController::class, 'show'])->whereNumber('id')->name('show');
    Route::get('/{id}/pdf', [PublicationController::class, 'pdf'])->whereNumber('id')->name('pdf.show');

    Route::middleware(['auth:sanctum', 'account.ready'])->group(function () {
        Route::get('/mine', [PublicationController::class, 'mine'])->name('mine');
        Route::post('/', [PublicationController::class, 'store'])->middleware('throttle:posting')->name('store');
        Route::put('/{id}', [PublicationController::class, 'update'])->whereNumber('id')->name('update');
        Route::delete('/{id}', [PublicationController::class, 'destroy'])->whereNumber('id')->name('destroy');
        Route::put('/{id}/pdf', [PublicationController::class, 'uploadPdf'])->whereNumber('id')->middleware('throttle:uploads')->name('pdf.store');
        Route::delete('/{id}/pdf', [PublicationController::class, 'removePdf'])->whereNumber('id')->name('pdf.destroy');
    });
});
