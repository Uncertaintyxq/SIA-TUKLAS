# Module route files

Each module keeps its routes in its own file here, so two developers never edit the same route
file at the same time. `routes/api.php` (a hot file) only requires them, and registers the
broadcasting auth route:

```php
require __DIR__.'/modules/auth.php';
require __DIR__.'/modules/groups.php';
// One line per module: append new modules at the end.
```

Everything is under `/api` (the React app is the only front end). A module file:

```php
<?php

use App\Http\Controllers\Groups\GroupController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'account.ready'])->prefix('groups')->name('groups.')->group(function () {
    Route::get('/', [GroupController::class, 'index'])->name('index');
    Route::post('/', [GroupController::class, 'store'])->middleware('throttle:posting')->name('store');
    Route::get('/{id}', [GroupController::class, 'show'])->whereNumber('id')->name('show');
});
```

- `account.ready` keeps people who still have to confirm their email or set up 2FA out; leave it
  off only for routes they need for that (see `account.php`).
- Name every route `module.resource.action`; constrain ids with `whereNumber`; add a `throttle:`
  limiter (`posting`, `uploads`, `messages`, `auth`) to writes that could be abused.
- Public routes (no sign-in) sit outside the `auth:sanctum` group and check visibility themselves.
