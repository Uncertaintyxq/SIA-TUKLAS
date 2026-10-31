# Prompt for a second Claude Code session

Paste everything below the line into a new Claude Code session. It is written so two sessions
(on one machine or two) can build Tuklas features at the same time without picking the same
feature or editing the same files. Update the **Assignment** section before each use.

---

You are a second Claude Code session on **Tuklas**, a research and academic engagement hub
(repo `https://github.com/Uncertaintyxq/SIA-TUKLAS`, app in `tuklas/`). Another Claude Code
session is building other features at the same time. Your job is to build the features assigned
below without coding the same thing as the other session and without causing merge conflicts.

## 1. Use your own working copy

Never work in the same folder as the other session. Both sessions switching branches in one
checkout breaks both. Clone separately:

```bash
git clone https://github.com/Uncertaintyxq/SIA-TUKLAS.git SIA-TUKLAS-2
cd SIA-TUKLAS-2/tuklas
composer install && npm install
cp .env.example .env && php artisan key:generate && php artisan reverb:install
```

Use SQLite for your own database (`DB_CONNECTION=sqlite`, delete the other `DB_*` lines, create
`database/database.sqlite`), so `migrate:fresh` never wipes the other session's data.
`php artisan test` uses in-memory SQLite and needs no setup.

**Ports:** the other session may be using `:8000` (Laravel) and `:5173` (Vite). Don't start dev
servers on those ports without asking the user first. Prefer tests, the typecheck, lint and the
build for checking your work.

**Windows:** PHP comes from Laravel Herd (`C:\Users\J M\.config\herd\bin`). In each PowerShell
call, refresh PATH first:
`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.

## 2. Read before coding

1. `docs/TODO.md`: the planned branches, each with a fixed name and a fixed **Scope** (the
   files it may change), plus **the branch rule**. Follow it exactly.
2. `docs/CONVERSION.md`: decisions D1–D13, the security spec, and "How the code is laid out".
3. `docs/GETTING_STARTED.md`: how to run and test.
4. `tuklas/reference/README.md`: client requirements, when a feature's behaviour is unclear.

## 3. Assignment

**Taken by the other session (don't start these, don't edit their scope):**
- `feat/client-account-screens`: new pages in `client/src/pages/` for 2FA, email verification,
  password reset, sessions, data export; `client/src/components/account/`;
  `client/src/api/account.ts`; routes in `client/src/App.tsx`; fields added to
  `client/src/types/auth.ts`.

**Yours, in this order:**
1. `feat/account-deletion` (server only; spec is D13 in `docs/CONVERSION.md`).
2. `feat/client-chat-search` (D7).
3. `feat/client-realtime` (Laravel Echo on Reverb).

Before each one:
```bash
git fetch --prune
git ls-remote --heads origin <branch>   # prints a line = taken, skip it
```
- If it's taken, or its "Depends on" rows aren't Done in `docs/TODO.md` on `main`, skip to the
  next one. If none of yours are free, pick another free row whose dependencies are Done. Tell
  the user which one you picked before claiming it.
- **Claim it** before writing code: create the branch from the latest `main`, make an empty
  commit, push. The pushed branch is the claim.
  ```bash
  git switch main && git pull --ff-only
  git switch -c <branch>
  git commit --allow-empty -m "chore: start <branch>"
  git push -u origin <branch>
  ```

## 4. Avoiding conflicts

- **Stay inside your row's Scope.** If you need a file outside it, stop and ask the user. Don't
  edit it "just a little".
- **Files the other session owns right now:** `client/src/App.tsx`,
  `client/src/types/auth.ts`, `client/src/api/auth.ts`, `client/src/pages/LoginPage.tsx`,
  `client/src/pages/SignupModal.tsx`, and anything under `client/src/components/account/`. If
  your feature needs a route or an auth type change, ask the user.
- **Shared files** (marked *shared* in TODO.md, e.g. `client/package.json`,
  `routes/modules/groups.php`, `composer.json`): keep the change to the few lines you need. Run
  `npm install` from `tuklas/` (the workspace root) so only the root `package-lock.json` changes.
- **Never reformat code you didn't change.** Run Pint only on changed files:
  `vendor/bin/pint --dirty`. Don't run Prettier or ESLint `--fix` across the whole client.
- **Migrations:** add new files with a current timestamp. Never edit an existing migration.
- **Docs:** in `docs/TODO.md`, change only your own row's Status, and only when you finish. In
  `docs/CONVERSION.md`, add one dated entry at the end of the Log and tick only your own Module
  status row. If those files conflict on rebase, keep both sides' lines.
- Don't rename, move or delete files outside your scope, and don't touch `server/` (the old Node
  server; `chore/remove-node-server` deletes it last).

## 5. How to write the code

Follow `docs/CONVERSION.md` → "How the code is laid out". In short:

- **Server:**
  - Database columns are snake_case. JSON is camelCase through API Resources, which are also the
    output allowlist.
  - Errors are `{error, issues}`. Hidden content throws `HttpException(404, ...)`; don't use
    `NotFoundHttpException`.
  - Access rules go in policies and gates, never in controllers. Writes go through
    `app/Actions/` where the module already does that.
  - Personal text uses encrypted casts. Security-relevant actions write to the audit log
    (`App\Support\Audit`).
- **Tests:** a feature test for every rule: allowed, denied, and hidden (404). Use the helpers in
  `tests/TestCase.php` (`seedDemo()`, `signOut()`).
- **Client:**
  - React 19 + TanStack Query. API hooks live in `client/src/api/<module>.ts` and use `api()` /
    `upload()` from `client/src/api/client.ts`. Types live in `client/src/types/`.
  - Styling is CSS modules with the existing tokens. Reuse the components in
    `client/src/components/ui/`.
- **Commits:** conventional style (`feat(scope): ...`), ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 6. Finishing a branch

1. Run the checks:
   - `php artisan test` (all pass)
   - `vendor/bin/pint --dirty`
   - if the client changed: `npx tsc --noEmit -p client`, `npx eslint client/src`, `npm run build -w client`
2. Catch up with `main`: `git fetch && git rebase origin/main`, fix any conflicts as in
   section 4, then re-run the checks and `git push --force-with-lease` (your branch only).
3. Mark your row **Done** in `docs/TODO.md`, add the Log entry, commit, push.
4. **Ask the user before merging.** With their OK:
   ```bash
   git switch main && git pull --ff-only
   git merge --no-ff <branch> -m "Merge branch '<branch>'"
   git push origin main
   git push origin --delete <branch> && git branch -d <branch>
   ```
   If the push to `main` is rejected because the other session merged first, pull, re-run the
   tests, and push again. **Never force-push `main`.**
5. Tell the user what you built, what you tested, and anything left undone. Then start your next
   assigned branch.

## 7. When unsure

Ask the user rather than guess, especially about scope, files outside your row, or
product behaviour that `tuklas/reference/` doesn't settle. You can't see the other session's
uncommitted work. The pushed branches on `origin` and `docs/TODO.md` on `main` are the only
shared record of who is doing what.
