const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");

loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const GLOBAL_YOUTUBE_LIMIT = 200;
const GLOBAL_YOUTUBE_FILE = path.join(__dirname, "data", "global-youtube-favorites.json");
const GLOBAL_CHAT_LIMIT = 180;
const GLOBAL_CHAT_FILE = path.join(__dirname, "data", "global-chat-messages.json");
const CHAT_ATTACHMENT_URL_LIMIT = 2600000;
const CHAT_ALLOWED_DATA_MEDIA = /^data:(image\/(?:png|jpe?g|gif|webp)|video\/(?:mp4|webm|ogg));base64,/i;
const SECRET_VIDEO_DIR = path.join(__dirname, "assets", "secret-videos");
const SECRET_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".mov"]);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PROXY_TIMEOUT_MS = 12000;
const PROXY_MAX_BYTES = 12 * 1024 * 1024;
const handleLobbies = require("./lib/api/lobbies.js");
const handleSoundboard = require("./lib/api/soundboard.js");
const handleDevPresence = require("./lib/api/dev/presence.js");
const handleDevScreen = require("./lib/api/dev/screen.js");
const handleChatTyping = require("./lib/chatTyping.js");
const handleFlappyLeaderboard = require("./lib/api/games/flappy.js");
const handleLive = require("./lib/live.js");
const sessions = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime"
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function isGitLfsPointer(filePath, stat) {
  if (!stat || stat.size > 1024) return false;
  try {
    const head = fs.readFileSync(filePath, "utf8").slice(0, 220);
    return head.startsWith("version https://git-lfs.github.com/spec/v1");
  } catch (error) {
    return false;
  }
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function signSessionId(id) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(id).digest("base64url");
}

function encodeSessionCookie(id) {
  return `${id}.${signSessionId(id)}`;
}

function decodeSessionCookie(value) {
  const [id, signature] = String(value || "").split(".");
  if (!id || !signature) return "";
  const expected = signSessionId(id);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return "";
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer) ? id : "";
}

function getSession(req, res) {
  const cookies = parseCookies(req);
  let id = decodeSessionCookie(cookies.velos_session);
  if (!id || !sessions.has(id)) {
    id = crypto.randomBytes(24).toString("hex");
    sessions.set(id, {});
    res.setHeader(
      "Set-Cookie",
      `velos_session=${encodeURIComponent(encodeSessionCookie(id))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
    );
  }
  return sessions.get(id);
}

function cleanQuery(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 160);
}

function cleanProviderMessage(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGlobalText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 120);
}

function cleanChatText(value = "", limit = 360) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function getChatAttachmentTypeFromUrl(value = "") {
  const cleanUrl = String(value).split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/.test(cleanUrl)) return "image";
  if (/\.(mp4|webm|ogg|mov)$/.test(cleanUrl)) return "video";
  return "link";
}

function normalizeChatAttachment(input = null) {
  if (!input || typeof input !== "object") return null;
  const rawUrl = String(input.url || "").trim();
  if (!rawUrl || rawUrl.length > CHAT_ATTACHMENT_URL_LIMIT) {
    const error = new Error("That attachment is too large for chat. Use the vault folder for big videos.");
    error.code = "attachment_too_large";
    throw error;
  }

  const isDataUrl = rawUrl.startsWith("data:");
  let type = ["image", "video", "link"].includes(input.type)
    ? input.type
    : getChatAttachmentTypeFromUrl(rawUrl);

  if (isDataUrl) {
    if (!CHAT_ALLOWED_DATA_MEDIA.test(rawUrl)) {
      const error = new Error("Only PNG, JPG, GIF, WEBP, MP4, WEBM, and OGG attachments are supported.");
      error.code = "unsupported_attachment";
      throw error;
    }
    type = rawUrl.startsWith("data:image/") ? "image" : "video";
  } else {
    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol.");
    } catch (error) {
      const invalid = new Error("Attachment links must start with http:// or https://.");
      invalid.code = "invalid_attachment_url";
      throw invalid;
    }
  }

  return {
    type,
    url: rawUrl,
    name: cleanChatText(input.name, 90) || (type === "image" ? "Image" : type === "video" ? "Video" : "Link"),
    size: Math.max(0, Number(input.size) || 0)
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

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

function extractYouTubeVideoId(value = "") {
  const trimmed = String(value || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalized);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname)) return "";
    if (/youtu\.be$/i.test(url.hostname)) {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
    }
    const watchId = url.searchParams.get("v") || "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;
    const embedMatch = url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    return embedMatch?.[1] || "";
  } catch (error) {
    return "";
  }
}

function normalizeGlobalYouTubeItem(input = {}) {
  const id = extractYouTubeVideoId(input.url || input.id);
  if (!id) return null;
  return {
    id,
    title: cleanGlobalText(input.title, "Shared YouTube Video"),
    channel: cleanGlobalText(input.channel, "Global Favs"),
    thumbnail: cleanGlobalText(input.thumbnail, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`),
    publishedAt: cleanGlobalText(input.publishedAt),
    description: cleanGlobalText(input.description, "Saved by someone on vel.os."),
    addedAt: Date.now()
  };
}

function readGlobalYouTubeFavorites() {
  try {
    const raw = fs.readFileSync(GLOBAL_YOUTUBE_FILE, "utf8");
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items.filter((item) => item?.id).slice(0, GLOBAL_YOUTUBE_LIMIT) : [];
  } catch (error) {
    return [];
  }
}

function writeGlobalYouTubeFavorites(items) {
  fs.mkdirSync(path.dirname(GLOBAL_YOUTUBE_FILE), { recursive: true });
  fs.writeFileSync(GLOBAL_YOUTUBE_FILE, JSON.stringify(items.slice(0, GLOBAL_YOUTUBE_LIMIT), null, 2));
}

async function handleYoutubeSearch(req, res, url) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return sendJson(res, 503, {
      error: "missing_config",
      message: "Set YOUTUBE_API_KEY in .env to enable YouTube search."
    });
  }

  const q = cleanQuery(url.searchParams.get("q"), "music");
  const pageToken = cleanQuery(url.searchParams.get("pageToken"));
  const duration = cleanQuery(url.searchParams.get("duration")).toLowerCase();
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "25",
    safeSearch: "moderate",
    q,
    key
  });
  if (pageToken) params.set("pageToken", pageToken);
  if (["short", "medium", "long"].includes(duration)) {
    params.set("videoDuration", duration);
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return sendJson(res, response.status, {
      error: data.error?.errors?.[0]?.reason || "youtube_error",
      message: cleanProviderMessage(data.error?.message) || "YouTube search failed."
    });
  }

  sendJson(res, 200, {
    items: (data.items || []).map((item) => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      channel: item.snippet?.channelTitle,
      thumbnail:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        "",
      publishedAt: item.snippet?.publishedAt,
      description: item.snippet?.description || ""
    })).filter((item) => item.id),
    nextPageToken: data.nextPageToken || ""
  });
}

async function handleYoutubeGlobal(req, res, url) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      items: readGlobalYouTubeFavorites(),
      storage: "file"
    });
  }

  if (!["POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, DELETE");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET, POST, or DELETE for global YouTube favorites."
    });
  }

  let body = {};
  try {
    body = JSON.parse(await readBody(req) || "{}");
  } catch (error) {
    body = {};
  }

  if (req.method === "DELETE") {
    const id = extractYouTubeVideoId(body.id || body.url || url?.searchParams?.get("id") || url?.searchParams?.get("url"));
    if (!id) {
      return sendJson(res, 400, {
        error: "invalid_youtube_link",
        message: "Choose a valid YouTube video to remove from Global Favs."
      });
    }
    const items = readGlobalYouTubeFavorites().filter((item) => item.id !== id);
    writeGlobalYouTubeFavorites(items);
    return sendJson(res, 200, { items, storage: "file", deleted: id });
  }

  const nextItem = normalizeGlobalYouTubeItem(body);
  if (!nextItem) {
    return sendJson(res, 400, {
      error: "invalid_youtube_link",
      message: "Paste a valid YouTube video link, Shorts link, youtu.be link, or 11-character video ID."
    });
  }

  const current = readGlobalYouTubeFavorites();
  const items = [
    nextItem,
    ...current.filter((item) => item.id !== nextItem.id)
  ].slice(0, GLOBAL_YOUTUBE_LIMIT);
  writeGlobalYouTubeFavorites(items);
  return sendJson(res, 201, { item: nextItem, items, storage: "file" });
}

function normalizeChatMessages(value) {
  return (Array.isArray(value) ? value : [])
    .map((message) => {
      let attachment = null;
      try {
        attachment = normalizeChatAttachment(message?.attachment);
      } catch (error) {
        attachment = null;
      }
      return {
        id: cleanChatText(message?.id, 48),
        userId: cleanChatText(message?.userId, 64),
        username: cleanChatText(message?.username, 24) || "Guest",
        text: cleanChatText(message?.text, 360),
        attachment,
        createdAt: Number(message?.createdAt) || Date.now()
      };
    })
    .filter((message) => message.id && (message.text || message.attachment))
    .slice(-GLOBAL_CHAT_LIMIT);
}

function readGlobalChatMessages() {
  try {
    const raw = fs.readFileSync(GLOBAL_CHAT_FILE, "utf8");
    return normalizeChatMessages(JSON.parse(raw));
  } catch (error) {
    return [];
  }
}

function writeGlobalChatMessages(messages) {
  fs.mkdirSync(path.dirname(GLOBAL_CHAT_FILE), { recursive: true });
  fs.writeFileSync(GLOBAL_CHAT_FILE, JSON.stringify(normalizeChatMessages(messages), null, 2));
}

function normalizeIncomingChatMessage(input = {}) {
  const text = cleanChatText(input.text, 360);
  const attachment = normalizeChatAttachment(input.attachment);
  if (!text && !attachment) return null;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    userId: cleanChatText(input.userId, 64) || `guest-${Math.random().toString(36).slice(2, 10)}`,
    username: cleanChatText(input.username, 24) || "Guest",
    text,
    attachment,
    createdAt: Date.now()
  };
}

function getDeleteChatMessageId(input = {}) {
  return cleanChatText(input.messageId || input.id, 48);
}

async function handleChatMessages(req, res, url) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      messages: readGlobalChatMessages(),
      storage: "file",
      persistent: true,
      message: "Local Global Chat is saved to a file while testing."
    });
  }

  if (!["POST", "DELETE"].includes(req.method)) {
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET, POST, or DELETE for Global Chat."
    });
  }

  let body = {};
  try {
    body = JSON.parse(await readBody(req) || "{}");
  } catch (error) {
    body = {};
  }
  if (req.method === "DELETE") {
    const shouldClear = body.action === "clear" || body.clear === true || url.searchParams.get("action") === "clear";
    const messageId = getDeleteChatMessageId(body) || cleanChatText(url.searchParams.get("messageId") || "", 48);
    if (!shouldClear && !messageId) {
      return sendJson(res, 400, {
        error: "missing_message_id",
        message: "Choose a message to delete."
      });
    }
    const messages = shouldClear
      ? []
      : readGlobalChatMessages().filter((message) => message.id !== messageId);
    writeGlobalChatMessages(messages);
    handleLive.broadcastLiveEvent?.("chat", {
      action: shouldClear ? "clear" : "delete",
      messageId,
      senderUserId: cleanChatText(body.userId, 64),
      senderDeviceId: cleanChatText(body.deviceId, 96)
    });
    return sendJson(res, 200, {
      messages,
      storage: "file",
      persistent: true,
      deleted: shouldClear ? "all" : messageId
    });
  }

  let nextMessage = null;
  try {
    nextMessage = normalizeIncomingChatMessage(body);
  } catch (error) {
    const statusCode = error.code === "attachment_too_large"
      ? 413
      : ["unsupported_attachment", "invalid_attachment_url"].includes(error.code) ? 400 : 500;
    return sendJson(res, statusCode, {
      error: error.code || "chat_error",
      message: error.message || "Could not send that attachment."
    });
  }
  if (!nextMessage) {
    return sendJson(res, 400, {
      error: "empty_message",
      message: "Type a message before sending."
    });
  }
  const messages = [...readGlobalChatMessages(), nextMessage].slice(-GLOBAL_CHAT_LIMIT);
  writeGlobalChatMessages(messages);
  handleLive.broadcastLiveEvent?.("chat", {
    action: "message",
    messageId: nextMessage.id,
    senderUserId: nextMessage.userId,
    senderDeviceId: cleanChatText(body.deviceId, 96)
  });
  return sendJson(res, 201, {
    message: nextMessage,
    messages,
    storage: "file",
    persistent: true
  });
}

function getSecretVideoType(extension) {
  if (extension === ".webm") return "video/webm";
  if (extension === ".ogg") return "video/ogg";
  if (extension === ".mov") return "video/quicktime";
  return "video/mp4";
}

function handleSecretVideos(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET for vault videos."
    });
  }

  let files = [];
  try {
    files = fs.readdirSync(SECRET_VIDEO_DIR, { withFileTypes: true });
  } catch (error) {
    files = [];
  }

  const videos = files
    .filter((file) => file.isFile())
    .map((file) => {
      const extension = path.extname(file.name).toLowerCase();
      if (!SECRET_VIDEO_EXTENSIONS.has(extension)) return null;
      const filePath = path.join(SECRET_VIDEO_DIR, file.name);
      const stat = fs.statSync(filePath);
      const lfsPointer = isGitLfsPointer(filePath, stat);
      return {
        name: path.basename(file.name, extension).replace(/[-_]+/g, " "),
        fileName: file.name,
        url: `/assets/secret-videos/${encodeURIComponent(file.name)}`,
        type: getSecretVideoType(extension),
        size: stat.size,
        playable: !lfsPointer,
        lfsPointer,
        issue: lfsPointer
          ? "This deploy has a Git LFS pointer instead of the real video file. Enable Git LFS in Vercel and redeploy."
          : ""
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  return sendJson(res, 200, {
    videos,
    folder: "assets/secret-videos"
  });
}

function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REDIRECT_URI);
}

function handleTikTokStatus(req, res) {
  const session = getSession(req, res);
  sendJson(res, 200, {
    configured: tiktokConfigured(),
    connected: Boolean(session.tiktok)
  });
}

function handleTikTokLogout(req, res) {
  const session = getSession(req, res);
  delete session.tiktok;
  delete session.tiktokState;
  sendJson(res, 200, { ok: true });
}

async function handleTikTokAuthStart(req, res) {
  if (!tiktokConfigured()) {
    return sendJson(res, 503, {
      error: "missing_config",
      message: "Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI in .env."
    });
  }
  const session = getSession(req, res);
  session.tiktokState = crypto.randomBytes(24).toString("hex");
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    scope: "user.info.basic,video.list",
    response_type: "code",
    redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    state: session.tiktokState
  });
  sendRedirect(res, `https://www.tiktok.com/v2/auth/authorize/?${params}`);
}

async function handleTikTokCallback(req, res, url) {
  const session = getSession(req, res);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== session.tiktokState) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>TikTok auth failed</h1><p>Missing or invalid OAuth state.</p>");
    return;
  }
  delete session.tiktokState;

  const body = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.TIKTOK_REDIRECT_URI
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>TikTok auth failed</h1><p>${escapeHtmlServer(data.error_description || data.message || "Token exchange failed.")}</p>`);
    return;
  }

  session.tiktok = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in || 86400) * 1000,
    openId: data.open_id
  };
  sendRedirect(res, "/?media=tiktok");
}

async function refreshTikTokToken(session) {
  if (!session.tiktok) return null;
  if (session.tiktok.expiresAt > Date.now() + 60000) return session.tiktok.accessToken;
  if (!session.tiktok.refreshToken) return null;

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: session.tiktok.refreshToken
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) return null;
  session.tiktok.accessToken = data.access_token;
  session.tiktok.refreshToken = data.refresh_token || session.tiktok.refreshToken;
  session.tiktok.expiresAt = Date.now() + Number(data.expires_in || 86400) * 1000;
  return session.tiktok.accessToken;
}

async function requireTikTokToken(req, res) {
  const session = getSession(req, res);
  const token = await refreshTikTokToken(session);
  if (!token) {
    sendJson(res, 401, {
      error: "auth_required",
      message: "Connect TikTok to show profile and recent videos."
    });
    return null;
  }
  return token;
}

async function handleTikTokProfile(req, res) {
  if (!tiktokConfigured()) {
    return sendJson(res, 503, { error: "missing_config", message: "TikTok credentials are not configured." });
  }
  const token = await requireTikTokToken(req, res);
  if (!token) return;
  const fields = "open_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,username";
  const response = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  const apiError = data.error && data.error.code !== "ok";
  if (!response.ok || apiError) {
    return sendJson(res, response.status || 502, {
      error: data.error?.code || "tiktok_error",
      message: data.error?.message || "TikTok profile request failed."
    });
  }
  sendJson(res, 200, data.data?.user || {});
}

async function handleTikTokVideos(req, res, url) {
  if (!tiktokConfigured()) {
    return sendJson(res, 503, { error: "missing_config", message: "TikTok credentials are not configured." });
  }
  const token = await requireTikTokToken(req, res);
  if (!token) return;
  const fields = "id,title,video_description,duration,cover_image_url,embed_link,share_url,create_time";
  const cursor = Number(url.searchParams.get("cursor") || 0);
  const response = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ max_count: 20, cursor })
  });
  const data = await response.json().catch(() => ({}));
  const apiError = data.error && data.error.code !== "ok";
  if (!response.ok || apiError) {
    return sendJson(res, response.status || 502, {
      error: data.error?.code || "tiktok_error",
      message: data.error?.message || "TikTok video request failed."
    });
  }
  sendJson(res, 200, data.data || { videos: [] });
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

function serveStatic(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(PUBLIC_DIR) || filePath.includes(`${path.sep}.env`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const noStore = new Set([".html", ".js", ".css"]);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": noStore.has(ext) ? "no-store" : "public, max-age=3600"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  try {
    if (url.pathname === "/api/chat/messages" && url.searchParams.get("__typing") === "1") return await handleChatTyping(req, res);
    if (url.pathname === "/api/chat/messages") return await handleChatMessages(req, res, url);
    if (url.pathname === "/api/chat/typing") return await handleChatTyping(req, res);
    if (url.pathname === "/api/lobbies") return await handleLobbies(req, res);
    if (url.pathname === "/api/soundboard") return await handleSoundboard(req, res);
    if (url.pathname === "/api/dev/presence") return await handleDevPresence(req, res);
    if (url.pathname === "/api/dev/screen") return await handleDevScreen(req, res);
    if (url.pathname === "/api/games/flappy") return await handleFlappyLeaderboard(req, res);
    if (url.pathname === "/api/live") return await handleLive(req, res);
    if (url.pathname === "/api/secret/videos") return handleSecretVideos(req, res);
    if (req.method === "GET" && url.pathname === "/api/youtube/search") return await handleYoutubeSearch(req, res, url);
    if (url.pathname === "/api/youtube/global") return await handleYoutubeGlobal(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/tiktok/status") return handleTikTokStatus(req, res);
    if (req.method === "POST" && url.pathname === "/api/tiktok/logout") return handleTikTokLogout(req, res);
    if (req.method === "GET" && url.pathname === "/api/tiktok/auth/start") return await handleTikTokAuthStart(req, res);
    if (req.method === "GET" && url.pathname === "/api/tiktok/auth/callback") return await handleTikTokCallback(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/tiktok/profile") return await handleTikTokProfile(req, res);
    if (req.method === "GET" && url.pathname === "/api/tiktok/videos") return await handleTikTokVideos(req, res, url);
    if (url.pathname === "/api/proxy") return await handleProxyRequest(req, res, url);
    if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not_found", message: "API route not found." });
    return serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: "server_error", message: error.message || "Unexpected server error." });
  }
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`vel.os running at http://localhost:${PORT}`);
});
