// Regenerates database/schema.sql and database/seed.sql so they never drift from Prisma.
//   schema.sql — from prisma/schema.prisma (no database needed)
//   seed.sql   — dumped from the running, seeded MySQL container (run `npm run db:reset` first)
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const run = (cmd: string) => execSync(cmd, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const schema = run('npx prisma migrate diff --from-empty --to-schema-datamodel server/prisma/schema.prisma --script');
writeFileSync(`${root}database/schema.sql`,
  `-- Tuklas schema (MySQL 8). Generated from server/prisma/schema.prisma by \`npm run db:sql\` — do not edit by hand.\n\n${schema}`);
console.log('Wrote database/schema.sql');

if (process.argv.includes('--schema-only')) process.exit(0);

const data = run(
  'docker compose exec -T mysql mysqldump -utuklas -ptuklas --no-create-info --skip-triggers --complete-insert ' +
  '--skip-extended-insert --no-tablespaces --compact --ignore-table=tuklas._prisma_migrations tuklas',
);
writeFileSync(`${root}database/seed.sql`,
  '-- Tuklas demo data. Dumped from the database seeded by server/src/seed.ts (`npm run db:sql`) — do not edit by hand.\n' +
  '-- Load after schema.sql. Every account\'s password is tuklas123 (bcrypt hash below).\n' +
  '-- Dates are a snapshot of when it was dumped; `npm run db:reset` re-seeds with dates relative to now.\n\n' +
  `SET FOREIGN_KEY_CHECKS = 0;\n${data}SET FOREIGN_KEY_CHECKS = 1;\n`);
console.log('Wrote database/seed.sql');
