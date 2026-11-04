# Putting Tuklas into production

The steps from an empty server to a site real students sign up on. It's the `chore/deploy-production`
row in [TODO.md](TODO.md) and the last step before real student data. Staging stays as it is
([STAGING_SERVER.md](STAGING_SERVER.md)); production is a **separate server** with real accounts, no
demo data and real email.

Work through it in order. Each step says who does it. Never paste a password, key or `.env` value
into chat, an issue or git: they go in the team's password manager.

## 0. Before you start (the team and the client)

These are decisions and paperwork, not code. Nothing below works without them.

| What | Decide or get | Notes |
|---|---|---|
| Host | Where the server runs | Suggested: a Singapore-region VPS (closest to the Philippines). [DEPLOYMENT.md](DEPLOYMENT.md#decisions-needed) has the options. Azure for Students is fine for staging but not for real data. |
| Domain | The site's address | A university subdomain if the university can point DNS at the server. |
| Email provider | Who sends signup, reset and notification emails | Postmark, Mailgun, Amazon SES or the university's SMTP. |
| Access | Who holds the server keys and the password manager | At least two people. |
| Super-admins | Who they are | Decided: the team plus one university contact ([decisions/0002](decisions/0002-several-schools-on-one-site.md)). |
| Schools | Each school's name, short name, email domains, departments and first admin | One row per school; the commands in step 4 take exactly these. |
| Privacy notice | The approved final text | It replaces the draft in `client/src/components/account/PrivacyNotice.tsx` (step 8). |
| Data Protection | A Data Protection Officer per school, a data processing agreement signed with each school, NPC registration if required | [DEPLOYMENT.md](DEPLOYMENT.md#data-privacy-act-ra-10173). |
| The repo | Who owns it | If ownership moves, update the clone URL in step 1 and in [STAGING_SERVER.md](STAGING_SERVER.md). |

## For now: production on the staging server, with free accounts

Decided 2026-11-04: until a production host is chosen, the Azure VM from
[STAGING_SERVER.md](STAGING_SERVER.md) becomes the production server. There's no separate staging
site while it does: try branches on your own PC. It all runs on free accounts:

| Need | Free option |
|---|---|
| Domain | A `.me` domain from Namecheap, free for one year with the GitHub Student Developer Pack (claim it at nc.me). Turn auto-renew off unless you mean to pay for year two |
| DNS, and inboxes for the admins | Cloudflare's free plan: DNS plus **Email Routing**, which forwards `admin@<domain>` and others to the team's own inboxes |
| Sending email | Brevo's free SMTP plan (300 emails a day): `smtp-relay.brevo.com`, port 587, an SMTP key as the password |
| Off-server backups | rclone to a Google Drive (step 6) |

1. **Domain and DNS:** at Namecheap, set the nameservers to the two Cloudflare gives you. In
   Cloudflare, add an `A` record for the domain pointing to the VM's static IP, set to **DNS only**
   (grey cloud) so Let's Encrypt and the live-chat WebSocket work as they do now.
2. **Email:** in Brevo, authenticate the domain (it adds the DKIM and DMARC records). A domain has
   only one SPF record, so merge Cloudflare's and Brevo's into
   `v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`.
3. **Keep it on at night**, in Cloud Shell: `az vm auto-shutdown -g tuklas-staging -n tuklas-vm --off`.
   The free hours cover a month of this size; check Cost analysis in the portal after a week.
4. **Move the site to the domain**, on the server, once `nslookup <domain>` shows the VM's IP.
   `setup-server.sh` keeps an existing Nginx site, so remove it and let the script make a new one
   with the certificate:
   ```bash
   git -C ~/SIA-TUKLAS pull
   bash /var/www/tuklas/current/deploy/backup.sh --label before-production
   sudo cp /etc/nginx/sites-available/tuklas ~/nginx-staging.bak
   sudo rm /etc/nginx/sites-available/tuklas
   sudo bash ~/SIA-TUKLAS/tuklas/deploy/setup-server.sh --domain <domain> --email <a team address>
   ```
5. **Settings:** step 2 below. The `.env` already exists, so also change these by hand:
   `SANCTUM_STATEFUL_DOMAINS` and `REVERB_ALLOWED_ORIGINS` to the domain, and `MAIL_FROM_ADDRESS`
   to `no-reply@<domain>`.
6. **Deploy, then empty the demo data:** step 3's `deploy.sh`, then
   `cd /var/www/tuklas/current && php artisan migrate:fresh --force` (deletes **all** data) and
   `rm -rf /var/www/tuklas/shared/storage/app/private/uploads`. Load the showcase now if the
   client is to see the site with content (step 3), then carry on from step 4.

The old `cloudapp.azure.com` address stops working. Azure for Students isn't meant for real data
in the long run (the subscription stops when the credit or student status ends), so the
off-server backup copy in step 6 is a must here.

## 1. The server (whoever holds access)

1. Create an **Ubuntu 24.04** server on the chosen host: 2 GB of memory or more, a static IP, and a
   firewall that allows only 22, 80 and 443.
2. Point the domain at it: an `A` record for the domain (and `AAAA` if the server has IPv6). Wait
   until `nslookup <domain>` shows the server's address.
3. Log in with an SSH key (no passwords) and get the repo:
   ```bash
   git clone https://github.com/Uncertaintyxq/SIA-TUKLAS.git ~/SIA-TUKLAS
   ```
4. Set it up (the same script as staging; the email is only given to Let's Encrypt):
   ```bash
   sudo bash ~/SIA-TUKLAS/tuklas/deploy/setup-server.sh --domain <domain> --email <a team address>
   exit   # log out and back in, so your account joins the www-data group
   ```

## 2. Production settings

`setup-server.sh` writes a **staging** `.env`. Turn it into production before the first deploy:

```bash
nano /var/www/tuklas/shared/.env
```

| Setting | Value |
|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / `false` |
| `APP_URL` | `https://<domain>` |
| `DEMO_MODE` | `false` (the app refuses to start in production otherwise) |
| `SESSION_SECURE_COOKIE` / `SESSION_ENCRYPT` | `true` / `true` |
| `SANCTUM_STATEFUL_DOMAINS` | `<domain>` |
| `MAIL_MAILER` and `MAIL_*` | The provider's SMTP settings; `MAIL_FROM_ADDRESS` on the real domain |
| `LOG_LEVEL` | `warning` |
| `TUKLAS_INSTITUTION` | Leave empty: every author's own school is used |

The rest (`APP_KEY`, database, Reverb keys) was generated by `setup-server.sh`. Copy `APP_KEY` into
the password manager now; encrypted messages and two-factor secrets can't be read without it.

## 3. First deploy (no demo data)

```bash
bash ~/SIA-TUKLAS/tuklas/deploy/deploy.sh
```

Never `--seed` here: it loads demo accounts, and `deploy.sh` refuses it when `APP_ENV=production`.

### Showcase data, for a presentation before launch (optional)

To show the client the finished site with content in it, load the demo people, works, groups and
chat **under production rules** (decided 2026-11-04):

```bash
cd /var/www/tuklas/current
php artisan tuklas:showcase --domain=<the team's domain>
```

- The personas get addresses on the team's domain: `andrea@tu.<domain>`, `msantos@tu.<domain>`,
  `alim@bsc.<domain>`, … Tuklas University takes `tu.<domain>` signups and Bayan State College
  `bsc.<domain>`, so signing up by school email can be shown live. In Cloudflare, Email Routing
  → Settings → add the subdomains `tu` and `bsc`, and make a catch-all rule for each that forwards
  to the presenter's inbox, so password resets and notifications arrive.
- One password for every persona is asked for (12+ characters, not in a known breach). Keep it
  in the password manager. There are no one-click logins in production.
- Before the presentation, sign in once as each admin and educator (Lea, Dr. Santos, Prof.
  Aquino, Prof. Javier, Dr. Lim, Jose Ramos) to accept the privacy notice and set up two-factor
  sign-in in an authenticator app. Students only accept the notice.
- It replaces all the app's data, so it refuses while any other account exists. Load it **before**
  step 4's admins, or empty the site first with `php artisan migrate:fresh --force`. Schools added
  with `tuklas:school` before it are replaced too.
- `tuklas:launch-check` fails while it's loaded. Before real data goes in, empty the site with
  `php artisan migrate:fresh --force` and `rm -rf /var/www/tuklas/shared/storage/app/private/uploads`,
  then do step 4.

## 4. Schools and the first admins

From the app folder (`cd /var/www/tuklas/current`):

```bash
# One per school: its email domains sign people in straight away (subdomains count too)
php artisan tuklas:school "University of the Immaculate Conception" --short=UIC \
  --domain=uic.edu.ph --department="College of Computing" --department="College of Nursing"

# The super-admins (the team plus one university contact): the password is asked for, not typed on the line
php artisan tuklas:admin office@uic.edu.ph --name="Office of Research" --super

# Each school's own admin
php artisan tuklas:admin research@uic.edu.ph --name="UIC Research Office" --school="University of the Immaculate Conception"
```

Running `tuklas:school` again adds new domains and departments and keeps the rest. Each admin signs
in once to set up two-factor sign-in and accept the privacy notice; then they can add departments
and more schools from the admin page (Schools tab).

## 5. Email

1. In the provider's dashboard, verify the sending domain and add its **SPF**, **DKIM** and
   **DMARC** DNS records, so emails don't land in spam.
2. Test it end to end: sign up with a school address, confirm the email, reset the password, and
   turn on two-factor sign-in.

## 6. Backups, on and off the server

Follow "Backups" in [tuklas/deploy/README.md](../tuklas/deploy/README.md#backups):

1. `age-keygen`; the private key goes in the password manager, never on the server.
2. `BACKUP_AGE_RECIPIENT=age1…` in the `.env`; run `backup.sh` once by hand.
3. **Required for production:** `rclone config` and `BACKUP_RCLONE_REMOTE=<remote>:tuklas-backups`. A
   backup on the same server is lost with it.
4. **Restore once from the off-server copy**, on staging or a spare server, before launch. A backup
   that has never been restored doesn't count.

## 7. The launch check

```bash
php artisan tuklas:launch-check
```

It checks what the app can see for itself: production settings, real mail, push keys, encrypted and
off-server backups, a super-admin, each school's email domains and own admin, and that no demo
accounts are left. It never prints a setting's value. Fix every `fix` line; judge the `warn` lines.
Then tick the rest of the [security checklist](DEPLOYMENT.md#security-checklist-before-the-first-public-launch)
by hand (SSL Labs and securityheaders.com grade A, firewall, SSH by key only).

## 8. The approved privacy notice (a developer, in the repo)

Replace the draft text in `client/src/components/account/PrivacyNotice.tsx` with the approved
notice, and bump `PRIVACY_VERSION` there and `privacy_version` in `tuklas/config/tuklas.php` to the
same new date. Merge it, then deploy (step 3's command). Everyone accepts the new version at their
next sign-in.

## 9. Open it

When the launch check passes and the by-hand items are ticked: share the address with the schools.
After that, each release is the same `deploy.sh` ([deploy/README.md](../tuklas/deploy/README.md#each-new-release));
it takes a backup before migrating.
