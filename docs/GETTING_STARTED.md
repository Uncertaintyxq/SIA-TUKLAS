# Getting started

What to install, how to run and test Tuklas on your machine, and what's left to build.

**Where things stand (2026-10-31):** Tuklas is moving from a Node/Express server to a Laravel
API. The Laravel API is finished and tested, but the React app still talks to the old Node
server until the client branches in [TODO.md](TODO.md) are done. So for now there are two ways
to run it:

- **A. The Laravel API**, the new server. Test it with `php artisan test` or call its `/api`
  endpoints. This is where new work goes.
- **B. The React app on the old Node server**, to see and click through the current site.

## 1. Install these

| Tool | Version | Needed for | Get it |
|---|---|---|---|
| Git | any recent | Everything | [git-scm.com](https://git-scm.com/) |
| PHP | **8.3 or newer**, with `intl`, `zip`, `sodium`, `pdo_mysql`, `pdo_sqlite`, `mbstring`, `fileinfo`, `openssl` | Laravel API (A) | **[Laravel Herd](https://herd.laravel.com/)** (Windows/macOS) installs PHP and Composer with these extensions on |
| Composer | 2.x | Laravel API (A) | Included with Herd, or [getcomposer.org](https://getcomposer.org/) |
| Node.js | **22 or newer** (with npm) | React app, old Node server (B) | [nodejs.org](https://nodejs.org/) |
| MySQL | **8.x** | The real database (A and B) | **Docker Desktop** (uses the repo's `docker-compose.yml`), or the [MySQL 8 installer](https://dev.mysql.com/downloads/mysql/) |
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
npm install                   # JavaScript packages (React app, old Node server)
```

## 3. Run the Laravel API (A)

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

## 4. Run the React app on the old Node server (B)

Until the client branches are done, this is how to see the site:

```bash
cp server/.env.example server/.env
npm run db:up                 # MySQL in Docker (or: npm run db:local, see README)
npm run db:reset              # Node server's tables + demo data, in the `tuklas` database
npm run dev                   # Node API on :4000, React app on http://localhost:5173
```

## Demo accounts

Password `tuklas123` for all, in both setups:

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

1. **React client on Laravel** (`feat/client-*` branches): shared types, API headers and proxy,
   2FA / verification / password-reset / privacy screens, live updates through Reverb, the new
   chat search. After these, the React app runs on the Laravel API.
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
| 403 with `"code": "two_factor_required"` | Expected for educators/admins when `DEMO_MODE=false`; set up 2FA or turn demo mode on |
