<?php

use App\Http\Controllers\Moderation\ReportController;
use App\Http\Controllers\Moderation\ReportQueueController;
use Illuminate\Support\Facades\Route;

// Reporting a work, comment, message, event or person (anyone signed in)
Route::middleware(['auth:sanctum', 'account.ready'])->group(function () {
    Route::post('/reports', [ReportController::class, 'store'])->middleware('throttle:posting')->name('reports.store');
});

// The admins' Reports queue
Route::middleware(['auth:sanctum', 'account.ready', 'can:admin'])->prefix('admin/reports')->name('admin.reports.')->group(function () {
    Route::get('/', [ReportQueueController::class, 'index'])->name('index');
    Route::post('/{type}/{id}/resolve', [ReportQueueController::class, 'resolve'])
        ->whereIn('type', ['work', 'comment', 'message', 'event', 'user'])->whereNumber('id')->name('resolve');
});
