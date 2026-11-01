# Getting started

What to install, how to run and test Tuklas on your machine, and what's left to build.

**Where things stand (2026-11-01):** Tuklas is a Laravel 13 JSON API with a React app in
`client/`. The move from the original Node/Express server is complete and that server has been
removed. What's left is tooling and deployment (see [TODO.md](TODO.md)).

To run the site: set it up once (section 3), then `npm run dev` starts everything (section 4).

## 1. Install these

| Tool | Version | Needed for | Get it |
|---|---|---|---|
| Git | any recent | Everything | [git-scm.com](https://git-scm.com/) |
| PHP | **8.3 or newer**, with `intl`, `zip`, `sodium`, `pdo_mysql`, `pdo_sqlite`, `mbstring`, `fileinfo`, `openssl` | Laravel API | **[Laravel Herd](https://herd.laravel.com/)** (Windows/macOS) installs PHP and Composer with these extensions on |
| Composer | 2.x | Laravel API | Included with Herd, or [getcomposer.org](https://getcomposer.org/) |
| Node.js | **22 or newer** (with npm) | React app | [nodejs.org](https://nodejs.org/) |
| MySQL | **8.x** | The database | **Docker Desktop** (uses the repo's `docker-compose.yml`), or the [MySQL 8 installer](https://dev.mysql.com/downloads/mysql/) |
| VS Code | optional | Editing | Recommended extensions: PHP Intelephense, ESLint |
| GitHub CLI | optional | `gh` commands for PRs | [cli.github.com](https://cli.github.com/) |

**No MySQL yet?** The Laravel API also runs on SQLite (built into PHP) for a quick start; see 3a.
The automated tests always use an in-memory SQLite database, so `php artisan test` needs no database server.

Check your setup in a **new** terminal:

```bash
php -v          # 8.3+
php -m          # lists intl, zip, sodium, pdo_mysql, ...
composer -V
node -v         # v22+
docker -v       # if you use Docker for MySQL
```

> **Windows with XAMPP:** XAMPP's PHP 8.2 is too old for Laravel 13. Install Herd and remove
> `C:\xampp\php` from your PATH so Herd's PHP comes first.

## 2. Get the code

```bash
git clone https://github.com/Uncertaintyxq/SIA-TUKLAS.git
cd SIA-TUKLAS/tuklas          # the app lives in tuklas/
composer install              # PHP packages (vendor/)
npm install                   # JavaScript packages (React app)
```

## 3. Run the Laravel API

### 3a. Configure

```bash
cp .env.example .env
php artisan key:generate      # the app's encryption key, in your .env only
php artisan reverb:install    # live-update keys in your .env (answer "no" to any npm prompt)
```

Pick a database in `.env`:

- **MySQL in Docker** (recommended): `npm run db:up` starts MySQL 8 with a `tuklas` database and
  user, which is what `.env.example` already points at (`127.0.0.1:3306`).
- **MySQL installed directly**: create a `tuklas` database and user, and put them in `.env`.
- **SQLite** (no install): in `.env` set `DB_CONNECTION=sqlite`, delete the other `DB_*` lines,
  and create the file: `touch database/database.sqlite` (PowerShell: `New-Item database/database.sqlite`).

### 3b. Create the tables and demo data

```bash
php artisan migrate:fresh --seed
```

Emails (verification, password reset, announcements) aren't sent locally: with `MAIL_MAILER=log`
they're written to `storage/logs/laravel.log`.

### 3c. Test

```bash
php artisan test                    # all tests (SQLite in memory, no setup needed)
php artisan test --filter=Works     # one area
vendor/bin/pint                     # format PHP before committing (PowerShell: php vendor/bin/pint)
```

All tests must pass before a pull request is merged.

## 4. Run it

From `tuklas/`, one command starts everything, with each part's output labelled:

```bash
npm run dev
```

| Label | What | Where |
|---|---|---|
| `api` | `php artisan serve`, the Laravel API | :8000 |
| `live` | `php artisan reverb:start`, live updates (new messages, notifications, who's online) | :8080 |
| `queue` | `php artisan queue:work`, background jobs such as emails | |
| `web` | the React app (Vite) | <http://localhost:5173> |

Open <http://localhost:5173>. Vite forwards `/api` and `/sanctum` to Laravel and `/app/` to Reverb,
so the browser sees one site and the sign-in cookies work. Ctrl+C stops all four. Vite reads
`VITE_REVERB_APP_KEY` and `VITE_DEMO_LOGIN` from `tuklas/.env`: restart after changing them.

You can still run the parts separately, each in its own terminal (`php artisan serve`, and so on,
plus `npm run dev -w client` for the site).

On a server there is no Vite: `npm run build` writes the site to `tuklas/public/build/` and Laravel
hands out its page for every address (`routes/web.php`). Locally, keep using :5173; the build at
:8000 has no hot reload, live updates or sign-in (those are set up for :5173).

**Testing push notifications** (Account and security → Notifications): make the server's push keys
once with `php artisan tuklas:vapid-keys --write=.env`, restart `npm run dev`, and use Chrome or Edge
at <http://localhost:5173> (browsers allow push on localhost without HTTPS). The service worker is
registered in development too; to start clean, DevTools → Application → Service workers → Unregister.

**Testing sign-in security:** set `DEMO_MODE=false` in `.env` and restart `npm run dev`.
Educators and admins are then asked to set up 2FA (any authenticator app works), and new
accounts must confirm their email. Emails go to `storage/logs/laravel.log`: copy the link from
there into the browser (`npm run dev` runs the queue worker that sends them).

## Working with Claude Code

The repo carries a Claude Code setup that every developer's session loads: `CLAUDE.md` (stack,
commands, rules), `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, and `.claude/`
(team settings, hooks, path rules, commands). Open Claude Code at the repo root (`SIA-TUKLAS/`).

- At the start of a session Claude lists the files other active branches are changing, and asks
  before it edits one of them, a shared "hot" file, or anything on `main`.
- After it edits a PHP file it checks the syntax and runs Pint on that file.
- Commands: `/split-work`, `/new-task`, `/start-task <branch>`, `/scope-check`, `/sync`, `/finish-task`.
  The full protocol is [COLLABORATION.md](COLLABORATION.md).
- The hooks need PHP 8.3+ on the PATH where Claude Code runs (Herd's PHP first). Optional: the
  GitHub CLI (`gh auth login`) adds PR titles to the snapshot.
- Personal preferences go in `CLAUDE.local.md` or `.claude/settings.local.json` (both ignored by git).

## Let Claude see the site while it builds (recommended)

Tests and API scripts prove the rules, not the screens. When you build with Claude Code, connect
**Claude in Chrome** so Claude opens the running site in your Chrome, logs in as the demo accounts,
clicks through what it changed, reads the browser console and fixes what looks wrong, before
calling a feature done.

1. Install the **Claude** extension from the Chrome Web Store and sign in with the same account
   you use for Claude Code.
2. In Claude Code, run `/chrome` and connect it (from a terminal you can also start with
   `claude --chrome`). Reopen the Claude Code panel if the browser tools don't appear.
3. Ask Claude to check the change in the browser. It starts `npm run dev` itself, works in its own tab at <http://localhost:5173>, and asks
   before visiting any other site.

Good habits: say which account and page to check ("as `kim@tuklas.edu`, hand in Chapter 3"),
avoid running two sessions' dev servers on the same ports (see
[PARALLEL_SESSION_PROMPT.md](PARALLEL_SESSION_PROMPT.md)), and close confirm dialogs ("Delete …?")
yourself if one appears: they pause the extension until dismissed.

## Demo accounts

Password `tuklas123` for all:

| Email | Role |
|---|---|
| `andrea@tuklas.edu`, `paolo@tuklas.edu`, `kim@tuklas.edu` | Students |
| `msantos@tuklas.edu`, `raquino@tuklas.edu` | Verified educators |
| `cjavier@tuklas.edu` | Educator waiting for verification |
| `admin@tuklas.edu` | Admin |

On the Laravel API, `DEMO_MODE=true` (the default in `.env.example`) skips email verification and
the 2FA requirement, so these accounts sign in straight away. Turn it off to test those flows.

## 5. What needs to be built

The full list, with the branch name to use for each item and the files it may touch, is
[TODO.md](TODO.md). In short:

1. **React client**: done (types, API connection, account screens, live updates, chat search).
2. (Account deletion and group deliverables are done.)
3. **Tooling**: Claude Code kit, CI on GitHub Actions, Larastan.
4. **Deployment** (`chore/deploy-*`), planned in [DEPLOYMENT.md](DEPLOYMENT.md).

**Before you start one:** check whether its branch already exists on GitHub. If it does,
someone is working on it. The full rule is at the top of [TODO.md](TODO.md).

## Other docs

| File | What's in it |
|---|---|
| [TODO.md](TODO.md) | What's left, as planned branches, and the branch rule |
| [COLLABORATION.md](COLLABORATION.md) | How several developers and Claude sessions work in parallel |
| [ARCHITECTURE.md](ARCHITECTURE.md) / [CONVENTIONS.md](CONVENTIONS.md) | Modules, data model, code style |
| [PROJECT.md](PROJECT.md) | What Tuklas is, roles, glossary, non-negotiables |
| [CONVERSION.md](CONVERSION.md) | Decisions, the security spec, and how the Laravel code is laid out |
| [DEPLOYMENT.md](DEPLOYMENT.md) | How Tuklas goes to production |
| [`tuklas/PLAN.md`](../tuklas/PLAN.md) | The original product plan and rules |
| [`tuklas/reference/`](../tuklas/reference/README.md) | Client meeting notes and design notes |

## Troubleshooting

| Problem | Fix |
|---|---|
| `php` or `composer` not found | Open a new terminal after installing Herd; check PATH order |
| `could not find driver` | Your PHP lacks `pdo_mysql` or `pdo_sqlite`; enable it in `php.ini` (`php --ini` shows which file) |
| `SQLSTATE[HY000] [2002]` | MySQL isn't running: `npm run db:up`, or check `DB_HOST`/`DB_PORT` in `.env` |
| Port 3306 already in use | Another MySQL is running; stop it, or change the port in `docker-compose.yml` and `.env` |
| `MissingAttributeException` in a test | Strict mode caught a missing default; add it to the model's `$attributes` |
| "Your session expired" (419) on every form | `APP_URL` in `.env` must be `http://localhost:5173` and `SANCTUM_STATEFUL_DOMAINS` must list `localhost:5173` (both in `.env.example`); then `php artisan config:clear` |
| Messages and notifications only appear after a reload | Check the `live` part of `npm run dev` is running, check `VITE_REVERB_APP_KEY` is in `tuklas/.env` (`php artisan reverb:install` adds it), and restart `npm run dev` |
| Edits don't show until you reload; the browser console keeps saying `[vite] connecting...` | Chrome can't open WebSockets to localhost (curl can). Usually an antivirus "web shield" or a browser extension. Allow `localhost` in it, or try another browser. Live updates (Reverb) need WebSockets too |
| An emailed link opens `localhost:8000` | Restart Vite after pulling: `client/vite.config.ts` must keep `changeOrigin: false` |
| 403 with `"code": "two_factor_required"` | Expected for educators/admins when `DEMO_MODE=false`; set up 2FA or turn demo mode on |
