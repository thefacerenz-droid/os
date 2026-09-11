const crypto = require('node:crypto');
const { fail } = require('./proxyTransport');
const memory = new Map();
const ttl = 3600;
function encryptionKey() {
  const secret = process.env.PROXY_CREDENTIAL_SECRET || process.env.PAYWALL_SESSION_SECRET;
  if (!secret || secret.length < 32) throw fail('Proxy storage needs PROXY_CREDENTIAL_SECRET (at least 32 characters) on the server.', 503);
  return crypto.createHash('sha256').update(secret).digest();
}
async function command(args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.VERCEL) throw fail('Proxy sessions need the Upstash REST URL and token configured on the server.', 503);
    const [op, key, value] = args;
    for (const [id, item] of memory) if (item.expires < Date.now()) memory.delete(id);
    if (op === 'SET') { memory.set(key, { value, expires: Date.now() + ttl * 1000 }); return; }
    if (op === 'DEL') return memory.delete(key);
    return memory.get(key)?.value;
  }
  try {
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error();
    return data.result;
  } catch { throw fail('Proxy session storage is unavailable. Try again shortly.', 503); }
}
function sessionId(req) {
  const id = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('vel_proxy='))?.slice(10);
  return /^[a-f0-9]{64}$/.test(id || '') ? id : null;
}
async function get(req) {
  const id = sessionId(req);
  if (!id) return null;
  const raw = await command(['GET', `veloi:proxy:${id}`]);
  if (!raw) return null;
  try {
    const blob = Buffer.from(raw, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), blob.subarray(0, 12));
    decipher.setAuthTag(blob.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]));
  } catch { return null; }
}
async function remove(req, res) {
  const id = sessionId(req);
  if (id) await command(['DEL', `veloi:proxy:${id}`]);
  res.setHeader('Set-Cookie', 'vel_proxy=; Path=/api/proxy; HttpOnly; SameSite=Strict; Max-Age=0');
}
async function save(req, res, config) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(config)), cipher.final()]);
  const id = crypto.randomBytes(32).toString('hex');
  await command(['SET', `veloi:proxy:${id}`, Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64'), 'EX', String(ttl)]);
  const old = sessionId(req);
  if (old) await command(['DEL', `veloi:proxy:${old}`]);
  res.setHeader('Set-Cookie', `vel_proxy=${id}; Path=/api/proxy; HttpOnly; SameSite=Strict; Max-Age=${ttl}${process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
}
module.exports = { get, save, remove };
