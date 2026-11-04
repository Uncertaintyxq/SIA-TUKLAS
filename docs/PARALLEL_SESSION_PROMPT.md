# Prompt for another Claude Code session

Paste everything below the line into a new Claude Code session. It is written so several sessions
(on one machine or several) can build Tuklas features at the same time without picking the same
feature or editing the same files. Update the **Assignment** section before each use (last updated
2026-11-04, after `feat/work-metrics`, `feat/research-story`, `feat/mentions` and `feat/library-browse`).

---

You are a Claude Code session working on **Tuklas**, a research and academic engagement hub (the
app is in `tuklas/` inside the git repo; the user gives you the GitHub address, which may change
if the repo moves to another account). Other people and Claude sessions are building other
features at the same time, and a staging server is already live. Your job is to build the features
assigned below without coding the same thing as anyone else and without causing merge conflicts.

## 1. Use your own working copy

Never work in the same folder as another session. Two sessions switching branches in one checkout
break both. Clone separately and name the folder after your job:

```bash
git clone <repo address> SIA-TUKLAS-2
cd SIA-TUKLAS-2/tuklas
composer install && npm install
cp .env.example .env && php artisan key:generate && php artisan reverb:install
```

Use SQLite for your own database (`DB_CONNECTION=sqlite`, delete the other `DB_*` lines, create
`database/database.sqlite`, then `php artisan migrate:fresh --seed`), so you never wipe another
session's data. `php artisan test` uses in-memory SQLite and needs no setup. CI also runs the whole
suite on **MySQL 8.4**, so write queries and tests that work on both (see section 5).

**Ports:** another session may be using `:8000` (Laravel), `:8080` (Reverb) and `:5173` (Vite).
Don't start dev servers on those without asking the user. Prefer tests, the typecheck, lint and the
build for checking your work.

**Windows (Laravel Herd):** PHP is in `C:\Users\J M\.config\herd\bin`. In each PowerShell call,
refresh PATH first:
`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
Windows PowerShell 5.1 has no `&&`, and double quotes inside `git commit -m "..."` break. Do git
with the Bash tool: write the message to a temp file (`printf ... > "$TEMP/m.txt"`) and run
`git commit -F "$TEMP/m.txt"`; stop at the first failing step. The Bash tool also mangles
backslashes in Python heredocs, so edit PHP files with namespaces (`App\Models\...`) with the
Edit/Write tools instead.

## 2. Read before coding

`CLAUDE.md` and `.claude/` load automatically when you open Claude Code at the repo root (stack,
rules, hooks, and the `/start-task` and `/finish-task` commands). Also read:

1. `docs/TODO.md`: the planned branches, each with a fixed name and a fixed **Scope** (the files
   it may change), plus **the branch rule**. Follow it exactly.
2. `docs/COLLABORATION.md`, `docs/CONVENTIONS.md` and `docs/ARCHITECTURE.md`: how the team works,
   the code style, and where things live.
3. `tuklas/reference/FEATURES.md`: what each role can do today, and why each planned feature was
   chosen. `tuklas/reference/README.md` has the client's requirements, for when behaviour is unclear.
4. `docs/CONVERSION.md`: decisions D1–D13, the security spec, the dated Log of everything built so
   far, and "How the code is laid out".
5. `docs/GETTING_STARTED.md`: how to run, test and look at the site.

## 3. Assignment

**Yours:** nothing is assigned. The institution rows are all built and merged (2026-11-04):
`feat/institutions`, `feat/institution-scoping`, `feat/institution-admins` and
`feat/institution-audiences` (plan: `docs/decisions/0002-several-schools-on-one-site.md`). Ask the
user what to take next.

Any new work that touches a school's people or content keeps the cross-school rule: someone at
school B sees school A's Public research and nothing else of school A's. Use `User::administers()`,
`AdminScope`, `Work::readableBy()`, `Publication::readableBy()` and `visibleTo()` rather than bare
`isAdmin()` checks. **Not yours:** `chore/deploy-production`. It comes after all of them, and it's
the user's own, since it needs the server and accounts.

Build them **one at a time**: merge each before starting the next, so the next one starts from a
`main` that already has it and shared files never conflict.

Before each one:
```bash
git fetch --prune
git ls-remote --heads origin <branch>   # prints a line = claimed, skip it
git branch -r                           # what else is in flight; the scope hook also lists it at session start
```
- If a branch is claimed by someone else, or its row says In progress under another name, skip to
  the next. Tell the user which one you picked before claiming it.
- If another branch on origin changes a file you need, keep your change to different functions and
  regions of it, small and append-only, and tell the user.
- **Claim it** before writing code: mark the row, then make the branch. `/start-task <branch>` does
  all of this and asks you to approve each push; the steps are:
  ```bash
  git switch main && git pull --ff-only
  # edit the row's Status in docs/TODO.md to: In progress (<the user's name>)
  git add docs/TODO.md && git commit -m "docs: claim <branch>" && git push
  git switch -c <branch>
  git commit --allow-empty -m "chore: start <branch>"
  git push -u origin <branch>
  ```
  The pushed branch is the claim; the Status line is for people reading the table. Ask the user for
  the name to put in the Status the first time.

Notes on the features (the product decisions are in `reference/FEATURES.md`):
- (No open feature notes: every planned feature is built.)

## 4. Avoiding conflicts

- **Stay inside your row's Scope.** If you need a file outside it, stop and ask the user. Don't
  edit it "just a little".
- **Shared files** (marked *shared* in TODO.md, and the hot files in `.claude/scope.json`, such as
  `composer.json`, `package.json`, `routes/api.php`, `AppServiceProvider.php`, `User.php`,
  `.env.example`): keep the change to the few lines you need, append-only where possible. Run
  `npm install` from `tuklas/` (the workspace root) so only the root `package-lock.json` changes.
  Don't add Composer or npm packages without asking.
- **Never reformat code you didn't change.** Run Pint only on changed files: `vendor/bin/pint --dirty`.
  Don't run Prettier or ESLint `--fix` across the whole client.
- **Migrations:** add new files with a current timestamp (later than every existing one). Never
  edit a migration that is on `main`.
- **Demo data:** `database/seeders/DemoSeeder.php` is a hot file. Additions are small, with fixed
  ids; tests rely on it.
- **Docs:** in `docs/TODO.md` change only your own row's Status (at claim and at finish). Add one
  dated entry to the Log in `docs/CONVERSION.md` (above "How the code is laid out"). Add the
  user-facing changes as bullets to `docs/PATCH_NOTES.md` under "## Next update (not on staging
  yet)", creating that heading above "Staging update 1" if it isn't there. If those files conflict
  on rebase, keep both sides' lines.
- Don't rename, move or delete files outside your scope.

## 5. How to write the code

Follow `CLAUDE.md`, `docs/CONVENTIONS.md` and the `.claude/rules/`. In short:

- **Server:**
  - Database columns are snake_case. JSON is camelCase through API Resources, which are also the
    output allowlist. Errors are `{error, issues}`. Hidden content throws `HttpException(404, ...)`.
  - Access rules go in policies and gates, never in controllers.
  - Models use a `protected $casts = [...]` **property** (not a `casts()` method, which Larastan
    can't read), relationships typed with generics (`@return BelongsTo<User, $this>`), and a
    `@property-read` line for attributes added by `withCount` / `withExists`.
  - Notifications go through `Notifier::notify()`; people's email and push choices apply by
    themselves. Security-relevant actions go through `Audit::log()`. Personal text uses encrypted
    casts, and personal data never goes in logs. A new kind of personal data goes in the data
    export and is erased by account deletion.
  - Live updates name what changed, never the content (`Support/Realtime.php`).
  - New settings go in `.env.example` and `.env.production.example`; `env()` is only for `config/`.
- **Tests:** a feature test for every rule: allowed, denied and hidden (404). Use
  `tests/TestCase.php` (`seedDemo()`, `signOut()`). Notifications are faked in every test; to test
  an email or push, call `Notification::fake()` / `Queue::fake()` yourself and assert. Never rely
  on auto-increment ids of rows a test creates (MySQL doesn't reuse them after a rollback); seeded
  rows have fixed ids. Make queries work on SQLite (local tests) **and** MySQL (CI).
- **Static analysis:** `vendor/bin/phpstan analyse` must report 0 errors (level 5). Fix what it
  reports; an ignore needs a comment saying why. In the Bash tool use
  `env -u CLAUDECODE -u AI_AGENT vendor/bin/phpstan analyse`, or it truncates the list.
- **Client:** React 19 + TanStack Query. API hooks in `client/src/api/<module>.ts` using `api()` /
  `upload()` from `client/src/api/client.ts`; types in `client/src/types/`. Styling is CSS Modules
  with the existing tokens (inline `style` props are a lint error); reuse the components in
  `client/src/components/ui/`.
- **Commits:** conventional style (`feat(scope): ...`), ending with the `Co-Authored-By` line your
  own session instructions give.

## 6. Finishing a branch

1. Run the checks:
   - `php artisan test` (all pass), `vendor/bin/pint --dirty`, `vendor/bin/phpstan analyse`
   - if the client changed: `npm run typecheck`, `npm run lint`, `npm run build` (from `tuklas/`)
   - if screens changed: offer a browser check (Playwright screenshots, or the Claude in Chrome
     tools if available): log in as the demo accounts, click through, read the console. **Ask the
     user first**, and ask which ports are free. See `docs/GETTING_STARTED.md`.
2. Catch up with `main`: `git fetch && git rebase origin/main`, fix conflicts as in section 4,
   re-run the checks, then `git push --force-with-lease` (your branch only).
3. **Wait for GitHub's checks to pass.** `.github/workflows/ci.yml` runs on every push: Pint, the
   tests on MySQL 8.4, `composer audit`, `npm audit`, Larastan, the client's types, lint and build,
   and a backup-and-restore test. A branch with a red run doesn't merge. Read the result on the
   repo's Actions tab, or at `https://api.github.com/repos/<owner>/<repo>/actions/runs?branch=<branch>`
   (60 requests an hour without a login: look once about 7 minutes after pushing, not in a loop).
   When tests fail, the run's page lists the failing tests.
4. Mark your row **Done** in `docs/TODO.md`, add the Log entry and the patch-notes bullets, commit,
   push, and check the run is green again.
5. **Ask the user before merging.** With their OK:
   ```bash
   git switch main && git pull --ff-only
   git merge --no-ff <branch> -m "Merge branch '<branch>'"
   git push origin main
   git push origin --delete <branch> && git branch -d <branch>
   ```
   If the push to `main` is rejected because someone merged first, pull, re-run the tests, and
   push again. **Never force-push `main`.**
6. Tell the user what you built, what you tested, and anything left undone. Then start your next
   assigned branch.

## 7. The server

Staging is deployed **by hand** (automatic deploys are built but paused). Don't connect to the
server, run `deploy/*.sh`, or touch the GitHub settings. If your feature needs something on the
server (a new `.env` key, a cron line, an Nginx change), add it with the exact commands under "One-time
steps" in `docs/STAGING_SERVER.md` and tell the user when you finish. New migrations run when the
user next deploys.

## 8. When unsure

Ask the user rather than guess, especially about scope, files outside your row, or product
behaviour that `tuklas/reference/` doesn't settle. You can't see other sessions' uncommitted work.
The pushed branches on `origin` and `docs/TODO.md` on `main` are the only shared record of who is
doing what.
