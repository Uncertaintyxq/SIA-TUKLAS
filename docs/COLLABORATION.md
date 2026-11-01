# Working in parallel without stepping on each other

Several developers, each with their own Claude Code session, commit to this repo at the same time.
Merge conflicts and thrown-away work come from three things: **two people unknowingly changing the
same files**, **long-lived branches**, and **shared files that everything touches**. This protocol
handles all three. The list of work itself, and the branch rule, are in [TODO.md](TODO.md).

## 1. Plan the split before anyone codes

1. One developer runs `/split-work <feature>` in Claude. Claude reads the architecture and the code,
   and proposes work units that don't share files, with foundations first.
2. Both developers look at the split together (five minutes is enough).
3. Each unit becomes a **row in `docs/TODO.md`** via `/new-task`: a fixed branch name, a Scope (the
   paths it may change), and what it depends on. Rows are added on `main` in a small commit of their
   own, before anyone creates the branch.

Good split: by module (one developer on Groups, the other on Admin), or by layer when there's a
fixed contract (an agreed JSON shape) between them. Bad split: two people on the same feature's
controllers and pages with no contract.

## 2. Claim work visibly

`/start-task <branch-name>` does this for you:

1. Checks the row is free (`git ls-remote --heads origin <branch>` prints nothing) and its
   dependencies are Done.
2. Creates the branch from an up-to-date `main`, makes an empty commit and pushes it. **The pushed
   branch is the claim**: anyone checking that name sees it's taken.
3. Compares the row's Scope with every other active branch and warns about overlaps.

**Push at least once a day**, even unfinished work: that keeps the overlap check accurate. With the
GitHub CLI signed in (`gh auth login`), opening a draft PR adds a title and link to the snapshot.

## 3. Guard rails while you work

These run automatically through `.claude/settings.json` (PHP must be on the PATH where Claude runs,
8.3+ so Pint works; with Herd, make sure Herd's PHP comes first):

| When | What happens |
|---|---|
| Session start | `scope_snapshot.php` fetches `origin`, lists other active branches (and open PRs if `gh` is signed in) with the files they change, and gives Claude that list. |
| Before Claude edits a file | `scope_guard.php` asks you first if you're on `main`, if another branch is changing the file, or if it's a hot file. Once per file per session. |
| After Claude edits a PHP file | `format_file.php` checks the syntax and runs Pint on just that file. Client files are left alone (no Prettier in this project). |
| Every pull request | `scope-overlap.yml` comments when it shares files with another open PR. |

If the guard warns you, in order of preference:

1. **Avoid it**: can the change go in a new file, or your module's own route file?
2. **Sequence it**: wait for the other branch to merge, then `/sync`.
3. **Extract it**: make the shared change a tiny branch of its own, merge it fast, both rebase.
4. **Coordinate it**: message the other developer and agree who edits what.

## 4. Hot files

Listed in `.claude/scope.json` under `hotFiles`. Rules:

- `tuklas/routes/api.php`: only `require` lines for module files in `routes/modules/`.
- `composer.json`, `package.json` and their lock files: dependency changes are announced, or go
  in their own small branch. Never hand-merge a lock file: take `main`'s version and re-run
  `composer update <package>` / `npm install`.
- `database/migrations/*`: only **add** files; never edit or rename one that's on `main`. Two
  branches altering the same table is a logical conflict even when Git shows none.
- `AppServiceProvider.php`, `bootstrap/app.php`, `config/*`, `User.php`, `.env.example`: small,
  append-only changes, mentioned when finishing.
- Shared client code (`client/src/components/ui`, `layout`, `api/client.ts`, `App.tsx`): small
  changes, ideally in their own branch.

## 5. Stay close to main

- Rebase on `main` daily: `/sync`.
- Aim to finish a branch within about two days. If it will take longer, split the row.
- After merging, delete the branch (local and `origin`) so the claim is released.

## 6. Finishing

`/finish-task` runs Pint, the tests and the client checks, asks the `code-reviewer` subagent to
review the diff against these conventions and the row's Scope, offers a browser check for UI
changes, marks the row Done in `docs/TODO.md`, and asks before merging.

## Recommended GitHub settings (repo owner)

- Branch protection on `main`: require a pull request and passing checks (once `chore/ci` lands),
  block force pushes. If you adopt this, merge through PRs instead of local `--no-ff` merges.
- "Automatically delete head branches".
- Fill in `.github/CODEOWNERS` with GitHub usernames.
