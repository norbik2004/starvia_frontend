import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4200/', { waitUntil: 'networkidle' });
await page.waitForSelector('app-hero-constellation canvas');
await page.waitForTimeout(3000);

const stats = await page.evaluate(() => {
  const canvas = document.querySelector('app-hero-constellation canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let nonClear = 0;
  let sumA = 0;
  let blueish = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 12) {
      nonClear++;
      sumA += a;
      if (data[i + 2] > data[i] + 10) blueish++;
    }
  }
  const total = width * height;
  return {
    width,
    height,
    cssW: canvas.clientWidth,
    cssH: canvas.clientHeight,
    nonClearRatio: nonClear / total,
    avgAlpha: nonClear ? sumA / nonClear / 255 : 0,
    blueishRatio: nonClear ? blueish / nonClear : 0,
  };
});

writeFileSync('tmp-screens/canvas-stats.json', JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));

const hero = page.locator('.hero').first();
await hero.screenshot({ path: 'tmp-screens/hero-section.png' });
await page.locator('.hero-constellation').first().screenshot({ path: 'tmp-screens/illo-crop.png' });
await page.screenshot({ path: 'tmp-screens/hero-v5.png' });

await browser.close();
