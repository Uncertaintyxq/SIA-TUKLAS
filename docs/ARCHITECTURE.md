# Architecture

Read this before adding a module, a table, a new layer or a third-party integration. Update it in
the same branch when you change any of those. Paths are relative to `tuklas/` (the app) unless
they start with `docs/`. Decisions behind this layout (D1–D13) are in `docs/CONVERSION.md`.

## Layers

```
React app (client/)  ──fetch /api, cookies + X-XSRF-TOKEN──►  Laravel
                     ◄──Reverb WebSocket on /app/ (Echo)───

Request → Route (routes/modules/<module>.php, required from routes/api.php)
        → Middleware (auth:sanctum, account.ready, throttle:<limiter>, SecurityHeaders)
        → Controller (app/Http/Controllers/<Module>/)        thin
        → Validation ($request->validate() or app/Http/Requests/<Module>/)
        → Policy / Gate (app/Policies, gates in AppServiceProvider)
        → Action (app/Actions/<Module>/) for writes with real rules
        → Model (app/Models/)                                relationships, casts, scopes
        → Resource (app/Http/Resources/)                     camelCase JSON allowlist
```

- **Controllers** load (or 404), authorize, validate, call an Action or do a simple write, and
  return a Resource or array. Anything with branching business rules goes in an Action.
- **Policies** hold every access rule. Something a person may not open answers 404 (not 403),
  so its existence isn't revealed.
- **Support classes** (`app/Support/`) are shared plumbing: `Cards` (eager loads for card
  resources), `Uploads` (byte-sniffed files on the private disk), `Notifier` (bell + live push),
  `Realtime` (Reverb, best effort), `Audit`, `Chat`, `Groups`, `Markup`, `Topics`, `Usernames`.
- **Live updates** say what changed, never the content; the client refetches through the API.

## Module map

| Module | Purpose | Main paths |
|---|---|---|
| Auth / Account | Fortify sign-in, 2FA, verification, reset; sessions, export, privacy consent, account deletion | `routes/modules/auth.php`, `account.php`, `app/Http/Controllers/{Auth,Account}`, `app/Actions/{Fortify,Account}`, `client/src/components/account`, `client/src/pages/{Login,Account,ForgotPassword,ResetPassword,Privacy}Page.tsx` |
| Users | Portfolios, profile editing, people search, adviser list | `users.php`, `app/Http/Controllers/Users`, `client/src/pages/PortfolioPage.tsx` |
| Works | Student works: drafts, versions, PDFs, review and approval, discussion, library, defense tracker | `works.php`, `app/Http/Controllers/Works`, `app/Actions/Works`, `WorkPolicy`, `client/src/components/works` |
| Feed | Community feed, sidebar, opportunities | `feed.php`, `app/Http/Controllers/Feed`, `client/src/pages/FeedPage.tsx` |
| Events | Academic events, registration, ad slots | `events.php`, `app/Http/Controllers/Events` |
| Publications | Educators' own research | `publications.php`, `PublicationPolicy` |
| Groups | Research groups: members, channels, files, deadlines, deliverables | `groups.php`, `app/Http/Controllers/Groups`, `ResearchGroupPolicy`, `client/src/components/groups`, `client/src/pages/GroupPage.tsx` |
| Announcements | System, department and group announcements with read receipts and email | `announcements.php` |
| Chat | Direct messages and group channels, threads, files | `chat.php`, `app/Support/Chat.php`, `client/src/components/chat` |
| Notifications | The bell | `notifications.php`, `app/Support/Notifier.php` |
| Admin | Stats, approvals, people, educator monitoring, moderation | `admin.php`, `app/Http/Controllers/Admin` |
| Shared | Layout, UI kit, API client, realtime | `client/src/components/{layout,ui}`, `client/src/api/client.ts`, `client/src/lib` (coordinate before changing) |

## Data model

Core tables (one migration file per module in `database/migrations/`):

```
users 1─1 profiles; users 1─* academic_links, backgrounds, honors
users 1─* works (author) *─* users (work_authors: co-authors); works *─1 users (adviser)
works 1─* work_versions, reviews (1─* revision_items), comments, reactions, defense_stages
research_groups *─1 users (adviser); research_groups 1─* group_members, group_files,
  group_deadlines (1─* deliverable_submissions 1─* deliverable_versions), group_activities
conversations (direct | channel of a group) 1─* conversation_members, messages (threads via parent_id)
announcements 1─* announcement_attachments, announcement_reads
events 1─* event_registrations, ads; opportunities 1─* opportunity_applications
publications *─* users (publication_authors); notifications; audit_logs
```

Encrypted at rest: `messages.text`, `comments.text`, `reviews.comment`, `revision_items.text`,
deliverable notes and feedback. A deleted account keeps its `users` row as "Former member"
(`account_deleted_at`); `User::active()` keeps those out of every people list.

## Integrations

| What | How | Config |
|---|---|---|
| Live updates | Laravel Reverb (Pusher protocol), Echo in the client | `REVERB_*`, `VITE_REVERB_APP_KEY` in `.env` |
| Mail | Laravel mail (log driver locally), queued announcement emails | `MAIL_*`; `queue:work` must run |
| Files | Private local disk (`storage/app/private/uploads`), served only by controllers | `FILESYSTEM_DISK` |
| Auth | Fortify (2FA TOTP, verification, reset) + Sanctum SPA cookies | `config/fortify.php`, `SANCTUM_STATEFUL_DOMAINS` |

## Deployment

Planned in `docs/DEPLOYMENT.md` (Ubuntu, Nginx, PHP-FPM, MySQL, Reverb and the queue worker under
Supervisor). Branches `chore/deploy-*` in `docs/TODO.md`.

## Directory layout

```
CLAUDE.md, docs/                    project guides, TODO, decisions (git root)
.claude/                            Claude Code settings, hooks, rules, commands
tuklas/                             the app
  app/Actions/<Module>/             business rules for writes
  app/Http/Controllers/<Module>/    thin controllers
  app/Http/Requests/<Module>/       larger validations
  app/Http/Resources/               JSON resources (camelCase)
  app/Models/  app/Enums/  app/Policies/  app/Support/  app/Events/
  database/migrations/  seeders/DemoSeeder.php  factories/
  routes/api.php                    only requires module files (hot)
  routes/modules/<module>.php       module routes
  tests/Feature/<Module>/
  client/src/api/                   TanStack Query hooks per module
  client/src/types/                 API types per module
  client/src/components/<area>/     components; ui/ and layout/ are shared
  client/src/pages/                 one page per route
  reference/                        client requirements (read before changing scope)
```
