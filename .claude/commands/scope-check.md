---
description: Re-check this branch's files (and any planned files) against other developers' active work and the row's Scope
argument-hint: [optional list of files or folders you plan to touch]
---

Run a scope check for the current branch.

1. `php .claude/hooks/scope_snapshot.php --json` (this refreshes from origin).
2. Collect my files: `myFiles` from the snapshot, plus these planned paths if given: $ARGUMENTS
3. For every other branch in `others`, report:
   - exact file overlaps with my files (folder overlaps for planned folders);
   - likely **logical** conflicts Git won't catch: migrations on the same table, the same route
     names or URIs, the same model methods, the same client hook, type or component, the same
     config or `.env.example` keys. Look at the diffs with
     `git diff origin/main...origin/<branch> -- <path>` where needed.
4. Find this branch's row in `docs/TODO.md` (the branch name is the row) and list anything I
   changed that's outside its Scope.
5. Check that hot files (`hotFiles` in `.claude/scope.json`) I touched have minimal, append-only changes.

Output: a short verdict (✅ clear / ⚠ needs coordination), then the specific overlaps with a
recommendation for each (avoid, sequence, extract, coordinate; see `docs/COLLABORATION.md` §3).
Don't change any files.
