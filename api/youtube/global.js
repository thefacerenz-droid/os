const GLOBAL_YOUTUBE_LIMIT = 200;
const KV_KEY = "velos:global-youtube-favorites";
const REDIS_CLIENT_KEY = "__velos_redis_client_promise";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cleanGlobalText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 120);
}

function decodeXml(value = "") {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function isYouTubeUrl(value = "") {
  try {
    const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(String(value || "").trim())
      ? String(value || "").trim()
      : `https://${String(value || "").trim()}`;
    const url = new URL(normalized);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  } catch (error) {
    return false;
  }
}

function getXmlTag(block = "", tagName = "") {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return decodeXml(match?.[1] || "");
}

function getXmlAttribute(block = "", tagName = "", attribute = "") {
  const match = block.match(new RegExp(`<${tagName}[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return decodeXml(match?.[1] || "");
}

function parseYouTubeFeedItems(xml = "") {
  const channel = getXmlTag(xml, "title") || "YouTube Channel";
  return [...String(xml || "").matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]
    .map((match) => {
      const block = match[1];
      const id = getXmlTag(block, "yt:videoId");
      if (!id) return null;
      const description = getXmlTag(block, "media:description") || `Shared from ${channel}.`;
      return {
        id,
        title: cleanGlobalText(getXmlTag(block, "title"), "Shared YouTube Video"),
        channel: cleanGlobalText(getXmlTag(block, "name"), channel),
        thumbnail: cleanGlobalText(getXmlAttribute(block, "media:thumbnail", "url"), `https://i.ytimg.com/vi/${id}/hqdefault.jpg`),
        publishedAt: cleanGlobalText(getXmlTag(block, "published")),
        description: cleanGlobalText(description, `Shared from ${channel}.`),
        addedAt: Date.now()
      };
    })
    .filter(Boolean)
    .slice(0, 25);
}

async function resolveYouTubeFeedUrl(value = "") {
  if (!isYouTubeUrl(value)) return "";
  const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(String(value || "").trim())
    ? String(value || "").trim()
    : `https://${String(value || "").trim()}`;
  const url = new URL(normalized);

  if (url.pathname.includes("/feeds/videos.xml") && url.searchParams.get("channel_id")) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(url.searchParams.get("channel_id"))}`;
  }

  const channelMatch = url.pathname.match(/\/channel\/([^/?#]+)/i);
  if (channelMatch?.[1]) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelMatch[1])}`;
  }

  if (!/^\/(@|c\/|user\/)/i.test(url.pathname)) return "";
  const pageResponse = await fetch(normalized, {
    headers: {
      "User-Agent": "Mozilla/5.0 vel.os Global Favs channel importer"
    }
  });
  const html = await pageResponse.text();
  if (!pageResponse.ok) return "";
  const rssMatch = html.match(/https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=[^"&<]+/i);
  return rssMatch?.[0]?.replace(/\\u0026/g, "&") || "";
}

async function getChannelImportItems(value = "") {
  const feedUrl = await resolveYouTubeFeedUrl(value);
  if (!feedUrl) return [];
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 vel.os Global Favs channel importer"
    }
  });
  const xml = await response.text();
  if (!response.ok) return [];
  return parseYouTubeFeedItems(xml);
}

function getKvConfig() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
  };
}

function restKvConfigured() {
  const config = getKvConfig();
  return Boolean(config.url && config.token);
}

function redisUrlConfigured() {
  return Boolean(getRedisUrl());
}

function getRedisUrl() {
  let value = String(process.env.REDIS_URL || "").trim();
  if (!value) return "";

  // Vercel quickstarts show REDIS_URL="..."; if that whole line is pasted as
  // the env var value, clean it up instead of failing with ERR_INVALID_URL.
  value = value.replace(/^REDIS_URL\s*=\s*/i, "").trim();
  value = value.replace(/^["']|["']$/g, "").trim();
  return value;
}

function validateRedisUrl(value) {
  try {
    const parsed = new URL(value);
    if (!["redis:", "rediss:"].includes(parsed.protocol)) {
      throw new Error("Redis URL must start with redis:// or rediss://.");
    }
    return value;
  } catch (error) {
    const invalid = new Error("REDIS_URL is invalid. In Vercel, set the key to REDIS_URL and paste only the connection string value, starting with redis:// or rediss://.");
    invalid.code = "invalid_redis_url";
    throw invalid;
  }
}

async function kvCommand(command) {
  const config = getKvConfig();
  if (!config.url || !config.token) {
    const error = new Error("Connect Vercel KV or Upstash Redis to make Global Favs permanent.");
    error.code = "missing_storage";
    throw error;
  }
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Vercel KV request failed.");
  return data.result;
}

async function getRedisClient() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (!globalThis[REDIS_CLIENT_KEY]) {
    globalThis[REDIS_CLIENT_KEY] = (async () => {
      const validRedisUrl = validateRedisUrl(redisUrl);
      let createClient;
      try {
        ({ createClient } = require("redis"));
      } catch (error) {
        throw new Error("The redis package is missing. Run npm install, commit package.json, and redeploy.");
      }
      const client = createClient({ url: validRedisUrl });
      client.on("error", (error) => {
        console.error("vel.os Redis error:", error.message);
      });
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
}

async function readRedisStore() {
  const client = await getRedisClient();
  const raw = await client.get(KV_KEY);
  let items = [];
  try {
    items = raw ? JSON.parse(raw) : [];
  } catch (error) {
    items = [];
  }
  return {
    items: Array.isArray(items) ? items.filter((item) => item?.id).slice(0, GLOBAL_YOUTUBE_LIMIT) : [],
    storage: "redis",
    persistent: true,
    message: "Permanent Global Favs storage is connected through Redis."
  };
}

async function readGlobalStore() {
  if (restKvConfigured()) {
    const raw = await kvCommand(["GET", KV_KEY]);
    let items = [];
    try {
      items = raw ? JSON.parse(raw) : [];
    } catch (error) {
      items = [];
    }
    return {
      items: Array.isArray(items) ? items.filter((item) => item?.id).slice(0, GLOBAL_YOUTUBE_LIMIT) : [],
      storage: "kv",
      persistent: true,
      message: "Permanent Global Favs storage is connected through KV."
    };
  }

  if (redisUrlConfigured()) {
    return readRedisStore();
  }

  return {
    items: [],
    storage: "missing",
    persistent: false,
    message: "Permanent Global Favs storage is not connected yet. Connect Redis to the project, make sure REDIS_URL exists, then redeploy."
  };
}

async function writeGlobalStore(items) {
  const nextItems = items.slice(0, GLOBAL_YOUTUBE_LIMIT);
  if (restKvConfigured()) {
    await kvCommand(["SET", KV_KEY, JSON.stringify(nextItems)]);
    return "kv";
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(KV_KEY, JSON.stringify(nextItems));
    return "redis";
  }
  const error = new Error("Permanent Global Favs storage is not connected yet. Connect Redis to the project, make sure REDIS_URL exists, then redeploy.");
  error.code = "missing_storage";
  throw error;
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

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const store = await readGlobalStore();
      return sendJson(res, 200, {
        items: store.items,
        storage: store.storage,
        persistent: store.persistent,
        message: store.message
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use GET or POST for global YouTube favorites."
      });
    }

    let body = {};
    try {
      body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    } catch (error) {
      body = {};
    }

    const importType = String(body.importType || "video").toLowerCase();
    const nextItem = importType === "channel" ? null : normalizeGlobalYouTubeItem(body);
    const channelItems = nextItem ? [] : await getChannelImportItems(body.url || body.id);
    if (!nextItem && !channelItems.length) {
      return sendJson(res, 400, {
        error: "invalid_youtube_link",
        message: "Paste a valid YouTube video link, Shorts link, youtu.be link, video ID, or YouTube channel videos URL."
      });
    }

    const store = await readGlobalStore();
    if (!store.persistent) {
      return sendJson(res, 503, {
        error: "missing_storage",
        message: store.message
      });
    }
    const nextItems = nextItem ? [nextItem] : channelItems;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const items = [
      ...nextItems,
      ...store.items.filter((item) => !nextIds.has(item.id))
    ].slice(0, GLOBAL_YOUTUBE_LIMIT);
    const storage = await writeGlobalStore(items);
    return sendJson(res, 201, {
      item: nextItem || nextItems[0],
      items,
      storage,
      importedCount: nextItems.length
    });
  } catch (error) {
    return sendJson(res, error.code === "missing_storage" ? 503 : 500, {
      error: error.code || "global_favs_error",
      message: error.message || "Global Favs storage failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "missing"
    });
  }
};
