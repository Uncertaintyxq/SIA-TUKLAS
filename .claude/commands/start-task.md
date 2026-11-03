---
description: Claim a planned branch from docs/TODO.md — check it's free, branch from fresh main, push the claim, check overlap, then plan
argument-hint: <branch-name from docs/TODO.md>
---

Start work on the planned branch `$ARGUMENTS`.

1. **Read the row** in `docs/TODO.md`: Scope, Depends on, Status. If it's Done, or its
   dependencies aren't Done, stop and tell me. If there's no such row, offer `/new-task` first.
2. **Check it's free**: `git fetch --prune` then `git ls-remote --heads origin $ARGUMENTS`. If that
   prints a line, someone has claimed it: stop and tell me.
3. **Check state**: `git status`. If there are uncommitted changes, stop and ask what to do.
4. **Check for collisions**: `php .claude/hooks/scope_snapshot.php`. Compare the row's Scope with
   every other active branch: file or folder overlaps, and logical overlaps (same table, same
   route names, same component or hook). If there's overlap, stop and recommend: wait, extract a
   shared mini-branch, or coordinate.
5. **Create and claim the branch** (ask me before pushing; the push is visible to the team). First
   mark the row in `docs/TODO.md` on `main`: Status `In progress (<my name>)` (ask me for the name
   once), committed and pushed on its own, so the table shows the claim too:
   ```
   git switch main && git pull --ff-only
   # edit the row's Status in docs/TODO.md, then:
   git add docs/TODO.md && git commit -m "docs: claim $ARGUMENTS" && git push
   git switch -c $ARGUMENTS
   git commit --allow-empty -m "chore: start $ARGUMENTS"
   git push -u origin $ARGUMENTS
   ```
   Run these one at a time and stop at the first failure.
6. **Plan**: read `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md` and the code in scope. Write a
   numbered plan: files to create or change (inside Scope), migrations, tests, client screens, and
   anything outside Scope that seems necessary (flag it; don't do it without approval).

Wait for my go-ahead on the plan before writing code.
