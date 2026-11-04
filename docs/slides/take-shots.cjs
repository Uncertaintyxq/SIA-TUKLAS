/**
 * Clean screenshots (no markers) for the slide deck, saved as docs/slides/assets/shot-*.png.
 *
 * Uses the user manual's screenshot setup: the app running locally on the showcase data, with
 * MANUAL_PASSWORD set to the showcase password (see docs/manual/screenshots/take.cjs). Then:
 *     node docs/slides/take-shots.cjs
 * Set PLAYWRIGHT_CHROMIUM to a Chromium executable if Playwright's own browser isn't installed.
 */
const path = require('path');
const { chromium } = require('playwright');
const { BASE, DOMAIN, signIn, newPage } = require('../manual/screenshots/take.cjs');

const OUT = path.join(__dirname, 'assets');

async function snap(page, url, name, heading) {
  await page.goto(BASE + url);
  if (heading) await page.getByRole('heading', { name: heading, exact: true }).first().waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `shot-${name}.png`) });
  console.log('saved', name);
}

(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  await snap(await newPage(browser), '/works/1', 'work', null);

  const andrea = await signIn(browser, `andrea@tu.${DOMAIN}`);
  await snap(andrea, '/feed', 'feed', 'Community feed');

  const phone = await signIn(browser, `kim@tu.${DOMAIN}`, { width: 390, height: 844 });
  await snap(phone, '/feed', 'phone-feed', 'Community feed');

  const santos = await signIn(browser, `msantos@tu.${DOMAIN}`);
  await snap(santos, '/review', 'review-board', 'Review board');

  const lea = await signIn(browser, `admin@tu.${DOMAIN}`);
  await snap(lea, '/admin', 'admin', null);
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
