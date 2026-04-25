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
  return Boolean(process.env.REDIS_URL);
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
  if (!process.env.REDIS_URL) return null;
  if (!globalThis[REDIS_CLIENT_KEY]) {
    globalThis[REDIS_CLIENT_KEY] = (async () => {
      let createClient;
      try {
        ({ createClient } = require("redis"));
      } catch (error) {
        throw new Error("The redis package is missing. Run npm install, commit package.json, and redeploy.");
      }
      const client = createClient({ url: process.env.REDIS_URL });
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

  const nextItem = normalizeGlobalYouTubeItem(body);
  if (!nextItem) {
    return sendJson(res, 400, {
      error: "invalid_youtube_link",
      message: "Paste a valid YouTube video link, Shorts link, youtu.be link, or 11-character video ID."
    });
  }

  const store = await readGlobalStore();
  if (!store.persistent) {
    return sendJson(res, 503, {
      error: "missing_storage",
      message: store.message
    });
  }
  const items = [
    nextItem,
    ...store.items.filter((item) => item.id !== nextItem.id)
  ].slice(0, GLOBAL_YOUTUBE_LIMIT);
  const storage = await writeGlobalStore(items);
  return sendJson(res, 201, { item: nextItem, items, storage });
};
