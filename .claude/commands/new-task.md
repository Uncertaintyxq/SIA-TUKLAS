---
description: Add a well-scoped row (branch name, Scope, Depends on) to docs/TODO.md before anyone claims it
argument-hint: <what needs to be done>
---

Add a planned branch to `docs/TODO.md` for: $ARGUMENTS

1. Read `docs/ARCHITECTURE.md` and look at the relevant code so the Scope names real paths.
2. Check for duplicates and overlap: the existing rows in `docs/TODO.md`, and
   `php .claude/hooks/scope_snapshot.php` for branches in flight. If a row or branch already
   covers part of this, say so and adjust.
3. Draft the row for the right section's table:

   `| <branch-name> | <Scope: what it does, then the paths it may change; mark *shared* files> | <Depends on> | Not started |`

   Branch names: `feat/`, `fix/`, `chore/`, `docs/`, `test/` + a short kebab-case name. Paths are
   relative to `tuklas/` unless they start with `docs/` or `.github/`. Also list acceptance
   criteria (testable bullets) for me to see, even though only the row goes in the table.
4. Show me the draft. After I approve: the row goes on `main` in a small commit of its own
   (`docs: plan <branch-name>`), per the branch rule at the top of `docs/TODO.md`. Ask before
   committing or pushing. If the GitHub CLI is signed in and I want it, also create an issue with
   the same text.

If the task looks bigger than about a day, propose splitting it into several rows first.
