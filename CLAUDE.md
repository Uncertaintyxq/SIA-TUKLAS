# Tuklas — Claude Code project guide

<!-- Maintainers: keep this file under ~150 lines. It loads into every session.
     Put long-form material in docs/ and point to it. HTML comments like this
     one are stripped before Claude sees the file. -->

@docs/PROJECT.md

## Stack

The git root holds the docs; **the app lives in `tuklas/`**. Run every command below from `tuklas/`.

- Laravel 13 on PHP 8.3+ (Herd locally), a JSON API under `/api` (Sanctum SPA cookies, Fortify, Reverb)
- Database: MySQL 8 (SQLite for quick local setups; tests use in-memory SQLite)
- Frontend: React 19 + Vite + TypeScript in `tuklas/client/` (TanStack Query, CSS Modules, Framer Motion)
- Tests: PHPUnit (`tests/Feature/<Module>`). Client: `tsc`, ESLint, `vite build`
- Formatting: Laravel Pint (`pint.json`). Static analysis: Larastan level 5 (`phpstan.neon`); CI runs both

## Commands (from `tuklas/`)

| Task | Command |
|---|---|
| Install | `composer install && npm install` |
| Run everything | `npm run dev` (API :8000, Reverb :8080, queue worker, site on http://localhost:5173) |
| Fresh demo data | `php artisan migrate:fresh --seed` (wipes the local DB, ask first) |
| All tests | `php artisan test` |
| One area | `php artisan test --filter=DeliverableTest` |
| Format PHP | `vendor/bin/pint --dirty` (check only: `vendor/bin/pint --test`) |
| Static analysis | `vendor/bin/phpstan analyse` (fix what it reports; no ignores without a reason) |
| Client checks | `npm run typecheck`, `npm run lint`, `npm run build` |
| Routes | `php artisan route:list --path=api` |

Run the narrowest test while iterating; run the full suite, Pint and the client checks before
calling a task finished. Demo accounts: `docs/GETTING_STARTED.md` (password `tuklas123`).

## Where things live

Read `docs/ARCHITECTURE.md` before adding a module, table or layer, and `docs/CONVENTIONS.md`
before writing code in an area you haven't touched this session. Rules in `.claude/rules/` load
automatically for the paths they cover. Short version:

- Routes: one file per module in `tuklas/routes/modules/<module>.php`, required from `routes/api.php`.
- Controllers in `app/Http/Controllers/<Module>/`; access rules in Policies and gates, never in
  controllers; writes with real rules in `app/Actions/<Module>/`.
- JSON is camelCase through API Resources (the output allowlist); database columns are snake_case.
- Errors are `{error, issues}`. Hidden things answer 404, not 403.
- Client: API hooks in `client/src/api/`, types in `client/src/types/`, CSS Modules only.
- Database: always a NEW migration; never edit one that's on `main`.

## Team workflow — several developers, each with a Claude session

Full protocol: `docs/COLLABORATION.md`. The essentials:

1. **Work comes from `docs/TODO.md`.** Each row is a planned branch with a fixed name and Scope.
   A branch that exists on `origin` is claimed. Check with `git ls-remote --heads origin <name>`.
   `/start-task <branch>` claims a row for you. New work gets a new row first (`/new-task`).
2. **Never edit on `main`.** If the current branch is `main`, stop and use `/start-task`.
3. **Stay inside the row's Scope.** If you need a file outside it, say so and ask first.
4. **Check the other lanes.** At session start a hook lists the files other active branches change.
   If you need one of them, tell the developer before editing.
5. **Hot files** (`.claude/scope.json`: composer/package files, `bootstrap/app.php`,
   `routes/api.php`, `config/*`, `AppServiceProvider`, `User.php`, `.env.example`, …) get the
   smallest possible change, ideally append-only, mentioned when finishing.
6. **Push early** (the pushed branch is the claim) and keep branches short-lived.

Workflow commands: `/split-work`, `/new-task`, `/start-task`, `/scope-check`, `/sync`, `/finish-task`.

## How to work

- Before anything non-trivial, write a short plan (files, migrations, tests). Ask before touching
  files outside the Scope or adding a dependency.
- Match the patterns in neighbouring files before inventing new ones.
- Every behaviour change ships with a test: feature tests cover allowed, refused, and hidden (404).
- UI changes are checked in a real browser before they're called done (Playwright screenshots or
  Claude in Chrome; see `docs/GETTING_STARTED.md`). Ask the developer before running browser checks.
- Don't add Composer or npm packages without asking.
- No dead code, `dd()`, `dump()`, `ray()` or `console.log` left behind.
- Never read or print `.env` secrets. New keys go in `.env.example` and are mentioned when finishing.
- Prefer editing over rewriting whole files: smaller diffs merge cleanly.
- When unsure what the product should do, check `tuklas/reference/` and ask. Don't guess business rules.

## Commits and merging

- Conventional Commits: `feat(groups): hand in deliverables`. Scope = module.
- `/finish-task` runs the checks, a review pass, and updates the row in `docs/TODO.md` to Done.
- Merging into `main` (GitHub PR, or locally with `--no-ff`) happens only after the developer agrees.
- Run git steps one at a time and stop at the first failure; write commit messages to a file
  (`git commit -F`) when they contain quotes.

## Decisions

Product and architecture decisions D1–D13 are in `docs/CONVERSION.md`. New decisions that future
work should follow get an ADR in `docs/decisions/` in the same branch.
