---
description: Split a feature into non-overlapping work units that several developers can build in parallel
argument-hint: <feature description>
---

Split this feature into parallel work units for our developers: $ARGUMENTS

1. Read `docs/ARCHITECTURE.md` (module map, layers), `docs/PROJECT.md`, and `tuklas/reference/README.md`
   if the feature touches client requirements.
2. See what's already in flight: `php .claude/hooks/scope_snapshot.php` and the Planned branches
   in `docs/TODO.md` (a row is taken if its branch exists on `origin`).
3. Explore the code the feature will touch (routes, controllers, models, migrations, client pages,
   api hooks, types) so the split is based on real files.
4. Propose 2–6 work units. For each:
   - **Branch name** following `docs/TODO.md` (`feat/…`, `fix/…`, `chore/…`)
   - **Goal**: one or two sentences
   - **Scope**: exact folders/files it will create or change (mark hot files)
   - **Out of scope**: what it must not touch
   - **Depends on**: other units that must merge first
   - **Contract**: what other units rely on (route names, JSON shapes, columns, hook names), precisely
   - **Size**: S (< 0.5 day), M (≈ 1 day), L (> 1 day → split further)
5. Check the plan: no two units that can run at the same time may share a file. Shared needs (a
   migration both use, a new package, a shared component change) become a small foundation unit first.
6. Suggest an assignment: parallel tracks per developer, foundations first, ordered by dependency.

Present the plan as a table plus the track assignment. Don't write code or change files. End by
asking whether to add the rows with `/new-task`.
