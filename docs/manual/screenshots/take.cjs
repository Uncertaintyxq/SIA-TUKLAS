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

const usedCodes = new Map();

/**
 * Logs a persona all the way in, as on a real site: their two-factor code (setting it up the
 * first time, with the secret kept in SECRETS for later runs), then the privacy notice.
 * Ends on the feed.
 */
async function signIn(browser, email, viewport = DESKTOP) {
  const page = await newPage(browser, viewport);
  const secrets = fs.existsSync(SECRETS) ? JSON.parse(fs.readFileSync(SECRETS, 'utf8')) : {};
  const used = usedCodes.get(email) ?? new Set();
  usedCodes.set(email, used);
  await logIn(page, email);
  const feed = page.getByRole('heading', { name: 'Community feed', exact: true });
  const challenge = page.getByRole('heading', { name: 'Two-factor sign-in', exact: true });
  const setup = page.getByRole('heading', { name: 'Set up two-factor sign-in', exact: true });
  const privacy = page.getByRole('button', { name: 'Accept and continue' });
  for (;;) {
    await feed.or(challenge).or(setup).or(privacy).first().waitFor();
    if (await feed.isVisible()) break;
    if (await challenge.isVisible()) {
      await page.getByLabel('6-digit code').fill(await freshCode(page, secrets[email], used));
      await page.getByRole('button', { name: 'Log in', exact: true }).click();
      await challenge.waitFor({ state: 'hidden' });
    } else if (await setup.isVisible()) {
      const start = page.getByRole('button', { name: 'Set up two-factor sign-in' });
      await start.or(page.getByLabel('Your password')).first().waitFor();
      if (await page.getByLabel('Your password').isVisible()) {
        await page.getByLabel('Your password').fill(PASSWORD);
        await page.getByRole('button', { name: 'Continue' }).click();
      }
      await start.click();
      const key = page.locator('code').first();
      await key.waitFor();
      secrets[email] = (await key.textContent()).trim();
      fs.writeFileSync(SECRETS, JSON.stringify(secrets));
      await page.getByLabel('6-digit code').fill(await freshCode(page, secrets[email], used));
      await page.getByRole('button', { name: 'Turn on' }).click();
      await page.getByRole('button', { name: 'I’ve saved my codes' }).click();
      await setup.waitFor({ state: 'hidden' });
    } else {
      await page.getByRole('checkbox').check();
      await privacy.click();
      await privacy.waitFor({ state: 'hidden' });
    }
  }
  await page.getByText(/^Welcome back/).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  return page;
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
    // For later chapters' sign-ins, with the codes already used
    fs.writeFileSync(SECRETS, JSON.stringify({ ...(fs.existsSync(SECRETS) ? JSON.parse(fs.readFileSync(SECRETS, 'utf8')) : {}), [`msantos@tu.${DOMAIN}`]: secret }));
    usedCodes.set(`msantos@tu.${DOMAIN}`, used);
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

  // Andrea Villanueva, a student (and the leader of her research group). Nothing is saved: forms are
  // filled in for the picture, then cancelled, so the chapters can run again on the same data.
  async students(browser) {
    const page = await newPage(browser);
    await logIn(page, `andrea@tu.${DOMAIN}`);
    const accept = page.getByRole('button', { name: 'Accept and continue' });
    await accept.or(page.getByRole('heading', { name: 'Community feed' })).first().waitFor();
    if (await accept.isVisible()) {
      await page.getByRole('checkbox').check();
      await accept.click();
    }
    await page.waitForURL(/\/feed/);
    await page.getByText(/^Welcome back/).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const main = page.getByRole('main');
    const heading = (name) => main.getByRole('heading', { name });
    const card = (name) => heading(name).locator('xpath=ancestor::header[1]/..');
    const button = (name, scope = main) => scope.getByRole('button', { name, exact: typeof name === 'string' });
    const dialog = page.getByRole('dialog');

    // Your portfolio
    await page.goto(BASE + '/portfolio');
    await heading('Andrea Villanueva').waitFor();
    await shot(page, 'student-portfolio', [[button('Edit profile'), 'above'], [main.getByRole('link', { name: 'View public page' }), 'above'], [button('Share'), 'above'], button('Edit about')]);
    await shot(page, 'student-portfolio-sections', [
      card('Academic links').getByRole('button', { name: 'Edit', exact: true }), card('Academic background').getByRole('button', { name: 'Add', exact: true }),
      card(/^Honors/).getByRole('button', { name: 'Add', exact: true }), card('Curriculum vitae').getByText('Upload PDF'),
    ], { clip: [card('Academic links'), card('Curriculum vitae')] });
    await button('Edit profile').click();
    await dialog.getByLabel('Titles').waitFor();
    await shot(page, 'student-edit-profile', [
      dialog.getByText('Choose photo'), dialog.getByLabel('Full name'), dialog.getByLabel('Titles'), dialog.getByLabel('Program or position'),
      dialog.getByLabel('Department'), dialog.getByLabel('Short bio'), dialog.getByLabel('Extended bio'), [button('Save', dialog), 'above'],
    ], { clip: dialog });
    await button('Cancel', dialog).click();

    // A new work
    await page.goto(BASE + '/research');
    await heading('My research').waitFor();
    await shot(page, 'student-my-research', [
      button('New entry'), main.getByText('Approved', { exact: true }).first(), main.getByRole('link', { name: 'Open', exact: true }).first(), button('Edit draft'), heading('Reach'),
    ], { tall: true });
    await button('New entry').click();
    await dialog.getByLabel('Title').fill('Rainfall Thresholds for Landslide Warnings in Upland Barangays');
    await dialog.getByLabel('Research adviser').selectOption({ label: 'Dr. Maria Santos' });
    await dialog.getByLabel('Keywords').fill('Disaster Risk Reduction, Landslides');
    await dialog.getByLabel('Abstract').fill('We compare rainfall thresholds from three upland barangays with the landslides recorded there since 2015, to suggest when barangay officials should warn residents.');
    await shot(page, 'student-new-work', [
      dialog.getByLabel('Type'), [dialog.getByLabel('Research adviser'), 'above'], dialog.getByLabel('Title'), dialog.getByLabel('Keywords'), dialog.getByLabel('Abstract'),
      dialog.getByLabel('How we made this (optional)'), dialog.getByLabel('Who can read it once approved'), dialog.getByLabel('Co-authors (optional)'),
    ], { clip: dialog });
    // The form scrolls inside its dialog: its end, with the buttons, is a picture of its own
    await dialog.getByText('Choose PDF').scrollIntoViewIfNeeded();
    await shot(page, 'student-new-work-end', [dialog.getByText('Choose PDF'), [button('Save draft', dialog), 'above'], [button('Submit for adviser review', dialog), 'above']], { clip: dialog });
    await button('Cancel', dialog).click();

    // A draft, and a submitted work's defense stages
    await page.goto(BASE + '/works/8');
    await button('Edit entry').waitFor();
    await shot(page, 'student-draft', [[button('Edit entry'), 'above'], [button('Submit for review'), 'above'], [button('Delete draft'), 'above']]);
    await page.goto(BASE + '/works/4');
    await heading(/^Defense to Discovery/).waitFor();
    await shot(page, 'student-defense-stages', [button('Add stage'), [button('Edit Proposal defense'), 'above'], [button('Remove Proposal defense'), 'right']], { clip: card(/^Defense to Discovery/) });

    // Someone else's work: discussion, reactions, saving, reporting
    await page.goto(BASE + '/works/3');
    await heading('Discussion').waitFor();
    await main.getByLabel('Add to the discussion').fill('Did you try the extract on second-instar larvae too? @Kim');
    await shot(page, 'student-engage', [
      main.getByLabel('Add to the discussion'), button('Comment'), button(/^Insightful/), button('Save to library'), button('Share link'), button('Report'),
    ], { tall: true });
    await main.getByLabel('Add to the discussion').fill('');
    await button('Report').click();
    await dialog.getByText('Plagiarism: someone else’s work').waitFor();
    await shot(page, 'student-report', [dialog.getByText('Plagiarism: someone else’s work'), dialog.getByLabel('Anything an admin should know (optional)'), [button('Send report', dialog), 'above']], { clip: dialog });
    await button('Cancel', dialog).click();

    // The feed, following, the library
    await page.goto(BASE + '/feed');
    await heading('Community feed').waitFor();
    // The type filters scroll sideways ("My library" and "Following" sit at the end), so only "All" is marked
    const readFirst = main.getByRole('link', { name: 'Read the work' }).first();
    await shot(page, 'student-feed', [button('All'), main.getByLabel('Department'), main.getByText('Newest', { exact: true }), [button('Save').first(), 'above'], readFirst],
      { clip: [heading('Community feed'), readFirst] });
    await shot(page, 'student-updates', [button('Mark all read'), card('Updates').getByRole('button').nth(1)], { clip: card('Updates') });
    await page.goto(BASE + '/u/kim');
    await button('Follow Kim Dela Cruz').waitFor();
    await shot(page, 'student-follow', [button('Follow Kim Dela Cruz')]);
    await page.goto(BASE + '/library');
    await heading('Research library').waitFor();
    await shot(page, 'student-library', [main.getByLabel('Search educator research'), main.getByLabel('Year', { exact: true }), main.getByLabel('Department', { exact: true }), main.getByLabel('Keyword', { exact: true }), heading('Browse by department')]);

    // A research group: chat, and handing in a deliverable
    await page.goto(BASE + '/groups/1');
    await heading('Disaster Informatics Lab').waitFor();
    await shot(page, 'student-group', [
      button('Chat'), button('chapter-3-methods'), main.getByRole('textbox', { name: 'Message #general' }), main.getByText('Send a file'), heading(/^Members/), button('Leave group'),
    ]);
    await button(/^Deadlines/).click();
    await button('Chapter 3 (Methodology) draft due').click();
    const panel = card('Chapter 3 (Methodology) draft due');
    await panel.getByRole('button', { name: 'Hand in again' }).waitFor();
    await shot(page, 'student-deliverable', [panel.getByRole('link', { name: 'Villanueva Chapter 3 draft.pdf', exact: true }), panel.getByText('Choose file'), panel.getByLabel('Note to your reviewers (optional)'), panel.getByRole('button', { name: 'Hand in again' })],
      { clip: panel });

    // Messages
    await page.goto(BASE + '/messages');
    await main.getByRole('link', { name: /Kim Dela Cruz/ }).first().click();
    const box = main.getByRole('textbox', { name: 'Message Kim Dela Cruz' });
    await box.waitFor();
    const lastMessage = main.getByText(/Bringing two kits/).last();
    await lastMessage.hover();
    await shot(page, 'student-messages', [
      main.getByLabel('Find a chat by person, channel or group'), [button('New message'), 'below'], [button('React').filter({ visible: true }).last(), 'above'],
      [button('Reply in thread').filter({ visible: true }).last(), 'above'], [main.getByText('Send a file'), 'above'], [box, 'inside'], [button('Send'), 'above'],
    ]);

    // Events, opportunities and announcements
    await page.goto(BASE + '/events');
    await heading('Academic events').waitFor();
    await shot(page, 'student-events', [button('Research colloquium'), main.getByRole('link', { name: 'Thesis Defense Week: College of Computing' }), button('Register').first(), button('Registered').first()]);
    await page.goto(BASE + '/feed');
    await button('Opportunities').click();
    await button('Apply').first().click();
    await dialog.getByLabel(/^Message to/).fill('I have built two LoRa sensor nodes for my thesis and can help with field tests on weekends.');
    await shot(page, 'student-apply', [dialog.getByLabel(/^Message to/), [button('Send application', dialog), 'above']], { clip: dialog });
    await button('Cancel', dialog).click();
    await page.goto(BASE + '/announcements');
    await heading('Announcements').waitFor();
    await shot(page, 'student-announcements', [button(/^All/), button('My department'), heading(/^Lab meeting moved/)]);
    await page.context().close();

    // Paolo Reyes, whose essay his adviser sent back for revision
    const paolo = await newPage(browser);
    await logIn(paolo, `paolo@tu.${DOMAIN}`);
    await paolo.getByRole('button', { name: 'Accept and continue' }).waitFor();
    await paolo.getByRole('checkbox').check();
    await paolo.getByRole('button', { name: 'Accept and continue' }).click();
    await paolo.waitForURL(/\/feed/);
    await paolo.goto(BASE + '/works/5');
    const pmain = paolo.getByRole('main');
    await pmain.getByRole('button', { name: 'Revise & resubmit' }).waitFor();
    await shot(paolo, 'student-revision', [
      pmain.getByRole('heading', { name: /^Review history/ }), pmain.getByText('Return to the salt beds sooner after the opening.').locator('xpath=ancestor::label[1]'), pmain.getByLabel('Add a comment'),
      [pmain.getByRole('button', { name: 'Revise & resubmit' }), 'above'],
    ], { tall: true });
    await paolo.context().close();
  },

  // Dr. Maria Santos, a verified educator who advises the Disaster Informatics Lab. As in the
  // students' chapter, forms are filled in for the picture and cancelled; no decision is made.
  async educators(browser) {
    const page = await signIn(browser, `msantos@tu.${DOMAIN}`);
    const main = page.getByRole('main');
    const heading = (name) => main.getByRole('heading', { name });
    const card = (name) => heading(name).locator('xpath=ancestor::header[1]/..');
    const button = (name, scope = main) => scope.getByRole('button', { name, exact: typeof name === 'string' });
    const dialog = page.getByRole('dialog');

    // The review board, and a decision on a submitted work
    await page.goto(BASE + '/review');
    await heading('Awaiting review').waitFor();
    await shot(page, 'educator-review-board', [heading('Awaiting review'), heading('Under review'), heading('Needs revision'), heading(/^Approved/)]);
    await page.goto(BASE + '/works/4');
    await heading('Your decision').waitFor();
    await shot(page, 'educator-decision', [[button('Start review'), 'above'], [button('Approve & sign off'), 'above'], [button('Return with comments'), 'below'], [button('Reject'), 'below']], { clip: card('Your decision') });
    await button('Return with comments').click();
    await dialog.getByLabel('Comments for the author').fill('A clear question and a good data set. Before the colloquium, explain how you handled students who transferred campuses.');
    await dialog.getByLabel(/^Revision checklist/).fill('Describe how transferees are counted\nAdd the confusion matrix for week 5');
    await shot(page, 'educator-return', [dialog.getByLabel('Comments for the author'), dialog.getByLabel(/^Revision checklist/), [button('Send to the author', dialog), 'above']], { clip: dialog });
    await button('Cancel', dialog).click();

    // Your own research
    await page.goto(BASE + '/publications/new');
    await heading('New research').waitFor();
    await main.getByLabel('Title').fill('Sensor Placement for Barangay Flood Alerts');
    await shot(page, 'educator-publication', [
      main.getByLabel('Title'), main.getByLabel('Abstract'), main.getByLabel('Keywords'), main.getByLabel('How the research was done'), main.getByText('Choose PDF'),
      heading('Visibility'), main.getByLabel('Add a co-author'), button('Save draft'),
    ], { tall: true });

    // Research groups: a new one, and running one
    await page.goto(BASE + '/groups');
    await button('New group').click();
    await dialog.getByLabel('Group name').fill('Coastal Ecology Lab');
    await shot(page, 'educator-new-group', [dialog.getByLabel('Group name'), dialog.getByLabel(/^What the group works on/), [button('Create group', dialog), 'above']], { clip: dialog });
    await button('Cancel', dialog).click();
    await page.goto(BASE + '/groups/1');
    await heading('Disaster Informatics Lab').waitFor();
    await shot(page, 'educator-group', [
      main.getByLabel('Add a member'), main.getByLabel('Role for Andrea Villanueva'), [button('Remove Andrea Villanueva'), 'right'], main.getByLabel('New channel name'), button('Delete group'),
    ], { tall: true });
    await button(/^Deadlines/).click();
    const deadlines = card(/^Deadlines and deliverables/);
    await deadlines.getByLabel('New deadline').fill('Chapter 4 (Results) draft');
    await deadlines.getByLabel('Students hand in').selectOption({ index: 1 });
    await shot(page, 'educator-deadline', [deadlines.getByLabel('New deadline'), [deadlines.getByLabel('Due'), 'above'], deadlines.getByLabel('Students hand in'), deadlines.getByRole('button', { name: 'Add', exact: true })],
      { clip: deadlines });
    await button('Chapter 3 (Methodology) draft due').click();
    const panel = card('Chapter 3 (Methodology) draft due');
    await panel.getByLabel('New feedback').fill('Much better. Accepting this version.');
    await shot(page, 'educator-deliverable', [
      panel.getByRole('link', { name: 'Villanueva Chapter 3 draft.pdf', exact: true }), panel.getByLabel('New feedback'), panel.getByRole('button', { name: 'Accept', exact: true }),
      [panel.getByRole('button', { name: 'Ask for a revision' }), 'right'],
    ], { clip: panel });

    // Opportunities, events and their ads
    await page.goto(BASE + '/post');
    await heading('Post an opportunity').waitFor();
    await main.getByLabel('Title').fill('Research Assistants: Coastal Flood Mapping');
    await shot(page, 'educator-opportunity', [
      main.getByLabel('Type'), main.getByLabel('Title'), main.getByLabel('Description'), main.getByLabel('Application deadline'), [main.getByLabel('Slots (optional)'), 'above'],
      main.getByLabel('Who can see it'), button('Publish to feed'), heading(/^Your postings/),
    ], { tall: true });
    await page.goto(BASE + '/events');
    await button('Propose an event').click();
    await dialog.getByLabel('Event title').fill('Colloquium: Mapping Flood Risk with Barangays');
    await shot(page, 'educator-event', [
      dialog.getByLabel('Category'), dialog.getByLabel('Event title'), dialog.getByLabel('Date and time'), [dialog.getByLabel('Seats (optional)'), 'above'], dialog.getByLabel('Venue'),
      dialog.getByLabel('Who can see it'), dialog.getByLabel('Description'), [button('Submit for approval', dialog), 'above'],
    ], { clip: dialog });
    await button('Cancel', dialog).click();
    await page.goto(BASE + '/events/1');
    await heading('Promote in the feed').waitFor();
    await shot(page, 'educator-event-page', [
      heading(/^Attendees/), main.getByLabel('Headline'), main.getByLabel('Show from'), [main.getByLabel('Until'), 'above'], main.getByText('Choose file'), button('Request ad slot'), [button('Cancel event'), 'right'],
    ], { tall: true });

    // Announcements
    await page.goto(BASE + '/announcements');
    await button('New announcement').click();
    const composer = card('New announcement');
    await composer.getByLabel('Title').fill('Fieldwork in Barangay Tabuc Suba this Saturday');
    await shot(page, 'educator-announcement', [
      composer.getByLabel('Audience'), composer.getByLabel('Title'), composer.getByRole('toolbar', { name: 'Formatting' }), composer.getByText('Attach files'),
      composer.getByText('Pin to the top of the feed'), composer.getByRole('button', { name: 'Post announcement' }),
    ], { clip: composer });
    await composer.getByRole('button', { name: 'Cancel' }).click();
    const posted = heading(/^Lab meeting moved/).locator('xpath=ancestor::article[1]');
    await shot(page, 'educator-announcement-manage', [[posted.getByRole('button', { name: /^Seen by/ }), 'above'], [posted.getByRole('button', { name: /^(Pin|Unpin)$/ }), 'above'], [posted.getByRole('button', { name: 'Edit' }), 'above'], [posted.getByRole('button', { name: 'Delete' }), 'above']],
      { clip: posted });
    await page.context().close();
  },

  // Lea Mercado (Tuklas University's admin, also a super-admin) and Jose Ramos (Bayan State College's admin)
  async admins(browser) {
    // A report for the queue: Paolo reports a work
    const paolo = await signIn(browser, `paolo@tu.${DOMAIN}`);
    await paolo.goto(BASE + '/works/3');
    await paolo.getByRole('main').getByRole('button', { name: 'Report', exact: true }).click();
    await paolo.getByRole('dialog').getByText('Something else').click();
    await paolo.getByRole('dialog').getByLabel('Anything an admin should know (optional)').fill('The abstract repeats a paragraph from a 2019 thesis I read in the library.');
    await paolo.getByRole('dialog').getByRole('button', { name: 'Send report' }).click();
    await paolo.getByRole('dialog').waitFor({ state: 'hidden' });
    await paolo.context().close();

    const page = await signIn(browser, `admin@tu.${DOMAIN}`);
    const main = page.getByRole('main');
    const heading = (name) => main.getByRole('heading', { name });
    const card = (name) => heading(name).locator('xpath=ancestor::header[1]/..');
    const button = (name, scope = main) => scope.getByRole('button', { name, exact: typeof name === 'string' });
    const tab = (name) => main.getByRole('button', { name: new RegExp('^' + name) }).first();
    const dialog = page.getByRole('dialog');
    await page.goto(BASE + '/admin');
    await heading('Approval queue').waitFor();

    await shot(page, 'admin-queue', [tab('Student research'), main.getByRole('link', { name: 'Review', exact: true }).first(), [button('Panel approve').first(), 'above'], [button('Reject').first(), 'right']],
      { clip: [tab('Student research'), card(/^Student research/)] });
    await tab('Educators').click();
    await heading('Educators to verify').waitFor();
    await shot(page, 'admin-educators', [
      button('Verify').first(), [button('Make student').first(), 'above'], main.locator('label', { hasText: 'Publish research' }).first(), main.locator('label', { hasText: 'Moderate groups' }).first(),
      main.locator('label', { hasText: 'Post announcements' }).first(), heading('Recent educator activity'),
    ], { tall: true });
    for (const [name, title, approve] of [['Events', 'Events awaiting approval', 'Approve event'], ['Ad slots', 'Academic ad slots', 'Approve ad']]) {
      await tab(name).click();
      await heading(title).waitFor();
      await shot(page, 'admin-' + name.toLowerCase().replace(' ', '-'), [button(approve).first(), [button('Reject').first(), 'right']], { clip: card(title) });
    }
    await tab('Honors').click();
    await heading(/^Honors & grants to verify/).waitFor();
    await shot(page, 'admin-honors', [button('Verify').first(), [button('Decline').first(), 'right']], { clip: card(/^Honors & grants to verify/) });
    await tab('Reports').click();
    await button('Dismiss').waitFor();
    await shot(page, 'admin-reports', [button(/^Waiting/), [button('Handled'), 'right'], button('Dismiss'), [button(/^Warn /), 'below'], [button('Remove'), 'right']],
      { clip: [tab('Student research'), button('Remove'), card(/^Work/)] });
    await tab('Users & roles').click();
    await heading('Users & roles').waitFor();
    await shot(page, 'admin-users', [
      main.getByLabel('Search'), main.getByLabel('Role', { exact: true }), main.getByLabel('Role for Dr. Ana Lim'), [main.getByLabel('School for Dr. Ana Lim'), 'below'], [button('Unverify').first(), 'right'],
    ], { clip: [heading('Users & roles'), main.getByLabel('Role for Dr. Maria Santos')] });
    await tab('Moderate posts').click();
    await heading('Published works').waitFor();
    await shot(page, 'admin-moderate', [heading('Published works'), button('Remove').first(), heading('Opportunities'), heading('Recent comments')], { tall: true });

    // Super-admins: every school
    await shot(page, 'super-school-filter', [main.getByLabel('School').first()], { clip: [heading('Approval queue'), tab('Moderate posts')] });
    await tab('Users & roles').click();
    await shot(page, 'super-make-super', [button('Make super-admin').first()], { clip: card('Users & roles') });
    await tab('Schools').click();
    await heading('Schools on Tuklas').waitFor();
    await shot(page, 'super-schools', [button('Add a school'), button('Edit').first()], { clip: card('Schools on Tuklas') });
    await button('Add a school').click();
    await dialog.getByLabel('Name', { exact: true }).fill('University of the Immaculate Conception');
    await dialog.getByLabel('Short name (optional)').fill('UIC');
    await dialog.getByLabel('School email domains').fill('uic.edu.ph');
    await shot(page, 'super-add-school', [dialog.getByLabel('Name', { exact: true }), dialog.getByLabel('Short name (optional)'), dialog.getByLabel('School email domains'), [button('Add school', dialog), 'above']], { clip: dialog });
    await button('Cancel', dialog).click();
    await page.context().close();

    // A school's own admin: confirming sign-ups and the school's departments
    const school = await signIn(browser, `jramos@bsc.${DOMAIN}`);
    const smain = school.getByRole('main');
    await school.goto(BASE + '/admin');
    await smain.getByRole('button', { name: /^Schools/ }).first().click();
    await smain.getByRole('heading', { name: 'People to confirm' }).waitFor();
    const departments = smain.getByRole('heading', { name: 'Departments' }).locator('xpath=ancestor::header[1]/..');
    await shot(school, 'admin-schools', [
      smain.getByRole('button', { name: 'Confirm', exact: true }), departments.getByRole('button', { name: 'Add a department' }), departments.getByRole('button', { name: 'Rename' }).first(),
      [departments.getByRole('button', { name: 'Remove' }).first(), 'right'],
    ], { clip: [smain.getByRole('heading', { name: 'People to confirm' }), departments] });
    await school.context().close();
  },
};

// Also used as a module, to look around the app with the same helpers
module.exports = { BASE, DOMAIN, signIn, newPage };

if (require.main === module) (async () => {
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
