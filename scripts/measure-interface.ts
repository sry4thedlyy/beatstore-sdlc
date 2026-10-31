import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Run against the built, running app; this samples a local browser, not a Lighthouse score.
const baseUrl = process.env.MEASURE_URL || 'http://127.0.0.1:3000';
const width = Number(process.env.MEASURE_WIDTH || 1280);
const featured = process.env.MEASURE_FEATURED === '1';
assert([360, 1280].includes(width), 'MEASURE_WIDTH must be 360 or 1280');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(baseUrl);
  await page.locator('.product-card').last().waitFor();
  if (featured) await page.getByRole('button', { name: 'Слушать главный трек Night Drive' }).click();
  else await page.locator('.product-card').first().getByRole('button').click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const before = await session.send('Performance.getMetrics');
  // A static browser expression avoids tsx's function-name helper in serialized callbacks.
  const frames = await page.evaluate<number[]>(`new Promise(resolve => {
    const frames = [];
    let previous = performance.now();
    const start = previous;
    function frame(now) {
      frames.push(now - previous);
      previous = now;
      if (now - start < 3000) requestAnimationFrame(frame);
      else resolve(frames);
    }
    requestAnimationFrame(frame);
  })`);
  const after = await session.send('Performance.getMetrics');
  const metric = (set: typeof before, name: string) => set.metrics.find(item => item.name === name)?.value || 0;
  const sorted = frames.slice(2).sort((a, b) => a - b);
  assert(sorted.length > 0);
  const result = {
    browser: browser.version(), viewport: `${width}x900`, cpuThrottle: 4, scenario: featured ? 'featured' : 'catalog',
    frames: sorted.length,
    frameMedianMs: sorted[Math.floor(sorted.length * .5)],
    frameP95Ms: sorted[Math.floor(sorted.length * .95)],
    taskDurationMs: (metric(after, 'TaskDuration') - metric(before, 'TaskDuration')) * 1000,
    scriptDurationMs: (metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) * 1000,
    layoutCount: metric(after, 'LayoutCount') - metric(before, 'LayoutCount'),
    jsHeapMb: metric(after, 'JSHeapUsedSize') / 1024 / 1024,
  };
  const output = path.resolve('output/design');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, `measurement-${width}${featured ? '-featured' : ''}.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
