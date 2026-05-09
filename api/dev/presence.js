const PRESENCE_KEY = "velos:dev-presence-v1";
const REDIS_CLIENT_KEY = "__velos_dev_presence_redis_client_promise";
const MEMORY_KEY = "__velos_dev_presence_store";
const SITE_PIN = process.env.VEL_OS_PIN || "74281";
const ADMIN_CODE = process.env.ADMIN_CODE || "918273";
const USER_ACTIVE_MS = 1000 * 60 * 8;

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

function cleanUser(input = {}) {
  const userId = cleanText(input.userId || input.id, 64).replace(/[^\w.-]/g, "");
  const username = cleanText(input.username || input.name, 24);
  if (!userId || !username) return null;
  return { userId, username };
}

function getQueryValue(req, key) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    return url.searchParams.get(key) || "";
  } catch (error) {
    return "";
  }
}

function getPin(req, body = {}) {
  return cleanText(req.headers?.["x-vel-chat-pin"] || body.pin || getQueryValue(req, "pin"), 32);
}

function getAdminCode(req, body = {}) {
  return cleanText(req.headers?.["x-vel-admin-code"] || body.adminCode || getQueryValue(req, "adminCode"), 64);
}

function hasSitePin(req, body = {}) {
  return getPin(req, body) === SITE_PIN;
}

function hasAdminAccess(req, body = {}) {
  return getAdminCode(req, body) === ADMIN_CODE;
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
    if (raw.length > 12000) break;
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
    const error = new Error("No persistent storage connected.");
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
      client.on("error", (error) => console.error("vel.os dev presence Redis error:", error.message));
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
}

function normalizeStore(value = {}) {
  const users = {};
  Object.entries(value?.users || {}).forEach(([key, user]) => {
    const person = cleanUser({ userId: user.userId || key, username: user.username });
    if (!person) return;
    users[person.userId] = {
      ...person,
      app: cleanText(user.app, 40) || "desktop",
      appTitle: cleanText(user.appTitle, 80) || "Desktop",
      panel: cleanText(user.panel, 40) || "desktop",
      path: cleanText(user.path, 120) || "/",
      lastSeen: Number(user.lastSeen) || 0
    };
  });
  return { users };
}

function prunePresence(store) {
  const now = Date.now();
  Object.entries(store.users || {}).forEach(([id, user]) => {
    if (!user?.lastSeen || now - user.lastSeen > USER_ACTIVE_MS) {
      delete store.users[id];
    }
  });
}

async function readStore() {
  if (restKvConfigured()) {
    const raw = await kvCommand(["GET", PRESENCE_KEY]);
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (error) {
      parsed = {};
    }
    return { ...normalizeStore(parsed), storage: "kv", persistent: true };
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(PRESENCE_KEY);
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (error) {
      parsed = {};
    }
    return { ...normalizeStore(parsed), storage: "redis", persistent: true };
  }
  globalThis[MEMORY_KEY] = normalizeStore(globalThis[MEMORY_KEY] || {});
  return { ...globalThis[MEMORY_KEY], storage: "memory", persistent: false };
}

async function writeStore(store) {
  const normalized = normalizeStore(store);
  if (restKvConfigured()) {
    await kvCommand(["SET", PRESENCE_KEY, JSON.stringify(normalized)]);
    return { ...normalized, storage: "kv", persistent: true };
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(PRESENCE_KEY, JSON.stringify(normalized));
    return { ...normalized, storage: "redis", persistent: true };
  }
  globalThis[MEMORY_KEY] = normalized;
  return { ...normalized, storage: "memory", persistent: false };
}

function serialize(store) {
  prunePresence(store);
  return {
    users: Object.values(store.users || {})
      .sort((left, right) => (right.lastSeen || 0) - (left.lastSeen || 0))
      .slice(0, 80),
    storage: store.storage || "memory",
    persistent: Boolean(store.persistent)
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (!hasAdminAccess(req)) {
        return sendJson(res, 401, {
          error: "admin_required",
          message: "Admin code required."
        });
      }
      const store = await readStore();
      const saved = await writeStore(store);
      return sendJson(res, 200, serialize(saved));
    }

    if (req.method === "POST") {
      const body = await readRequestBody(req);
      if (!hasSitePin(req, body)) {
        return sendJson(res, 401, {
          error: "pin_required",
          message: "Startup PIN required."
        });
      }
      const user = cleanUser(body);
      if (!user) {
        return sendJson(res, 400, {
          error: "bad_user",
          message: "A username is required for presence."
        });
      }
      const store = await readStore();
      prunePresence(store);
      store.users[user.userId] = {
        ...user,
        app: cleanText(body.app, 40) || "desktop",
        appTitle: cleanText(body.appTitle, 80) || "Desktop",
        panel: cleanText(body.panel, 40) || "desktop",
        path: cleanText(body.path, 120) || "/",
        lastSeen: Date.now()
      };
      const saved = await writeStore(store);
      return sendJson(res, 200, {
        ok: true,
        storage: saved.storage || "memory",
        persistent: Boolean(saved.persistent)
      });
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET or POST for Dev Panel presence."
    });
  } catch (error) {
    return sendJson(res, error.code === "missing_storage" ? 503 : 500, {
      error: error.code || "dev_presence_error",
      message: error.message || "Dev Panel failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "memory"
    });
  }
};
