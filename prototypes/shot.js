const { chromium } = require('/home/dev/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'shots');
fs.mkdirSync(outDir, { recursive: true });

const combos = [
  { v: 1, w: 1280, s: 'setup' },
  { v: 1, w: 390, s: 'listening' },
  { v: 2, w: 1280, s: 'ready' },
  { v: 2, w: 390, s: 'listening' },
  { v: 3, w: 1280, s: 'playback' },
  { v: 3, w: 390, s: 'ready' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const c of combos) {
    const url = 'file://' + path.join(__dirname, 'responsive-composition.html') +
      `?v=${c.v}&w=${c.w}&s=${c.s}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(200);
    const frame = page.frames()[1] || page.mainFrame();
    if (c.s !== 'setup') {
      await frame.click('#startBtn');               // setup -> ready
      const clicks = { ready: 0, listening: 1, translating: 2, playback: 3 }[c.s] || 0;
      for (let i = 0; i < clicks; i++) {
        await frame.click('#micBtn');               // ready -> listening -> translating -> playback
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(100);
    }
    const file = path.join(outDir, `v${c.v}_${c.w}_${c.s}.png`);
    await page.screenshot({ path: file });
    console.log('shot', file);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
