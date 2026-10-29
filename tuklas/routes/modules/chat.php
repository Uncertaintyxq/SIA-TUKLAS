<?php

use App\Http\Controllers\Chat\ChatController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'account.ready'])->prefix('chat')->name('chat.')->group(function () {
    Route::get('/conversations', [ChatController::class, 'conversations'])->name('conversations');
    Route::get('/unread', [ChatController::class, 'unread'])->name('unread');
    Route::get('/search', [ChatController::class, 'search'])->name('search');
    Route::post('/direct', [ChatController::class, 'direct'])->middleware('throttle:messages')->name('direct');

    Route::get('/conversations/{id}', [ChatController::class, 'show'])->whereNumber('id')->name('show');
    Route::post('/conversations/{id}/read', [ChatController::class, 'markRead'])->whereNumber('id')->name('read');
    Route::post('/conversations/{id}/messages', [ChatController::class, 'send'])->whereNumber('id')->middleware('throttle:messages')->name('messages.store');
    Route::post('/conversations/{id}/files', [ChatController::class, 'sendFile'])->whereNumber('id')->middleware('throttle:uploads')->name('files.store');

    Route::get('/messages/{id}/replies', [ChatController::class, 'thread'])->whereNumber('id')->name('thread');
    Route::get('/messages/{id}/file', [ChatController::class, 'file'])->whereNumber('id')->name('messages.file');
    Route::delete('/messages/{id}', [ChatController::class, 'destroy'])->whereNumber('id')->name('messages.destroy');
});
