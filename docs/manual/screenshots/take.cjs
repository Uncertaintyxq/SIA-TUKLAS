// Takes the user manual's screenshots from a running local copy of Tuklas, as the showcase personas.
//
// 1. A database just for the screenshots, with the showcase loaded (DEMO_MODE=false, as in production):
//      DEMO_MODE=false DB_DATABASE=<file> php artisan migrate --force
//      DEMO_MODE=false DB_DATABASE=<file> php artisan tinker --execute "(new Database\Seeders\DemoSeeder)->forShowcase('tuklas.example', '<password>')->run();"
// 2. The app on that database: DEMO_MODE=false VITE_DEMO_LOGIN=false DB_DATABASE=<file> npm run dev (from tuklas/)
// 3. NODE_PATH=<folder with playwright>/node_modules MANUAL_PASSWORD=<password> node docs/manual/screenshots/take.cjs [chapter ...]
//
// Each chapter's run starts from where the previous one left the database (accounts it created stay),
// so run the chapters in order on a fresh database. Markers are numbered red boxes that the
// manual's steps refer to. QR codes, setup keys and recovery codes are blurred.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.MANUAL_URL || 'http://localhost:5173';
const PASSWORD = process.env.MANUAL_PASSWORD;
const DOMAIN = 'tuklas.example';
const OUT = __dirname;
const LOG = path.join(__dirname, '..', '..', '..', 'tuklas', 'storage', 'logs', 'laravel.log');
// The personas' two-factor secrets from this run, kept outside the repo
const SECRETS = path.join(require('os').tmpdir(), 'tuklas-manual-2fa.json');
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

if (!PASSWORD) {
  console.error('Set MANUAL_PASSWORD to the showcase password.');
  process.exit(1);
}

/** The current 6-digit code for a base32 two-factor secret (RFC 6238). */
function totp(secret, offset = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}

/** Waits until a new 30-second period starts, so a code is never reused (the server refuses that). */
async function freshCode(page, secret, used) {
  let code = totp(secret);
  while (used.has(code)) {
    await page.waitForTimeout(2000);
    code = totp(secret);
  }
  used.add(code);
  return code;
}

/** Numbered red boxes, numbered like the manual's steps: the nth target is box n. A target is a
 * locator, [locator, side] to put its number 'right', 'above', 'below' or 'inside' (at the box's
 * right end) instead of on the left, or null for a step that has nothing to mark. */
async function mark(page, targets) {
  const boxes = [];
  for (const t of targets) {
    if (t === null) {
      boxes.push(null);
      continue;
    }
    const [locator, side] = Array.isArray(t) ? t : [t, 'left'];
    const box = await locator.boundingBox();
    boxes.push(box && { ...box, side });
  }
  await page.evaluate((list) => {
    const layer = document.createElement('div');
    layer.id = 'manual-marks';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    list.forEach((b, i) => {
      if (!b) return;
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;left:${b.x - 4}px;top:${b.y - 4}px;width:${b.width + 8}px;height:${b.height + 8}px;border:3px solid #d62828;border-radius:6px`;
      const n = document.createElement('div');
      n.textContent = String(i + 1);
      // Left of the box and centred on it, so it never hides a label; on the right when there's no room
      const side = b.side === 'left' && b.x < 40 ? 'right' : b.side;
      const middle = b.x + b.width / 2 - 13;
      const left = { above: middle, below: middle, right: b.x + b.width + 10, inside: b.x + b.width - 36 }[side] ?? b.x - 38;
      const top = { above: b.y - 36, below: b.y + b.height + 10 }[side] ?? b.y + b.height / 2 - 13;
      n.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:26px;height:26px;border-radius:50%;background:#d62828;color:#fff;font:bold 15px Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #fff`;
      layer.append(box, n);
    });
    document.body.append(layer);
  }, boxes);
}

async function blur(page, selectors) {
  await page.evaluate((list) => list.forEach((s) => document.querySelectorAll(s).forEach((el) => (el.style.filter = 'blur(6px)'))), selectors);
}

/**
 * Saves a screenshot with its markers. `tall` takes the whole page; `clip` (a locator, or several)
 * takes only the area around them, with room left for the markers' numbers.
 */
async function shot(page, name, targets = [], { blurred = [], clip, tall = false, toasts = false } = {}) {
  const viewport = page.viewportSize();
  if (tall || clip) {
    // The whole page in one viewport, so the markers and the clip share one set of coordinates
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(700); // let entrance animations finish
  // Pop-up messages ("Welcome back") hide parts of the screen; shown only where the manual is about one
  await page.evaluate((show) => document.querySelectorAll('[aria-live="polite"]').forEach((el) => (el.style.visibility = show ? '' : 'hidden')), toasts);
  if (blurred.length) await blur(page, blurred);
  if (targets.length) await mark(page, targets);
  const file = path.join(OUT, `${name}.png`);
  if (clip) {
    const boxes = await Promise.all([].concat(clip).map((l) => l.boundingBox()));
    const size = page.viewportSize();
    const x = Math.max(Math.min(...boxes.map((b) => b.x)) - 48, 0);
    const y = Math.max(Math.min(...boxes.map((b) => b.y)) - 20, 0);
    const right = Math.min(Math.max(...boxes.map((b) => b.x + b.width)) + 48, size.width);
    const bottom = Math.min(Math.max(...boxes.map((b) => b.y + b.height)) + 20, size.height);
    await page.screenshot({ path: file, clip: { x, y, width: right - x, height: bottom - y } });
  } else {
    await page.screenshot({ path: file });
  }
  await page.evaluate(() => document.getElementById('manual-marks')?.remove());
  if (tall || clip) await page.setViewportSize(viewport);
  console.log('  ' + name + '.png');
}

async function newPage(browser, viewport = DESKTOP) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'light', locale: 'en-PH', timezoneId: 'Asia/Manila' });
  await context.addInitScript(() => localStorage.setItem('tuklas.prefs.v1', JSON.stringify({ theme: 'light', appearance: 'modern' })));
  return context.newPage();
}

async function logIn(page, email, password = PASSWORD) {
  await page.goto(BASE + '/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

/** The newest link in the local mail log (MAIL_MAILER=log) that contains this text. */
function lastMailedLink(contains) {
  const links = fs.readFileSync(LOG, 'utf8').match(/https?:\/\/[^\s"'<>]+/g) || [];
  const found = links.reverse().find((l) => l.includes(contains));
  if (!found) throw new Error(`No "${contains}" link in ${LOG}`);
  return found.replace(/&amp;/g, '&').replace(/=3D/g, '=');
}

const chapters = {
  async 'getting-started'(browser) {
    const page = await newPage(browser);

    // Logging in, and where to create an account
    await page.goto(BASE + '/login');
    await shot(page, 'login', [page.getByLabel('Email address'), page.getByLabel('Password', { exact: true }), page.getByRole('button', { name: 'Log in', exact: true })]);

    // Signing up with a school email
    await page.getByRole('button', { name: 'Create your account' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Bea Santos');
    await dialog.getByLabel('School email').fill(`bea.santos@tu.${DOMAIN}`);
    await dialog.getByLabel('Password').fill('my coffee is always cold');
    await dialog.getByLabel('Program or department').fill('BS Psychology');
    await dialog.getByRole('checkbox').check();
    await shot(page, 'signup', [
      dialog.getByLabel('Full name'), dialog.getByLabel('School email'), dialog.getByLabel('Password'), dialog.getByLabel('School', { exact: true }),
      dialog.getByLabel('I am a'), dialog.getByLabel('Program or department'), dialog.getByRole('checkbox'), [dialog.getByRole('button', { name: 'Create account' }), 'above'],
    ], { clip: dialog });
    await dialog.getByRole('button', { name: 'Create account' }).click();

    // Confirming the email
    await page.getByRole('heading', { name: 'Confirm your email' }).waitFor();
    await shot(page, 'confirm-email', [page.getByRole('button', { name: 'Send a new link' }), page.getByRole('button', { name: 'I’ve confirmed it' })]);
    await page.goto(lastMailedLink('verify'));
    await page.getByText('Email confirmed. Welcome to Tuklas.').waitFor();

    // Signing up without a school email: the school's admins confirm the account
    const other = await newPage(browser);
    await other.goto(BASE + '/login');
    await other.getByRole('button', { name: 'Create your account' }).click();
    const d2 = other.getByRole('dialog');
    await d2.getByLabel('Full name').fill('Carlo Reyes');
    await d2.getByLabel('School email').fill('carlo.reyes@example.com');
    await d2.getByLabel('Password').fill('a long walk to the library');
    await d2.getByLabel('School', { exact: true }).selectOption({ label: 'Bayan State College' });
    await d2.getByLabel('Program or department').fill('BS Agriculture');
    await d2.getByRole('checkbox').check();
    await shot(other, 'signup-choose-school', [d2.getByLabel('School', { exact: true }), [d2.getByRole('button', { name: 'Create account' }), 'above']], { clip: d2 });
    await d2.getByRole('button', { name: 'Create account' }).click();
    await other.getByRole('heading', { name: 'Confirm your email' }).waitFor();
    await other.goto(lastMailedLink('verify'));
    await other.getByRole('heading', { name: /Waiting for/ }).waitFor();
    await shot(other, 'waiting-for-school', [other.getByRole('button', { name: 'Check again' })]);
    await other.context().close();

    // First sign-in of an educator: two-factor set-up, then the privacy notice
    const edu = await newPage(browser);
    await logIn(edu, `msantos@tu.${DOMAIN}`);
    await edu.getByRole('heading', { name: 'Set up two-factor sign-in' }).waitFor();
    // The password is asked for again only when it wasn't entered in the last few hours
    const start = edu.getByRole('button', { name: 'Set up two-factor sign-in' });
    await start.or(edu.getByLabel('Your password')).first().waitFor();
    if (await edu.getByLabel('Your password').isVisible()) {
      await edu.getByLabel('Your password').fill(PASSWORD);
      await edu.getByRole('button', { name: 'Continue' }).click();
    }
    await start.waitFor();
    await shot(edu, '2fa-start', [edu.getByRole('button', { name: 'Set up two-factor sign-in' })]);
    await edu.getByRole('button', { name: 'Set up two-factor sign-in' }).click();
    const secretEl = edu.locator('code').first();
    await secretEl.waitFor();
    const secret = (await secretEl.textContent()).trim();
    const used = new Set();
    await edu.getByLabel('6-digit code').fill(await freshCode(edu, secret, used));
    await shot(edu, '2fa-scan', [edu.getByAltText('QR code to scan with your authenticator app'), secretEl, edu.getByLabel('6-digit code'), edu.getByRole('button', { name: 'Turn on' })],
      { blurred: ['img[alt^="QR code"]', 'code'] });
    await edu.getByRole('button', { name: 'Turn on' }).click();
    await edu.getByRole('button', { name: 'I’ve saved my codes' }).waitFor();
    await edu.waitForTimeout(500);
    await shot(edu, '2fa-recovery-codes', [edu.getByRole('button', { name: 'Copy' }), edu.getByRole('button', { name: 'Download' }), edu.getByRole('button', { name: 'I’ve saved my codes' })], { blurred: ['ul li', 'ol li', 'code'] });
    await edu.getByRole('button', { name: 'I’ve saved my codes' }).click();
    await edu.getByRole('heading', { name: 'Our privacy notice has changed' }).waitFor();
    await shot(edu, 'privacy-accept', [edu.getByRole('checkbox'), edu.getByRole('button', { name: 'Accept and continue' })]);
    await edu.getByRole('checkbox').check();
    await edu.getByRole('button', { name: 'Accept and continue' }).click();
    await edu.waitForURL(/\/(feed|portfolio)/);

    // Logging in again with two-factor sign-in
    await edu.context().clearCookies();
    await logIn(edu, `msantos@tu.${DOMAIN}`);
    await edu.getByRole('heading', { name: 'Two-factor sign-in' }).waitFor();
    const codeField = edu.getByLabel('6-digit code');
    await shot(edu, '2fa-challenge', [codeField, edu.getByRole('button', { name: 'Log in', exact: true }), [edu.getByRole('button', { name: 'Lost your phone? Use a recovery code' }), 'below']]);
    await codeField.fill(await freshCode(edu, secret, used));
    await codeField.press('Enter');
    await edu.waitForURL(/\/feed/);
    fs.writeFileSync(SECRETS, JSON.stringify({ [`msantos@tu.${DOMAIN}`]: secret })); // for later chapters' sign-ins
    await edu.context().close();

    // A forgotten password
    await page.context().clearCookies();
    await page.goto(BASE + '/forgot-password');
    await shot(page, 'forgot-password', [page.getByLabel('School email'), page.getByRole('button', { name: 'Send reset link' })]);

    // Finding your way around, as a student
    await logIn(page, `andrea@tu.${DOMAIN}`);
    const privacy = page.getByRole('button', { name: 'Accept and continue' });
    await privacy.waitFor();
    await page.getByRole('checkbox').check();
    await privacy.click();
    await page.waitForURL(/\/feed/);
    await page.getByText(/^Welcome back/).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const userMenu = page.getByRole('complementary', { name: 'Main navigation' }).getByRole('button', { name: /Andrea Villanueva/ });
    await shot(page, 'layout-desktop', [
      page.getByRole('complementary', { name: 'Main navigation' }).getByRole('link', { name: /Community feed/ }), page.getByRole('search'),
      page.getByRole('button', { name: 'Switch to dark mode' }), page.getByText('Updates', { exact: true }), userMenu,
    ]);
    await userMenu.click();
    await page.getByText('Look', { exact: true }).waitFor();
    await shot(page, 'user-menu', [[userMenu, 'right'], page.getByRole('radiogroup', { name: 'Theme' }).or(page.getByLabel('Theme')).first(), page.getByRole('radiogroup', { name: 'Look' }).or(page.getByLabel('Look')).first()]);
    await page.keyboard.press('Escape');

    await page.goto(BASE + '/account');
    await page.getByRole('heading', { name: 'Account and security' }).waitFor();
    await shot(page, 'account', [page.getByRole('button', { name: 'Set up two-factor sign-in' }), page.getByLabel('Current password')]);
    const center = (name) => page.getByRole('heading', { name }).evaluate((h) => h.scrollIntoView({ block: 'center' }));
    await center('Notifications');
    await shot(page, 'account-notifications', [
      page.getByRole('button', { name: 'Turn on notifications here' }), [page.getByText('Email', { exact: true }).first(), 'above'], [page.getByText('Push', { exact: true }).first(), 'above'],
    ]);
    await center('Delete account');
    await shot(page, 'account-data', [page.getByText('Weekly digest email').locator('xpath=ancestor::label[1]'), page.getByRole('link', { name: 'Download my data' }).or(page.getByRole('button', { name: 'Download my data' })).first(),
      page.getByRole('button', { name: /Delete my account/ })]);

    const phone = await newPage(browser, PHONE);
    await logIn(phone, `andrea@tu.${DOMAIN}`);
    await phone.waitForURL(/\/feed/);
    await phone.getByText(/^Welcome back/).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const bar = phone.getByRole('navigation', { name: 'Main navigation' });
    await shot(phone, 'layout-phone', [
      [phone.getByRole('search'), 'inside'], [phone.getByRole('banner').getByRole('button', { name: 'Account and appearance' }), 'left'],
      [bar.getByRole('link', { name: 'Feed' }), 'above'], [bar.getByRole('button', { name: 'More' }), 'above'],
    ]);
    await phone.context().close();
    await page.context().close();
  },

  async visitors(browser) {
    const page = await newPage(browser);
    const heading = (name) => page.getByRole('heading', { name });

    // A public portfolio
    await page.goto(BASE + '/u/andrea');
    await heading('Andrea Villanueva').waitFor();
    await shot(page, 'visitor-portfolio', [
      page.getByRole('button', { name: 'Share' }), page.getByText('Published works', { exact: true }).locator('..'), heading(/^Published research/),
      heading(/^Research & literary works/), heading('Academic links'), heading('Academic background'), heading(/^Honors/),
    ], { tall: true });

    // A work, from the top
    await page.goto(BASE + '/works/1');
    await heading('Abstract').waitFor();
    await shot(page, 'visitor-work', [
      page.getByText('Research adviser:'), heading('Abstract'), heading('How we made this'), heading('Approval'), heading('Readers'),
    ]);
    // A card is the section whose header holds the heading
    const card = (name) => heading(name).locator('xpath=ancestor::header[1]/..');
    const joinIn = page.getByRole('main').getByRole('link', { name: 'Log in' });
    await shot(page, 'visitor-work-stages', [heading(/^Defense to Discovery/), heading(/^Discussion/), joinIn], { clip: [card(/^Defense to Discovery/), card(/^Discussion/)] });
    await shot(page, 'visitor-cite', [page.getByText('APA 7', { exact: true }), page.getByRole('button', { name: 'Copy citation' })], { clip: card('Cite this work') });
    await shot(page, 'visitor-share', [page.getByRole('button', { name: 'Share link' }), page.getByRole('link', { name: 'Download PNG' }).or(page.getByRole('button', { name: 'Download PNG' })).first()],
      { clip: [card('Readers'), card('QR code for posters')] });

    // An educator's publication
    await page.goto(BASE + '/publications/4');
    await heading('Abstract').waitFor();
    await shot(page, 'visitor-publication', [heading('Abstract'), heading('Methodology'), heading('Full text'), heading('Cite this research'), page.getByRole('button', { name: 'Copy link' })], { tall: true });
    await page.context().close();
  },
};

(async () => {
  const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(chapters);
  const browser = await chromium.launch();
  try {
    for (const name of wanted) {
      console.log(name);
      await chapters[name](browser);
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
