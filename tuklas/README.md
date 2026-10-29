# Tuklas — From Defense to Discovery

A research and academic engagement hub for students, educators and administrators.
See `PLAN.md` for the full build plan and [`reference/`](reference/README.md) for the client meeting notes, design notes and original prototype.

> **Moving to Laravel.** The Express server in `server/` is being replaced by a Laravel API in this folder.
> Decisions, the security spec and what's left are in [`docs/CONVERSION.md`](../docs/CONVERSION.md).

## Run it locally

Requires Node 22+ and Docker Desktop (or MySQL 8+, see below).

```bash
npm install
cp server/.env.example server/.env
npm run db:up        # start MySQL 8 in Docker
npm run db:reset     # create tables + load demo data
npm run dev          # API on :4000, app on http://localhost:5173
```

**No Docker?** If MySQL 8+ is installed (for example from [dev.mysql.com](https://dev.mysql.com/downloads/mysql/)),
use `npm run db:local` instead of `npm run db:up`. It runs a separate MySQL just for Tuklas, with the same database
and account, on the port in `DATABASE_URL` in `server/.env`. Run it again after restarting your computer. If another
MySQL already uses port 3306, change that port (e.g. to 3307).

Demo accounts (password `tuklas123`): `andrea@tuklas.edu`, `paolo@tuklas.edu`, `kim@tuklas.edu` (students),
`msantos@tuklas.edu`, `raquino@tuklas.edu` (verified educators), `cjavier@tuklas.edu` (educator waiting for
verification), `admin@tuklas.edu` (admin). "Reset demo data" in the account menu reloads them and deletes every other account.

Uploaded files (work PDFs, CVs, photos, ad images, group files) are stored in `server/uploads/` (gitignored);
the database keeps only their names. Work PDFs are served through the same privacy check as the work itself.

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
| `npm run db:sql` | Regenerate `database/schema.sql` and `database/seed.sql` from Prisma and the seeded DB |
| `npm run typecheck` / `npm run lint` | Type and lint checks for both workspaces |
| `npm run db:down` | Stop MySQL (data is kept in the `tuklas-mysql` volume) |
| `npm run db:local` / `npm run db:local:stop` | Start / stop MySQL from a local install instead of Docker (data in `database/.local-mysql/`) |
