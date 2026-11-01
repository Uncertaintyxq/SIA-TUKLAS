# Installing Tuklas on a server

From an empty Ubuntu 24.04 server (the Azure one from [`azure/README.md`](azure/README.md), or any
other) to the live site. Two scripts do the work:

| Script | Run | Does |
|---|---|---|
| `setup-server.sh` | once, with `sudo` | Installs Nginx, PHP 8.4, MySQL, Node 22, Composer and Supervisor; creates the database, the server's `.env` with fresh keys, the Nginx site and the HTTPS certificate |
| `deploy.sh` | every release, as your login user | Puts the latest `main` live in a new release folder and switches to it (with a backup first when there are migrations) |
| `backup.sh` | nightly by cron, or by hand | An encrypted backup of the database and the uploads |
| `restore.sh` | when you need it | Puts a backup back: the database and the uploads |
| `ci-deploy.sh` | by GitHub Actions | The only thing GitHub's deploy key may run: brings the scripts up to date and runs `deploy.sh` |

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
than `main`. Once [automatic deploys](#automatic-deploys) are set up, GitHub does this for you.

## Automatic deploys

`.github/workflows/deploy.yml` deploys staging by itself whenever the `ci` checks pass on `main`
(and can be run by hand: **Actions → deploy → Run workflow**). It logs in with its own SSH key, which
the server only lets run `deploy/ci-deploy.sh`: that key can deploy `main` or a release tag, and
can't open a shell. Until the steps below are done, the workflow skips staging with a notice.

**Set it up (once):**
1. **A key just for GitHub**, made on your PC (PowerShell). Press Enter when asked for a passphrase
   (GitHub can't type one):
   ```powershell
   ssh-keygen -t ed25519 -C "github-deploy" -f $HOME\.ssh\tuklas-github-deploy
   Get-Content $HOME\.ssh\tuklas-github-deploy.pub      # the public key, one line
   ```
2. **On the server**, allow that key to run the deploy only. Put your public key line where it says:
   ```bash
   echo 'command="bash /home/tuklas/SIA-TUKLAS/tuklas/deploy/ci-deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty <public key line>' >> ~/.ssh/authorized_keys
   ```
3. **The server's fingerprint**, so GitHub trusts only this server. On your PC:
   ```powershell
   ssh-keyscan -t ed25519 tuklas-sia-jm.japaneast.cloudapp.azure.com
   ```
   Copy the line that starts with the address (not the `#` comment).
4. **On GitHub**: the repo → **Settings → Environments → New environment** → name it `staging`.
   - Under **Deployment branches and tags**, choose **Selected branches and tags** and add `main`.
   - **Environment secrets:**
     - `DEPLOY_SSH_KEY`: the whole private key, i.e. the output of
       `Get-Content $HOME\.ssh\tuklas-github-deploy` (the file without `.pub`), including the
       `-----BEGIN` and `-----END` lines.
     - `DEPLOY_KNOWN_HOSTS`: the line from step 3.
   - **Environment variables:** `DEPLOY_HOST` = `tuklas-sia-jm.japaneast.cloudapp.azure.com`,
     `DEPLOY_USER` = `tuklas`, `SITE_URL` = `https://tuklas-sia-jm.japaneast.cloudapp.azure.com`.
5. Try it: **Actions → deploy → Run workflow** (the server must be on).

The private key now lives only in GitHub's secrets: delete it from your PC if you like
(`Remove-Item $HOME\.ssh\tuklas-github-deploy`), and make a new one the same way if it's ever needed.

**When the server is off** (after 11 PM), a deploy fails with "Couldn't deploy": start the server
(`vm.sh start`) and click **Re-run jobs** on that run.

**Production** works the same way with an environment named `production` (its own secrets and
variables), deploying a release tag: `git tag v1.0.0 && git push origin v1.0.0`. Give that
environment **Required reviewers**, so each release waits for someone's approval. Until it has a
`DEPLOY_HOST`, tagged releases skip production with a notice.

## Backups

Nightly at **10:30 PM** Philippine time (before the 11 PM shutdown), `backup.sh` saves the database
and the uploads in one file in `/var/backups/tuklas/`, encrypted with [age](https://age-encryption.org).
The server holds only the **public** key, so someone who gets into the server can't read old
backups. The **private** key opens them; it lives in the team's password manager. Backups are kept
30 days. Every push to GitHub also tests a backup and a restore (the `backups` job in CI).

**Turn them on (once):**
1. Make the key pair on the server, and copy **all three lines** it prints into the password manager
   (a note called "Tuklas backup key"):
   ```bash
   age-keygen
   ```
   The line starting `AGE-SECRET-KEY-` is the private key: it must not stay on the server, so don't
   save it to a file there. The `# public key: age1…` line is the public key.
2. Put the public key in the server's settings, then check a backup works:
   ```bash
   nano /var/www/tuklas/shared/.env        # set BACKUP_AGE_RECIPIENT=age1… (the public key)
   bash /var/www/tuklas/current/deploy/backup.sh
   ```
3. **Optional, recommended:** a copy off the server, so a lost server doesn't take its backups with
   it. `rclone config` connects a Google Drive or OneDrive folder (any rclone remote works); then set
   `BACKUP_RCLONE_REMOTE=<remote>:tuklas-backups` in the `.env`.

**Restore a backup** (replaces everything in the database and the uploads):
```bash
ls -lt /var/backups/tuklas/                       # newest first; pre-migrate ones are from deploys
nano ~/backup-key.txt                             # paste the AGE-SECRET-KEY- line, save
bash /var/www/tuklas/current/deploy/restore.sh /var/backups/tuklas/<file>.tar.age --identity ~/backup-key.txt
rm ~/backup-key.txt                               # the private key never stays on the server
```
It asks you to type the database name before it changes anything, and keeps the site in maintenance
mode while it works. If the backup is older than the code, run `deploy.sh` afterwards. Log of the
nightly runs: `/var/backups/tuklas/backup.log`.

## Where things are

| What | Where |
|---|---|
| Live release | `/var/www/tuklas/current` → `releases/<date-time>/tuklas` (the last 5 are kept) |
| Settings | `/var/www/tuklas/shared/.env` (only you and PHP can read it; never copy it into chat or git) |
| Uploads, logs | `/var/www/tuklas/shared/storage/` (`logs/laravel-<date>.log`, `queue.log`, `reverb.log`) |
| Nginx errors | `/var/log/nginx/error.log` |
| Backups | `/var/backups/tuklas/` (`backup.log` for the nightly runs) |

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
