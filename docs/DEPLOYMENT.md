# Deployment plan

How Tuklas goes from the repo to a public, secure site. The work is split into the
`chore/deploy-*` branches in [TODO.md](TODO.md). Nothing here is set up yet.

## What runs in production

```
                 HTTPS (443)
 browser ──► Nginx ──┬── /api/*, /up ............► PHP-FPM 8.4 ── Laravel
                     ├── /app/* (Reverb WebSocket) ► Reverb (Supervisor)
                     └── everything else ........► Laravel serves the built React app
                                                    (public/app/, with the CSP header)
 Laravel ──► MySQL 8          (database)
         ──► storage/app/private   (uploads, never web-served)
         ──► queue (database) ──► queue worker (Supervisor) ──► SMTP (emails)
```

One server is enough at Tuklas's scale: one university, hundreds to a few thousand users.
Everything is on one domain, so the session cookie, CSRF and WebSocket all stay same-origin.

| Piece | Choice | Why |
|---|---|---|
| OS | Ubuntu 24.04 LTS | Long support, standard for PHP hosting |
| Web server | Nginx | Serves static files, proxies Reverb, terminates TLS |
| PHP | 8.4 (FPM) with intl, zip, sodium, pdo_mysql, mbstring, fileinfo, openssl | Laravel 13 needs 8.3+; 8.4 has security support until 2028 |
| Database | MySQL 8.4 LTS | What the migrations and CI target |
| Live updates | Laravel Reverb, kept running by Supervisor | Ships with Laravel |
| Background jobs | `php artisan queue:work`, kept running by Supervisor | Announcement emails are queued |
| TLS | Let's Encrypt (Certbot), auto-renewing | Free; HTTPS is required (HSTS, secure cookies) |
| Email | A transactional SMTP provider | Verification, reset and announcement emails must arrive |

## Environments

| Environment | Purpose | Data | Deploys |
|---|---|---|---|
| Local | Development | Demo seed (`DEMO_MODE=true`) | By hand |
| Staging | Client reviews and testing before release | Demo seed, reset freely | Automatically on every merge to `main` |
| Production | The real site | Real people's data | On a tagged release (`v1.0.0`, …), by hand approval in GitHub |

Staging and production are separate servers (or at least separate databases, `.env` files
and app keys). Real data never goes to staging.

## Production settings

`.env` on the server (kept out of git; see `.env.production.example` from `chore/deploy-server-config`):

| Setting | Value |
|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / `false` |
| `APP_URL` | `https://<domain>` |
| `APP_KEY` | Generated once on the server (`php artisan key:generate`); stored in the team's password manager, never in chat or git |
| `DEMO_MODE` | `false` (the app refuses to start otherwise) |
| `SESSION_SECURE_COOKIE` | `true` |
| `SESSION_ENCRYPT` | `true` |
| `SANCTUM_STATEFUL_DOMAINS` | `<domain>` |
| `DB_*` | A MySQL user with rights on the `tuklas` database only, from localhost only |
| `MAIL_*` | The SMTP provider's credentials; `MAIL_FROM_ADDRESS` on the real domain |
| `BROADCAST_CONNECTION` / `REVERB_*` | `reverb`, with keys generated for production |
| `LOG_LEVEL` | `warning` |

PHP (`deploy/php.ini`): `expose_php=Off`, `display_errors=Off`, `post_max_size=25M`,
`upload_max_filesize=21M` (uploads are capped at 20 MB), `memory_limit=256M`, OPcache on.

## Deploying a release

`deploy/deploy.sh` (from `chore/deploy-server-config`), run by the pipeline. Each release goes in
its own folder and a symlink switches to it, so a failed build never takes the site down.

1. Check out the tag into `releases/<timestamp>/`.
2. `composer install --no-dev --optimize-autoloader`
3. `npm ci && npm run build` (the React app into `public/app/`)
4. Link the shared `.env` and `storage/` into the release.
5. `php artisan migrate --force` (migrations only ever add; never edit one that's deployed)
6. `php artisan config:cache && php artisan route:cache && php artisan event:cache`
7. Switch the `current` symlink to the new release, then reload PHP-FPM.
8. `php artisan queue:restart` and `php artisan reverb:restart`
9. Check `https://<domain>/up` returns 200; keep the last 5 releases.

**Rollback:** point `current` at the previous release and reload. If the release ran a
migration, restore the database backup taken just before step 5 (the pipeline takes one).

## Security checklist (before the first public launch)

Server
- [ ] Firewall allows only 22 (SSH), 80 and 443. MySQL and Reverb's port are not reachable from outside.
- [ ] SSH with keys only, no root login, no passwords. Automatic security updates on.
- [ ] Files owned by a deploy user; only `storage/` and `bootstrap/cache/` writable by PHP.
- [ ] Nginx serves only `public/`; `.env`, `storage/` and `vendor/` can't be downloaded.

App
- [ ] Production `.env` as above; `php artisan about` shows production, debug off.
- [ ] HTTPS works and HTTP redirects to it; the response has `Strict-Transport-Security`.
- [ ] securityheaders.com and SSL Labs both grade A or better.
- [ ] Signing up, email verification, password reset and 2FA work with the real mail provider.
- [ ] The first admin account is created on the server (`php artisan tinker`), with 2FA set up straight away.
- [ ] `composer audit` and `npm audit` are clean.
- [ ] Mail domain has SPF, DKIM and DMARC records, so emails don't land in spam.

Key rotation: to change `APP_KEY`, put the old key in `APP_PREVIOUS_KEYS` first, so encrypted
messages, review text and 2FA secrets stay readable.

## Backups and recovery

From `chore/deploy-backups`:
- **What:** the MySQL database (`mysqldump --single-transaction`) and `storage/app/private`
  (uploads). The `.env` lives in the password manager, not in backups.
- **When:** nightly, plus right before every production migration.
- **Where:** encrypted, off the server (another provider or region), kept 30 days.
- **Proof:** restore a backup to staging once a month, and before launch. A backup that has
  never been restored doesn't count.

## Monitoring

- Uptime check on `https://<domain>/up` every few minutes, alerting the developers by email.
- Laravel logs rotated daily (`LOG_CHANNEL=daily`, 14 days). Logs must not contain personal
  data; the audit log in the database is the record of who did what.
- Watch disk space (uploads) and failed queue jobs (`php artisan queue:failed`).

## Data Privacy Act (RA 10173)

Before real students' data goes in:
- [ ] Final privacy notice text, shown at signup. Changing it means bumping `privacy_version`
      in `config/tuklas.php`, which asks everyone to accept again.
- [ ] A named Data Protection Officer, with contact details in the privacy notice.
- [ ] Check with the university whether Tuklas must be registered with the National Privacy
      Commission (registration depends on the number of people and the kind of data).
- [ ] A breach plan: who decides, and how the NPC and affected people are told within 72 hours.
- [ ] Hosting region and provider agreed with the university (data may leave the Philippines
      only with proper safeguards).

## Decisions needed

| Decision | Options | Suggestion |
|---|---|---|
| Host | A VPS you manage (DigitalOcean, Linode, Vultr, …) with Laravel Forge or by hand; or a managed platform (Laravel Cloud) | A Singapore-region VPS managed through Forge: closest region to the Philippines, and Forge handles Nginx, PHP, SSL, Supervisor and deploys |
| Domain | A university subdomain, or a new domain | A university subdomain, if the university can point DNS at the server |
| Email | Postmark, Mailgun, Amazon SES, or the university's SMTP | A transactional provider (better delivery and logs), unless the university requires its own |
| Who holds production access | Both developers, or one plus a university contact | At least two people, so access isn't lost if one leaves |
