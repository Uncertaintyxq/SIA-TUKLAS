# Converting Tuklas to Laravel

Living document for the move from the Node/Express server to Laravel. Update the status table and
the log in the same commit as the work. Started 2026-10-30 on branch `Conversion`.

## Goal

Replace the Express + Prisma server in `tuklas/server/` with a Laravel JSON API that serves the
same `/api` URLs, keep the React app in `tuklas/client/`, and bring security up to industry
standard (see [Security](#security)). When every module is ported and tested, `tuklas/server/`
and Prisma are deleted.

Product rules and client requirements don't change: see `tuklas/PLAN.md` §2 and
`tuklas/reference/README.md`.

## Decisions

| # | Decision | Date |
|---|---|---|
| D1 | Laravel replaces only the server, as a JSON API at the same `/api` paths. The React SPA stays. | 2026-10-30 |
| D2 | In place: `tuklas/` becomes the Laravel app root. The Node server stops working partway through; that's accepted. | 2026-10-30 |
| D3 | Order: Laravel skeleton → Claude Code kit → shared groundwork → module ports → client changes → delete Node server. | 2026-10-30 |
| D4 | Implement fully. Quality over the November deadline. | 2026-10-30 |
| D5 | Database columns are **snake_case** everywhere. API JSON stays **camelCase**, produced by API Resources, which also act as the output allowlist. | 2026-10-30 |
| D6 | Two-factor sign-in (TOTP + recovery codes) is **required for admins and educators**, optional for students. | 2026-10-30 |
| D7 | Chat message text and private review text are **encrypted at rest**. Server-side chat text search is dropped; chat can still filter by person, group and date. | 2026-10-30 |
| D8 | Laravel 13 on PHP 8.3+ (dev machine: PHP 8.5 via Laravel Herd). Composer's platform is pinned to PHP 8.3 so the lock file installs on 8.3, 8.4 and 8.5. MySQL 8 is the database. Tests run on SQLite in memory locally and on MySQL 8 in CI. | 2026-10-30 |
| D9 | Table names follow Laravel (plural snake_case of the model) so no model needs a `$table` override. Renamed from the Prisma schema: `groups` → `research_groups` (also a reserved word in MySQL 8), `saves` → `saved_works`, `background` → `backgrounds`, `group_activity` → `group_activities`; `groupId` columns → `research_group_id`. Composite keys stay composite. | 2026-10-30 |
| D10 | Auth endpoints are Laravel Fortify's, under `/api/auth`, answering JSON. Signup moves from `/api/auth/signup` to `/api/auth/register`. Passkeys are off until the client has screens for them. | 2026-10-30 |
| D11 | `APP_URL` is the address people open (in development the Vite server, `http://localhost:5173`, which forwards `/api` to Laravel on `:8000`), so emailed links and cookies share one origin. | 2026-10-30 |
| D12 | Demo mode (`DEMO_MODE=true`) skips the email-verification and 2FA checks for every account, so the "Continue as" demo logins work. The app refuses to start with demo mode on when `APP_ENV=production`. | 2026-10-30 |
| D13 | Deleting an account erases personal data (profile, links, honors, messages, files, sessions, notifications). Approved, published works stay in the library, credited to "Former member"; an educator's past reviews stay, unnamed. | 2026-10-30 |

## Target layout

```
tuklas/
├─ app/
│  ├─ Enums/                      Role, WorkStatus, EventCategory, … (backed enums, cast on models)
│  ├─ Http/Controllers/<Module>/  thin: authorize → validate → action → resource
│  ├─ Http/Requests/<Module>/     validation (replaces server/src/schemas/*.ts)
│  ├─ Http/Resources/<Module>/    camelCase JSON, explicit field allowlist
│  ├─ Http/Middleware/            security headers, 2FA enforcement
│  ├─ Actions/<Module>/           business rules (replaces logic inside server/src/routes/*.ts)
│  ├─ Models/  Policies/          policies replace server/src/policies/*.ts
│  └─ Support/                    markup renderer, file storage, notifier
├─ routes/api.php + routes/modules/<module>.php
├─ database/migrations, seeders, factories
├─ tests/Feature/<Module>, tests/Unit
└─ client/                        React SPA (Vite proxies /api to Laravel, /app/ to Reverb)
                                  (server/, the Node API, was deleted in chore/remove-node-server)
```

## Security

Yardsticks: OWASP ASVS 4.0 Level 2, OWASP Top 10, NIST SP 800-63B (passwords), Philippine Data
Privacy Act of 2012 (RA 10173).

**Accounts and sessions**
- Passwords: Argon2id. At least 12 characters, checked against known breaches (Have I Been Pwned
  range API: only the first 5 characters of the password's SHA-1 hash leave the server).
- Email verification and password reset through signed, expiring links.
- 2FA per D6, through Laravel Fortify. Accounts that must use 2FA can't do anything else until
  it's set up.
- Sanctum SPA auth: session cookie that is `HttpOnly`, `Secure` (production) and
  `SameSite=Lax`. CSRF token on every write. The session ID changes at login. Idle timeout.
  "Log out other devices".
- Rate limits: login and 2FA by account and IP, signup, password reset, uploads, posting, chat.
- Login errors don't reveal whether an email has an account.

**Authorization**
- A policy for every model, deny by default. Roles always come from the database.
- Content the viewer may not see returns 404, as today (PLAN.md §2 rule 1).
- Responses only contain fields listed in an API Resource, so emails, hashes and secrets can't leak by accident.

**Data**
- Encrypted columns (D7): `messages.text`, `comments.text`, `reviews.comment`,
  `revision_items.text`. 2FA secrets and recovery codes are encrypted by Fortify.
  `APP_PREVIOUS_KEYS` allows key rotation.
- Uploads are checked by content (finfo), not by the name or header the client sends. They're stored on a
  private disk under random names, with size limits, and only served by a controller after a
  policy check (`Content-Disposition`, `X-Content-Type-Options: nosniff`).
- User markup is rendered with escaping; links must be `https`.

**Transport and headers**
- HTTPS only with HSTS in production. Strict Content-Security-Policy on the app page.
  `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Content-Type-Options`. Same-origin only (no CORS).
- Real-time (Laravel Reverb) uses private and presence channels, authorized per user.

**Privacy and accountability**
- Audit log of admin actions and security events (logins, failed logins, password and 2FA
  changes, role changes). Application logs contain no personal data.
- Privacy notice and consent recorded at signup. Users can export their data and delete their
  account.
- Demo reset only works when `DEMO_MODE=true`. The app refuses to start with demo mode on in
  production.

**Process**
- Feature tests for every policy (allowed, denied, hidden = 404) and every rate limit.
- CI runs `composer audit` and `npm audit`.

## Module status

What's been ported. **What's left is planned branch by branch in [TODO.md](TODO.md)**, with the
branch rule; the deployment plan is in [DEPLOYMENT.md](DEPLOYMENT.md).

| Module | Node source | Laravel | Tests | Owner |
|---|---|---|---|---|
| Skeleton, config, security middleware | `server/src/app.ts`, `env.ts` | ☑ | ☑ | |
| Database: migrations, models, enums | `server/prisma/schema.prisma` | ☑ | ☑ | |
| Database: demo seeders | `server/src/seed.ts`, `prisma/seed.ts` | ☑ | ☑ | |
| Auth: login, signup, 2FA, verification, reset | `routes/auth.ts`, `auth/` | ☑ | ☑ | |
| Auth: active sessions list, "log out other devices" | new | ☑ | ☑ | |
| Users, profiles, portfolio, people | `routes/users.ts` | ☑ | ☑ | |
| Works and review | `routes/works.ts`, `policies/works.ts` | ☑ | ☑ | |
| Feed and opportunities | `routes/feed.ts` | ☑ | ☑ | |
| Events and ads | `routes/events.ts` | ☑ | ☑ | |
| Research groups | `routes/groups.ts`, `policies/groups.ts` | ☑ | ☑ | |
| Group deliverables (new: submissions against a group deadline) | new | ☑ | ☑ | |
| Announcements | `routes/announcements.ts` | ☑ | ☑ | |
| Chat and real-time (server side) | `routes/chat.ts`, `realtime.ts` | ☑ | ☑ | |
| Publications | `routes/publications.ts` | ☑ | ☑ | |
| Admin | `routes/admin.ts` | ☑ | ☑ | |
| Notifications | `routes/notifications.ts`, `lib/notify.ts` | ☑ | ☑ | |
| Demo reset | `routes/demo.ts` | ☑ | ☑ | |
| Privacy: data export, sessions, consent, audit log | new | ☑ | ☑ | |
| Privacy: account deletion (D13) | new | ☑ | ☑ | |
| Client: own types (no `server/` imports) | `client/` | ☑ | typecheck | |
| Client: proxy, CSRF, `/auth/register`, privacy consent at signup | `client/` | ☑ | smoke test | |
| Client: 2FA setup and login code, email verification, password reset, sessions, privacy, data export | `client/` | ☑ | smoke test | |
| Client: Echo on Reverb (live updates, presence) | `client/` | ☑ | smoke test | |
| Client: chat search (D7) | `client/` | ☑ | typecheck | |
| Remove Node server and Prisma | | ☑ | | |

## Client changes this causes

- Types the client imports from `server/src/schemas/*` (36 files, all `import type`) move into
  `client/src/types/` before `server/` is deleted.
- Vite proxy target: Laravel on `:8000` instead of `:4000`.
- `client/src/api/client.ts` sends `Accept: application/json` (otherwise Fortify answers with
  redirects) and the `X-XSRF-TOKEN` header Sanctum needs (copied from the `XSRF-TOKEN` cookie).
- Signup posts to `/api/auth/register` and sends `privacy: true` (consent checkbox).
- Login can answer `{two_factor: true}`: then show the code screen, which posts to
  `/api/auth/two-factor-challenge` (`code` or `recovery_code`) and gets `{user}` back.
- `/api/auth/me` now also returns `emailVerified`, `emailVerificationRequired`, `twoFactorEnabled`,
  `twoFactorRequired` and `privacyAccepted` (the two `Required` flags are false in demo mode). Any API call can answer 403 with `code: "email_unverified"` or
  `code: "two_factor_required"`: route to the matching setup screen.
- Validation errors are 422 (were 400). The body is still `{error, issues}`.
- `client/src/lib/realtime.tsx` switches from the hand-written WebSocket to Laravel Echo on Reverb.
- New screens: 2FA setup and challenge, email verification, password reset, active sessions,
  privacy consent, data export, account deletion.
- Chat search UI: filters instead of text search (D7).

## Open questions

- **Demo password:** `tuklas123` fails the new 12-character and breached-password rules. Seeded
  accounts can still use it (rules apply when a password is set through the app), but a
  longer demo password would be better.
- **Local MySQL 8** on the Windows machine (no Docker yet; XAMPP's MariaDB 10.4 is end-of-life).

## Log

- 2026-10-30: Decisions D1–D8 made. PHP 8.5 (Herd) and Composer installed. Conversion document created.
- 2026-10-30: Laravel 13.17 skeleton merged into `tuklas/` (Sanctum, Fortify). All tables ported
  as migrations (one file per module) plus `audit_logs`; enums and models with encrypted casts.
  Security groundwork: Argon2id, password policy, rate limits, security headers, CORS off,
  `{error, issues}` errors, account-ready middleware, audit trail. Fortify wired for JSON with
  enumeration-safe password reset. 25 tests pass (`php artisan test`).
- 2026-10-30: Demo seeder ported (`php artisan migrate:fresh --seed`; encrypted fields go through
  the models). Users module (portfolio, profile, links, background, honors, photo/CV, people) and
  works module (lists, work page, writing, PDFs, submit, decisions, thread, checklist, defense
  tracker, reactions, library, discussion, topic overlap) ported with `WorkPolicy` and actions.
  Uploads are sniffed by their bytes and kept on the private disk. 55 tests pass.
- 2026-10-30: Feed, sidebar, opportunities, events, registration and ads ported. `organize` gate
  (admins + verified educators); events and ads from non-admins are always pending. 65 tests pass.
- 2026-10-30: Publications (`PublicationPolicy`), notifications and research groups
  (`ResearchGroupPolicy`: open/manage/moderate/organize/announce) ported. Group files of unknown
  type are served as `application/octet-stream` downloads. 80 tests pass.
- 2026-10-30: Announcements (visibility scope, read receipts, queued one-per-person emails) and
  chat ported. Laravel Reverb installed: private `users.{id}` and presence `online` channels,
  authorized at `/api/broadcasting/auth`. Chat search now matches people, channels and groups
  (D7); "online" = active in the last 2 minutes (`TouchLastSeen`). 95 tests pass.
  Running locally now needs `php artisan reverb:start` and `php artisan queue:work` beside `serve`.
- 2026-10-30: Admin (stats, queue, people, educator monitoring, moderation; every decision
  audited) and demo reset ported. Every Node route now has a Laravel equivalent. 103 tests pass.
- 2026-10-30: Privacy endpoints: `GET /api/account/export` (JSON download), `GET /api/account/sessions`,
  `POST /api/account/sessions/logout-others` (needs the password), `POST /api/account/privacy`.
  106 tests pass. Next: client changes, then the Claude Code kit, then removing `server/`.
- 2026-10-31: `Conversion` merged into `main`. `feat/client-types`: the client owns its API types
  in `client/src/types/`. `feat/client-api-transport`: Vite proxies `/api` and `/sanctum` to
  `:8000`; `client.ts` sends `Accept: application/json` and `X-XSRF-TOKEN` (fetching
  `/sanctum/csrf-cookie` first, and once more after a 419); signup posts to `/auth/register` with
  a privacy-consent checkbox and the 12-character hint; a 2FA login (`{two_factor: true}`) no
  longer crashes the login page. `ApiError` now carries `code` and `issues`. Checked end to end
  through the proxy: login, `/me`, feed, logout, register, and a write without the token (419).

- 2026-10-31: `feat/client-account-screens`. Before the app opens, `AccountGate` asks for whatever
  setup is unfinished: confirm the email, turn on 2FA (educators and admins), accept a changed
  privacy notice. Any API answer with `code: email_unverified / two_factor_required` re-reads `/me`
  to bring that screen up. Login has the code step (app code or recovery code). New pages:
  `/forgot-password`, `/reset-password`, `/privacy` (public), `/account` (2FA on/off and recovery
  codes, password change, sessions and "sign out other browsers", data download), linked from the
  account menu. Server: `emailVerificationRequired` in `/me`; the emailed verification link opened
  signed out goes to `/login`, and an expired one to `/verify-email?expired=1`, instead of JSON.
  The `auth` rate limit was 10 a minute per IP, which a single 2FA setup nearly used up (and a
  campus behind one IP would share): now 40 a minute per account when signed in, 20 per IP when
  not. Fix from the previous branch: Vite's string proxy shorthand turns on `changeOrigin`, so
  emailed links pointed at `:8000`; the proxy now keeps the browser's host. 110 tests pass; the
  flows were checked end to end through the proxy with `DEMO_MODE=false` (2FA setup with a real
  TOTP code, recovery-code login, verification link, reset link, sessions, export, privacy).
  The privacy notice text is a draft until the Data Privacy Act paperwork is done.

- 2026-11-01: `feat/group-deliverables`. A group deadline can collect work: `submission_mode`
  none (a reminder), each (every student hands in their own) or group (one shared submission),
  with optional instructions. Students hand in a file plus an optional note; handing in again
  counts a version and restarts the review, and the earlier file stays in the history with the
  feedback it got (`deliverable_versions`); work after the due date is marked late. Each hand-in
  is posted in the group's #general by the student (title and version only, never the file or
  note). The adviser, mentors and admins see every submission and who is missing, and accept or
  ask for a revision with feedback (required for a revision); students and reviewers are
  notified (`group_deliverable`) with a link that opens the deliverable. Students see only their
  own submission, or their group's; the files are served through the same check. Notes and
  feedback are encrypted. Deleting a deliverable or the group deletes the files handed in.
  New: `DeliverableController`, `DeliverableSubmission`, `SubmissionMode`, `SubmissionStatus`,
  policy abilities `submit` / `review`. Tests now use a fake disk (they used to write uploads into
  `storage/`). Fix found on the way: with Reverb not running, any request that sent a
  notification answered 500 after saving; live updates are now best effort and a failure is
  logged. `Chat::post` now saves every chat message (the chat controller uses it too). 123 tests
  pass; checked end to end through the proxy.

- 2026-11-01: `feat/account-deletion` (D13). `DELETE /api/account {password}` (`App\Actions\Account\DeleteAccount`)
  keeps the user row, renamed "Former member" (`former-member-{id}`, an unusable email and password,
  `account_deleted_at` set), because works, reviews and groups point at it and most of those foreign
  keys cascade. Erased: portfolio and its files, unapproved works and drafts, comments, reactions,
  saves, registrations, applications, opportunities, pending events and ads, draft publications,
  group memberships, files they shared in groups, their per-student deliverables, notifications,
  sessions; messages are removed like a deleted message; their name is replaced in group logs and
  other people's notifications. Kept as Former member: approved works, reviews, approved events,
  internal and public research, announcements, groups they advise (admins are told), group
  deliverables. Students whose work waited on that adviser are told. `User::active()` keeps former
  members out of people search, adviser and co-author pickers, portfolios, admin lists, announcement
  emails and every notification. Admins can't delete their own account. 131 tests pass.

- 2026-11-01: `feat/client-realtime`. `client/src/lib/realtime.tsx` uses Laravel Echo (pusher-js) on
  Reverb instead of the Node server's `/api/ws`: the private `users.{id}` channel (event `tuklas`)
  triggers the same refetches, and the `online` presence channel decides the chat dots once it has
  answered. Channel auth goes through `api()` (session cookie + XSRF) to `/api/broadcasting/auth`.
  Reverb is reached on the site's own origin at `/app/` (Vite proxies it to :8080; Nginx will in
  production), so no extra CSP entry is needed. Vite reads `tuklas/.env` (`envDir: '..'`; only
  `VITE_*` reach the browser), and `VITE_DEMO_LOGIN` now follows `DEMO_MODE`. Removing the dead
  `/api/ws` socket also removes what was crashing the Vite dev server (an unhandled ECONNRESET when
  a browser closed while that request hung).

- 2026-11-01: `feat/client-chat-search` (D7). The Messages list searches chats by the other person's
  name, the channel or the group, with All / Direct / Channels / Unread chips and counts, and
  highlights the match. It filters the conversation list the client already has (the API returns
  every conversation), so new chats with no messages are found too. The old message-text results
  ("No messages mention …") are gone; an empty search says why messages aren't searched.
  `/api/chat/search` stays on the server but the client no longer calls it.

- 2026-11-01: `chore/remove-node-server`. The conversion is complete: `server/` (Express, Prisma,
  58 files), `database/schema.sql` and the Node-only npm scripts (`db:reset`, `db:sql`, `db:local`)
  are gone; the root workspace is just `client`. `DB_DATABASE` is `tuklas` again (the separate
  `tuklas_laravel` database is no longer needed). `npm run dev` now starts `php artisan serve`,
  `reverb:start`, `queue:work` and Vite together.

- 2026-11-01: `chore/claude-code-kit`. The team's Claude Code setup is in the repo: `CLAUDE.md`,
  `docs/PROJECT.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `COLLABORATION.md`, `docs/decisions/`,
  `.claude/` (settings, hooks, path rules, six commands, a review subagent) and `.github/`
  (PR and task templates, CODEOWNERS, scope-overlap workflow). Adapted from the generic kit: the
  workflow uses `docs/TODO.md` rows instead of GitHub issues, rules match this codebase (React
  client, demo-seeded tests, 404 for hidden things), hot files carry the `tuklas/` prefix, and the
  format hook runs Pint from `tuklas/` after a syntax check, never Prettier.

- 2026-11-01: `chore/deploy-serve-spa`. `npm run build` writes the React app to `public/build/`
  (base `/build/`; `/app/` is left to Reverb). `Route::fallback` (`SpaController`) returns its
  `index.html`, uncached, for every page URL except `api/`, `sanctum/`, `build/`, `storage/` and
  paths with a file extension, which stay 404s; `SecurityHeaders` gives it `config('tuklas.csp')`.
  The before-paint theme script is now `client/public/theme.js`, because the CSP allows no inline
  script. `upgrade-insecure-requests` is only sent when `APP_URL` is HTTPS, so a server still on
  plain HTTP works. Development is unchanged (Vite at :5173).

- 2026-11-01: `chore/deploy-server-config`. `tuklas/deploy/` holds everything a server needs:
  `setup-server.sh` (run once with sudo: packages, MySQL user with a generated password, the
  server's `.env` from `.env.production.example` with fresh keys, Nginx site, Supervisor programs,
  Let's Encrypt), `deploy.sh` (each release: clone into `releases/<time>/`, link the shared `.env`
  and `storage/`, composer, build the client, migrate, cache, switch the `current` symlink, reload
  PHP-FPM, restart the queue worker and Reverb, check `/up`), and the settings they install.
  PHP-FPM and Supervisor run as `www-data` with umask 002; only `shared/storage` is writable by
  PHP. Reverb listens on 127.0.0.1:8080 behind Nginx's `/app/`, and `REVERB_ALLOWED_ORIGINS`
  limits WebSocket origins to the site.

- 2026-11-02: `feat/report-content`. People can report a work, a public discussion comment, a chat
  message, an event or a person (Flag buttons; `components/reports/ReportDialog.tsx`). `reports`
  keeps an encrypted snapshot of what was reported, so the evidence survives a deletion. Admins get a
  Reports tab grouped by reported thing: dismiss, warn the person, or remove the content (works are
  taken off the feed, comments deleted, messages removed like a deleted message, events rejected).
  Every reporter is told the outcome; nobody is told who reported them. Admins can't resolve reports
  about themselves. Reports are in the data export, and go with a deleted account.

- 2026-11-02: `feat/search-indexing`. Public work, publication and portfolio pages are served with
  their own title, description, canonical link, Open Graph/Twitter tags and Google Scholar
  `citation_*` tags (`app/Support/PageMeta.php`, used by `SpaController`), plus a plain copy of the
  content inside `#root` for crawlers without JavaScript; React replaces it on load. Everything else
  is served with `noindex` (except `/`). `/sitemap.xml` lists public works, publications and the
  portfolios of their authors only; `/robots.txt` is generated and keeps crawlers out of `/api/`
  except public PDFs and photos. Browser tabs now show the page's title (`usePageTitle`).
  **Existing servers:** remove the old `location = /robots.txt` line from the installed Nginx site
  (`deploy/nginx.conf` no longer has it), or robots.txt answers 404.

- 2026-11-02: `feat/notification-settings`. In-app notifications still always arrive; on the
  Account page people choose which of six categories also arrive by email (defaults: research,
  groups, announcements and account on; events and the admins' queue off), and turn on a weekly
  digest (Mondays 8 AM Philippine time, `tuklas:weekly-digest`; nothing new means no email).
  `Notifier` queues an `ActivityEmail` for confirmed addresses that want it; announcement emails
  follow the same setting. Tests fake notifications by default (`tests/TestCase.php`), which keeps the
  suite at about 20 seconds. **Servers** need the scheduler's cron line (`docs/STAGING_SERVER.md`,
  one-time steps). Locally, `php artisan schedule:work` runs scheduled jobs.

- 2026-11-02: `feat/chat-polish`. Senders edit their messages in place (`PATCH /api/chat/messages/{id}`;
  "(edited)" shows, the earlier text isn't kept). Anyone in the chat reacts with one of six emoji
  (`POST …/reactions` toggles; `message_reactions`), with who reacted on hover. "Seen" (direct) or
  "Seen by …" (channel) shows under my latest message, from the others' `last_read_at`, which the
  conversation response now includes as `readers`. Live: `message_changed` refetches an edited or
  reacted message without counting it as new; `conversation_read` is pushed only when the reader
  had something unread, so two open tabs can't keep waking each other.

- 2026-11-02: `chore/ci`. `.github/workflows/ci.yml` runs on every pushed branch: Laravel (Pint,
  `composer audit --no-dev`, the suite on MySQL 8.4 with PHP 8.4, like the servers) and the React app
  (`npm audit` for shipped packages, typecheck, lint, build). When tests fail, the failing test names
  and the end of the output appear as an annotation on the run's page. Running on MySQL for the first
  time showed the demo conversations had no fixed ids (MySQL doesn't reuse rolled-back ids), so
  `DemoSeeder` now fixes them at 1–6; and `tests/Unit/.gitkeep` keeps the empty suite folder in git.

- 2026-11-02: `chore/larastan`. Larastan 3 at level 5 (`phpstan.neon`, run in CI) reported 357
  errors; it now reports none. Most came from two gaps: Larastan 3 doesn't read the `casts()` method,
  so every model now uses a `$casts` property, and relationships had no generic types, so they now
  carry `@return BelongsTo<User, $this>` and so on (the `Cards` helpers too). It also found that the
  logout audit listener returned `false`, which stops the remaining Logout listeners; the auth
  listeners are now block closures. `database/seeders/` is left out (demo data; PHPStan misreads its
  tuple lists).

- 2026-11-02: `chore/deploy-backups` and `chore/deploy-pipeline`. Nightly encrypted backups
  (`deploy/backup.sh`: database and uploads, age with only the public key on the server, optional
  rclone copy, 30 days; a backup before every deploy that migrates) and `deploy/restore.sh`, tested
  by a CI job that backs up, damages, restores and checks. `.github/workflows/deploy.yml` deploys
  staging after `ci` passes on `main` and production on a release tag behind required reviewers,
  over SSH with a key the server limits to `deploy/ci-deploy.sh`. Both wait for one-time setup on
  the server and in GitHub (`docs/STAGING_SERVER.md`, one-time steps).

- 2026-11-02: `feat/pwa`. Tuklas installs as an app (manifest, icons from the logo, `client/public/sw.js`
  served at `/sw.js`). The service worker shows an offline page when a page can't load and keeps the
  hashed build files; it never stores API responses, so personal data stays out of the device's
  storage. Push notifications: per category next to email (Account and security → Notifications),
  per device (`push_subscriptions`), sent by a queued job through minishlink/web-push with the
  server's VAPID keys (`php artisan tuklas:vapid-keys`; `deploy.sh` adds them once). Expired devices
  are forgotten; devices are in the data export and go with a deleted account.

- 2026-11-04: `feat/work-metrics`. Works and publications count views and downloads
  (`view_count`, `download_count`; `app/Support/Reach.php`). A view is opening a public work or a
  non-draft publication through the API (so crawlers reading the page don't count); a download is
  opening its PDF as a page of its own (`Sec-Fetch-Dest: document`), not the PDF embedded in the work
  page. Each person or visitor counts once per item per day, and authors' own visits never count.
  `content_hits` remembers who already counted today as an HMAC of the day and the account (or the IP
  and browser), never the IP or browser themselves, and is emptied of earlier days every hour.
  Counting writes straight to the table, so `updated_at` doesn't move. Shown on the work page
  ("Readers"), the publication page, the portfolio's stats and a Reach panel on My research.

## How the code is laid out (for the next modules)

- **Routes:** `routes/modules/<module>.php`, required from `routes/api.php`. Signed-in groups use
  `['auth:sanctum', 'account.ready']`; creates add `throttle:posting`, uploads `throttle:uploads`.
- **Hidden = 404:** throw `HttpException(404, message)` (not `NotFoundHttpException`, whose message
  is replaced with "Not found"). Other refusals: `HttpException(400|403|409, message)`.
- **Cards:** `App\Support\Cards` holds the eager loads for `UserCardResource`, `WorkCardResource`,
  `MyWorkResource`, `PublicationCardResource`. Strict mode is on outside production, so a lazy
  load is an error: load what a resource reads.
- **Files:** `App\Support\Uploads::store($request, 'pdf'|'image'|'any')` and `::serve(...)`.
- **Side effects:** `Notifier::notify()` (in-app + live push), `Audit::log()` for admin and
  security actions.
- **Tests:** `$this->seedDemo()` loads the demo data with 2FA set for educators and admins;
  `$this->signOut()` turns the next request into a visitor.
