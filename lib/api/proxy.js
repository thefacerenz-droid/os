const dns = require("node:dns").promises;
const net = require("node:net");
const PROXY_TIMEOUT_MS = 12000;
const PROXY_MAX_BYTES = 3 * 1024 * 1024;
async function readRawBody(req, limit = PROXY_MAX_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      const error = new Error("Request body is too large for the proxy.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function escapeHtmlServer(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPrivateProxyAddress(address = "") {
  const version = net.isIP(address);
  if (version === 4) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:") ||
      lower.startsWith("::ffff:0.") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:169.254.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

function isBlockedProxyHostname(hostname = "") {
  const lower = String(hostname || "").toLowerCase();
  return (
    !lower ||
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower === "0.0.0.0" ||
    lower === "::" ||
    lower === "::1" ||
    (net.isIP(lower) && isPrivateProxyAddress(lower))
  );
}

async function assertProxyTargetAllowed(targetUrl) {
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    const error = new Error("Only http and https URLs can be proxied.");
    error.statusCode = 400;
    throw error;
  }
  if (targetUrl.username || targetUrl.password) {
    const error = new Error("Proxy URLs cannot include usernames or passwords.");
    error.statusCode = 400;
    throw error;
  }
  if (isBlockedProxyHostname(targetUrl.hostname)) {
    const error = new Error("Local and private network URLs cannot be proxied.");
    error.statusCode = 403;
    throw error;
  }
  if (!net.isIP(targetUrl.hostname)) {
    let addresses = [];
    try {
      addresses = await dns.lookup(targetUrl.hostname, { all: true, verbatim: true });
    } catch (error) {
      const lookupError = new Error("The proxy could not resolve that host.");
      lookupError.statusCode = 502;
      throw lookupError;
    }
    if (!addresses.length || addresses.some((record) => isPrivateProxyAddress(record.address))) {
      const error = new Error("The proxy blocked a private network destination.");
      error.statusCode = 403;
      throw error;
    }
  }
}

function sendProxyFrameMessage(res, statusCode, title, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtmlServer(title)}</title>
    <style>
      :root { color-scheme: dark; font-family: "Segoe UI", system-ui, sans-serif; }
      body { min-height: 100dvh; margin: 0; display: grid; place-items: center; background: #050608; color: #f7f4ec; }
      main { width: min(560px, calc(100vw - 2rem)); padding: 1rem; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,.035)); box-shadow: 0 28px 80px rgba(0,0,0,.42); }
      p { color: #b9b6ac; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtmlServer(title)}</h1>
      <p>${escapeHtmlServer(message)}</p>
    </main>
  </body>
</html>`);
}

function rewriteProxyHtml(html, targetUrl) {
  const safeHref = escapeHtmlServer(targetUrl.href);
  const proxyScript = `<script>
(() => {
  const proxyPath = "/api/proxy?url=";
  const toTargetUrl = (value) => {
    try {
      return new URL(value || document.baseURI, document.baseURI).href;
    } catch (error) {
      return "";
    }
  };
  const toProxyUrl = (value) => proxyPath + encodeURIComponent(value);
  const navigateInside = (value) => {
    const target = toTargetUrl(value);
    if (!target) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "vel-os-browser-navigate", url: target }, "*");
      return;
    }
    window.location.href = toProxyUrl(target);
  };
  window.open = (value) => {
    navigateInside(value);
    return null;
  };
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "vel-os-browser-loaded", url: document.baseURI }, "*");
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.hasAttribute("download")) return;
    const rawHref = link.getAttribute("href") || "";
    if (/^(mailto|tel|sms|javascript|data|blob):/i.test(rawHref)) return;
    if (link.target && link.target !== "_self") link.target = "_self";
    const target = toTargetUrl(rawHref);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigateInside(target);
  }, true);
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form || form.tagName !== "FORM") return;
    const method = String(form.method || "get").toLowerCase();
    const action = toTargetUrl(form.getAttribute("action") || document.baseURI);
    if (!action) return;
    if (method === "get") {
      event.preventDefault();
      const target = new URL(action);
      new FormData(form).forEach((value, key) => target.searchParams.append(key, value));
      navigateInside(target.href);
      return;
    }
    form.action = toProxyUrl(action);
    form.target = "_self";
  }, true);
})();
</script>`;
  const injectedHead = `<base href="${safeHref}" />${proxyScript}`;
  let output = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head([^>]*)>/i, `<head$1>${injectedHead}`);
  } else {
    output = `${injectedHead}${output}`;
  }
  return output;
}

async function handleProxyRequest(req, res, url) {
  if (!["GET", "HEAD", "POST"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD, POST" });
    res.end("Method not allowed");
    return;
  }

  const rawTarget = String(url.searchParams.get("url") || "").trim();
  if (!rawTarget) {
    sendProxyFrameMessage(res, 400, "Proxy needs a URL", "Enter a full http or https URL in the vel.os browser.");
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawTarget);
    await assertProxyTargetAllowed(targetUrl);
  } catch (error) {
    sendProxyFrameMessage(res, error.statusCode || 400, "Proxy blocked this URL", error.message || "That URL cannot be proxied.");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const body = req.method === "POST" ? await readRawBody(req) : undefined;
    const response = await fetch(targetUrl.href, {
      method: req.method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) vel.os/1.0",
        Accept: req.headers.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(req.headers["content-type"] ? { "Content-Type": req.headers["content-type"] } : {})
      },
      body
    });

    const redirectLocation = response.headers.get("location");
    if (redirectLocation && response.status >= 300 && response.status < 400) {
      const nextUrl = new URL(redirectLocation, targetUrl);
      await assertProxyTargetAllowed(nextUrl);
      res.writeHead(302, { Location: `/api/proxy?url=${encodeURIComponent(nextUrl.href)}` });
      res.end();
      return;
    }

    const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > PROXY_MAX_BYTES) {
      sendProxyFrameMessage(res, 413, "Proxy response too large", "That page is too large for the vel.os proxy.");
      return;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > PROXY_MAX_BYTES) {
      sendProxyFrameMessage(res, 413, "Proxy response too large", "That page is too large for the vel.os proxy.");
      return;
    }

    res.writeHead(response.status, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      res.end(rewriteProxyHtml(buffer.toString("utf8"), targetUrl));
      return;
    }
    res.end(buffer);
  } catch (error) {
    sendProxyFrameMessage(
      res,
      error.name === "AbortError" ? 504 : 502,
      "Proxy could not load this page",
      error.name === "AbortError" ? "The remote site took too long to respond." : (error.message || "The remote site could not be fetched.")
    );
  } finally {
    clearTimeout(timeout);
  }
}


module.exports = (req, res) => handleProxyRequest(req, res, new URL(req.url, "https://localhost"));
