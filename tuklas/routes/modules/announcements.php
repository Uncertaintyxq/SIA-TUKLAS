<?php

use App\Http\Controllers\Announcements\AnnouncementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'account.ready'])->prefix('announcements')->name('announcements.')->group(function () {
    Route::get('/', [AnnouncementController::class, 'index'])->name('index');
    Route::get('/unread', [AnnouncementController::class, 'unread'])->name('unread');
    Route::post('/', [AnnouncementController::class, 'store'])->middleware('throttle:posting')->name('store');
    Route::patch('/{id}', [AnnouncementController::class, 'update'])->whereNumber('id')->name('update');
    Route::delete('/{id}', [AnnouncementController::class, 'destroy'])->whereNumber('id')->name('destroy');
    Route::post('/{id}/read', [AnnouncementController::class, 'markRead'])->whereNumber('id')->name('read');
    Route::get('/{id}/receipts', [AnnouncementController::class, 'receipts'])->whereNumber('id')->name('receipts');

    Route::post('/{id}/attachments', [AnnouncementController::class, 'addAttachment'])->whereNumber('id')->middleware('throttle:uploads')->name('attachments.store');
    Route::get('/{id}/attachments/{attachmentId}', [AnnouncementController::class, 'attachment'])->whereNumber(['id', 'attachmentId'])->name('attachments.show');
    Route::delete('/{id}/attachments/{attachmentId}', [AnnouncementController::class, 'deleteAttachment'])->whereNumber(['id', 'attachmentId'])->name('attachments.destroy');
});
