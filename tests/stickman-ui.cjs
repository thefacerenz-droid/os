const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.route('**/api/billing/status', r => r.fulfill({ json: { active: true } }));
    await page.goto('http://localhost:3019', { waitUntil: 'domcontentloaded' });
    const library = await page.evaluate(() => ({ games: gameCatalog.map(g => g.id), local: Object.keys(localGameMeta) }));
    assert.deepEqual(library, { games: ['stickmanhook', 'mudline'], local: [] });
    await page.evaluate(() => { window.velBillingActive = true; completeCleverEntryGate(); openWebApp('stickmanhook'); });
    assert.equal(await page.locator('#webFrame').getAttribute('src'), 'https://stickmanhookgame.org/stickman-hook.embed');
    await page.waitForTimeout(15000);
    const provider = page.frames().find(frame => frame.url().startsWith('https://ozgames.io/'));
    if (provider) {
      await provider.getByText('Play Now', { exact: true }).click({ timeout: 10000 });
      await page.waitForTimeout(15000);
    }
    console.log(JSON.stringify({ frames: page.frames().map(f => f.url()), bounds: await page.locator('#webFrame').boundingBox(), backVisible: await page.locator('#showDesktopButton').isVisible() }));
    await page.screenshot({ path: path.join(os.tmpdir(), 'veloi-stickman-desktop.png'), timeout: 10000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(os.tmpdir(), 'veloi-stickman-mobile.png'), timeout: 10000 });
    await page.locator('#showDesktopButton').click();
    console.log('Library reset, embed launch and back control checked.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
