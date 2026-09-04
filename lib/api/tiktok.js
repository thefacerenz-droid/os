const crypto = require("node:crypto");

const AUTH_COOKIE = "velos_tiktok_auth";
const STATE_COOKIE = "velos_tiktok_state";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function appendCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", current ? [...(Array.isArray(current) ? current : [current]), value] : value);
}

function setCookie(res, name, value, maxAge) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  appendCookie(res, `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}

function readCookies(req) {
  return Object.fromEntries(
    String(req.headers?.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function getEncryptionKey() {
  return process.env.SESSION_SECRET
    ? crypto.createHash("sha256").update(process.env.SESSION_SECRET).digest()
    : null;
}

function seal(payload) {
  const key = getEncryptionKey();
  if (!key) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function unseal(value) {
  const key = getEncryptionKey();
  if (!key || !value) return null;
  try {
    const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    if (!iv || !tag || !encrypted) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
  } catch (error) {
    return null;
  }
}

function configured() {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY
    && process.env.TIKTOK_CLIENT_SECRET
    && process.env.TIKTOK_REDIRECT_URI
    && process.env.SESSION_SECRET
  );
}

function queryValue(req, name) {
  const value = req.query?.[name];
  if (Array.isArray(value)) return value[0] || "";
  if (value !== undefined) return String(value || "");
  try {
    return new URL(req.url || "/", "https://vel.os").searchParams.get(name) || "";
  } catch (error) {
    return "";
  }
}

function isTikTokHostname(hostname = "") {
  const normalized = String(hostname).toLowerCase().replace(/\.$/, "");
  return normalized === "tiktok.com" || normalized.endsWith(".tiktok.com");
}

function getVideoId(value = "") {
  return String(value).match(/\/video\/(\d{8,})/)?.[1] || "";
}

async function resolveShareLink(req, res) {
  let currentUrl;
  try {
    currentUrl = new URL(queryValue(req, "url").trim());
  } catch (error) {
    return sendJson(res, 400, { error: "invalid_url", message: "Paste a valid TikTok share link." });
  }

  if (currentUrl.protocol !== "https:" || !isTikTokHostname(currentUrl.hostname)) {
    return sendJson(res, 400, { error: "invalid_host", message: "Only HTTPS TikTok links are supported." });
  }

  const directId = getVideoId(currentUrl.pathname);
  if (directId) return sendJson(res, 200, { id: directId, url: currentUrl.href });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36" }
      });
      response.body?.cancel().catch(() => {});
      const location = response.headers.get("location");
      if (!location || response.status < 300 || response.status >= 400) break;
      const nextUrl = new URL(location, currentUrl);
      if (nextUrl.protocol !== "https:" || !isTikTokHostname(nextUrl.hostname)) {
        return sendJson(res, 400, { error: "invalid_redirect", message: "TikTok returned an unsupported link." });
      }
      currentUrl = nextUrl;
      const id = getVideoId(currentUrl.pathname);
      if (id) return sendJson(res, 200, { id, url: currentUrl.href });
    }
    return sendJson(res, 422, { error: "missing_video", message: "That TikTok link does not point to a public video." });
  } catch (error) {
    return sendJson(res, 502, {
      error: "resolve_failed",
      message: error.name === "AbortError" ? "TikTok took too long to resolve that link." : "TikTok could not resolve that share link."
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshAuth(req, res) {
  const auth = unseal(readCookies(req)[AUTH_COOKIE]);
  if (!auth) return null;
  if (auth.expiresAt > Date.now() + 60000) return auth;
  if (!auth.refreshToken) return null;

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) return null;
  const refreshed = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 86400) * 1000,
    openId: data.open_id || auth.openId
  };
  setCookie(res, AUTH_COOKIE, seal(refreshed), 2592000);
  return refreshed;
}

async function requireAuth(req, res) {
  if (!configured()) {
    sendJson(res, 503, { error: "missing_config", message: "TikTok credentials are not configured." });
    return null;
  }
  const auth = await refreshAuth(req, res);
  if (!auth) sendJson(res, 401, { error: "auth_required", message: "Connect TikTok to show profile and recent videos." });
  return auth;
}

async function startAuth(req, res) {
  if (!configured()) {
    return sendJson(res, 503, {
      error: "missing_config",
      message: "Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI, and SESSION_SECRET."
    });
  }
  const state = crypto.randomBytes(24).toString("hex");
  setCookie(res, STATE_COOKIE, seal({ state, expiresAt: Date.now() + 600000 }), 600);
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    scope: "user.info.basic,video.list",
    response_type: "code",
    redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    state
  });
  redirect(res, `https://www.tiktok.com/v2/auth/authorize/?${params}`);
}

async function finishAuth(req, res) {
  const stateRecord = unseal(readCookies(req)[STATE_COOKIE]);
  const code = queryValue(req, "code");
  const state = queryValue(req, "state");
  clearCookie(res, STATE_COOKIE);
  if (!code || !stateRecord || stateRecord.expiresAt < Date.now() || state !== stateRecord.state) {
    return sendJson(res, 400, { error: "invalid_state", message: "TikTok login expired or returned an invalid state." });
  }

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    return sendJson(res, 502, { error: "token_exchange_failed", message: data.error_description || data.message || "TikTok login failed." });
  }
  setCookie(res, AUTH_COOKIE, seal({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in || 86400) * 1000,
    openId: data.open_id
  }), 2592000);
  redirect(res, "/?media=tiktok");
}

async function profile(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const fields = "open_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,username";
  const response = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.error && data.error.code !== "ok")) {
    return sendJson(res, response.status || 502, { error: data.error?.code || "tiktok_error", message: data.error?.message || "TikTok profile request failed." });
  }
  sendJson(res, 200, data.data?.user || {});
}

async function videos(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const fields = "id,title,video_description,duration,cover_image_url,embed_link,share_url,create_time";
  const cursor = Number(queryValue(req, "cursor") || 0);
  const response = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_count: 20, cursor })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.error && data.error.code !== "ok")) {
    return sendJson(res, response.status || 502, { error: data.error?.code || "tiktok_error", message: data.error?.message || "TikTok video request failed." });
  }
  sendJson(res, 200, data.data || { videos: [] });
}

module.exports = async function handleTikTok(req, res, action) {
  if (action === "status" && req.method === "GET") {
    const auth = unseal(readCookies(req)[AUTH_COOKIE]);
    return sendJson(res, 200, { configured: configured(), connected: Boolean(auth) });
  }
  if (action === "resolve" && req.method === "GET") return resolveShareLink(req, res);
  if (action === "logout" && req.method === "POST") {
    clearCookie(res, AUTH_COOKIE);
    clearCookie(res, STATE_COOKIE);
    return sendJson(res, 200, { ok: true });
  }
  if (action === "auth/start" && req.method === "GET") return startAuth(req, res);
  if (action === "auth/callback" && req.method === "GET") return finishAuth(req, res);
  if (action === "profile" && req.method === "GET") return profile(req, res);
  if (action === "videos" && req.method === "GET") return videos(req, res);
  res.setHeader("Allow", action === "logout" ? "POST" : "GET");
  return sendJson(res, 405, { error: "method_not_allowed", message: "Method not allowed for this TikTok route." });
};
