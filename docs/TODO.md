# TODO

Everything left to build, as a list of planned branches. A branch name is a claim: if the branch
exists on GitHub, someone is working on that scope.

## The branch rule

1. **Pick a row** from the table below. Each row is one branch with a fixed name and a fixed scope
   (the files and folders it may change).
2. **Check whether it's taken:**
   ```bash
   git fetch --prune
   git ls-remote --heads origin feat/account-deletion   # prints a line = taken, nothing = free
   git branch -r                                        # or list every branch in progress
   ```
   - The branch exists on `origin`: someone is on it. Don't start it; talk to them instead.
   - The branch doesn't exist and the row says **Not started**: it's free.
   - The row says **Done**: it's merged.
3. **Claim it:** create the branch from the latest `main` with the exact name in the table,
   and push it right away, even before the first real commit. The pushed branch is the claim.
   ```bash
   git switch main && git pull
   git switch -c feat/account-deletion
   git commit --allow-empty -m "chore: start feat/account-deletion"
   git push -u origin feat/account-deletion
   ```
4. **Stay in scope:** change only the paths in the row's Scope. If you need a file outside it,
   say so in the PR or ask the other developer first. Files marked *shared* are touched by
   several rows: keep those changes small.
5. **Finish:** in the same PR, change the row's Status to **Done (#PR number)**. Merge the PR
   into `main`, then delete the branch. Status is only edited at this step, so the table
   rarely causes merge conflicts.
6. **New work** gets a new row first, added in a small PR of its own, before anyone creates
   the branch.

Branches start from `main` (the Laravel conversion was merged into it on 2026-10-31; `Conversion`
is no longer used). New to the project? Read [GETTING_STARTED.md](GETTING_STARTED.md) first. Prefixes: `feat/` (feature), `fix/`, `chore/` (tooling, setup), `docs/`, `test/`.

## Planned branches

Paths are relative to `tuklas/` unless they start with `docs/` or `.github/`.

### Conversion: server

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `feat/account-deletion` | Delete my account (D13): erase personal data; keep published works as "Former member"; keep reviews, unnamed. `app/Http/Controllers/Account/`, `app/Actions/Account/` (new), `routes/modules/account.php`, `tests/Feature/Account/`. Needs a nullable `author_id` migration for works and publications (new file in `database/migrations/`). | | Not started |
| `feat/group-deliverables` | Students submit deliverables against a group deadline; the adviser sees who submitted, who's late, and leaves feedback. New migration, model, controller and tests; `routes/modules/groups.php` (*shared*); group page in `client/src/pages/GroupPage.tsx` and `client/src/components/groups/` (new). | `feat/client-types` | Not started |

### Conversion: React client

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `feat/client-types` | Copy the types the client imports from `server/src/schemas/*` into `client/src/types/` and update the 36 importing files. No behaviour change. | | Done |
| `feat/client-api-transport` | Point the client at Laravel: `client/vite.config.ts` proxy to `:8000`; `client/src/api/client.ts` sends `Accept: application/json` and `X-XSRF-TOKEN`; `client/src/api/auth.ts` uses `/auth/register`; privacy checkbox and 12-character hint in `client/src/pages/SignupModal.tsx`; `client/src/types/auth.ts`; 2FA login answer handled in `client/src/pages/LoginPage.tsx`. | `feat/client-types` | Done |
| `feat/client-account-screens` | Screens for 2FA setup and the login code challenge, email verification, forgot/reset password, privacy consent, active sessions and data export; route to them when the API answers `email_unverified` or `two_factor_required`. `client/src/pages/` (new pages), `client/src/components/account/` (new), `client/src/api/account.ts` (new), `client/src/App.tsx` (*shared*: routes only). Also touched: `LoginPage.tsx` (code step, forgot link), `SignupModal.tsx` (privacy link), `UserMenu.tsx` (Account link), `client/vite.config.ts` (proxy keeps the host), `AccountResource` (`emailVerificationRequired`), `bootstrap/app.php` (emailed links in a browser), the `auth` rate limit. | `feat/client-api-transport` | Done |
| `feat/client-realtime` | Replace the hand-written WebSocket with Laravel Echo on Reverb: `client/src/lib/realtime.tsx`, `client/package.json` (*shared*: adds `laravel-echo`, `pusher-js`). Presence for "online" dots. | `feat/client-api-transport` | Not started |
| `feat/client-chat-search` | Chat search UI: find conversations by person, channel or group instead of message text (D7). `client/src/components/chat/`, `client/src/pages/MessagesPage.tsx`. | `feat/client-types` | Not started |
| `chore/remove-node-server` | Delete `server/`, Prisma, `database/schema.sql`, the Node scripts in `package.json` (*shared*) and the root `docker-compose` notes that only apply to Node. Switch `DB_DATABASE` back to `tuklas`. Update `README.md` and `docs/GETTING_STARTED.md`. Last of the conversion. | every row above | Not started |

### Tooling

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `docs/getting-started` | `docs/GETTING_STARTED.md` (what to install, run, test, build next); README link; separate `tuklas_laravel` database in `.env.example` and `database/docker-init/`. | | Done |
| `chore/claude-code-kit` | The Laravel Claude Code kit (`Downloads/tuklas-claude-kit`) at the git root: `CLAUDE.md`, `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/COLLABORATION.md`, `docs/decisions/`, `.claude/`, `.github/` (templates, CODEOWNERS). Root `.gitignore` stops ignoring `.claude/`. Paths in the kit get the `tuklas/` prefix. | | Not started |
| `chore/ci` | GitHub Actions: Pint, tests on MySQL 8, `composer audit`, `npm audit`, client typecheck/lint/build. `.github/workflows/`. | `chore/claude-code-kit` | Not started |
| `chore/larastan` | Add Larastan and fix what level 5 reports. `composer.json` (*shared*), `phpstan.neon`, small fixes in `app/`. | `chore/ci` | Not started |

### Deployment (see [DEPLOYMENT.md](DEPLOYMENT.md))

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `chore/deploy-serve-spa` | Laravel serves the built React app: Vite builds into `public/app/`, a fallback route in `routes/web.php` returns its `index.html` with the CSP from `config/tuklas.php`. | `feat/client-realtime` | Not started |
| `chore/deploy-server-config` | Server config kept in the repo: `deploy/nginx.conf`, `deploy/supervisor.conf` (queue worker, Reverb), `deploy/php.ini`, `deploy/deploy.sh`, `.env.production.example`. | `chore/deploy-serve-spa` | Not started |
| `chore/deploy-pipeline` | GitHub Actions workflow that deploys `main` to staging automatically and to production on a tagged release. `.github/workflows/deploy.yml`. | `chore/ci`, `chore/deploy-server-config` | Not started |
| `chore/deploy-backups` | Nightly encrypted database and upload backups with a restore script and a tested restore. `deploy/backup.sh`, `deploy/restore.sh`, `docs/DEPLOYMENT.md` (restore steps). | `chore/deploy-server-config` | Not started |

## Not tied to a branch

- [ ] **Local MySQL 8 on the Windows machine** (now SQLite; XAMPP's MariaDB 10.4 is end-of-life).
  Options: Docker Desktop with the repo's `docker-compose.yml`, or the MySQL 8 installer.
- [ ] **Answer the deployment decisions** in [DEPLOYMENT.md](DEPLOYMENT.md#decisions-needed): host, domain, email provider.
- [ ] **Data Privacy Act paperwork** before launch: privacy notice text, a named Data Protection
  Officer, and NPC registration if required (see DEPLOYMENT.md). A draft notice is in
  `client/src/components/account/PrivacyNotice.tsx`; when the approved text replaces it, bump
  `PRIVACY_VERSION` there and `privacy_version` in `config/tuklas.php` together.
- [ ] **Later, optional:** passkeys sign-in (Fortify supports it; needs client screens).
