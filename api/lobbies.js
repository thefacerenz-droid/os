const LOBBIES_KEY = "velos:lobbies-v1";
const REDIS_CLIENT_KEY = "__velos_lobbies_redis_client_promise";
const MEMORY_KEY = "__velos_lobbies_store";
const LOBBY_PIN = "3745";
const NOTE_LIMIT = 8000;
const DRAWING_LIMIT = 700000;
const ENTRY_LIMIT = 36;
const ALLOWED_DRAWING = /^data:image\/(?:png|jpe?g|webp);base64,/i;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cleanText(value = "", limit = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanNote(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .slice(0, NOTE_LIMIT);
}

function cleanLobbyName(value = "") {
  const clean = cleanText(value, 28)
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "Main";
}

function cleanUser(input = {}) {
  return {
    userId: cleanText(input.userId, 64) || `guest-${Math.random().toString(36).slice(2, 10)}`,
    username: cleanText(input.username, 24) || "Guest"
  };
}

function getRequestPin(req, body = {}) {
  let queryPin = "";
  try {
    const url = new URL(req.url || "/", "http://localhost");
    queryPin = url.searchParams.get("pin") || "";
  } catch (error) {
    queryPin = "";
  }
  return cleanText(req.headers?.["x-vel-chat-pin"] || body.pin || queryPin, 12);
}

function hasValidPin(req, body = {}) {
  return getRequestPin(req, body) === LOBBY_PIN;
}

function sendPinRequired(res) {
  return sendJson(res, 401, {
    error: "pin_required",
    message: "Enter the startup PIN before opening shared lobbies."
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
    if (raw.length > DRAWING_LIMIT + NOTE_LIMIT + 4096) break;
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
    const error = new Error("Connect Redis/KV storage to make Lobbies permanent.");
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
      client.on("error", (error) => console.error("vel.os lobbies Redis error:", error.message));
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
}

function emptyLobby(name = "Main") {
  return {
    name,
    note: {
      content: "",
      updatedBy: "vel.os",
      updatedAt: 0
    },
    sketch: {
      prompt: "Draw the weirdest creature you can imagine.",
      promptBy: "vel.os",
      promptAt: 0,
      entries: []
    }
  };
}

function normalizeEntry(entry = {}) {
  const image = String(entry.image || "");
  if (!ALLOWED_DRAWING.test(image) || image.length > DRAWING_LIMIT) return null;
  return {
    id: cleanText(entry.id, 48) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    userId: cleanText(entry.userId, 64),
    username: cleanText(entry.username, 24) || "Guest",
    image,
    caption: cleanText(entry.caption, 120),
    prompt: cleanText(entry.prompt, 140),
    createdAt: Number(entry.createdAt) || Date.now()
  };
}

function normalizeLobby(lobby = {}, fallbackName = "Main") {
  const name = cleanLobbyName(lobby.name || fallbackName);
  const blank = emptyLobby(name);
  const entries = (Array.isArray(lobby.sketch?.entries) ? lobby.sketch.entries : [])
    .map(normalizeEntry)
    .filter(Boolean)
    .slice(0, ENTRY_LIMIT);
  return {
    name,
    note: {
      content: cleanNote(lobby.note?.content || ""),
      updatedBy: cleanText(lobby.note?.updatedBy, 24) || blank.note.updatedBy,
      updatedAt: Number(lobby.note?.updatedAt) || 0
    },
    sketch: {
      prompt: cleanText(lobby.sketch?.prompt, 140) || blank.sketch.prompt,
      promptBy: cleanText(lobby.sketch?.promptBy, 24) || blank.sketch.promptBy,
      promptAt: Number(lobby.sketch?.promptAt) || 0,
      entries
    }
  };
}

function normalizeStore(value = {}) {
  const lobbies = {};
  Object.entries(value?.lobbies || {}).forEach(([key, lobby]) => {
    const normalized = normalizeLobby(lobby, key);
    lobbies[normalized.name.toLowerCase()] = normalized;
  });
  ["Main", "Games", "Memes"].forEach((name) => {
    const key = name.toLowerCase();
    if (!lobbies[key]) lobbies[key] = emptyLobby(name);
  });
  return { lobbies };
}

async function readStore() {
  if (restKvConfigured()) {
    const raw = await kvCommand(["GET", LOBBIES_KEY]);
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
    const raw = await client.get(LOBBIES_KEY);
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
    await kvCommand(["SET", LOBBIES_KEY, JSON.stringify(normalized)]);
    return { ...normalized, storage: "kv", persistent: true };
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(LOBBIES_KEY, JSON.stringify(normalized));
    return { ...normalized, storage: "redis", persistent: true };
  }
  globalThis[MEMORY_KEY] = normalized;
  return { ...normalized, storage: "memory", persistent: false };
}

function getLobby(store, name) {
  const lobbyName = cleanLobbyName(name);
  const key = lobbyName.toLowerCase();
  if (!store.lobbies[key]) store.lobbies[key] = emptyLobby(lobbyName);
  return store.lobbies[key];
}

function serialize(store, lobbyName) {
  const lobby = getLobby(store, lobbyName);
  return {
    lobby,
    lobbies: Object.values(store.lobbies)
      .map((item) => ({
        name: item.name,
        updatedAt: Math.max(item.note?.updatedAt || 0, item.sketch?.promptAt || 0, item.sketch?.entries?.[0]?.createdAt || 0)
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 18),
    storage: store.storage || "memory",
    persistent: Boolean(store.persistent)
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (!hasValidPin(req)) return sendPinRequired(res);
      const url = new URL(req.url || "/", "http://localhost");
      const store = await readStore();
      return sendJson(res, 200, serialize(store, url.searchParams.get("lobby") || "Main"));
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use GET or POST for Lobbies."
      });
    }

    const body = await readRequestBody(req);
    if (!hasValidPin(req, body)) return sendPinRequired(res);

    const action = cleanText(body.action, 32);
    const lobbyName = cleanLobbyName(body.lobby || "Main");
    const user = cleanUser(body);
    const store = await readStore();
    const lobby = getLobby(store, lobbyName);

    if (action === "note") {
      lobby.note = {
        content: cleanNote(body.content || ""),
        updatedBy: user.username,
        updatedAt: Date.now()
      };
    } else if (action === "prompt") {
      lobby.sketch.prompt = cleanText(body.prompt, 140) || emptyLobby().sketch.prompt;
      lobby.sketch.promptBy = user.username;
      lobby.sketch.promptAt = Date.now();
      lobby.sketch.entries = [];
    } else if (action === "entry") {
      const image = String(body.image || "");
      if (!ALLOWED_DRAWING.test(image) || image.length > DRAWING_LIMIT) {
        return sendJson(res, 400, {
          error: "invalid_drawing",
          message: "That drawing is too large or not supported."
        });
      }
      const entry = normalizeEntry({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ...user,
        image,
        caption: body.caption,
        prompt: lobby.sketch.prompt,
        createdAt: Date.now()
      });
      lobby.sketch.entries = [entry, ...lobby.sketch.entries].filter(Boolean).slice(0, ENTRY_LIMIT);
    } else if (action === "clear-sketch") {
      lobby.sketch.entries = [];
    } else if (action === "clear-note") {
      lobby.note = {
        content: "",
        updatedBy: user.username,
        updatedAt: Date.now()
      };
    } else {
      return sendJson(res, 400, {
        error: "bad_action",
        message: "Choose a lobby action."
      });
    }

    const saved = await writeStore(store);
    return sendJson(res, 200, serialize(saved, lobbyName));
  } catch (error) {
    return sendJson(res, error.code === "missing_storage" ? 503 : 500, {
      error: error.code || "lobbies_error",
      message: error.message || "Lobbies failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "memory"
    });
  }
};
