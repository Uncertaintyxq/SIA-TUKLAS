# 0001. Organise code by module and work in TODO-row branches

- Status: accepted
- Date: 2026-11-01
- Deciders: Jun Mari Manla, Benz Ashley Limbadan, Thirbby Andrei V. Rollon

## Context

Several developers commit to the repo at the same time, each assisted by Claude Code. Without
structure, features spread across shared files (`routes/api.php`, `AppServiceProvider`, shared UI
components) and parallel branches conflict.

## Decision

- Code is grouped by module in every layer: `app/Http/Controllers/<Module>`, `app/Actions/<Module>`,
  `routes/modules/<module>.php`, `tests/Feature/<Module>`, `client/src/api/<module>.ts`,
  `client/src/components/<area>`.
- Every piece of work is a row in `docs/TODO.md` with a fixed branch name and an explicit Scope. A
  branch pushed to `origin` is the claim (`/start-task`). This replaces the kit's original
  issue-numbered branches; GitHub issues and PRs are optional extras.
- Shared files are "hot files" (`.claude/scope.json`), edited minimally and append-only where possible.
- Claude Code hooks ask before editing files another active branch is changing.

## Consequences

- New features mostly add files rather than edit shared ones, so merges are mostly conflict-free.
- Developers must push daily so the overlap check sees their work.
- The TODO table is the single list of planned work; its Status column changes only when a row is Done.

## Alternatives considered

- Issue-numbered branches (`feat/42-slug`) from the original kit: needs every task filed as a GitHub
  issue first; the team chose pre-planned branch names in `docs/TODO.md` instead.
- Layer-based split (backend developer / frontend developer): overlaps on the same features without
  a fixed contract.
