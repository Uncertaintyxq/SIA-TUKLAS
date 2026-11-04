# Running the staging server

How to use and look after Tuklas's public test server. It's for the team: you don't need to
know Linux, just copy the commands. How it was built: [`tuklas/deploy/README.md`](../tuklas/deploy/README.md)
and [`tuklas/deploy/azure/README.md`](../tuklas/deploy/azure/README.md).

## What it is

| | |
|---|---|
| Purpose | Public testing and client reviews, with **demo data only** (never real students' data) |
| Where | Azure for Students, region **Japan East**, resource group `tuklas-staging`, VM `tuklas-vm` (`Standard_B2ats_v2`: 2 vCPU, 1 GB, free student hours) |
| Login user on the server | `tuklas` |
| Site address | <https://tuklas-sia-jm.japaneast.cloudapp.azure.com> |
| Demo accounts | One-click logins on the login page; the password for all of them is `tuklas123` |
| Turns itself off | Every day at **11:00 PM Philippine time**, with an email 30 minutes before |
| Updates | **Manual, for now:** someone runs `deploy.sh` on the server after changes reach `main` ([below](#put-a-new-version-live)). Automatic deploys from GitHub are built but not set up (paused 2026-11-04) |

## Three different terminals

Most mistakes come from typing a command in the wrong one. Check the prompt first.

| Prompt looks like | It is | Use it for |
|---|---|---|
| `PS C:\Users\...>` | **PowerShell on your PC** | `ssh` into the server |
| `yourname [ ~ ]$` | **Azure Cloud Shell** (the `>_` icon in portal.azure.com) | `az …` commands and `vm.sh` (start, stop, status). It is *not* the server |
| `tuklas@tuklas-vm:~$` | **The server** (after `ssh`) | Deploying, logs, restarting things |

Cloud Shell forgets its files when you close it. If `~/SIA-TUKLAS` is missing there, clone it
again: `git clone https://github.com/Uncertaintyxq/SIA-TUKLAS.git ~/SIA-TUKLAS`.

## Find the address

In Cloud Shell:
```bash
az network public-ip show -g tuklas-staging -n tuklas-ip --query "{address:dnsSettings.fqdn, ip:ipAddress}" -o table
```
The address is **`tuklas-sia-jm.japaneast.cloudapp.azure.com`**; the commands below already use it.
If the server is ever rebuilt with a different name, update this page.

## Start, stop, check

In Cloud Shell (or use the **Start** / **Stop** buttons on the VM in the portal or the Azure phone app):

```bash
bash ~/SIA-TUKLAS/tuklas/deploy/azure/vm.sh start    # before a test session; the site answers about a minute later
bash ~/SIA-TUKLAS/tuklas/deploy/azure/vm.sh stop     # when nobody is testing
bash ~/SIA-TUKLAS/tuklas/deploy/azure/vm.sh status   # running or stopped, address, auto-shutdown time
```

- **Stop it from Azure, never from inside the server.** `sudo shutdown` on the server leaves it
  "Stopped" but still billed; only Azure's Stop (or `vm.sh stop`, or the 11 PM auto-shutdown)
  makes it "Stopped (deallocated)", which costs almost nothing.
- **Testing past 11 PM?** Use the "postpone" link in the warning email, or change the time in
  the portal: VM → **Auto-shutdown**.

## Log in to the server

In PowerShell on your PC:
```powershell
ssh -i $HOME\.ssh\id_ed25519 tuklas@tuklas-sia-jm.japaneast.cloudapp.azure.com
```
The prompt changes to `tuklas@tuklas-vm:~$`. Type `exit` to leave.

**A teammate who needs access** makes their own key on their own PC (never share keys):
```powershell
ssh-keygen -t ed25519 -C "tuklas-staging-<their name>"
Get-Content $HOME\.ssh\id_ed25519.pub
```
They send you that one line (the public key, safe to share). You add it on the server:
```bash
echo "ssh-ed25519 AAAA...their line..." >> ~/.ssh/authorized_keys
```

## Put a new version live

After changes are merged into `main`, on the server:
```bash
bash ~/SIA-TUKLAS/tuklas/deploy/deploy.sh
```
5–10 minutes. It downloads the latest `main` itself, builds it in a new folder and switches over
only if everything worked, so a failed deploy leaves the site running as before. It ends with
`/up is OK` and `Done: <commit>`.

| To | Run |
|---|---|
| Try a branch before it's merged | `bash ~/SIA-TUKLAS/tuklas/deploy/deploy.sh --ref feat/some-branch` (deploy `main` again afterwards) |
| Start over with fresh demo data | **Reset demo data** in the user menu on the site, or `bash ~/SIA-TUKLAS/tuklas/deploy/deploy.sh --seed` |
| Get changes to the deploy scripts themselves | `git -C ~/SIA-TUKLAS pull` first |

## One-time steps waiting for the next deploy

Some features need a small change on the server itself, once. When one does, it's listed here with
the commands: do it **before** the next `deploy.sh`, then delete the line (in a docs branch).

**Nothing is waiting.** Done on 2026-11-01: the `/robots.txt` Nginx change, the scheduler and
nightly backup (`setup-server.sh` re-run) and the backup key.

Skipped or optional:
- Automatic deploys from GitHub: paused on 2026-11-04, deploys are manual for now. The guide is
  "Automatic deploys" in [`tuklas/deploy/README.md`](../tuklas/deploy/README.md#automatic-deploys).
- An off-server copy of the backups (`rclone config`, `BACKUP_RCLONE_REMOTE`): do it before real
  data goes on the server.
- Schools (several on one site, docs/decisions/0002): the deploy that brings `feat/institutions`
  puts every existing account in one school named after `TUKLAS_INSTITUTION` (or the app name),
  and existing admins become super-admins. Reseeding the demo makes Tuklas University and Bayan
  State College instead. Add real schools from the admin page's Schools tab.

Staging writes emails to the log instead of sending them (`MAIL_MAILER=log`), so email settings
and the digest can be tried there without a mail provider: read them in
`/var/www/tuklas/shared/storage/logs/`.

## Check it's healthy

On the server:
```bash
sudo supervisorctl status                                     # tuklas-queue and tuklas-reverb: RUNNING
ls /var/www/tuklas/shared/storage/logs/                       # log files
tail -n 50 /var/www/tuklas/shared/storage/logs/laravel-$(date +%F).log   # today's app errors (no file = none)
df -h /                                                       # disk space (Use% under 80% is fine)
free -h                                                       # memory
```

## When something's wrong

| Problem | What to do |
|---|---|
| The site doesn't load at all | It's probably off (after 11 PM): `vm.sh status`, then `vm.sh start`. If it's running: on the server, `sudo systemctl status nginx php8.4-fpm` |
| "Server Error" page | Read today's log (above) and send the last lines to whoever is fixing it |
| Chat or notifications don't update live | `sudo supervisorctl status`; if not RUNNING: `sudo supervisorctl restart 'tuklas:*'` |
| `deploy.sh` failed | The site still runs the previous version. Read the last lines of its output; fix on a branch, merge, deploy again |
| SSH says "Permission denied (publickey)" | Check you're using `tuklas@`, the right address, and the PC that has your key. To put your key back from Cloud Shell: `az vm user update -g tuklas-staging -n tuklas-vm -u tuklas --ssh-key-value "<your .pub line>"` |
| SSH says "Connection timed out" | The server is off: `vm.sh start`, wait a minute |
| Browser says the certificate is invalid | On the server: `sudo certbot renew` (it renews by itself normally); `sudo certbot certificates` shows the expiry date |
| The newest version broke something | Roll back to the previous release (below) |

**Roll back** to the previous release, on the server:
```bash
ls -1t /var/www/tuklas/releases/                    # newest first; the second line is the previous one
ln -sfn /var/www/tuklas/releases/<previous>/tuklas /var/www/tuklas/current
sudo systemctl reload php8.4-fpm && sudo supervisorctl restart 'tuklas:*'
```
If the broken release changed the database (a migration), the database stays changed; on
staging, **Reset demo data** fixes that.

## Change a setting

The server's settings are in `/var/www/tuklas/shared/.env` (keys and passwords: never copy it
into chat, screenshots or git). To change one, on the server:
```bash
nano /var/www/tuklas/shared/.env                   # Ctrl+O, Enter to save; Ctrl+X to leave
bash ~/SIA-TUKLAS/tuklas/deploy/deploy.sh          # settings are cached and the site is built with them
```

## The credit

- See what's left on the **Azure for Students** page in the portal. With the 11 PM shutdown
  the server should use little or none of it while the free hours last (first 12 months).
- Azure for Students can't charge you: when the credit runs out, services stop.
- **Remove everything** when staging is no longer needed (deletes the server and its data for good),
  in Cloud Shell: `az group delete --name tuklas-staging`

## If it ever has to be rebuilt

Follow [`tuklas/deploy/azure/README.md`](../tuklas/deploy/azure/README.md) then
[`tuklas/deploy/README.md`](../tuklas/deploy/README.md). What we learned the first time (2026-11-01):

- This subscription **can't use Southeast Asia** (Azure's region policy); Japan East works. List
  the allowed regions with `az policy assignment list --query "[].parameters" -o json`.
- **Standard_B1s had no capacity** in Japan East, Korea Central and Indonesia Central. Use
  `--size Standard_B2ats_v2` (also free for students). Check a size before creating:
  `az vm list-skus --location japaneast --size Standard_B2ats_v2 --resource-type virtualMachines -o table`
  (Restrictions must say `None`).
- Set the region in `create-vm.sh` with
  `sed -i 's/^LOCATION=".*"/LOCATION="japaneast"/' create-vm.sh`.
- After a failed attempt, delete the group **and wait** before retrying:
  `az group delete --name tuklas-staging --yes && az group wait --name tuklas-staging --deleted`.
- If `create-vm.sh` stops after creating the VM, finish by hand: `az vm auto-shutdown -g tuklas-staging -n tuklas-vm --time 1500 --email <you>`,
  and `az network public-ip update -g tuklas-staging -n tuklas-ip --dns-name <name>` if the address is blank.
- Run `setup-server.sh` and `deploy.sh` **on the server** (`tuklas@tuklas-vm`), not in Cloud Shell,
  and log out and back in between them.
