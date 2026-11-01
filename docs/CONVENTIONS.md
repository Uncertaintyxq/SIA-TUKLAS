# Coding conventions

Formatting is enforced by Pint (`tuklas/pint.json`, Laravel preset): don't hand-format PHP or argue
with it. The client follows ESLint (`tuklas/eslint.config.js`) and the style of neighbouring files;
there is no Prettier, so never reformat client files you didn't otherwise change. This file covers
what a formatter can't. When this file and the existing code disagree, follow the code and fix this file.

## PHP / Laravel

- Type every parameter, return and property; docblocks for generics (`@return list<int>`) and
  `@var User $me` hints.
- Statuses and kinds are PHP enums in `app/Enums/`, cast on the model.
- Models declare `#[Fillable([...])]`, a `protected $casts = [...]` property (not the `casts()` method:
  Larastan doesn't read it, so every cast column looks like a string), relationships with their
  generic type (`/** @return BelongsTo<User, $this> */`), and `$attributes` defaults for columns with
  database defaults (strict mode is on outside production). Attributes added by `withCount` /
  `withExists` get a `@property-read` line on the model.
- Larastan (level 5, `phpstan.neon`) runs in CI: `vendor/bin/phpstan analyse`. Fix what it reports;
  an ignore needs a comment saying why.
- Event listeners never return `false`: it stops the remaining listeners (`fn ($e) => $x && Audit::log(...)`
  returns false). Use a block closure.
- Validation: `$request->validate([...], [messages])` for small endpoints, a Form Request in
  `app/Http/Requests/<Module>/` when it grows. Messages are written for the person reading them.
- Authorization through Policies and gates (`Gate::allows`, `GroupController::load($id, 'manage')`).
  Something the viewer may not open throws `HttpException(404, '...')` (not `NotFoundHttpException`,
  which loses the message). Never scatter `if ($user->role === ...)` through controllers.
- Writes with real business rules go in an Action (`app/Actions/<Module>/`): `handle()` or `__invoke()`.
  Wrap multi-table writes in `DB::transaction()`. Files are deleted from disk after the commit.
- JSON out is camelCase through Resources or explicit arrays; never return a model directly.
- Eager-load what you loop over (`Cards::user('author')` for user cards). No queries in loops.
- `env()` only in `config/*.php`. New keys go in `.env.example`.
- Notifications through `Notifier::notify()`; security events through `Audit::log()`; uploads through
  `Uploads::store()` / `serve()` / `delete()`.
- Comments explain why, in plain sentences, at the density of the surrounding code.

## Client (React, `tuklas/client/src`)

- Data: one TanStack Query hook per endpoint in `api/<module>.ts`, using `api()` / `upload()` from
  `api/client.ts`. Writes use `useAction()` (refreshes every view) unless they need special caching.
- Types for API data live in `types/<module>.ts` and mirror the server's JSON exactly.
- Styling: CSS Modules with the tokens in `styles/tokens.css`. No inline `style` (ESLint enforces it).
- Reuse `components/ui/` (Button, Field, Sheet, Notice, Badge, Chips, Modal, Toast...) and
  `components/layout/PageHeader`. What a person may do comes from the server (`can`), not from role checks.
- Accessibility: every input has a label, icon buttons have `sr-only` text, errors use `role="alert"`.
- Copy: short, plain, specific; say what happened and what to do next.

## Naming

| Thing | Pattern | Example |
|---|---|---|
| Action | VerbNoun | `DeleteAccount`, `DecideOnWork` |
| Controller | NounController | `DeliverableController` |
| Form Request | NounRequest / VerbNounRequest | `EventRequest`, `DecisionRequest` |
| Policy | ModelPolicy | `ResearchGroupPolicy` |
| Migration | timestamped, one module per file | `2026_11_01_000100_create_deliverable_submissions_table` |
| Table / column | plural snake_case / snake_case | `deliverable_versions.submitted_at` |
| Route name | `module.resource.action` | `groups.deliverables.review` |
| Test | `<Subject>Test` in `tests/Feature/<Module>/` | `tests/Feature/Groups/DeliverableTest.php` |
| Client hook | `use<Thing>` | `useHandIn`, `useDeliverable` |

## Tests

- Feature tests for every route: allowed, refused (validation or 403), and hidden (404).
- Tests may use the demo data (`$this->seedDemo()`, which also gives educators and admins 2FA) or
  factories; the class docblock names the demo people a test relies on.
- The local disk is faked in every test (`tests/TestCase.php`); assert files with `Storage::disk('local')`.
- Name tests as sentences: `test_students_see_only_their_own_work`.
- Don't weaken or delete a test to make a change pass; explain and ask.

## Git

- Branch names come from `docs/TODO.md` (`feat/…`, `fix/…`, `chore/…`, `docs/…`, `test/…`).
- Conventional Commits, scope = module, imperative subject ≤ 72 characters, body says why.
- One logical change per commit. Merge into `main` with `--no-ff` (or a GitHub PR) once the
  developer agrees; delete the branch after.
