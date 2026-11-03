<?php

use App\Support\Reach;
use Illuminate\Support\Facades\Schedule;

/*
 * Scheduled jobs. On a server, cron runs `php artisan schedule:run` every minute
 * (deploy/setup-server.sh installs it); locally, `php artisan schedule:work`.
 */

// The weekly digest email, Monday morning in the Philippines (SendWeeklyDigest)
Schedule::command('tuklas:weekly-digest')->weeklyOn(1, '8:00')->timezone('Asia/Manila')->withoutOverlapping();

// Forget who viewed or downloaded what on earlier days (Reach). Hourly rather than at midnight, so a
// server that was shut down overnight catches up as soon as it's back.
Schedule::call(fn () => Reach::forgetYesterday())->hourly()->name('reach:forget-yesterday');
