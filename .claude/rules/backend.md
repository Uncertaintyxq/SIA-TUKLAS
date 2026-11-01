---
paths:
  - "tuklas/app/**/*.php"
  - "tuklas/routes/**/*.php"
  - "tuklas/config/**/*.php"
  - "tuklas/bootstrap/**/*.php"
---

# Backend rules (tuklas/app, routes, config)

- Controller methods: load the thing (404 if the viewer may not open it) → authorize through a
  Policy or gate → validate → call an Action or do a simple write → return a Resource or array.
- Access rules live in `app/Policies/` and gates, never inline role checks. Hidden things throw
  `HttpException(404, '...')`.
- Writes with business rules go in `app/Actions/<Module>/<VerbNoun>.php` (`handle()` or `__invoke()`),
  wrapped in `DB::transaction()` when they touch several tables. Delete files from disk after the commit.
- JSON is camelCase via Resources or explicit arrays; errors are `{error, issues}` (bootstrap/app.php).
- Route changes go in `routes/modules/<module>.php`. Touch `routes/api.php` only to add a `require`.
  Name every route (`module.resource.action`), constrain ids with `whereNumber`, add a `throttle:`
  limiter to uploads and posting.
- Personal text that isn't public goes in `encrypted` casts. Never log personal data.
- Notifications via `Notifier::notify()` (it skips deleted accounts); people lists use `User::active()`.
- `env()` only inside `config/*.php`; new keys also go in `.env.example`.
- Never catch `\Throwable` just to hide it; log with context or rethrow.
