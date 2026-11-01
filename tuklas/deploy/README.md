# Installing Tuklas on a server

From an empty Ubuntu 24.04 server (the Azure one from [`azure/README.md`](azure/README.md), or any
other) to the live site. Two scripts do the work:

| Script | Run | Does |
|---|---|---|
| `setup-server.sh` | once, with `sudo` | Installs Nginx, PHP 8.4, MySQL, Node 22, Composer and Supervisor; creates the database, the server's `.env` with fresh keys, the Nginx site and the HTTPS certificate |
| `deploy.sh` | every release, as your login user | Puts the latest `main` live in a new release folder and switches to it |

The other files are the settings those scripts install: `nginx.conf`, `supervisor.conf` (queue
worker and Reverb), `php.ini`, `mysql.cnf`, and `../.env.production.example`.

## First time

1. **Start the server and log in** from your PC (the one with the SSH key):
   ```powershell
   ssh tuklas@<address>          # the address create-vm.sh printed
   ```
   The first time, type `yes` to trust the server's fingerprint.
2. **Get the repo onto the server:**
   ```bash
   git clone https://github.com/Uncertaintyxq/SIA-TUKLAS.git ~/SIA-TUKLAS
   ```
3. **Set the server up** (10–15 minutes; your email is only given to Let's Encrypt, for
   certificate-expiry notices):
   ```bash
   sudo bash ~/SIA-TUKLAS/tuklas/deploy/setup-server.sh --domain <address> --email you@example.com
   ```
4. **Log out and back in**, so your account joins the `www-data` group:
   ```bash
   exit
   ssh tuklas@<address>
   ```
5. **Deploy, loading the demo data** (5–10 minutes on a B1s; most of it is building the React app):
   ```bash
   bash ~/SIA-TUKLAS/tuklas/deploy/deploy.sh --seed
   ```
6. Open `https://<address>`. The demo accounts' one-click logins are on the login page.

## Each new release

After changes are merged into `main`, log in and run:
```bash
bash ~/SIA-TUKLAS/tuklas/deploy/deploy.sh
```
It clones `main` fresh, so the `~/SIA-TUKLAS` copy only matters for the scripts themselves (run
`git -C ~/SIA-TUKLAS pull` when they change). `--ref <tag or branch>` deploys something other
than `main`. `chore/deploy-pipeline` will run this automatically from GitHub.

## Where things are

| What | Where |
|---|---|
| Live release | `/var/www/tuklas/current` → `releases/<date-time>/tuklas` (the last 5 are kept) |
| Settings | `/var/www/tuklas/shared/.env` (only you and PHP can read it; never copy it into chat or git) |
| Uploads, logs | `/var/www/tuklas/shared/storage/` (`logs/laravel-<date>.log`, `queue.log`, `reverb.log`) |
| Nginx errors | `/var/log/nginx/error.log` |

## When something's wrong

| Problem | Try |
|---|---|
| The page doesn't load at all | `bash vm.sh status` in Cloud Shell (it shuts down at 11 PM); `sudo systemctl status nginx php8.4-fpm` |
| "Server Error" | `tail -n 50 /var/www/tuklas/shared/storage/logs/laravel-$(date +%F).log` |
| Live updates or chat don't refresh | `sudo supervisorctl status`; both `tuklas:` programs should be RUNNING |
| The certificate step failed | Check the address resolves to the server and port 80 is open, then rerun `setup-server.sh` with `--email` and redeploy |
| Changed `.env` | Run `deploy.sh` again (settings are cached, and the React app is built with them) |
| Go back to the last release | `ln -sfn <previous release>/tuklas /var/www/tuklas/current && sudo systemctl reload php8.4-fpm && sudo supervisorctl restart 'tuklas:*'` (if it ran a migration, the database stays migrated) |
| Start the demo data over | "Reset demo data" in the app (staging, `DEMO_MODE=true`) |

## Staging vs production

`setup-server.sh` writes a **staging** `.env`: `APP_ENV=staging`, `DEMO_MODE=true`, emails written
to the log instead of sent. For production, on its own server: set `APP_ENV=production`,
`DEMO_MODE=false`, the real mail provider (`MAIL_*`), then deploy without `--seed` and create the
first admin by hand. The checklist is in [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).
