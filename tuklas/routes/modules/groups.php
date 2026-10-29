<?php

use App\Http\Controllers\Groups\GroupController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'account.ready'])->prefix('groups')->name('groups.')->group(function () {
    Route::get('/', [GroupController::class, 'index'])->name('index');
    Route::post('/', [GroupController::class, 'store'])->middleware('throttle:posting')->name('store');
    Route::get('/{id}', [GroupController::class, 'show'])->whereNumber('id')->name('show');
    Route::patch('/{id}', [GroupController::class, 'update'])->whereNumber('id')->name('update');
    Route::delete('/{id}', [GroupController::class, 'destroy'])->whereNumber('id')->name('destroy');

    Route::post('/{id}/members', [GroupController::class, 'addMember'])->whereNumber('id')->name('members.store');
    Route::patch('/{id}/members/{userId}', [GroupController::class, 'setRole'])->whereNumber(['id', 'userId'])->name('members.update');
    Route::delete('/{id}/members/{userId}', [GroupController::class, 'removeMember'])->whereNumber(['id', 'userId'])->name('members.destroy');

    Route::post('/{id}/channels', [GroupController::class, 'addChannel'])->whereNumber('id')->name('channels.store');
    Route::delete('/{id}/channels/{channelId}', [GroupController::class, 'deleteChannel'])->whereNumber(['id', 'channelId'])->name('channels.destroy');

    Route::post('/{id}/files', [GroupController::class, 'addFile'])->whereNumber('id')->middleware('throttle:uploads')->name('files.store');
    Route::get('/{id}/files/{fileId}', [GroupController::class, 'file'])->whereNumber(['id', 'fileId'])->name('files.show');
    Route::delete('/{id}/files/{fileId}', [GroupController::class, 'deleteFile'])->whereNumber(['id', 'fileId'])->name('files.destroy');

    Route::post('/{id}/deadlines', [GroupController::class, 'addDeadline'])->whereNumber('id')->name('deadlines.store');
    Route::delete('/{id}/deadlines/{deadlineId}', [GroupController::class, 'deleteDeadline'])->whereNumber(['id', 'deadlineId'])->name('deadlines.destroy');
});
