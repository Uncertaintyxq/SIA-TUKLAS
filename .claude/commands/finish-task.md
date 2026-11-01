---
description: Quality gate before merging — format, test, client checks, review, browser check, mark the TODO row Done, ask to merge
---

Finish the current task.

1. **Identify the task**: the branch name is a row in `docs/TODO.md`; read its Scope.
2. **Sync**: if `origin/main` has moved, run the `/sync` procedure first.
3. **Quality checks** from `tuklas/`; fix failures and re-run until all pass:
   - `vendor/bin/pint --dirty`, then `vendor/bin/pint --test`
   - `vendor/bin/phpstan analyse --memory-limit=1G` (once `phpstan.neon` exists)
   - `php artisan test`
   - if anything under `client/` changed: `npm run typecheck`, `npm run lint`, `npm run build`
4. **Hygiene**: search `git diff origin/main...HEAD` for `dd(`, `dump(`, `ray(`, `var_dump(`,
   `console.log`, commented-out code, unexplained TODOs and unused imports. Remove them.
5. **Review**: use the `code-reviewer` subagent on `git diff origin/main...HEAD` with the row's Scope.
   Fix every "must fix"; list "should fix" items for me to decide.
6. **Browser check**: if screens changed, ask me whether to check them in a real browser
   (Playwright screenshots or Claude in Chrome, see `docs/GETTING_STARTED.md`) and do it if I agree.
7. **Scope check**: run the `/scope-check` procedure. Anything outside the Scope, or hot files
   touched, gets written into the row ("Also touched: …").
8. **Docs**: mark the row **Done** in `docs/TODO.md`; add a dated entry to the Log in
   `docs/CONVERSION.md` for notable changes; update `docs/ARCHITECTURE.md` if modules, tables or
   integrations changed.
9. **Commits**: show `git log --oneline origin/main..HEAD`. If there are WIP or fixup commits,
   propose a cleaner history and rewrite it only after I agree. Commit with `git commit -F <file>`.
10. **Merge**: ask me. With my OK, either open a PR (`gh pr create`, if the GitHub CLI is set up and
    we use PRs) or merge locally, one step at a time, stopping at the first failure:
    `git switch main`, `git pull --ff-only`, `git merge --no-ff <branch>`, `git push origin main`,
    then delete the branch on `origin` and locally.

End with what was done, what was checked, and anything left undone.
