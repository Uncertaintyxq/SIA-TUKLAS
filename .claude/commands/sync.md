---
description: Rebase the current branch on the latest main and resolve conflicts safely
---

Bring this branch up to date with main.

1. `git status`: if there are uncommitted changes, commit them as a WIP commit (ask me first) or stop.
2. `git fetch origin`, then show what landed on main since we branched:
   `git log --oneline HEAD..origin/main`.
3. `git rebase origin/main`.
4. If there are conflicts, for each conflicted file:
   - Read both sides and the commit on main that introduced theirs (`git log origin/main -1 -- <file>`).
   - Keep **both** intents. Never drop main's change to make ours apply.
   - Lock files (`tuklas/composer.lock`, `tuklas/package-lock.json`): never hand-merge. Take main's
     version (`git checkout origin/main -- <lockfile>`), then re-run `composer update <packages this
     branch added>` / `npm install` from `tuklas/` so our additions are re-applied.
   - `docs/TODO.md`: keep both sides' rows; only our own row's Status may differ.
   - Migrations: never edit main's migrations; if ours conflicts logically with a new one on main,
     tell me before changing anything.
   - If the right resolution is unclear, stop and show me both sides.
   - `git add <file>` and `git rebase --continue`.
5. From `tuklas/`: `vendor/bin/pint --test`, `php artisan test`, and if the client changed
   `npm run typecheck`, `npm run lint`, `npm run build`. Fix anything the rebase broke.
6. Ask before pushing; push with `git push --force-with-lease` (never `--force`).

Summarise what changed on main that affects this branch.
