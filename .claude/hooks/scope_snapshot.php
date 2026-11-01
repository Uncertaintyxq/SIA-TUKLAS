<?php

declare(strict_types=1);

/**
 * SessionStart hook (also usable by hand: `php .claude/hooks/scope_snapshot.php`).
 *
 * Fetches the remote, records which files other active branches/PRs change,
 * and prints a short summary. For SessionStart, stdout becomes context for Claude.
 *
 * Flags: --no-fetch   skip `git fetch`
 *        --json       print the raw snapshot JSON instead of the summary
 */

require __DIR__.'/lib.php';

$projectDir = project_dir();
if (! is_git_repo($projectDir)) {
    exit(0);
}

// Drain stdin if Claude Code sent the hook payload; we don't need it.
if (! stream_isatty(STDIN)) {
    stream_set_blocking(STDIN, false);
    stream_get_contents(STDIN);
}

$config = load_config($projectDir);
$args = array_slice($argv, 1);
$snap = build_snapshot($projectDir, $config, ! in_array('--no-fetch', $args, true));

if (in_array('--json', $args, true)) {
    echo json_encode($snap, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    exit(0);
}

$maxFiles = 25;
$out = [];
$out[] = '## Parallel-work snapshot ('.date('Y-m-d H:i').')';

$branch = $snap['currentBranch'] ?: '(detached)';
$line = "You are on `{$branch}`";
if ($snap['myPr']) {
    $line .= " — PR #{$snap['myPr']['number']}".($snap['myPr']['draft'] ? ' (draft)' : '');
}
$out[] = $line.'.';

if ($config['protectMain'] && $branch === $config['mainBranch']) {
    $out[] = "⚠ This is the main branch. Do not edit files here — run `/start-task <branch from docs/TODO.md>` to claim a task branch first.";
}

$others = $snap['others'];
if ($others === []) {
    $out[] = 'No other active branches or open PRs are changing files right now.';
} else {
    $out[] = '';
    $out[] = 'Other developers are currently changing these files. Do NOT edit them without asking the developer first:';
    foreach ($others as $o) {
        $out[] = '';
        $out[] = '- '.describe_other($o).' — '.count($o['files']).' file(s):';
        foreach (array_slice($o['files'], 0, $maxFiles) as $f) {
            $out[] = "    {$f}";
        }
        if (count($o['files']) > $maxFiles) {
            $out[] = '    …and '.(count($o['files']) - $maxFiles).' more (see '.SCOPE_CACHE_RELATIVE.')';
        }
    }
}

// Overlaps between my work and theirs.
$overlaps = [];
foreach ($others as $o) {
    foreach (array_intersect($snap['myFiles'], $o['files']) as $f) {
        $overlaps[$f][] = $o['branch'];
    }
}
if ($overlaps !== []) {
    $out[] = '';
    $out[] = '⚠ Files YOUR branch changes that another branch also changes (likely merge conflict):';
    foreach ($overlaps as $f => $branches) {
        $out[] = "    {$f}  ←  ".implode(', ', $branches);
    }
    $out[] = 'Tell the developer about these before continuing.';
}

foreach ($snap['notes'] as $n) {
    $out[] = '';
    $out[] = "Note: {$n}";
}

echo implode("\n", $out), "\n";
exit(0);
