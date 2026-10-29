// Visual review captures. Stubs /api/auth/me so the signed-in shell renders without a database.
// Usage: node scripts/capture.mjs <outDir>   (with the Vite dev server running on :5173)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '.impeccable/review';
mkdirSync(out, { recursive: true });
const base = 'http://localhost:5173';
const users = {
  student: { id: 1, name: 'Andrea Villanueva', email: 'andrea@tuklas.edu', role: 'student', program: 'BS Computer Science · 4th year', headline: '' },
  educator: { id: 4, name: 'Dr. Maria Santos', email: 'msantos@tuklas.edu', role: 'educator', program: 'Research Adviser', headline: '' },
};

const browser = await chromium.launch();

async function shot(name, { width, height, path, user, theme = 'light', appearance = 'modern', wait = 2600, before }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme });
  await ctx.addInitScript((p) => localStorage.setItem('tuklas.prefs.v1', JSON.stringify(p)), { theme, appearance });
  const page = await ctx.newPage();
  await page.route('**/api/auth/me', (r) =>
    user ? r.fulfill({ json: { user: users[user] } }) : r.fulfill({ status: 401, json: { error: 'Please log in to continue.' } }),
  );
  await page.goto(base + path);
  await page.waitForTimeout(wait);
  if (before) await before(page);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  await ctx.close();
  console.log('captured', name);
}

await shot('login-desktop', { width: 1440, height: 900, path: '/login', wait: 3800 });
await shot('login-mobile', { width: 390, height: 844, path: '/login' });
await shot('login-dark', { width: 1440, height: 900, path: '/login', theme: 'dark', wait: 3800 });
await shot('login-classic', { width: 1440, height: 900, path: '/login', appearance: 'classic', wait: 3800 });
await shot('shell-desktop', { width: 1440, height: 900, path: '/research', user: 'student' });
await shot('shell-medium', { width: 1024, height: 768, path: '/review', user: 'educator' });
await shot('shell-mobile', { width: 390, height: 844, path: '/research', user: 'student' });
await shot('shell-dark-menu', {
  width: 1440, height: 900, path: '/feed', user: 'educator', theme: 'dark',
  before: async (p) => { await p.getByRole('button', { name: /Account and appearance/ }).first().click(); await p.waitForTimeout(600); },
});
await shot('shell-classic', { width: 1440, height: 900, path: '/feed', user: 'student', appearance: 'classic' });
await shot('signup-modal', {
  width: 1440, height: 900, path: '/login', wait: 1200,
  before: async (p) => { await p.getByRole('button', { name: 'Create your account' }).click(); await p.waitForTimeout(700); },
});

await browser.close();
