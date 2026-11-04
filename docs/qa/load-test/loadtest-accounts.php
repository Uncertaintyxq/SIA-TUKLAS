<?php

// Makes or removes the temporary accounts for the load test (README.md in this folder).
// Copy it to the server and run it from the app folder:
//
//   cd /var/www/tuklas/current
//   php ~/loadtest-accounts.php create 100     # asks for the accounts' password
//   php ~/loadtest-accounts.php delete         # the same day, when the test is over
//
// The accounts are students of the school with the short name TU, called loadtest-001 to
// loadtest-100, with addresses on that school's first email domain. "delete" removes them with their
// sessions and sign-in records, and takes back the views they added to works and publications
// (Reach counts each account once per item per day), so the showcase's numbers stay as they were.

use App\Models\Institution;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

if (! file_exists(getcwd().'/artisan')) {
    fwrite(STDERR, "Run this from the app folder: cd /var/www/tuklas/current\n");
    exit(1);
}
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$action = $argv[1] ?? '';

if ($action === 'create') {
    $count = max(1, min(200, (int) ($argv[2] ?? 100)));
    $school = Institution::where('short_name', 'TU')->first();
    if ($school === null || empty($school->email_domains)) {
        fwrite(STDERR, "No school with the short name TU and an email domain. Load the showcase first.\n");
        exit(1);
    }
    $domain = $school->email_domains[0];

    fwrite(STDOUT, 'Password for the test accounts (12+ characters, not shown): ');
    system('stty -echo');
    $password = trim((string) fgets(STDIN));
    system('stty echo');
    fwrite(STDOUT, "\n");
    if (mb_strlen($password) < 12) {
        fwrite(STDERR, "Use at least 12 characters.\n");
        exit(1);
    }

    $hash = Hash::make($password); // once: hashing 100 times would take a while on this server
    for ($i = 1; $i <= $count; $i++) {
        $n = sprintf('%03d', $i);
        $email = "loadtest-{$n}@{$domain}";
        $user = User::where('email', $email)->first() ?? new User;
        $user->forceFill([
            'name' => "Load Test {$n}",
            'username' => "loadtest-{$n}",
            'email' => $email,
            'password' => $hash,
            'role' => 'student',
            'program' => 'Load test account',
            'verified' => true,
            'privacy_accepted_at' => now(),
            'privacy_version' => config('tuklas.privacy_version'),
            'email_verified_at' => now(),
            'institution_id' => $school->id,
            'institution_confirmed_at' => now(),
        ])->save();
        if ($user->profile()->doesntExist()) {
            $user->profile()->create();
        }
    }
    fwrite(STDOUT, "Ready: loadtest-001 to loadtest-{$n} @{$domain}, students of {$school->name}.\n");
    exit(0);
}

if ($action === 'delete') {
    $users = User::where('username', 'like', 'loadtest-%')->where('email', 'like', 'loadtest-%')->get();
    $days = [now()->toDateString(), now()->subDay()->toDateString()];
    $views = 0;
    foreach ($users as $user) {
        foreach ($days as $day) {
            $visitor = hash_hmac('sha256', "{$day}|user:{$user->id}", (string) config('app.key'));
            foreach (DB::table('content_hits')->where('visitor', $visitor)->get() as $hit) {
                $table = $hit->subject_type === 'work' ? 'works' : 'publications';
                $views += DB::table($table)->where('id', $hit->subject_id)->where("{$hit->kind}_count", '>', 0)
                    ->decrement("{$hit->kind}_count");
            }
            DB::table('content_hits')->where('visitor', $visitor)->delete();
        }
        DB::table('sessions')->where('user_id', $user->id)->delete();
        DB::table('audit_logs')->where('actor_id', $user->id)->delete();
        $user->delete();
    }
    fwrite(STDOUT, "Removed {$users->count()} test accounts and took back {$views} views and downloads.\n");
    exit(0);
}

fwrite(STDERR, "Usage: php loadtest-accounts.php create [count] | delete\n");
exit(1);
