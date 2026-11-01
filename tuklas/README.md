# Tuklas — From Defense to Discovery

A research and academic engagement hub for students, educators and administrators.
See `PLAN.md` for the full build plan and [`reference/`](reference/README.md) for the client meeting notes, design notes and original prototype.

> **Stack:** a Laravel 13 JSON API (this folder) and a React app (`client/`). The move from the original
> Express server is recorded in [`docs/CONVERSION.md`](../docs/CONVERSION.md) (decisions, security spec, code
> layout). What's left, and which branch name to use for it, is in [`docs/TODO.md`](../docs/TODO.md); deployment
> in [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Run it locally

**Full steps: [`docs/GETTING_STARTED.md`](../docs/GETTING_STARTED.md)**, covering what to install (PHP 8.3+ via Herd,
Composer, Node 22+, MySQL 8), how to run and test, and what's left to build. In short:

```bash
composer install && npm install
cp .env.example .env && php artisan key:generate && php artisan reverb:install
php artisan migrate:fresh --seed     # tables + demo data
npm run dev                          # API :8000, Reverb :8080, queue worker, site on http://localhost:5173
```

Demo accounts (password `tuklas123`): `andrea@tuklas.edu`, `paolo@tuklas.edu`, `kim@tuklas.edu` (students),
`msantos@tuklas.edu`, `raquino@tuklas.edu` (verified educators), `cjavier@tuklas.edu` (educator waiting for
verification), `admin@tuklas.edu` (admin). "Reset demo data" in the account menu reloads them and deletes every other account.

Uploaded files (work PDFs, CVs, photos, ad images, group files) are stored on Laravel's private disk
(`storage/app/private/`, gitignored); the database keeps only their names. Every file is served through the same
privacy check as the thing it belongs to.

## What's built

| Phase | Where | What |
|---|---|---|
| 3 · Portfolio | `/portfolio` (edit), `/u/<username>` (public) | Photo, name and titles, position, department, role badge, short and extended bio, academic background, honors (pending until an admin verifies), academic links, CV PDF |
| 4 · Research & approval | `/research`, `/works/:id`, `/review` | New entry (type, abstract, keywords, co-authors, adviser, PDF), Draft → Submitted → Under review → Needs revision → Approved / Rejected, review queue, version history, notifications |
| 5 · Feed | `/feed` | Approved works, opportunities and approved events only; filters, sort, reactions, comments, library, share, search for works, keywords and people |
| 6 · Events & ads | `/events`, `/events/:id` | Propose → admin approves → register, attendee list, admin-approved academic ad slots in the feed sidebar |
| 7 · Groups & admin | `/groups`, `/admin` | Adviser-led research groups with files and deadlines; admin verifies educators, manages roles, approves events/ads/honors, removes posts, sees stats |
| Signature | work page | Verified seal + `/verify/<code>`, APA 7 / MLA citation, QR code, topic overlap check, defense tracker, revision checklist |

## Useful scripts

| Script | Does |
|---|---|
| `npm run dev` | Everything for local development: `php artisan serve`, `reverb:start`, `queue:work` and the React app |
| `npm run typecheck` / `npm run lint` | Type and lint checks for the React app |
| `php artisan test` / `vendor/bin/pint` | Laravel tests and PHP formatting |
| `npm run db:down` | Stop MySQL (data is kept in the `tuklas-mysql` volume) |
