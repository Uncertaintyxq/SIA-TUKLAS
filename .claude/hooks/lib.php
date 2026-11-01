<?php

declare(strict_types=1);

/**
 * Shared helpers for the Claude Code hooks in this folder.
 *
 * The "scope snapshot" answers one question: which files are other developers
 * currently changing? It looks at every active branch on the remote (and open
 * PRs, if the GitHub CLI is installed and signed in) and records the files each
 * one changes relative to the main branch.
 *
 * Only PHP's standard library is used so the hooks run anywhere the app runs.
 */

const SCOPE_CACHE_RELATIVE = '.claude/.cache/active-scope.json';

function project_dir(): string
{
    $dir = getenv('CLAUDE_PROJECT_DIR');
    if (is_string($dir) && $dir !== '' && is_dir($dir)) {
        return rtrim(str_replace('\\', '/', $dir), '/');
    }

    return rtrim(str_replace('\\', '/', (string) getcwd()), '/');
}

/** @return array<string, mixed> */
function load_config(string $projectDir): array
{
    $defaults = [
        'mainBranch' => 'main',
        'remote' => 'origin',
        'staleAfterDays' => 14,
        'cacheMaxAgeMinutes' => 15,
        'protectMain' => true,
        'hotFileMode' => 'ask',
        'appDir' => '',
        'ignoreBranches' => ['main'],
        'hotFiles' => [],
    ];

    $file = $projectDir.'/.claude/scope.json';
    if (! is_file($file)) {
        return $defaults;
    }

    $data = json_decode((string) file_get_contents($file), true);

    return is_array($data) ? array_merge($defaults, $data) : $defaults;
}

/**
 * Run a command without a shell and return [exitCode, stdout, stderr].
 *
 * @param  list<string>  $cmd
 * @return array{0: int, 1: string, 2: string}
 */
function run_cmd(array $cmd, string $cwd): array
{
    $env = getenv();
    $env['GIT_TERMINAL_PROMPT'] = '0';   // never hang waiting for credentials
    $env['GH_PROMPT_DISABLED'] = '1';
    $env['NO_COLOR'] = '1';

    $spec = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = @proc_open($cmd, $spec, $pipes, $cwd, $env);
    if (! is_resource($proc)) {
        return [127, '', ''];
    }

    fclose($pipes[0]);
    $out = (string) stream_get_contents($pipes[1]);
    $err = (string) stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    return [proc_close($proc), $out, $err];
}

/** @return list<string> */
function lines(string $text): array
{
    return array_values(array_filter(array_map('trim', explode("\n", $text)), fn ($l) => $l !== ''));
}

/** Convert a simple glob (*, **, ?) to a regex anchored on the whole path. */
function glob_to_regex(string $glob): string
{
    $glob = str_replace('\\', '/', $glob);
    $out = '';
    $len = strlen($glob);
    for ($i = 0; $i < $len; $i++) {
        $c = $glob[$i];
        if ($c === '*') {
            if ($i + 1 < $len && $glob[$i + 1] === '*') {
                $out .= '.*';
                $i++;
                if ($i + 1 < $len && $glob[$i + 1] === '/') {
                    $i++;
                    $out .= '/?';
                }
            } else {
                $out .= '[^/]*';
            }
        } elseif ($c === '?') {
            $out .= '[^/]';
        } else {
            $out .= preg_quote($c, '#');
        }
    }

    return '#^'.$out.'$#';
}

/** @param list<string> $globs */
function matches_any(string $path, array $globs): bool
{
    foreach ($globs as $g) {
        if (preg_match(glob_to_regex((string) $g), $path) === 1) {
            return true;
        }
    }

    return false;
}

function current_branch(string $projectDir): string
{
    [$code, $out] = run_cmd(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], $projectDir);

    return $code === 0 ? trim($out) : '';
}

function is_git_repo(string $projectDir): bool
{
    [$code] = run_cmd(['git', 'rev-parse', '--is-inside-work-tree'], $projectDir);

    return $code === 0;
}

/**
 * Build the snapshot of other developers' active work and write it to the cache.
 *
 * @return array<string, mixed>
 */
function build_snapshot(string $projectDir, array $config, bool $fetch = true): array
{
    $remote = (string) $config['remote'];
    $main = (string) $config['mainBranch'];
    $notes = [];

    if ($fetch) {
        [$code] = run_cmd(['git', 'fetch', '--prune', '--quiet', $remote], $projectDir);
        if ($code !== 0) {
            $notes[] = "Could not fetch from '{$remote}' (offline or no access) — data may be out of date.";
        }
    }

    $base = "{$remote}/{$main}";
    [$code] = run_cmd(['git', 'rev-parse', '--verify', '--quiet', $base], $projectDir);
    if ($code !== 0) {
        $base = $main;
        [$code] = run_cmd(['git', 'rev-parse', '--verify', '--quiet', $base], $projectDir);
        if ($code !== 0) {
            $base = '';
            $notes[] = "Main branch '{$main}' not found; cannot compute other branches' changes.";
        }
    }

    $current = current_branch($projectDir);
    $staleCutoff = time() - ((int) $config['staleAfterDays'] * 86400);
    $ignore = array_values(array_map('strval', (array) $config['ignoreBranches']));

    // --- Remote branches -------------------------------------------------
    $others = [];
    if ($base !== '') {
        [, $refs] = run_cmd([
            'git', 'for-each-ref',
            '--format=%(refname)%09%(committerdate:unix)%09%(authorname)',
            "refs/remotes/{$remote}",
        ], $projectDir);

        foreach (lines($refs) as $line) {
            [$ref, $ts, $author] = array_pad(explode("\t", $line), 3, '');
            $branch = substr($ref, strlen("refs/remotes/{$remote}/"));
            if ($branch === '' || $branch === 'HEAD' || $branch === $current) {
                continue;
            }
            if (matches_any($branch, $ignore) || (int) $ts < $staleCutoff) {
                continue;
            }

            [, $diff] = run_cmd(['git', 'diff', '--name-only', "{$base}...{$remote}/{$branch}"], $projectDir);
            $files = lines($diff);
            if ($files === []) {
                continue; // already merged or no changes yet
            }

            $others[$branch] = [
                'branch' => $branch,
                'author' => $author,
                'updatedAt' => (int) $ts,
                'files' => $files,
                'pr' => null,
            ];
        }
    }

    // --- Open PRs (optional, needs `gh auth login`) ----------------------
    $myPr = null;
    $ghAvailable = false;
    [$code, $json] = run_cmd([
        'gh', 'pr', 'list', '--state', 'open', '--limit', '50',
        '--json', 'number,title,headRefName,author,isDraft,url,files',
    ], $projectDir);

    if ($code === 0 && is_array($prs = json_decode($json, true))) {
        $ghAvailable = true;
        foreach ($prs as $pr) {
            $head = (string) ($pr['headRefName'] ?? '');
            $info = [
                'number' => $pr['number'] ?? null,
                'title' => $pr['title'] ?? '',
                'draft' => (bool) ($pr['isDraft'] ?? false),
                'url' => $pr['url'] ?? '',
                'author' => $pr['author']['login'] ?? '',
            ];
            if ($head === $current) {
                $myPr = $info;

                continue;
            }
            if (isset($others[$head])) {
                $others[$head]['pr'] = $info;
            } elseif (! matches_any($head, $ignore)) {
                // PR from a fork or a branch we couldn't diff locally.
                $files = array_values(array_map(fn ($f) => (string) $f['path'], (array) ($pr['files'] ?? [])));
                if ($files !== []) {
                    $others[$head] = [
                        'branch' => $head,
                        'author' => $info['author'],
                        'updatedAt' => null,
                        'files' => $files,
                        'pr' => $info,
                    ];
                }
            }
        }
    } else {
        $notes[] = 'GitHub CLI not available or not signed in — showing branches only (run `gh auth login` for PR titles).';
    }

    // --- My own changes (committed on this branch + uncommitted) ---------
    $mine = [];
    if ($base !== '' && $current !== '' && $current !== 'HEAD') {
        [, $d] = run_cmd(['git', 'diff', '--name-only', "{$base}...HEAD"], $projectDir);
        $mine = lines($d);
    }
    [, $status] = run_cmd(['git', 'status', '--porcelain', '--untracked-files=all'], $projectDir);
    foreach (explode("\n", $status) as $l) {
        // Porcelain format: "XY <path>" — the first 3 chars are status + space.
        if (strlen(rtrim($l)) < 4) {
            continue;
        }
        $path = trim(substr(rtrim($l), 3));
        if (str_contains($path, ' -> ')) {
            $path = substr($path, strpos($path, ' -> ') + 4);
        }
        $mine[] = trim($path, '"');
    }
    $mine = array_values(array_unique(array_filter($mine, fn ($p) => ! str_starts_with($p, '.claude/.cache/'))));

    $snapshot = [
        'generatedAt' => time(),
        'base' => $base,
        'currentBranch' => $current,
        'myPr' => $myPr,
        'myFiles' => $mine,
        'ghAvailable' => $ghAvailable,
        'notes' => $notes,
        'others' => array_values($others),
    ];

    $cacheFile = $projectDir.'/'.SCOPE_CACHE_RELATIVE;
    @mkdir(dirname($cacheFile), 0775, true);
    @file_put_contents($cacheFile, json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return $snapshot;
}

/** @return array<string, mixed> */
function load_or_build_snapshot(string $projectDir, array $config): array
{
    $cacheFile = $projectDir.'/'.SCOPE_CACHE_RELATIVE;
    if (is_file($cacheFile)) {
        $data = json_decode((string) file_get_contents($cacheFile), true);
        $maxAge = (int) $config['cacheMaxAgeMinutes'] * 60;
        if (is_array($data) && (time() - (int) ($data['generatedAt'] ?? 0)) < $maxAge) {
            return $data;
        }
    }

    return build_snapshot($projectDir, $config);
}

function describe_other(array $o): string
{
    $label = "`{$o['branch']}`";
    if (! empty($o['pr'])) {
        $draft = $o['pr']['draft'] ? ' (draft)' : '';
        $label .= " — PR #{$o['pr']['number']} \"{$o['pr']['title']}\"{$draft}";
    }
    $who = ! empty($o['pr']['author']) ? '@'.$o['pr']['author'] : ($o['author'] ?? '');
    if ($who !== '') {
        $label .= " by {$who}";
    }
    if (! empty($o['updatedAt'])) {
        $label .= ', last push '.human_ago((int) $o['updatedAt']);
    }

    return $label;
}

function human_ago(int $ts): string
{
    $s = max(0, time() - $ts);

    return match (true) {
        $s < 3600 => intdiv($s, 60).' min ago',
        $s < 86400 => intdiv($s, 3600).' h ago',
        default => intdiv($s, 86400).' d ago',
    };
}

/** Normalise an absolute or relative tool path to a repo-relative path, or null if outside. */
function to_repo_path(string $path, string $projectDir): ?string
{
    $path = str_replace('\\', '/', $path);
    if (! preg_match('#^(/|[A-Za-z]:/)#', $path)) {
        $path = $projectDir.'/'.$path;
    }
    // Resolve ./ and ../ without requiring the file to exist.
    $parts = [];
    foreach (explode('/', $path) as $seg) {
        if ($seg === '' || $seg === '.') {
            continue;
        }
        if ($seg === '..') {
            array_pop($parts);

            continue;
        }
        $parts[] = $seg;
    }
    $prefix = preg_match('#^[A-Za-z]:/#', $path) ? '' : '/';
    $abs = $prefix.implode('/', $parts);

    $root = $projectDir.'/';
    if (strncasecmp($abs, $root, strlen($root)) !== 0) {
        return null;
    }

    return substr($abs, strlen($root));
}
