const SCREEN_PREFIX = "velos:screen:";
const SCREEN_MEMORY_KEY = "__velos_screen_sessions";
const REDIS_CLIENT_KEY = "__velos_screen_redis_client_promise";
const SCREEN_TTL_MS = 1000 * 60 * 8;
const SITE_PIN = process.env.VEL_OS_PIN || "74281";
const ADMIN_CODE = process.env.VEL_OS_ADMIN_CODE || process.env.ADMIN_CODE || "admin7945";
const { broadcastLiveEvent } = require("../../live.js");
const BUILT_IN_ADMIN_DEVICE_IDS = ["3fa56c0a", "a9f794a2-9e8f-4d01-acdc-3b707472ae2e"];
const ADMIN_DEVICE_IDS = [
  ...(process.env.VEL_OS_ADMIN_DEVICE_IDS || "").split(/[\s,]+/),
  ...(process.env.ADMIN_DEVICE_ID || "").split(/[\s,]+/),
  ...BUILT_IN_ADMIN_DEVICE_IDS
]
  .map((id) => cleanId(id, 96))
  .filter(Boolean)
  .filter((id, index, list) => list.indexOf(id) === index);

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

function getAdminDeviceId(req, body = {}) {
  return cleanId(req.headers?.["x-vel-device-id"] || body.adminDeviceId || getQueryValue(req, "adminDeviceId"), 96);
}

function hasSitePin(req, body = {}) {
  return getPin(req, body) === SITE_PIN;
}

function isAllowedAdminDevice(deviceId = "") {
  const currentDeviceId = cleanId(deviceId, 96);
  if (!ADMIN_DEVICE_IDS.length) return true;
  return ADMIN_DEVICE_IDS.some((adminDeviceId) => currentDeviceId === adminDeviceId || currentDeviceId.startsWith(adminDeviceId));
}

function hasAdminAccess(req, body = {}) {
  return getAdminCode(req, body) === ADMIN_CODE && isAllowedAdminDevice(getAdminDeviceId(req, body));
}

function redisUrlConfigured() {
  return Boolean(process.env.REDIS_URL);
}

function validateRedisUrl(value = "") {
  const url = new URL(value);
  if (!["redis:", "rediss:"].includes(url.protocol)) {
    throw new Error("REDIS_URL must start with redis:// or rediss://");
  }
  return url.toString();
}

async function getRedisClient() {
  if (!globalThis[REDIS_CLIENT_KEY]) {
    globalThis[REDIS_CLIENT_KEY] = (async () => {
      const { createClient } = require("redis");
      const client = createClient({ url: validateRedisUrl(process.env.REDIS_URL) });
      client.on("error", (error) => console.error("vel.os screen Redis error:", error.message));
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
}

async function readBody(req) {
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
    if (raw.length > 120000) break;
  }
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    return {};
  }
}

function normalizeSession(value = {}, id = "") {
  const messages = Array.isArray(value.messages) ? value.messages : [];
  return {
    id: cleanId(value.id || id, 96),
    targetUserId: cleanId(value.targetUserId, 64),
    targetDeviceId: cleanId(value.targetDeviceId, 96),
    targetName: cleanText(value.targetName, 32),
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
    status: cleanId(value.status, 32) || "requested",
    messages: messages
      .map((item) => ({
        id: Number(item.id) || Date.now(),
        at: Number(item.at) || Date.now(),
        from: cleanId(item.from, 16),
        type: cleanId(item.type, 32),
        payload: item.payload || null
      }))
      .filter((item) => item.from && item.type)
      .slice(-160)
  };
}

function getMemoryStore() {
  globalThis[SCREEN_MEMORY_KEY] ||= {};
  Object.entries(globalThis[SCREEN_MEMORY_KEY]).forEach(([id, session]) => {
    if (!session?.updatedAt || Date.now() - session.updatedAt > SCREEN_TTL_MS) {
      delete globalThis[SCREEN_MEMORY_KEY][id];
    }
  });
  return globalThis[SCREEN_MEMORY_KEY];
}

async function readSession(id = "") {
  const sessionId = cleanId(id, 96);
  if (!sessionId) return null;
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(`${SCREEN_PREFIX}${sessionId}`);
    return raw ? normalizeSession(JSON.parse(raw), sessionId) : null;
  }
  return getMemoryStore()[sessionId] || null;
}

async function writeSession(session = {}) {
  const normalized = normalizeSession(session, session.id);
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(`${SCREEN_PREFIX}${normalized.id}`, JSON.stringify(normalized), {
      PX: SCREEN_TTL_MS
    });
    return normalized;
  }
  getMemoryStore()[normalized.id] = normalized;
  return normalized;
}

async function resetSession(req, res, body) {
  if (!hasAdminAccess(req, body)) {
    return sendJson(res, 401, {
      error: "admin_required",
      message: getAdminCode(req, body) === ADMIN_CODE
        ? "You're not whitelisted for Dev Panel."
        : "Admin code required."
    });
  }
  const sessionId = cleanId(body.sessionId, 96);
  if (!sessionId) {
    return sendJson(res, 400, {
      error: "bad_session",
      message: "Screen session missing."
    });
  }
  const session = await writeSession({
    id: sessionId,
    targetUserId: cleanId(body.targetUserId, 64),
    targetDeviceId: cleanId(body.targetDeviceId, 96),
    targetName: cleanText(body.targetName, 32),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "requested",
    messages: []
  });
  broadcastLiveEvent("screen", {
    action: "reset",
    sessionId,
    targetUserId: session.targetUserId,
    targetDeviceId: session.targetDeviceId
  });
  return sendJson(res, 200, { ok: true, session });
}

async function signalSession(req, res, body) {
  if (!hasAdminAccess(req, body) && !hasSitePin(req, body)) {
    return sendJson(res, 401, {
      error: "auth_required",
      message: "Screen sharing needs admin or PIN access."
    });
  }
  const sessionId = cleanId(body.sessionId, 96);
  const role = cleanId(body.role, 16);
  const type = cleanId(body.type, 32);
  if (!sessionId || !["admin", "target"].includes(role) || !type) {
    return sendJson(res, 400, {
      error: "bad_signal",
      message: "Screen signal missing."
    });
  }
  const session = await readSession(sessionId);
  if (!session) {
    return sendJson(res, 404, {
      error: "missing_session",
      message: "Screen session expired."
    });
  }
  session.messages.push({
    id: Date.now() + Math.floor(Math.random() * 999),
    at: Date.now(),
    from: role,
    type,
    payload: body.payload || null
  });
  if (type === "accepted") session.status = "accepted";
  if (type === "stopped") session.status = "stopped";
  session.updatedAt = Date.now();
  const saved = await writeSession(session);
  broadcastLiveEvent("screen", {
    action: "signal",
    sessionId,
    role,
    type,
    targetUserId: saved.targetUserId,
    targetDeviceId: saved.targetDeviceId
  });
  return sendJson(res, 200, { ok: true, status: saved.status });
}

async function pollSession(req, res, body) {
  if (!hasAdminAccess(req, body) && !hasSitePin(req, body)) {
    return sendJson(res, 401, {
      error: "auth_required",
      message: "Screen sharing needs admin or PIN access."
    });
  }
  const sessionId = cleanId(body.sessionId, 96);
  const role = cleanId(body.role, 16);
  const after = Number(body.after) || 0;
  const session = await readSession(sessionId);
  if (!session) {
    return sendJson(res, 404, {
      error: "missing_session",
      message: "Screen session expired."
    });
  }
  const messages = session.messages
    .filter((message) => message.id > after && (!role || message.from !== role))
    .slice(-80);
  return sendJson(res, 200, {
    ok: true,
    status: session.status,
    messages,
    now: Date.now()
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use POST for screen sharing."
      });
    }
    const body = await readBody(req);
    const action = cleanId(body.action, 24);
    if (action === "reset") return resetSession(req, res, body);
    if (action === "signal") return signalSession(req, res, body);
    if (action === "poll") return pollSession(req, res, body);
    return sendJson(res, 400, {
      error: "bad_action",
      message: "Choose a screen sharing action."
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "screen_error",
      message: error.message || "Screen sharing failed."
    });
  }
};
