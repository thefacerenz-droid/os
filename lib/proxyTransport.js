const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns/promises');
const net = require('node:net');
const ipaddr = require('ipaddr.js');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
function fail(message, status = 400) { return Object.assign(new Error(message), { publicMessage: message, status }); }
function publicIp(address) { try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; } }
async function resolvePublic(host) {
  host = host.replace(/^\[|\]$/g, '');
  if (!host || /(^|\.)(localhost|local|internal)$/i.test(host)) throw fail('Local and private network hosts are not supported.');
  let records;
  try { records = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await dns.lookup(host, { all: true }); }
  catch { throw fail('The hostname could not be resolved. Check its spelling and DNS settings.', 502); }
  if (!records.length || records.some(r => !publicIp(r.address))) throw fail('Local, reserved and private network addresses are not supported.', 403);
  return records[0];
}
function settings(input) {
  const host = String(input.host || '').trim();
  const protocol = input.protocol;
  const port = Number(input.port);
  const username = String(input.username || '');
  const password = String(input.password || '');
  if (!['http', 'https'].includes(protocol)) throw fail('Choose HTTP or HTTPS for the proxy connection.');
  if (!host || host.length > 253 || /[\s/@?#\\]/.test(host)) throw fail('Enter a proxy hostname or IP address without a URL or path.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw fail('Proxy port must be an integer from 1 to 65535.');
  if (username.length > 256 || password.length > 1024 || /[\r\n:]/.test(username) || /[\r\n]/.test(password)) throw fail('Proxy credentials have an invalid format.');
  if (password && !username) throw fail('Enter a username with the proxy password.');
  return { host, port, protocol, username, password };
}
function connectionError(error) {
  if (error.publicMessage) return error;
  if (['ETIMEDOUT', 'ABORT_ERR'].includes(error.code)) return fail('Proxy connection timed out. Check the host, port and availability.', 504);
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(error.code)) return fail('Could not connect to the proxy. Check its host, port and access settings.', 502);
  if (/CERT|TLS|SSL/.test(error.code || '')) return fail('TLS certificate validation failed for the proxy or website.', 502);
  return fail('The proxy request failed. Check the connection settings and try again.', 502);
}
async function requestThroughProxy(config, target, hops = 0) {
  let url;
  try { url = new URL(target); } catch { throw fail('Enter a valid HTTP or HTTPS website address.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw fail('Only HTTP and HTTPS URLs without embedded credentials are supported.');
  if (url.port && !['80', '443'].includes(url.port)) throw fail('Website destinations must use port 80 or 443.');
  const [proxyIp, destination] = await Promise.all([resolvePublic(config.host), resolvePublic(url.hostname)]);
  const proxyHost = config.host.includes(':') && !config.host.startsWith('[') ? `[${config.host}]` : config.host;
  const proxyUrl = new URL(`${config.protocol}://${proxyHost}:${config.port}`);
  const headers = config.username ? { 'Proxy-Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}` } : {};
  const Agent = url.protocol === 'https:' ? HttpsProxyAgent : HttpProxyAgent;
  // Pin validated addresses while retaining hostnames for TLS and HTTP routing.
  const agent = new Agent(proxyUrl, { headers, lookup: (_host, options, callback) => options?.all ? callback(null, [proxyIp]) : callback(null, proxyIp.address, proxyIp.family) });
  let response;
  try {
    response = await new Promise((resolve, reject) => {
      const transport = url.protocol === 'https:' ? https : http;
      const request = transport.get({ hostname: destination.address, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search, servername: url.hostname.replace(/^\[|\]$/g, ''), agent,
        headers: { Host: url.host, 'User-Agent': 'Veloi-Reader/1.0', Accept: 'text/html,text/plain,application/json', 'Accept-Encoding': 'identity' } }, result => {
        const chunks = [];
        let bytes = 0;
        result.on('data', chunk => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) request.destroy(fail('The page exceeds the 2 MB reading limit.', 413)); else chunks.push(chunk); });
        result.on('error', reject);
        result.on('end', () => resolve({ status: result.statusCode, headers: result.headers, body: Buffer.concat(chunks).toString('utf8'), url: url.href }));
      });
      const timer = setTimeout(() => request.destroy(Object.assign(new Error(), { code: 'ETIMEDOUT' })), 12000);
      request.on('close', () => clearTimeout(timer));
      request.on('error', reject);
    });
  } catch (error) { throw connectionError(error); }
  finally { agent.destroy(); }
  if (response.status === 407) throw fail('Proxy authentication failed. Check your username and password.', 502);
  if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
    if (hops >= 3) throw fail('The website redirected too many times.', 502);
    return requestThroughProxy(config, new URL(response.headers.location, url).href, hops + 1);
  }
  if (response.status >= 400) throw fail(`The proxy or website returned HTTP ${response.status}.`, 502);
  return response;
}
module.exports = { settings, publicIp, resolvePublic, requestThroughProxy, fail };
