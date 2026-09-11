const crypto = require('node:crypto');
const sanitize = require('sanitize-html');
const { settings, requestThroughProxy, fail } = require('../proxyTransport');
const sessions = require('../proxySessions');
function documentView(response) {
  if (response.headers['x-frame-options'] || /frame-ancestors/i.test(response.headers['content-security-policy'] || '')) throw fail('This website restricts embedded viewing. Its embedding policy is respected.', 422);
  const type = response.headers['content-type'] || '';
  if (!/text\/html|text\/plain|application\/json/i.test(type)) throw fail('This view supports HTML, plain text and JSON pages only.', 415);
  if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') throw fail('This website returned an unsupported compressed response.', 415);
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = type.includes('text/html') ? sanitize(response.body, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'div', 'span', 'article', 'section', 'main', 'header', 'footer', 'nav', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'br', 'hr', 'pre', 'code', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'dl', 'dt', 'dd'],
    allowedAttributes: { a: ['href', 'data-url'], '*': ['id'] }, allowedSchemes: ['http', 'https'],
    transformTags: { a: (_tag, attributes) => {
      let href = '';
      try { const url = new URL(attributes.href || '', response.url); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) href = url.href; } catch { /* Drop invalid links. */ }
      return { tagName: 'a', attribs: href ? { href: '#', 'data-url': href } : {} };
    } }
  }) : `<pre>${escape(response.body)}</pre>`;
  const nonce = crypto.randomBytes(18).toString('base64');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{font:16px/1.65 system-ui;color:#e7edf1;background:#111518;max-width:980px;margin:32px auto;padding:0 24px;overflow-wrap:anywhere}a{color:#81dcc2}pre{white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #49545b;padding:8px}</style>${html}<script nonce="${nonce}">document.addEventListener('click',e=>{const a=e.target.closest('a[data-url]');if(a){e.preventDefault();parent.postMessage({type:'vel-os-browser-navigate',url:a.dataset.url},'*')}});</script>`;
}
async function body(req) {
  if (req.body) { if (JSON.stringify(req.body).length > 8192) throw fail('Proxy settings are too large.', 413); return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  let raw = '';
  for await (const part of req) { raw += part; if (raw.length > 8192) throw fail('Proxy settings are too large.', 413); }
  return JSON.parse(raw || '{}');
}
module.exports = async function handle(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
  try {
    if (req.method !== 'POST') return send(405, { message: 'Use the browser proxy controls to make a request.' });
    const origin = req.headers.origin;
    const expected = process.env.APP_BASE_URL || `http://${req.headers.host}`;
    if (!origin || new URL(origin).origin !== new URL(expected).origin) throw fail('Proxy settings must be submitted from this website.', 403);
    const input = await body(req);
    if (input.action === 'disconnect') { await sessions.remove(req, res); return send(200, { connected: false }); }
    if (input.action === 'connect') {
      const config = settings(input);
      await requestThroughProxy(config, 'https://example.com/');
      await sessions.save(req, res, config);
      return send(200, { connected: true, host: config.host, port: config.port, protocol: config.protocol });
    }
    const config = await sessions.get(req);
    if (input.action === 'status') return send(200, config ? { connected: true, host: config.host, port: config.port, protocol: config.protocol } : { connected: false });
    if (input.action !== 'browse') throw fail('Unknown proxy action.');
    if (!config) throw fail('Connect a proxy in Proxy settings first. Sessions expire after one hour.', 409);
    const response = await requestThroughProxy(config, input.url);
    return send(200, { url: response.url, html: documentView(response), status: response.status });
  } catch (error) { return send(error.status || 502, { message: error.publicMessage || 'Unable to complete the proxy request. Check your settings and try again.' }); }
};
module.exports.documentView = documentView;
