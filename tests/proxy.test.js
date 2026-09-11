const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { settings, publicIp, requestThroughProxy } = require('../lib/proxyTransport');
const { documentView } = require('../lib/api/configuredProxy');
const sessions = require('../lib/proxySessions');
test('settings and public address validation', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1', '192.0.2.1']) assert.equal(publicIp(address), false, address);
  assert.equal(publicIp('1.1.1.1'), true);
  assert.throws(() => settings({ host: 'https://proxy.test', port: 80, protocol: 'http' }));
  assert.throws(() => settings({ host: 'proxy.test', port: 65536, protocol: 'http' }));
  assert.throws(() => settings({ host: 'proxy.test', port: 80, protocol: 'socks' }));
});
test('reader strips active content and respects embedding policy', () => {
  const response = { url: 'https://example.com/path/', headers: { 'content-type': 'text/html' }, body: '<script>steal()</script><img src="https://tracker.test"><form><input></form><a href="../next" onclick="steal()">Next</a>' };
  const html = documentView(response);
  assert.ok(html.includes('https://example.com/next'));
  assert.ok(!html.includes('steal()'));
  assert.ok(!html.includes('tracker.test'));
  assert.ok(!html.includes('<form'));
  assert.throws(() => documentView({ ...response, headers: { ...response.headers, 'x-frame-options': 'DENY' } }), /restricts embedded/);
});
test('credentials are encrypted in storage, isolated by cookie and deleted on disconnect', async () => {
  process.env.PROXY_CREDENTIAL_SECRET = 'test-secret-with-more-than-32-characters';
  process.env.UPSTASH_REDIS_REST_URL = 'https://storage.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
  const original = global.fetch;
  const records = new Map();
  global.fetch = async (_url, options) => {
    const [op, key, value] = JSON.parse(options.body);
    let result;
    if (op === 'SET') { assert.ok(!value.includes('secret-password')); records.set(key, value); }
    if (op === 'GET') result = records.get(key);
    if (op === 'DEL') records.delete(key);
    return { ok: true, json: async () => ({ result }) };
  };
  try {
    let cookie;
    const res = { setHeader: (_key, value) => cookie = value.split(';')[0] };
    await sessions.save({ headers: {} }, res, { password: 'secret-password' });
    assert.equal((await sessions.get({ headers: { cookie } })).password, 'secret-password');
    assert.equal(await sessions.get({ headers: {} }), null);
    await sessions.remove({ headers: { cookie } }, res);
    assert.equal(records.size, 0);
  } finally { global.fetch = original; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; }
});
test('HTTP forwarding uses the configured proxy and HTTPS issues CONNECT with authentication', async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers['proxy-authorization'] });
    if (req.url.includes('/private')) { res.writeHead(302, { Location: 'http://127.0.0.1/' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('proxied');
  });
  server.on('connect', (req, socket) => { seen.push({ url: req.url, auth: req.headers['proxy-authorization'] }); socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\n\r\n'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const originalConnect = net.connect;
  // Redirect only the fixture proxy socket; production address checks stay enabled.
  net.connect = function(options, ...args) {
    if (options?.host === '8.8.8.8') return originalConnect.call(net, { ...options, host: '127.0.0.1', port: server.address().port }, ...args);
    throw new Error('Unexpected direct network connection');
  };
  try {
    const config = { host: '8.8.8.8', port: 8080, protocol: 'http', username: 'user', password: 'pass' };
    const result = await requestThroughProxy(config, 'http://1.1.1.1/page');
    assert.equal(result.body, 'proxied');
    assert.equal(seen[0].url, 'http://1.1.1.1/page');
    assert.equal(seen[0].auth, 'Basic dXNlcjpwYXNz');
    await assert.rejects(requestThroughProxy(config, 'https://1.1.1.1/'), /authentication failed/);
    assert.equal(seen[1].url, '1.1.1.1:443');
    await assert.rejects(requestThroughProxy(config, 'http://1.1.1.1/private'), /private|reserved/i);
  } finally { net.connect = originalConnect; await new Promise(resolve => server.close(resolve)); }
});
