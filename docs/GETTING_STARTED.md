# Getting started

What to install, how to run and test Tuklas on your machine, and what's left to build.

**Where things stand (2026-10-31):** Tuklas has moved from a Node/Express server to a Laravel
API. The API is finished and tested, and the React app now talks to it, including the 2FA,
email-verification, password-reset and account screens. Still missing on the client: live
updates and the new chat search (see [TODO.md](TODO.md)). The old Node server in `server/` is no longer used and will be deleted.

To run the site you start the Laravel API (section 3) and then the React app (section 4).

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

- **MySQL in Docker** (recommended):
  ```bash
  npm run db:up                                   # starts MySQL 8 in Docker
  docker exec tuklas-mysql mysql -utuklas -ptuklas -e "CREATE DATABASE IF NOT EXISTS tuklas_laravel"
  ```
  `.env.example` already points at `tuklas_laravel` on `127.0.0.1:3306`. Laravel uses its own
  database so it doesn't overwrite the old Node server's `tuklas` database.
- **SQLite** (no install): in `.env` set `DB_CONNECTION=sqlite`, delete the other `DB_*` lines,
  and create the file: `touch database/database.sqlite` (PowerShell: `New-Item database/database.sqlite`).

### 3b. Create the tables and demo data

```bash
php artisan migrate:fresh --seed
```

### 3c. Start it

Three processes, each in its own terminal:

```bash
php artisan serve             # the API on http://localhost:8000
php artisan reverb:start      # live updates (WebSocket on :8080)
php artisan queue:work        # background jobs: emails
```

Quick check: <http://localhost:8000/up> shows "Application up", and
<http://localhost:8000/api/users/andrea/portfolio> returns JSON.

Emails (verification, password reset, announcements) aren't sent locally: with `MAIL_MAILER=log`
they're written to `storage/logs/laravel.log`.

### 3d. Test

```bash
php artisan test                    # all tests (SQLite in memory, no setup needed)
php artisan test --filter=Works     # one area
vendor/bin/pint                     # format PHP before committing (PowerShell: php vendor/bin/pint)
```

All tests must pass before a pull request is merged.

## 4. Run the React app

With the Laravel API from 3c running, in a fourth terminal:

```bash
npm run dev -w client         # the site on http://localhost:5173
```

Open <http://localhost:5173>. Vite forwards `/api` and `/sanctum` to Laravel on `:8000`, so the
browser sees one site and the sign-in cookies work. Use `npm run dev -w client`, not
`npm run dev`: the root script still starts the old Node server too, until
`chore/remove-node-server`.

Not there yet: live updates (new messages appear after a refresh; `feat/client-realtime`).

**Testing sign-in security:** set `DEMO_MODE=false` in `.env` and restart `php artisan serve`.
Educators and admins are then asked to set up 2FA (any authenticator app works), and new
accounts must confirm their email. Emails go to `storage/logs/laravel.log`: copy the link from
there into the browser. Run `php artisan queue:work` too, or queued emails never arrive.

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

1. **React client** (`feat/client-*` branches): live updates through Reverb and the new chat
   search. (Shared types, the API connection and the account screens are done.)
2. **Account deletion** (`feat/account-deletion`) and **group deliverables** (`feat/group-deliverables`).
3. **Tooling**: Claude Code kit, CI on GitHub Actions, Larastan.
4. **Remove the old Node server** (`chore/remove-node-server`), last.
5. **Deployment** (`chore/deploy-*`), planned in [DEPLOYMENT.md](DEPLOYMENT.md).

**Before you start one:** check whether its branch already exists on GitHub. If it does,
someone is working on it. The full rule is at the top of [TODO.md](TODO.md).

## Other docs

| File | What's in it |
|---|---|
| [TODO.md](TODO.md) | What's left, as planned branches, and the branch rule |
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
| `Unknown database 'tuklas_laravel'` | Run the `CREATE DATABASE` command in 3a |
| Port 3306 already in use | Another MySQL is running; stop it, or change the port in `docker-compose.yml` and `.env` |
| `MissingAttributeException` in a test | Strict mode caught a missing default; add it to the model's `$attributes` |
| "Your session expired" (419) on every form | `APP_URL` in `.env` must be `http://localhost:5173` and `SANCTUM_STATEFUL_DOMAINS` must list `localhost:5173` (both in `.env.example`); then `php artisan config:clear` |
| An emailed link opens `localhost:8000` | Restart Vite after pulling: `client/vite.config.ts` must keep `changeOrigin: false` |
| 403 with `"code": "two_factor_required"` | Expected for educators/admins when `DEMO_MODE=false`; set up 2FA or turn demo mode on |
