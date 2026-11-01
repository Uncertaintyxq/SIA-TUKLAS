## Summary

<!-- What does this PR do and why? 1–3 sentences. -->

Branch / TODO row: `<branch-name>` (docs/TODO.md)

## Scope

<!-- Folders/files this PR changes. Copy from the TODO row and update at the end.
     Reviewers: anything not listed here is a red flag. -->

- 

## Hot files touched

<!-- Shared files from .claude/scope.json (routes/api.php, composer/package files, config/*,
     AppServiceProvider, User.php, DemoSeeder, shared UI components, .env.example…).
     Write "None" if none. For each, say what changed and why it couldn't be avoided. -->

None

## How to test

1. 

## Screenshots

<!-- Required for UI changes (a browser check). Delete if not applicable. -->

## Checklist

- [ ] Stays within the row's Scope (or deviations explained above)
- [ ] Tests added/updated for every behaviour change (allowed / refused / hidden)
- [ ] `vendor/bin/pint --test` and `php artisan test` pass; client `typecheck`, `lint`, `build` pass if it changed
- [ ] New migrations only — no edits to migrations already on `main`
- [ ] New env keys added to `.env.example`
- [ ] Row marked Done in `docs/TODO.md`
- [ ] Rebased on latest `main`
- [ ] No debug code (`dd`, `dump`, `ray`, `console.log`)
