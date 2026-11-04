// Renders every .mmd (Mermaid) diagram in this folder to a .png next to it, for docs/srs/build.py.
// Needs Playwright (with its Chromium) and Mermaid installed outside the repo:
//
//   npm install --prefix <tools folder> playwright@1.56.1 mermaid@11.4.1
//   NODE_PATH=<tools folder>/node_modules node docs/srs/diagrams/render.cjs [name.mmd ...]
//
// Each diagram renders black on white in Arial, at twice its size, so it prints sharply in Word.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const here = __dirname;
const mermaidJs = require.resolve('mermaid/dist/mermaid.min.js');

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(here).filter((f) => f.endsWith('.mmd'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="out"></div></body></html>');
  await page.addScriptTag({ path: mermaidJs });
  await page.evaluate(() => {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: 'Arial', fontSize: '15px', primaryColor: '#ffffff', primaryBorderColor: '#000000',
        primaryTextColor: '#000000', lineColor: '#000000', secondaryColor: '#f2f2f2', tertiaryColor: '#ffffff',
        clusterBkg: '#f7f7f7', clusterBorder: '#555555',
      },
      flowchart: { htmlLabels: true, curve: 'basis', padding: 12 },
    });
  });
  for (const name of names) {
    const source = fs.readFileSync(path.join(here, name), 'utf8');
    await page.evaluate(async (src) => {
      const { svg } = await window.mermaid.render('d' + Date.now(), src);
      document.getElementById('out').innerHTML = svg;
    }, source);
    const box = await page.locator('#out svg').boundingBox();
    await page.setViewportSize({ width: Math.ceil(box.width) + 20, height: Math.ceil(box.height) + 20 });
    const png = path.join(here, name.replace(/\.mmd$/, '.png'));
    await page.locator('#out svg').screenshot({ path: png });
    console.log('Rendered ' + path.basename(png));
  }
  await browser.close();
})();
