import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4200/', { waitUntil: 'networkidle' });
await page.waitForSelector('app-hero-constellation canvas');
await page.waitForTimeout(2500);

const hero = page.locator('.hero').first();
await hero.screenshot({ path: 'tmp-screens/hero-section.png' });

const illo = page.locator('.hero-constellation').first();
await illo.screenshot({ path: 'tmp-screens/illo-crop.png' });

const box = await hero.boundingBox();
if (box) {
  await page.screenshot({
    path: 'tmp-screens/hero-right.png',
    clip: {
      x: box.x + box.width * 0.4,
      y: Math.max(0, box.y),
      width: box.width * 0.6,
      height: Math.min(box.height, 820),
    },
  });
}

await browser.close();
