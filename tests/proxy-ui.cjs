const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1366, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/api/billing/status', route => route.fulfill({ json: { active: true } }));
      await page.route('**/api/proxy', route => route.fulfill({ status: route.request().postDataJSON().action === 'connect' ? 502 : 200, json: route.request().postDataJSON().action === 'connect' ? { message: 'Proxy authentication failed. Check your username and password.' } : { connected: false } }));
      await page.goto('http://localhost:3018');
      await page.evaluate(() => { window.velBillingActive = true; completeCleverEntryGate(); openWebApp('browser'); });
      await page.locator('#proxySettingsOpen').click();
      await page.locator('.proxy-settings [name=host]').fill('proxy.example.com');
      await page.locator('.proxy-settings [name=username]').fill('test');
      await page.locator('.proxy-settings [name=password]').fill('test-password');
      await page.locator('.proxy-settings [type=submit]').click();
      await page.locator('.proxy-settings [role=status]').filter({ hasText: 'authentication failed' }).waitFor();
      assert.equal(await page.locator('.proxy-settings [name=password]').inputValue(), '');
      const bounds = await page.locator('.proxy-settings').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      const output = path.join(os.tmpdir(), `veloi-proxy-${width}.png`);
      await page.screenshot({ path: output });
      console.log(`Proxy UI checked at ${width}px: ${output}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
