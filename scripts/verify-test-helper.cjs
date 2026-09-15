const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const secret = crypto.randomBytes(32).toString('hex'); const base = 'http://localhost:3023';
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: '3023', APP_BASE_URL: base, PAYWALL_SESSION_SECRET: secret }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => reject(new Error(`Server exited ${code}`))); });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const value = Buffer.from(JSON.stringify({ expires: Date.now() + 3600000 })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(value).digest('base64url');
    await context.addCookies([{ name: 'vel_pass', value: `${value}.${signature}`, url: base, httpOnly: true }]);
    const page = await context.newPage(); const errors = []; let requests = 0, delay = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.captureCalls = 0;
      navigator.mediaDevices.getDisplayMedia = async () => {
        window.captureCalls++; const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 600;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1000, 600); ctx.fillStyle = 'black'; ctx.font = '30px sans-serif'; ctx.fillText('4. What is 2 + 2?', 50, 90); ctx.fillText('A. 3    B. 4    C. 5', 50, 160);
        const stream = canvas.captureStream(2); window.testStream = stream; return stream;
      };
    });
    await page.route('**/api/test-helper', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { configured: true } });
      requests++; const body = route.request().postDataJSON(); assert.equal(body.consent, true); assert.match(body.image, /^data:image\/jpeg;base64,/);
      if (delay) await new Promise(resolve => setTimeout(resolve, 400));
      await route.fulfill({ json: { questions: [{ number: '4', question: 'What is 2 + 2?', answer: 'B. 4', explanation: 'Two plus two equals four.', uncertain: false }], note: '' } }).catch(() => {});
    });
    await page.goto(base + '/test-helper/');
    await page.getByRole('button', { name: 'Start Testing', exact: true }).click();
    assert.equal(await page.evaluate(() => captureCalls), 0);
    await page.locator('#consent').check(); await page.getByRole('button', { name: 'Start Testing', exact: true }).click();
    await page.getByText('B. 4', { exact: true }).waitFor(); assert.equal(requests, 1);
    await page.screenshot({ path: path.join(__dirname, '../artifacts/test-helper-desktop.png') });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    assert.equal(await page.evaluate(() => testStream.getTracks().every(track => track.readyState === 'ended')), true);
    await page.getByRole('button', { name: 'Clear answers' }).click();
    delay = true; await page.getByRole('button', { name: 'Start Testing', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#state').textContent === 'Analyzing');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.waitForTimeout(600); assert.equal(await page.locator('.answer').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 }); delay = false;
    await page.getByRole('button', { name: 'Start Testing', exact: true }).click(); await page.getByText('B. 4', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(__dirname, '../artifacts/test-helper-mobile.png'), fullPage: true });
    await page.locator('#consent').uncheck(); assert.equal(await page.evaluate(() => testStream.getTracks().every(track => track.readyState === 'ended')), true);
    const removed = await context.request.get(base + '/shorts/'); assert.equal(removed.status(), 404);
    const removedApi = await context.request.get(base + '/api/tiktok/status'); assert.equal(removedApi.status(), 410);
    await page.goto(base + '/'); await page.waitForFunction(() => typeof utilityApps !== 'undefined');
    assert.equal(await page.evaluate(() => Boolean(utilityApps.testhelper) && !utilityApps.media), true);
    assert.equal(await page.evaluate(() => installedApps.includes('panel:testhelper')), true);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ui: 'desktop and mobile passed', capture: 'simulated stream passed', consentAndStop: 'passed', cancelledResponse: 'ignored', numberedAnswers: 'passed with mocked AI', removal: 'passed', runtimeErrors: errors }, null, 2));
  } finally { await browser?.close(); child.kill(); await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
