const TYPING_KEY = "velos:chat-typing-v1";
const REDIS_CLIENT_KEY = "__velos_chat_typing_redis_client_promise";
const MEMORY_KEY = "__velos_chat_typing_store";
const CHAT_PIN = process.env.VEL_OS_PIN || "74281";
const TYPING_ACTIVE_MS = 4500;
const { broadcastLiveEvent } = require("./live.js");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cleanText(value = "", limit = 160) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanId(value = "", limit = 96) {
  return cleanText(value, limit).replace(/[^\w.-]/g, "").slice(0, limit);
}

function getRequestPin(req, body = {}) {
  let queryPin = "";
  try {
    const url = new URL(req.url || "/", "http://localhost");
    queryPin = url.searchParams.get("pin") || "";
  } catch (error) {
    queryPin = "";
  }
  return cleanText(req.headers?.["x-vel-chat-pin"] || body.pin || queryPin, 32);
}

function hasValidPin(req, body = {}) {
  return getRequestPin(req, body) === CHAT_PIN;
}

function sendPinRequired(res) {
  return sendJson(res, 401, {
    error: "pin_required",
    message: "Enter the chat PIN before syncing typing."
  });
}

async function readRequestBody(req) {
  if (typeof req.body === "object" && req.body) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch (error) {
      return {};
    }
  }
  if (!req || typeof req[Symbol.asyncIterator] !== "function") return {};
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 6000) break;
  }
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    return {};
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

function getRedisUrl() {
  let value = String(process.env.REDIS_URL || "").trim();
  if (!value) return "";
  value = value.replace(/^REDIS_URL\s*=\s*/i, "").trim();
  value = value.replace(/^["']|["']$/g, "").trim();
  return value;
}

function redisUrlConfigured() {
  return Boolean(getRedisUrl());
}

function validateRedisUrl(value) {
  try {
    const parsed = new URL(value);
    if (!["redis:", "rediss:"].includes(parsed.protocol)) throw new Error("Bad Redis protocol.");
    return value;
  } catch (error) {
    const invalid = new Error("REDIS_URL is invalid. Paste only the redis:// or rediss:// connection string.");
    invalid.code = "invalid_redis_url";
    throw invalid;
  }
}

async function kvCommand(command) {
  const config = getKvConfig();
  if (!config.url || !config.token) {
    const error = new Error("No typing storage connected.");
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
  if (!response.ok) throw new Error(data.error || "KV request failed.");
  return data.result;
}

async function getRedisClient() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (!globalThis[REDIS_CLIENT_KEY]) {
    globalThis[REDIS_CLIENT_KEY] = (async () => {
      const { createClient } = require("redis");
      const client = createClient({ url: validateRedisUrl(redisUrl) });
      client.on("error", (error) => console.error("vel.os typing Redis error:", error.message));
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
}

function normalizeTypingStore(value = {}) {
  const users = {};
  Object.entries(value?.users || {}).forEach(([key, user]) => {
    const userId = cleanId(user.userId || key, 64);
    const username = cleanText(user.username, 24);
    if (!userId || !username) return;
    users[userId] = {
      userId,
      username,
      deviceId: cleanId(user.deviceId, 96),
      updatedAt: Number(user.updatedAt) || 0
    };
  });
  return { users };
}

function pruneTyping(store) {
  const now = Date.now();
  Object.entries(store.users || {}).forEach(([id, user]) => {
    if (!user?.updatedAt || now - user.updatedAt > TYPING_ACTIVE_MS) {
      delete store.users[id];
    }
  });
}

async function readStore() {
  if (restKvConfigured()) {
    const raw = await kvCommand(["GET", TYPING_KEY]);
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (error) {
      parsed = {};
    }
    return { ...normalizeTypingStore(parsed), storage: "kv", persistent: true };
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(TYPING_KEY);
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (error) {
      parsed = {};
    }
    return { ...normalizeTypingStore(parsed), storage: "redis", persistent: true };
  }
  globalThis[MEMORY_KEY] = normalizeTypingStore(globalThis[MEMORY_KEY] || {});
  return { ...globalThis[MEMORY_KEY], storage: "memory", persistent: false };
}

async function writeStore(store) {
  const normalized = normalizeTypingStore(store);
  if (restKvConfigured()) {
    await kvCommand(["SET", TYPING_KEY, JSON.stringify(normalized)]);
    return { ...normalized, storage: "kv", persistent: true };
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(TYPING_KEY, JSON.stringify(normalized));
    return { ...normalized, storage: "redis", persistent: true };
  }
  globalThis[MEMORY_KEY] = normalized;
  return { ...normalized, storage: "memory", persistent: false };
}

function serialize(store) {
  pruneTyping(store);
  return {
    typing: Object.values(store.users || {})
      .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
      .slice(0, 12),
    storage: store.storage || "memory",
    persistent: Boolean(store.persistent)
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (!hasValidPin(req)) return sendPinRequired(res);
      const store = await readStore();
      const saved = await writeStore(store);
      return sendJson(res, 200, serialize(saved));
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use GET or POST for typing."
      });
    }

    const body = await readRequestBody(req);
    if (!hasValidPin(req, body)) return sendPinRequired(res);

    const userId = cleanId(body.userId, 64);
    const username = cleanText(body.username, 24);
    if (!userId || !username) {
      return sendJson(res, 400, {
        error: "bad_user",
        message: "A username is required for typing."
      });
    }

    const store = await readStore();
    pruneTyping(store);
    if (body.typing === false) {
      delete store.users[userId];
    } else {
      store.users[userId] = {
        userId,
        username,
        deviceId: cleanId(body.deviceId, 96),
        updatedAt: Date.now()
      };
    }
    const saved = await writeStore(store);
    broadcastLiveEvent("chat-typing", {
      userId,
      username,
      deviceId: cleanId(body.deviceId, 96),
      typing: body.typing !== false
    });
    return sendJson(res, 200, serialize(saved));
  } catch (error) {
    return sendJson(res, error.code === "missing_storage" ? 503 : 500, {
      error: error.code || "typing_error",
      message: error.message || "Typing failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "memory"
    });
  }
};
