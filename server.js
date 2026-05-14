const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const GLOBAL_YOUTUBE_LIMIT = 200;
const GLOBAL_YOUTUBE_FILE = path.join(__dirname, "data", "global-youtube-favorites.json");
const GLOBAL_CHAT_LIMIT = 180;
const GLOBAL_CHAT_FILE = path.join(__dirname, "data", "global-chat-messages.json");
const GLOBAL_CHAT_PIN = process.env.VEL_OS_PIN || "74281";
const CHAT_ATTACHMENT_URL_LIMIT = 2600000;
const CHAT_ALLOWED_DATA_MEDIA = /^data:(image\/(?:png|jpe?g|gif|webp)|video\/(?:mp4|webm|ogg));base64,/i;
const SECRET_VIDEO_DIR = path.join(__dirname, "assets", "secret-videos");
const SECRET_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".mov"]);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const handleLobbies = require("./api/lobbies.js");
const handleSoundboard = require("./api/soundboard.js");
const handleDevPresence = require("./api/dev/presence.js");
const handleDevScreen = require("./api/dev/screen.js");
const handleChatTyping = require("./api/chat/typing.js");
const handleFlappyLeaderboard = require("./api/games/flappy.js");
const handleLive = require("./api/live.js");
const sessions = new Map();
let spotifyToken = null;

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

function cleanAiMessage(value) {
  return String(value || "").trim().slice(0, 1200);
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

function getChatPin(req, body = {}, url = null) {
  return cleanChatText(
    req.headers["x-vel-chat-pin"] || body.pin || url?.searchParams?.get("pin") || "",
    12
  );
}

function sendChatPinRequired(req, res, body = {}, url = null) {
  if (getChatPin(req, body, url) === GLOBAL_CHAT_PIN) return false;
  sendJson(res, 401, {
    error: "pin_required",
    message: "Enter the chat PIN before viewing or sending messages."
  });
  return true;
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

function normalizeAiMessages(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: cleanAiMessage(message?.content)
    }))
    .filter((message) => message.content)
    .slice(-12);
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (data?.output || [])
    .flatMap((item) => item?.content || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function handleAiChat(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use POST for Vel AI chat."
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return sendJson(res, 503, {
      error: "missing_config",
      message: "Set OPENAI_API_KEY in Vercel Environment Variables, then redeploy."
    });
  }

  let body = {};
  try {
    body = JSON.parse(await readBody(req) || "{}");
  } catch (error) {
    body = {};
  }
  const messages = normalizeAiMessages(body.messages);
  if (!messages.length) {
    return sendJson(res, 400, {
      error: "missing_message",
      message: "Send at least one message."
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: "You are Vel AI inside vel.os. Be helpful, concise, friendly, and practical. Keep answers clear for a student building a web OS. Do not claim you can bypass school or network restrictions.",
      input: messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      max_output_tokens: 900,
      store: false
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return sendJson(res, response.status, {
      error: data.error?.code || "openai_error",
      message: data.error?.message || "Vel AI could not reach OpenAI."
    });
  }

  sendJson(res, 200, {
    reply: extractOpenAiText(data) || "Vel AI did not return text.",
    model: data.model || process.env.OPENAI_MODEL || "gpt-5-mini"
  });
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
    if (sendChatPinRequired(req, res, {}, url)) return;
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
  if (sendChatPinRequired(req, res, body, url)) return;

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
      return {
        name: path.basename(file.name, extension).replace(/[-_]+/g, " "),
        fileName: file.name,
        url: `/assets/secret-videos/${encodeURIComponent(file.name)}`,
        type: getSecretVideoType(extension),
        size: stat.size
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  return sendJson(res, 200, {
    videos,
    folder: "assets/secret-videos"
  });
}

async function getSpotifyToken() {
  if (spotifyToken && spotifyToken.expiresAt > Date.now() + 30000) {
    return spotifyToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.");
    error.code = "missing_config";
    throw error;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "client_credentials" })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || "Spotify token request failed.");
    error.code = data.error || "spotify_auth_error";
    throw error;
  }

  spotifyToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
  };
  return spotifyToken.accessToken;
}

async function handleSpotifySearch(req, res, url) {
  try {
    const q = cleanQuery(url.searchParams.get("q"), "lofi");
    const type = cleanQuery(url.searchParams.get("type"), "track,artist,album,playlist")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => ["track", "artist", "album", "playlist"].includes(item))
      .join(",") || "track";
    const token = await getSpotifyToken();
    const params = new URLSearchParams({ q, type, limit: "20", market: "US" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = {};
    }
    if (!response.ok) {
      return sendJson(res, response.status, {
        error: data.error?.status || "spotify_error",
        message: data.error?.message || data.error_description || raw || "Spotify search failed."
      });
    }
    sendJson(res, 200, normalizeSpotifySearch(data));
  } catch (error) {
    sendJson(res, error.code === "missing_config" ? 503 : 500, {
      error: error.code || "spotify_error",
      message: error.message
    });
  }
}

function imageOf(item) {
  return item.images?.[0]?.url || item.album?.images?.[0]?.url || "";
}

function normalizeSpotifySearch(data) {
  const mapItems = (collection, type) =>
    (collection?.items || []).filter(Boolean).map((item) => ({
      id: item.id,
      type,
      title: item.name,
      subtitle:
        type === "track"
          ? item.artists?.map((artist) => artist.name).join(", ")
          : type === "artist"
            ? `${item.followers?.total?.toLocaleString?.() || 0} followers`
            : item.artists?.map((artist) => artist.name).join(", ") || item.owner?.display_name || "Spotify",
      image: imageOf(item),
      uri: item.uri,
      externalUrl: item.external_urls?.spotify || "",
      playable: type !== "artist"
    }));

  return {
    tracks: mapItems(data.tracks, "track"),
    artists: mapItems(data.artists, "artist"),
    albums: mapItems(data.albums, "album"),
    playlists: mapItems(data.playlists, "playlist")
  };
}

function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REDIRECT_URI);
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
    res.end(`<h1>TikTok auth failed</h1><p>${data.error_description || data.message || "Token exchange failed."}</p>`);
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
    if (url.pathname === "/api/ai/chat") return await handleAiChat(req, res);
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
    if (req.method === "GET" && url.pathname === "/api/spotify/search") return await handleSpotifySearch(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/tiktok/auth/start") return await handleTikTokAuthStart(req, res);
    if (req.method === "GET" && url.pathname === "/api/tiktok/auth/callback") return await handleTikTokCallback(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/tiktok/profile") return await handleTikTokProfile(req, res);
    if (req.method === "GET" && url.pathname === "/api/tiktok/videos") return await handleTikTokVideos(req, res, url);
    if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not_found", message: "API route not found." });
    return serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: "server_error", message: error.message || "Unexpected server error." });
  }
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`vel.os running at http://localhost:${PORT}`);
});
