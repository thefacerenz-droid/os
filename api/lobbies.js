const LOBBIES_KEY = "velos:lobbies-v1";
const REDIS_CLIENT_KEY = "__velos_lobbies_redis_client_promise";
const MEMORY_KEY = "__velos_lobbies_store";
const LOBBY_PIN = process.env.VEL_OS_PIN || "74281";
const NOTE_LIMIT = 8000;
const DRAWING_LIMIT = 700000;
const ENTRY_LIMIT = 36;
const INVITE_LIMIT = 80;
const USER_ACTIVE_MS = 1000 * 60 * 8;
const STROKE_LIMIT = 900;
const STROKE_POINT_LIMIT = 180;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;
const ALLOWED_DRAWING = /^data:image\/(?:png|jpe?g|webp);base64,/i;
const handleLive = require("../lib/live.js");
const { broadcastLiveEvent } = handleLive;

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

function cleanPerson(input = {}) {
  const userId = cleanText(input.userId || input.id, 64);
  const username = cleanText(input.username || input.name, 24);
  if (!userId || !username) return null;
  return { userId, username };
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
    message: "Enter the startup PIN before opening Notebook."
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
      const error = new Error("Connect Redis/KV storage to make Notebook permanent.");
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
      canvasUpdatedAt: 0,
      collaborators: [],
      strokes: [],
      entries: []
    }
  };
}

function normalizeEntry(entry = {}) {
  const image = String(entry.image || "");
  if (!ALLOWED_DRAWING.test(image) || image.length > DRAWING_LIMIT) return null;
  const fallbackAuthor = cleanPerson(entry) || { userId: cleanText(entry.userId, 64), username: cleanText(entry.username, 24) || "Guest" };
  const authors = (Array.isArray(entry.authors) ? entry.authors : [fallbackAuthor])
    .map(cleanPerson)
    .filter(Boolean)
    .filter((person, index, people) => people.findIndex((item) => item.userId === person.userId) === index)
    .slice(0, 8);
  return {
    id: cleanText(entry.id, 48) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    userId: cleanText(entry.userId, 64) || authors[0]?.userId || "",
    username: cleanText(entry.username, 24) || authors[0]?.username || "Guest",
    authors,
    image,
    caption: cleanText(entry.caption, 120),
    prompt: cleanText(entry.prompt, 140),
    createdAt: Number(entry.createdAt) || Date.now()
  };
}

function clampNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizePoint(point = {}) {
  const x = clampNumber(point.x, 0, CANVAS_WIDTH, NaN);
  const y = clampNumber(point.y, 0, CANVAS_HEIGHT, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100
  };
}

function normalizeStroke(stroke = {}) {
  const person = cleanPerson(stroke);
  const points = (Array.isArray(stroke.points) ? stroke.points : [])
    .map(normalizePoint)
    .filter(Boolean)
    .slice(0, STROKE_POINT_LIMIT);
  if (!person || points.length < 2) return null;
  const color = /^#[0-9a-f]{6}$/i.test(String(stroke.color || ""))
    ? String(stroke.color).toLowerCase()
    : "#050505";
  return {
    id: cleanText(stroke.id, 48) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    userId: person.userId,
    username: person.username,
    color,
    size: Math.round(clampNumber(stroke.size, 2, 28, 8) * 10) / 10,
    points,
    createdAt: Number(stroke.createdAt) || Date.now()
  };
}

function normalizeInvite(invite = {}) {
  const id = cleanText(invite.id, 48);
  const from = cleanPerson({
    userId: invite.fromUserId || invite.from?.userId,
    username: invite.fromUsername || invite.from?.username
  });
  const to = cleanPerson({
    userId: invite.toUserId || invite.to?.userId,
    username: invite.toUsername || invite.to?.username
  });
  if (!id || !from || !to) return null;
  return {
    id,
    lobby: cleanLobbyName(invite.lobby || "Main"),
    prompt: cleanText(invite.prompt, 140),
    fromUserId: from.userId,
    fromUsername: from.username,
    toUserId: to.userId,
    toUsername: to.username,
    createdAt: Number(invite.createdAt) || Date.now()
  };
}

function normalizeLobby(lobby = {}, fallbackName = "Main") {
  const name = cleanLobbyName(lobby.name || fallbackName);
  const blank = emptyLobby(name);
  const entries = (Array.isArray(lobby.sketch?.entries) ? lobby.sketch.entries : [])
    .map(normalizeEntry)
    .filter(Boolean)
    .slice(0, ENTRY_LIMIT);
  const collaborators = (Array.isArray(lobby.sketch?.collaborators) ? lobby.sketch.collaborators : [])
    .map(cleanPerson)
    .filter(Boolean)
    .filter((person, index, people) => people.findIndex((item) => item.userId === person.userId) === index)
    .slice(0, 8);
  const strokes = (Array.isArray(lobby.sketch?.strokes) ? lobby.sketch.strokes : [])
    .map(normalizeStroke)
    .filter(Boolean)
    .slice(-STROKE_LIMIT);
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
      canvasUpdatedAt: Number(lobby.sketch?.canvasUpdatedAt) || 0,
      collaborators,
      strokes,
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
  const users = {};
  Object.entries(value?.users || {}).forEach(([key, user]) => {
    const person = cleanPerson(user);
    if (!person) return;
    users[person.userId || key] = {
      ...person,
      lobby: cleanLobbyName(user.lobby || "Main"),
      lastSeen: Number(user.lastSeen) || 0
    };
  });
  const invites = (Array.isArray(value?.invites) ? value.invites : [])
    .map(normalizeInvite)
    .filter(Boolean)
    .slice(0, INVITE_LIMIT);
  return { lobbies, users, invites };
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

function prunePresence(store) {
  const now = Date.now();
  Object.entries(store.users || {}).forEach(([id, user]) => {
    if (!user?.lastSeen || now - user.lastSeen > USER_ACTIVE_MS) {
      delete store.users[id];
    }
  });
  store.invites = (store.invites || []).filter((invite) => now - (invite.createdAt || now) < USER_ACTIVE_MS * 4);
}

function touchUser(store, user, lobbyName) {
  if (!user?.userId) return;
  prunePresence(store);
  store.users[user.userId] = {
    userId: user.userId,
    username: user.username || "Guest",
    lobby: cleanLobbyName(lobbyName),
    lastSeen: Date.now()
  };
}

function addCollaborators(lobby, people = []) {
  const current = Array.isArray(lobby.sketch.collaborators) ? lobby.sketch.collaborators : [];
  lobby.sketch.collaborators = [...current, ...people]
    .map(cleanPerson)
    .filter(Boolean)
    .filter((person, index, list) => list.findIndex((item) => item.userId === person.userId) === index)
    .slice(0, 8);
}

function getActiveUsers(store) {
  prunePresence(store);
  return Object.values(store.users || {})
    .filter((user) => user?.userId && user?.username)
    .sort((left, right) => (right.lastSeen || 0) - (left.lastSeen || 0))
    .slice(0, 50);
}

function getPendingInvites(store, userId = "") {
  if (!userId) return [];
  return (store.invites || [])
    .filter((invite) => invite.toUserId === userId)
    .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
    .slice(0, 20);
}

function canDeleteEntry(entry, user) {
  if (!entry || !user?.userId) return false;
  return entry.userId === user.userId
    || (entry.authors || []).some((author) => author.userId === user.userId);
}

function serialize(store, lobbyName, user = null) {
  const lobby = getLobby(store, lobbyName);
  return {
    lobby,
    lobbies: Object.values(store.lobbies)
      .map((item) => ({
        name: item.name,
        updatedAt: Math.max(item.note?.updatedAt || 0, item.sketch?.promptAt || 0, item.sketch?.canvasUpdatedAt || 0, item.sketch?.entries?.[0]?.createdAt || 0)
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 18),
    users: getActiveUsers(store),
    invites: getPendingInvites(store, user?.userId),
    storage: store.storage || "memory",
    persistent: Boolean(store.persistent)
  };
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && url.searchParams.get("__live") === "1") {
      return handleLive(req, res);
    }

    if (req.method === "GET") {
      if (!hasValidPin(req)) return sendPinRequired(res);
      const store = await readStore();
      const user = cleanPerson({
        userId: url.searchParams.get("userId") || "",
        username: url.searchParams.get("username") || ""
      });
      if (user) {
        touchUser(store, user, url.searchParams.get("lobby") || "Main");
        const saved = await writeStore(store);
        return sendJson(res, 200, serialize(saved, url.searchParams.get("lobby") || "Main", user));
      }
      return sendJson(res, 200, serialize(store, url.searchParams.get("lobby") || "Main"));
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use GET or POST for Notebook."
      });
    }

    const body = await readRequestBody(req);
    if (!hasValidPin(req, body)) return sendPinRequired(res);

    const action = cleanText(body.action, 32);
    let lobbyName = cleanLobbyName(body.lobby || "Main");
    const user = cleanUser(body);
    const store = await readStore();
    touchUser(store, user, lobbyName);
    let lobby = getLobby(store, lobbyName);

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
      lobby.sketch.canvasUpdatedAt = Date.now();
      lobby.sketch.collaborators = [user];
      lobby.sketch.strokes = [];
      lobby.sketch.entries = [];
    } else if (action === "stroke") {
      const stroke = normalizeStroke({
        ...(body.stroke && typeof body.stroke === "object" ? body.stroke : {}),
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        userId: user.userId,
        username: user.username,
        createdAt: Date.now()
      });
      if (!stroke) {
        return sendJson(res, 400, {
          error: "invalid_stroke",
          message: "That shared stroke could not be synced."
        });
      }
      addCollaborators(lobby, [user]);
      lobby.sketch.strokes = [...(lobby.sketch.strokes || []), stroke].slice(-STROKE_LIMIT);
      lobby.sketch.canvasUpdatedAt = Date.now();
    } else if (action === "clear-canvas") {
      addCollaborators(lobby, [user]);
      lobby.sketch.strokes = [];
      lobby.sketch.canvasUpdatedAt = Date.now();
    } else if (action === "entry") {
      const image = String(body.image || "");
      if (!ALLOWED_DRAWING.test(image) || image.length > DRAWING_LIMIT) {
        return sendJson(res, 400, {
          error: "invalid_drawing",
          message: "That drawing is too large or not supported."
        });
      }
      addCollaborators(lobby, [user]);
      const entry = normalizeEntry({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ...user,
        authors: lobby.sketch.collaborators,
        image,
        caption: body.caption,
        prompt: lobby.sketch.prompt,
        createdAt: Date.now()
      });
      lobby.sketch.entries = [entry, ...lobby.sketch.entries].filter(Boolean).slice(0, ENTRY_LIMIT);
      lobby.sketch.strokes = [];
      lobby.sketch.canvasUpdatedAt = Date.now();
    } else if (action === "delete-entry") {
      const entryId = cleanText(body.entryId, 48);
      const entry = lobby.sketch.entries.find((item) => item.id === entryId);
      if (!entry) {
        return sendJson(res, 404, {
          error: "missing_entry",
          message: "That sketch is already gone."
        });
      }
      if (!canDeleteEntry(entry, user)) {
        return sendJson(res, 403, {
          error: "not_entry_author",
          message: "Only sketch authors can delete that post."
        });
      }
      lobby.sketch.entries = lobby.sketch.entries.filter((item) => item.id !== entryId);
    } else if (action === "invite") {
      const targetUserId = cleanText(body.targetUserId, 64);
      const target = store.users[targetUserId];
      if (!target || target.userId === user.userId) {
        return sendJson(res, 404, {
          error: "missing_user",
          message: "That person is not online in Notebook right now."
        });
      }
      const invite = normalizeInvite({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        lobby: lobby.name,
        prompt: lobby.sketch.prompt,
        fromUserId: user.userId,
        fromUsername: user.username,
        toUserId: target.userId,
        toUsername: target.username,
        createdAt: Date.now()
      });
      store.invites = [
        invite,
        ...store.invites.filter((item) => !(item.lobby.toLowerCase() === invite.lobby.toLowerCase() && item.fromUserId === invite.fromUserId && item.toUserId === invite.toUserId))
      ].slice(0, INVITE_LIMIT);
      addCollaborators(lobby, [user]);
    } else if (action === "invite-response") {
      const inviteId = cleanText(body.inviteId, 48);
      const invite = store.invites.find((item) => item.id === inviteId && item.toUserId === user.userId);
      if (!invite) {
        return sendJson(res, 404, {
          error: "missing_invite",
          message: "That invite is no longer active."
        });
      }
      store.invites = store.invites.filter((item) => item.id !== inviteId);
      if (body.accepted === true) {
        lobbyName = invite.lobby;
        lobby = getLobby(store, lobbyName);
        addCollaborators(lobby, [
          { userId: invite.fromUserId, username: invite.fromUsername },
          user
        ]);
        touchUser(store, user, lobbyName);
      }
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
        message: "Choose a Notebook action."
      });
    }

    const saved = await writeStore(store);
    broadcastLiveEvent("lobby", {
      action,
      lobby: lobbyName,
      userId: user.userId,
      username: user.username,
      targetUserId: cleanText(body.targetUserId || "", 64),
      inviteId: cleanText(body.inviteId || "", 48)
    });
    return sendJson(res, 200, serialize(saved, lobbyName, user));
  } catch (error) {
    return sendJson(res, error.code === "missing_storage" ? 503 : 500, {
      error: error.code || "lobbies_error",
      message: error.message || "Notebook failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "memory"
    });
  }
};
