<?php

use App\Http\Controllers\Works\DefenseStageController;
use App\Http\Controllers\Works\ReadingController;
use App\Http\Controllers\Works\ReviewController;
use App\Http\Controllers\Works\WorkController;
use App\Http\Controllers\Works\WorkFileController;
use Illuminate\Support\Facades\Route;

Route::prefix('works')->name('works.')->group(function () {
    // Public: a work page and its PDF open without signing in once the work is approved (WorkPolicy::view)
    Route::get('/{id}', [WorkController::class, 'show'])->whereNumber('id')->name('show');
    Route::get('/{id}/pdf', [WorkFileController::class, 'show'])->whereNumber('id')->name('pdf.show');

    Route::middleware(['auth:sanctum', 'account.ready'])->group(function () {
        Route::get('/mine', [WorkController::class, 'mine'])->name('mine');
        Route::get('/review-queue', [WorkController::class, 'reviewQueue'])->middleware('can:review-works')->name('review-queue');
        Route::get('/similar', [WorkController::class, 'similar'])->name('similar');

        Route::post('/', [WorkController::class, 'store'])->middleware('throttle:posting')->name('store');
        Route::put('/{id}', [WorkController::class, 'update'])->whereNumber('id')->name('update');
        Route::delete('/{id}', [WorkController::class, 'destroy'])->whereNumber('id')->name('destroy');

        Route::put('/{id}/pdf', [WorkFileController::class, 'upload'])->whereNumber('id')->middleware('throttle:uploads')->name('pdf.store');
        Route::delete('/{id}/pdf', [WorkFileController::class, 'remove'])->whereNumber('id')->name('pdf.destroy');
        Route::get('/{id}/versions/{version}/pdf', [WorkFileController::class, 'version'])->whereNumber(['id', 'version'])->name('versions.pdf');

        Route::post('/{id}/submit', [ReviewController::class, 'submit'])->whereNumber('id')->name('submit');
        Route::post('/{id}/decision', [ReviewController::class, 'decide'])->whereNumber('id')->name('decision');
        Route::post('/{id}/comments', [ReviewController::class, 'comment'])->whereNumber('id')->middleware('throttle:posting')->name('comments.store');
        Route::patch('/{id}/items/{itemId}', [ReviewController::class, 'item'])->whereNumber(['id', 'itemId'])->name('items.update');

        Route::post('/{id}/stages', [DefenseStageController::class, 'store'])->whereNumber('id')->name('stages.store');
        Route::put('/{id}/stages/{stageId}', [DefenseStageController::class, 'update'])->whereNumber(['id', 'stageId'])->name('stages.update');
        Route::delete('/{id}/stages/{stageId}', [DefenseStageController::class, 'destroy'])->whereNumber(['id', 'stageId'])->name('stages.destroy');

        Route::put('/{id}/reaction', [ReadingController::class, 'react'])->whereNumber('id')->name('reaction.store');
        Route::delete('/{id}/reaction', [ReadingController::class, 'unreact'])->whereNumber('id')->name('reaction.destroy');
        Route::put('/{id}/save', [ReadingController::class, 'save'])->whereNumber('id')->name('save.store');
        Route::delete('/{id}/save', [ReadingController::class, 'unsave'])->whereNumber('id')->name('save.destroy');
        Route::post('/{id}/discussion', [ReadingController::class, 'discuss'])->whereNumber('id')->middleware('throttle:posting')->name('discussion.store');
        Route::delete('/{id}/discussion/{commentId}', [ReadingController::class, 'deleteComment'])->whereNumber(['id', 'commentId'])->name('discussion.destroy');
    });
});
