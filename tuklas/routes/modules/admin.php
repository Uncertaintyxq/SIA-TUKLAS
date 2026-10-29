<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ModerationController;
use App\Http\Controllers\Admin\PeopleController;
use App\Http\Controllers\DemoController;
use Illuminate\Support\Facades\Route;

// The back office: every route is admin-only
Route::middleware(['auth:sanctum', 'account.ready', 'can:admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/stats', [DashboardController::class, 'stats'])->name('stats');
    Route::get('/queue', [DashboardController::class, 'queue'])->name('queue');

    Route::get('/users', [PeopleController::class, 'index'])->name('users.index');
    Route::patch('/users/{id}', [PeopleController::class, 'update'])->whereNumber('id')->name('users.update');
    Route::get('/educators', [PeopleController::class, 'educators'])->name('educators');

    Route::post('/events/{id}/{action}', [ModerationController::class, 'event'])->whereNumber('id')->whereIn('action', ['approve', 'reject'])->name('events.decide');
    Route::post('/ads/{id}/{action}', [ModerationController::class, 'ad'])->whereNumber('id')->whereIn('action', ['approve', 'reject'])->name('ads.decide');
    Route::post('/honors/{id}/verify', [ModerationController::class, 'verifyHonor'])->whereNumber('id')->name('honors.verify');
    Route::post('/honors/{id}/decline', [ModerationController::class, 'declineHonor'])->whereNumber('id')->name('honors.decline');
    Route::get('/posts', [ModerationController::class, 'posts'])->name('posts');
    Route::post('/works/{id}/remove', [ModerationController::class, 'removeWork'])->whereNumber('id')->name('works.remove');
    Route::post('/works/{id}/restore', [ModerationController::class, 'restoreWork'])->whereNumber('id')->name('works.restore');
});

// Demo reset: any signed-in account, only while DEMO_MODE=true (DemoController)
Route::middleware(['auth:sanctum', 'throttle:auth'])->post('/demo/reset', [DemoController::class, 'reset'])->name('demo.reset');
