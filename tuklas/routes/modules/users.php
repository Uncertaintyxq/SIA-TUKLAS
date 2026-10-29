<?php

use App\Http\Controllers\Users\PeopleController;
use App\Http\Controllers\Users\PortfolioController;
use App\Http\Controllers\Users\ProfileController;
use Illuminate\Support\Facades\Route;

// Public portfolios: no sign-in needed
Route::prefix('users/{username}')->group(function () {
    Route::get('/portfolio', [PortfolioController::class, 'show'])->name('users.portfolio');
    Route::get('/photo', [PortfolioController::class, 'photo'])->name('users.photo');
    Route::get('/cv', [PortfolioController::class, 'cv'])->name('users.cv');
});

// The signed-in person's own portfolio
Route::middleware(['auth:sanctum', 'account.ready'])->prefix('profile')->group(function () {
    Route::patch('/', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/links', [ProfileController::class, 'links'])->name('profile.links');
    Route::middleware('throttle:posting')->group(function () {
        Route::post('/background', [ProfileController::class, 'addBackground'])->name('profile.background.store');
        Route::post('/honors', [ProfileController::class, 'addHonor'])->name('profile.honors.store');
    });
    Route::put('/background/{id}', [ProfileController::class, 'updateBackground'])->whereNumber('id')->name('profile.background.update');
    Route::delete('/background/{id}', [ProfileController::class, 'deleteBackground'])->whereNumber('id')->name('profile.background.destroy');
    Route::put('/honors/{id}', [ProfileController::class, 'updateHonor'])->whereNumber('id')->name('profile.honors.update');
    Route::delete('/honors/{id}', [ProfileController::class, 'deleteHonor'])->whereNumber('id')->name('profile.honors.destroy');
    Route::middleware('throttle:uploads')->group(function () {
        Route::put('/photo', [ProfileController::class, 'uploadPhoto'])->name('profile.photo.store');
        Route::put('/cv', [ProfileController::class, 'uploadCv'])->name('profile.cv.store');
    });
    Route::delete('/photo', [ProfileController::class, 'deletePhoto'])->name('profile.photo.destroy');
    Route::delete('/cv', [ProfileController::class, 'deleteCv'])->name('profile.cv.destroy');
});

// Pickers
Route::middleware(['auth:sanctum', 'account.ready'])->prefix('people')->group(function () {
    Route::get('/search', [PeopleController::class, 'search'])->name('people.search');
    Route::get('/advisers', [PeopleController::class, 'advisers'])->name('people.advisers');
});
