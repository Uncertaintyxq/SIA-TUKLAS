---
paths:
  - "tuklas/database/**/*.php"
  - "tuklas/app/Models/**/*.php"
---

# Database rules (migrations, models, factories, seeders)

- **Never edit, rename or delete a migration that exists on `main`.** Add a new one
  (`php artisan make:migration`, or copy the dated naming: `2026_11_01_000300_add_..._table.php`).
  Check with `git log origin/main -- <file>` if unsure.
- Every migration has a working `down()`.
- Foreign keys: choose `cascadeOnDelete()`, `nullOnDelete()` or `restrictOnDelete()` deliberately.
  Note that user rows are never deleted (account deletion anonymises them, D13).
- Index columns used in `where`, `orderBy` or joins.
- Status/kind columns are backed by a PHP enum in `app/Enums/`, cast on the model.
- Models: `#[Fillable([...])]`, `casts()`, typed relationships, and `$attributes` defaults for
  columns with database defaults (strict mode throws on missing attributes).
- New demo data goes in `DemoSeeder` (a hot file: keep additions small) with fixed ids; tests rely on it.
- If another active branch alters the same table, tell the developer before writing the migration.
- Never run `migrate:fresh`, `db:wipe` or the demo reset unless the developer asks in this session.
