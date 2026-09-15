const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('screen helper validates input and handles structured answers without saving screenshots', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'veloi-helper-'));
  for (const key of ['VERCEL', 'REDIS_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'APP_BASE_URL', 'OPENAI_API_KEY']) delete process.env[key];
  process.env.TEST_HELPER_LIMIT_FILE = path.join(directory, 'limits.json');
  const handler = require('../lib/api/test-helper');
  const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const nativeFetch = global.fetch; let upstream = 0, mode = 'ok';
  const fixture = { questions: [{ number: '4', question: 'What is 2 + 2?', answer: 'B. 4', explanation: 'Two plus two equals four.', uncertain: false }], note: '' };
  global.fetch = async (url, options) => {
    if (url !== 'https://api.openai.com/v1/responses') return nativeFetch(url, options);
    upstream++;
    const request = JSON.parse(options.body); assert.equal(request.store, false); assert.equal(request.text.format.type, 'json_schema'); assert.equal(request.input[0].content[1].type, 'input_image');
    if (mode === 'invalid') return new Response(JSON.stringify({ output_text: 'invalid' }));
    if (mode === 'rate') return new Response('{}', { status: 429 });
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(fixture) }] }] }));
  };
  const post = (data, headers = {}) => nativeFetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
  const image = 'data:image/jpeg;base64,' + Buffer.from([255,216,255,224,0,0,255,217]).toString('base64');
  try {
    assert.equal((await (await nativeFetch(base)).json()).configured, false);
    assert.equal((await post({})).status, 503);
    process.env.OPENAI_API_KEY = 'test-not-a-real-key';
    assert.equal((await post({ image, consent: false })).status, 400);
    assert.equal((await post({ image: 'https://external.invalid/image.png', consent: true })).status, 400);
    assert.equal((await post({ image: 'data:image/jpeg;base64,YmFk', consent: true })).status, 400);
    assert.equal((await post({ image, consent: true }, { origin: 'https://external.invalid' })).status, 403);
    assert.equal(upstream, 0);
    assert.deepEqual(await (await post({ image, consent: true })).json(), fixture);
    mode = 'invalid'; assert.equal((await post({ image, consent: true })).status, 502);
    mode = 'rate'; assert.equal((await post({ image, consent: true })).status, 429);
    const stored = await fs.readFile(process.env.TEST_HELPER_LIMIT_FILE, 'utf8'); assert.ok(!stored.includes('image')); assert.ok(!stored.includes('question'));
  } finally {
    global.fetch = nativeFetch; server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'veloi-helper-'));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
