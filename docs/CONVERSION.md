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
├─ client/                        React SPA (Vite proxies /api to Laravel)
└─ server/                        Node API: deleted once every module is ported
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
| Group deliverables (new: submissions against a group deadline) | new | ☐ | ☐ | |
| Announcements | `routes/announcements.ts` | ☑ | ☑ | |
| Chat and real-time (server side) | `routes/chat.ts`, `realtime.ts` | ☑ | ☑ | |
| Publications | `routes/publications.ts` | ☑ | ☑ | |
| Admin | `routes/admin.ts` | ☑ | ☑ | |
| Notifications | `routes/notifications.ts`, `lib/notify.ts` | ☑ | ☑ | |
| Demo reset | `routes/demo.ts` | ☑ | ☑ | |
| Privacy: data export, sessions, consent, audit log | new | ☑ | ☑ | |
| Privacy: account deletion (D13) | new | ☐ | ☐ | |
| Client: types, proxy, CSRF, Echo, new security screens | `client/` | ☐ | ☐ | |
| Remove Node server and Prisma | | ☐ | | |

## Client changes this causes

- Types the client imports from `server/src/schemas/*` (36 files, all `import type`) move into
  `client/src/types/` before `server/` is deleted.
- Vite proxy target: Laravel on `:8000` instead of `:4000`.
- `client/src/api/client.ts` sends `Accept: application/json` (otherwise Fortify answers with
  redirects) and the `X-XSRF-TOKEN` header Sanctum needs (copied from the `XSRF-TOKEN` cookie).
- Signup posts to `/api/auth/register` and sends `privacy: true` (consent checkbox).
- Login can answer `{two_factor: true}`: then show the code screen, which posts to
  `/api/auth/two-factor-challenge` (`code` or `recovery_code`) and gets `{user}` back.
- `/api/auth/me` now also returns `emailVerified`, `twoFactorEnabled`, `twoFactorRequired` and
  `privacyAccepted`. Any API call can answer 403 with `code: "email_unverified"` or
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
