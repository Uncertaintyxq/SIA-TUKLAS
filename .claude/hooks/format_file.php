<?php

declare(strict_types=1);

/**
 * PostToolUse hook for Edit / Write / MultiEdit.
 *
 * Formats only the PHP file Claude just changed, with Laravel Pint, so every diff is already in
 * house style and formatting never shows up as a merge conflict. The app lives in a subfolder
 * (`appDir` in .claude/scope.json, "tuklas"), so Pint runs from there.
 *
 *   - A syntax error (php -l) exits with code 2 so Claude sees it and fixes the file.
 *   - If Pint itself can't run (e.g. the `php` on PATH is older than the app needs), it's a
 *     warning, not an error: Herd's PHP should come first on the PATH.
 *   - Client files (ts/tsx/css) are left alone: the project uses ESLint, not Prettier, and
 *     reformatting whole files would cause merge conflicts.
 */

require __DIR__.'/lib.php';

$input = json_decode((string) stream_get_contents(STDIN), true);
$rawPath = (string) ($input['tool_input']['file_path'] ?? '');
if ($rawPath === '') {
    exit(0);
}

$projectDir = project_dir();
$path = to_repo_path($rawPath, $projectDir);
if ($path === null || ! is_file($projectDir.'/'.$path) || ! str_ends_with($path, '.php') || str_ends_with($path, '.blade.php')) {
    exit(0);
}

$appDir = trim((string) (load_config($projectDir)['appDir'] ?? ''), '/');
$appRoot = $appDir === '' ? $projectDir : $projectDir.'/'.$appDir;
$inApp = $appDir === '' ? $path : (str_starts_with($path, $appDir.'/') ? substr($path, strlen($appDir) + 1) : null);
if ($inApp === null || preg_match('#^(vendor|node_modules|storage|bootstrap/cache|public/build)/#', $inApp)) {
    exit(0);
}

$php = PHP_BINARY ?: 'php';

[$lintCode, $lint, $lintErr] = run_cmd([$php, '-d', 'display_errors=stderr', '-l', $inApp], $appRoot);
if ($lintCode !== 0) {
    fwrite(STDERR, "{$path} has a PHP syntax error.\n".trim($lintErr."\n".$lint)."\n");
    exit(2);
}

$pint = $appRoot.'/vendor/bin/pint';
if (is_file($pint)) {
    [$code, $out, $err] = run_cmd([$php, $pint, '--quiet', $inApp], $appRoot);
    if ($code !== 0) {
        fwrite(STDERR, "Note: Pint could not run on {$path} (".trim(strtok(trim($err."\n".$out), "\n") ?: 'no output')."). Run `vendor/bin/pint --dirty` from {$appDir}/ before finishing.\n");
    }
}

exit(0);
