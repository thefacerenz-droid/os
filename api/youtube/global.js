const GLOBAL_YOUTUBE_LIMIT = 200;
const STORE_KEY = "__velos_global_youtube_favorites";
const KV_KEY = "velos:global-youtube-favorites";

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

function getMemoryStore() {
  if (!globalThis[STORE_KEY]) globalThis[STORE_KEY] = [];
  return globalThis[STORE_KEY];
}

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Vercel KV request failed.");
  return data.result;
}

async function readGlobalStore() {
  if (!kvConfigured()) {
    return { items: getMemoryStore(), storage: "memory" };
  }

  const raw = await kvCommand(["GET", KV_KEY]);
  let items = [];
  try {
    items = raw ? JSON.parse(raw) : [];
  } catch (error) {
    items = [];
  }
  return {
    items: Array.isArray(items) ? items.filter((item) => item?.id).slice(0, GLOBAL_YOUTUBE_LIMIT) : [],
    storage: "kv"
  };
}

async function writeGlobalStore(items) {
  const nextItems = items.slice(0, GLOBAL_YOUTUBE_LIMIT);
  if (!kvConfigured()) {
    globalThis[STORE_KEY] = nextItems;
    return "memory";
  }
  await kvCommand(["SET", KV_KEY, JSON.stringify(nextItems)]);
  return "kv";
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
      storage: store.storage
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
  const items = [
    nextItem,
    ...store.items.filter((item) => item.id !== nextItem.id)
  ].slice(0, GLOBAL_YOUTUBE_LIMIT);
  const storage = await writeGlobalStore(items);
  return sendJson(res, 201, { item: nextItem, items, storage });
};
