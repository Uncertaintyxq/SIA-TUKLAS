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
   - The row says **In progress (name)**: it's taken; check the branch, or ask that person.
   - The row says **Done**: it's merged.
3. **Claim it:** on the latest `main`, set the row's Status to `In progress (Your Name)` and push
   that one-line docs commit straight away, so the table shows the claim. Then create the branch
   with the exact name in the table and push it right away, even before the first real commit.
   The pushed branch is the claim; the Status is for people reading the table.
   ```bash
   git switch main && git pull --ff-only
   # edit the row's Status in docs/TODO.md to: In progress (Your Name)
   git add docs/TODO.md && git commit -m "docs: claim feat/account-deletion" && git push
   git switch -c feat/account-deletion
   git commit --allow-empty -m "chore: start feat/account-deletion"
   git push -u origin feat/account-deletion
   ```
4. **Stay in scope:** change only the paths in the row's Scope. If you need a file outside it,
   say so in the PR or ask the other developer first. Files marked *shared* are touched by
   several rows: keep those changes small.
5. **Finish:** in the same PR, change the row's Status to **Done (#PR number)**. Merge the PR
   into `main`, then delete the branch. Status is edited only at claim and finish, so the table
   rarely causes merge conflicts.
6. **New work** gets a new row first, added in a small PR of its own, before anyone creates
   the branch.

Branches start from `main` (the Laravel conversion was merged into it on 2026-10-31; `Conversion`
is no longer used). New to the project? Read [GETTING_STARTED.md](GETTING_STARTED.md) first. With Claude Code, `/start-task <branch>` does steps 2–3
and `/finish-task` step 5 (see [COLLABORATION.md](COLLABORATION.md)). Prefixes: `feat/` (feature), `fix/`, `chore/` (tooling, setup), `docs/`, `test/`.

## Planned branches

Paths are relative to `tuklas/` unless they start with `docs/` or `.github/`.

### Conversion: server

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `feat/account-deletion` | Delete my account (D13): erase personal data; keep published works as "Former member"; keep reviews, unnamed. `app/Http/Controllers/Account/`, `app/Actions/Account/` (new), `routes/modules/account.php`, `tests/Feature/Account/`. Built by keeping the user row, anonymised, so no nullable `author_id` was needed: a `users.account_deleted_at` migration instead, `User::active()` in every people list, picker, portfolio and notification, and the "Delete account" section on `client/src/pages/AccountPage.tsx`. | | Done |
| `feat/group-deliverables` | Students submit deliverables against a group deadline; the adviser sees who submitted, who's late, and leaves feedback. New migration, model, controller and tests; `routes/modules/groups.php` (*shared*); group page in `client/src/pages/GroupPage.tsx` and `client/src/components/groups/` (new). Also touched: `DemoSeeder` (two demo deliverables), `tests/TestCase.php` (fake disk), `app/Support/Realtime.php` (a Reverb outage no longer fails the request). | `feat/client-types` | Done |

### Conversion: React client

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `feat/client-types` | Copy the types the client imports from `server/src/schemas/*` into `client/src/types/` and update the 36 importing files. No behaviour change. | | Done |
| `feat/client-api-transport` | Point the client at Laravel: `client/vite.config.ts` proxy to `:8000`; `client/src/api/client.ts` sends `Accept: application/json` and `X-XSRF-TOKEN`; `client/src/api/auth.ts` uses `/auth/register`; privacy checkbox and 12-character hint in `client/src/pages/SignupModal.tsx`; `client/src/types/auth.ts`; 2FA login answer handled in `client/src/pages/LoginPage.tsx`. | `feat/client-types` | Done |
| `feat/client-account-screens` | Screens for 2FA setup and the login code challenge, email verification, forgot/reset password, privacy consent, active sessions and data export; route to them when the API answers `email_unverified` or `two_factor_required`. `client/src/pages/` (new pages), `client/src/components/account/` (new), `client/src/api/account.ts` (new), `client/src/App.tsx` (*shared*: routes only). Also touched: `LoginPage.tsx` (code step, forgot link), `SignupModal.tsx` (privacy link), `UserMenu.tsx` (Account link), `client/vite.config.ts` (proxy keeps the host), `AccountResource` (`emailVerificationRequired`), `bootstrap/app.php` (emailed links in a browser), the `auth` rate limit. | `feat/client-api-transport` | Done |
| `feat/client-realtime` | Replace the hand-written WebSocket with Laravel Echo on Reverb: `client/src/lib/realtime.tsx`, `client/package.json` (*shared*: adds `laravel-echo`, `pusher-js`). Presence for "online" dots. Also touched: `client/vite.config.ts` (`envDir: '..'`, `/app/` proxied to Reverb), `client/src/types/realtime.ts`, `.env.example` (`VITE_DEMO_LOGIN` follows `DEMO_MODE`). | `feat/client-api-transport` | Done |
| `feat/client-chat-search` | Chat search UI: find conversations by person, channel or group instead of message text (D7). `client/src/components/chat/`, `client/src/pages/MessagesPage.tsx`. Built as filters on the conversation list (name search, All / Direct / Channels / Unread), so chats with no messages are found too; the unused client hook for `/api/chat/search` and its type were removed (`client/src/api/chat.ts`, `client/src/types/chat.ts`). | `feat/client-types` | Done |
| `chore/remove-node-server` | Delete `server/`, Prisma, `database/schema.sql`, the Node scripts in `package.json` (*shared*) and the root `docker-compose` notes that only apply to Node. Switch `DB_DATABASE` back to `tuklas`. Update `README.md` and `docs/GETTING_STARTED.md`. Last of the conversion. Also: `npm run dev` now starts the API, Reverb, the queue worker and the client together (`concurrently`); `eslint.config.js`, `.gitignore`, `client/PRODUCT.md`. | every row above | Done |

### Tooling

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `docs/getting-started` | `docs/GETTING_STARTED.md` (what to install, run, test, build next); README link; separate `tuklas_laravel` database in `.env.example` and `database/docker-init/`. | | Done |
| `chore/claude-code-kit` | The Laravel Claude Code kit (`Downloads/tuklas-claude-kit`) at the git root: `CLAUDE.md`, `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/COLLABORATION.md`, `docs/decisions/`, `.claude/`, `.github/` (templates, CODEOWNERS). Root `.gitignore` stops ignoring `.claude/`. Paths in the kit get the `tuklas/` prefix. Adapted to this repo: commands use TODO rows instead of GitHub issues (`/new-task` replaces `/new-issue`), rules describe the React client and the demo-seeded tests, the format hook runs Pint from `tuklas/` and skips client files; also `tuklas/pint.json`, `tuklas/routes/modules/README.md`, ADR 0001. The kit's `ci.yml` and `phpstan.neon` are left for the two rows below. | | Done |
| `chore/ci` | GitHub Actions: Pint, tests on MySQL 8, `composer audit`, `npm audit`, client typecheck/lint/build. `.github/workflows/`. Start from the kit's `ci.yml` (`Downloads/tuklas-claude-kit/.github/workflows/`) with `working-directory: tuklas`. Also: runs on every pushed branch (the team merges locally), PHP 8.4 like the servers, `npm audit` only for shipped packages (dev tools have moderate ESLint advisories), `docs/COLLABORATION.md`, fixed ids for the demo conversations (`DemoSeeder`), `tests/Unit/.gitkeep`. | `chore/claude-code-kit` | Done |
| `chore/larastan` | Add Larastan and fix what level 5 reports. `composer.json` (*shared*), `phpstan.neon` (start from the kit's), small fixes in `app/`. Also: models' `casts()` methods became `$casts` properties (Larastan 3 doesn't read the method), relationship generics on every model, typed `Cards` helpers, `@property-read` for count/exists attributes, `database/seeders/` left out of analysis, auth event listeners no longer return false (`AppServiceProvider`), event attendees read from `event_registrations` (`EventController`), `docs/CONVENTIONS.md`, `.claude/rules/database.md`. | `chore/ci` | Done |

### Features (from the feature review, see `reference/FEATURES.md`)

Decided 2026-11-01. Rows 1–7 in the review's order, then the three extras. Paths are relative to `tuklas/`.

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `feat/report-content` | Report a work, comment, chat message, event or person, with a reason; admins get a Reports queue (dismiss, remove the content, warn the person) and the reporter is told the outcome. `reports` table + `app/Models/Report.php`, `app/Http/Controllers/Moderation/` (new), `routes/modules/reports.php` (new; `routes/api.php` *shared*), `app/Http/Controllers/Admin/ModerationController.php`, client `components/reports/` (new), a Report action on `WorkPage`, discussion comments, chat messages, `EventPage` and portfolios, a Reports tab on `AdminPage`. Also: reports are in the data export, and go (or are blanked) with a deleted account (`PrivacyController`, `DeleteAccount`). | | Done |
| `feat/search-indexing` | Public work, publication and portfolio pages carry their own title, description, authors, date and PDF link in the HTML Laravel serves: Google Scholar `citation_*` tags, Open Graph and Twitter card tags, a canonical link. `sitemap.xml` of public pages; `robots.txt`. `app/Http/Controllers/SpaController.php`, `app/Support/PageMeta.php` (new), `routes/web.php`, `public/robots.txt`. Hidden or unapproved items get the plain page. Also: `SitemapController` (`robots.txt` is generated, so it carries the sitemap address), `TUKLAS_INSTITUTION` in `config/tuklas.php` and the `.env` examples, `deploy/nginx.conf` (robots.txt goes to Laravel), browser tab titles (`client/src/lib/usePageTitle.ts`). | `chore/deploy-serve-spa` | Done |
| `feat/work-metrics` | View and download counts on works and publications (one per person or visitor per day, no personal data kept), shown on the work and publication pages, and a "Reach" panel on My Research and the portfolio. Migration (counts + a daily dedupe table), `app/Http/Controllers/Works/WorkFileController.php`, `WorkController` (show), `Publications/PublicationController.php`, their Resources, client `WorkPage`, `PublicationPage`, `MyResearchPage`, `components/portfolio/`. Also: `app/Support/Reach.php` (counting; a view is opening a public work or a non-draft publication, a download is opening its PDF as a page, not the viewer embedded in the work page; authors' own visits don't count), `content_hits` keeps only a keyed one-way hash per reader and day and is emptied hourly of earlier days (`routes/console.php`), the portfolio's stats (`PortfolioController`), the card Resources carry `views`/`downloads`, client `components/portfolio/Reach.tsx`. Taken over from Benz Ashley's empty start branch. | | Done |
| `feat/library-browse` | Filter and browse research by year, program or department, adviser, type and tag, in the feed's works and in the Library; a "Browse by department" view with counts. `app/Http/Controllers/Feed/FeedController.php` (index), `Publications/PublicationController.php` (index), client `FeedPage`, `LibraryPage`, `components/feed/` filters, `api/feed.ts`, `api/publications.ts`. | | In progress (Jun Mari) |
| `feat/research-story` | Optional "How we made this" section on a work (the researchers' own words, client Q&A 2a), edited with the draft and shown on the work page once approved. Migration (`works.story`), `WorkController` (store/update validation), `WorkResource`, client work editor in `components/works/`, `WorkPage`. Also: `work_versions.story` (each submitted version keeps it), `WorkRequest`, `SubmitWork`, `MyWorkResource`, the data export (`PrivacyController`), a story on demo work 1 (`DemoSeeder`), `reference/README.md` and `docs/PROJECT.md`. Readers: the panel during review, everyone once public. | | Done |
| `feat/follow` | Follow people, departments and tags; a "Following" filter on the feed; followers hear when someone they follow has a work approved or posts a publication. `follows` table + model, `app/Http/Controllers/Users/FollowController.php` (new), `routes/modules/users.php`, `FeedController` (filter), `Notifier` calls in the approve/publish paths, client Follow buttons on portfolios, tag and department chips, `FeedPage`. | | Not started |
| `feat/notification-settings` | Per category (research and reviews, groups, announcements, events and opportunities, account, and the admins' approval queue), choose in-app only or also email; an optional weekly digest email (unread updates, this week's deadlines and events, new research in your department). `users.notification_settings` (json), `app/Support/NotificationPrefs.php`, `app/Support/Notifier.php` (*shared*: queues the email), `app/Notifications/ActivityEmail.php` and `WeeklyDigest.php` (Laravel notifications, like `AnnouncementPosted`), `app/Console/Commands/SendWeeklyDigest.php`, `routes/console.php` (weekly schedule), an Email section on `AccountPage`. Also: announcement emails follow the setting (`AnnouncementController`), settings are in the data export, a cron line for `schedule:run` in `deploy/setup-server.sh`, `tests/TestCase.php` fakes notifications by default. | | Done |
| `feat/mentions` | `@username` in discussion comments, review comments and chat messages: an autocomplete picker while typing, a link in the shown text, and a notification to the person mentioned (only if they can see the item). `app/Support/Mentions.php` (new), the comment and message store paths in `Works/WorkController`, `Works/ReviewController` and `Chat/ChatController`, client `components/ui/MentionInput.tsx` (new), the chat composer and discussion forms. Also: the public discussion is saved in `Works/ReadingController` (not `WorkController`); a "Mentions" notification category (push on, email off; `NotificationPrefs`), people already told about the post aren't told twice, an edited chat message only notifies newly mentioned people, at most 10 per message, notifications never quote the text; `components/ui/MentionText.tsx` (links), `TextAreaField` passes a `ref`, the review thread form (`ReviewPanel`), the mention icon (`Updates`); `@everyone` / `@all` in group channels for the group's organizers (adviser, mentors with the moderation right, the student leader, admins), with those names reserved in `Usernames`. | | Done |
| `feat/chat-polish` | Edit your own message (shows "edited"), react to messages with a few emoji, and "Seen by" on the latest message in a conversation (from `last_read_at`). Migration (`messages.edited_at`, `message_reactions`), `app/Http/Controllers/Chat/ChatController.php`, `routes/modules/chat.php`, the live-update events, client `components/chat/`, `api/chat.ts`. Also: `app/Support/Chat.php` (`message_changed` and `conversation_read` pushes), `app/Models/MessageReaction.php`, reactions in the data export and removed with a deleted account (`PrivacyController`, `DeleteAccount`). | | Done |
| `feat/pwa` | Install Tuklas on a phone or desktop (web app manifest, icons, a service worker that caches the app shell and shows an offline page) and push notifications for the types a person chooses. `client/public/` (manifest, icons, `sw.js`), `client/index.html`, `push_subscriptions` table + model, a Web Push package (`composer.json` *shared*), VAPID keys in `.env.example` and `.env.production.example`, `Notifier` (push channel), `config/tuklas.php` CSP (`worker-src`, `manifest-src`), a push toggle on `AccountPage`. Also: push choices sit next to the email ones per category (`NotificationPrefs`, settings API), `app/Support/PushSender.php` and `app/Jobs/SendPushNotifications.php` (minishlink/web-push), `/sw.js` served from the root (`SpaController`, `routes/web.php`, the app CSP in `SecurityHeaders`), `tuklas:vapid-keys` (works on Windows too) run once by `deploy.sh`, icons rendered from the logo, `client/src/lib/pwa.ts`, the Notifications section (`components/account/NotificationSettings.tsx`), devices in the data export and deleted with the account. | `feat/notification-settings` | Done |

### Before real student data (launch order)

Staging holds demo data only. Before any real student's data goes on a server, these come first,
in this order (decided 2026-11-04):

1. **Several schools on one site**: the three institution rows below. First, because every account
   then carries its school, and what people can see and what admins may do depend on it. Adding it
   after real accounts exist means moving them and re-checking who sees what.
2. **Data Privacy Act paperwork**: final privacy notice text, a named Data Protection Officer, NPC
   registration if required, and who controls each school's data (checklist under "Not tied to a
   branch", and [DEPLOYMENT.md](DEPLOYMENT.md#data-privacy-act-ra-10173)).
3. **Production decisions**: host, domain and email provider (checklist below).
4. **Backups off the server**: `rclone config` and `BACKUP_RCLONE_REMOTE`
   (`tuklas/deploy/README.md`, "Backups"). A backup on the same server is lost with it.
5. **The security checklist** in [DEPLOYMENT.md](DEPLOYMENT.md#security-checklist-before-the-first-public-launch).

### Several schools on one site (build before real student data, if the client wants it)

Tuklas is built for one university per site. These three rows make it hold several schools (decided
2026-11-02; see `reference/FEATURES.md`, section 4), and since 2026-11-04 they come before real
student data. Status stays **Future** until the user schedules them: ask before claiming one. First
confirm the client's answer (one site per school, or several on one site). If it's one site per
school, delete this section and set `TUKLAS_INSTITUTION` on each server instead.

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `feat/institutions` | Each person belongs to an institution (school or university). `institutions` table (name, short name, the email domains that belong to it, e.g. `school.edu.ph`) and `users.institution_id`; signup picks the institution, matched automatically by email domain where it can be; shown on portfolios and person cards; admins add and edit institutions. Google Scholar's institution on a work comes from its author's institution (`app/Support/PageMeta.php`), replacing `TUKLAS_INSTITUTION`. A migration puts existing accounts in one default institution. `app/Actions/Fortify/CreateNewUser.php`, `app/Models/`, `app/Http/Controllers/Admin/`, `UserCardResource`, client signup, portfolio and admin screens, `DemoSeeder` (a second school). | | Future |
| `feat/institution-scoping` | Departments belong to an institution, so the same department name at two schools stays separate: department announcements reach only that school's department; the weekly digest's "new research in your department", the feed's department filter, library browsing and people search are limited to (or filterable by) the institution. Opportunities and events say which institution posted them and can be limited to it. `Announcements/AnnouncementController.php`, `Feed/FeedController.php`, `Publications/PublicationController.php`, `Users/PeopleController.php`, `SendWeeklyDigest.php`, client filters. | `feat/institutions` | Future |
| `feat/institution-admins` | Admins per institution, plus super-admins over all of them: an institution's admins verify its educators, approve its events and ads, verify its honors, handle reports about its people and content, and post system announcements to it; super-admins manage institutions and admins. Policies and gates (`AppServiceProvider`, `app/Policies/`), `Admin/*Controller.php`, `Moderation/ReportQueueController.php`, admin screens. Also: who controls each school's data under the Data Privacy Act (`docs/DEPLOYMENT.md`). | `feat/institutions` | Future |

### Deployment (see [DEPLOYMENT.md](DEPLOYMENT.md))

| Branch | Scope | Depends on | Status |
|---|---|---|---|
| `chore/deploy-azure-vm` | A free staging server on Azure for Students: one Cloud Shell script that creates only cheap resources (B1s Ubuntu 24.04 VM in Southeast Asia, one disk, a static IP with a free `cloudapp.azure.com` name, a firewall for SSH/HTTP/HTTPS), a swap file on first boot, daily auto-shutdown at 11 PM Philippine time with an email warning, budget alerts where the subscription allows, and start/stop/status helpers. `deploy/azure/` (new). Installing Tuklas on it is the two rows below. Also: `docs/DEPLOYMENT.md` (staging host). | | Done |
| `chore/deploy-serve-spa` | Laravel serves the built React app: Vite builds into `public/build/` (not `public/app/`, which is Reverb's WebSocket path), a fallback route in `routes/web.php` returns its `index.html` with the CSP from `config/tuklas.php`. Also: the theme script moved out of `index.html` into `client/public/theme.js` (the CSP blocks inline scripts); `upgrade-insecure-requests` only on an HTTPS `APP_URL`. | `feat/client-realtime` | Done |
| `chore/deploy-server-config` | Server config kept in the repo: `deploy/nginx.conf`, `deploy/supervisor.conf` (queue worker, Reverb), `deploy/php.ini`, `deploy/deploy.sh`, `.env.production.example`. Also: `deploy/setup-server.sh` (one-time install of Nginx, PHP 8.4, MySQL, Node 22, Composer, Certbot), `deploy/mysql.cnf` (small-server memory), `deploy/README.md`, `config/reverb.php` (`REVERB_ALLOWED_ORIGINS`). | `chore/deploy-serve-spa` | Done |
| `chore/deploy-pipeline` | GitHub Actions workflow that deploys `main` to staging automatically and to production on a tagged release. `.github/workflows/deploy.yml`. Also: `deploy/ci-deploy.sh` (the only command the deploy key may run), staging after `ci` passes on `main` or by hand, production on a `v*.*.*` tag behind the environment's required reviewers, skipped (not failed) until each environment is set up, `deploy/README.md` (setup), `docs/STAGING_SERVER.md`. Built; not set up on staging (deploys are manual for now, 2026-11-04). | `chore/ci`, `chore/deploy-server-config` | Done |
| `chore/deploy-backups` | Nightly encrypted database and upload backups with a restore script and a tested restore. `deploy/backup.sh`, `deploy/restore.sh`, `docs/DEPLOYMENT.md` (restore steps). Also: age encryption (public key on the server, private key in the password manager), optional rclone off-server copy, a backup before migrating in `deploy.sh`, the cron line and `age`/`rclone` in `setup-server.sh`, `.env.production.example`, the restore test as a CI job (`.github/workflows/ci.yml`), `deploy/README.md`, `docs/STAGING_SERVER.md`. | `chore/deploy-server-config` | Done |

## Not tied to a branch

- [ ] **Local MySQL 8 on the Windows machine** (now SQLite; XAMPP's MariaDB 10.4 is end-of-life).
  Options: Docker Desktop with the repo's `docker-compose.yml`, or the MySQL 8 installer.
- [ ] **Answer the deployment decisions** in [DEPLOYMENT.md](DEPLOYMENT.md#decisions-needed): host, domain, email provider.
- [ ] **Data Privacy Act paperwork** before launch: privacy notice text, a named Data Protection
  Officer, and NPC registration if required (see DEPLOYMENT.md). A draft notice is in
  `client/src/components/account/PrivacyNotice.tsx`; when the approved text replaces it, bump
  `PRIVACY_VERSION` there and `privacy_version` in `config/tuklas.php` together.
- [ ] **GitHub setup for the kit** (repo owner): fill in `.github/CODEOWNERS`; each developer installs the GitHub CLI and runs
  `gh auth login` (PR titles in the session snapshot); consider branch protection on `main` once `chore/ci` lands
  (see `docs/COLLABORATION.md`).
- [ ] **Later, optional:** passkeys sign-in (Fortify supports it; needs client screens).
