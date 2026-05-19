const PRESENCE_KEY = "velos:dev-presence-v2";
const LEGACY_PRESENCE_KEY = "velos:dev-presence-v1";
const REDIS_CLIENT_KEY = "__velos_dev_presence_redis_client_promise";
const MEMORY_KEY = "__velos_dev_presence_store";
const SITE_PIN = process.env.VEL_OS_PIN || "74281";
const ADMIN_CODE = process.env.VEL_OS_ADMIN_CODE || "admin7945";
const { broadcastLiveEvent } = require("../../lib/live.js");
// Hard-bind Dev Panel access to the owner devices provided.
const BUILT_IN_ADMIN_DEVICE_IDS = ["3fa56c0a", "f1a9b3e9-a51e-4f20-9ffe-ada48165a354"];
const ADMIN_DEVICE_IDS = [
  ...(process.env.VEL_OS_ADMIN_DEVICE_IDS || "").split(/[\s,]+/),
  ...BUILT_IN_ADMIN_DEVICE_IDS
]
  .map((id) => cleanId(id, 96))
  .filter(Boolean)
  .filter((id, index, list) => list.indexOf(id) === index);
const USER_ACTIVE_MS = 1000 * 18;
const KICK_ACTIVE_MS = 1000 * 60 * 15;
const CONTROL_LIMIT = 300;

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

function cleanUser(input = {}) {
  const userId = cleanId(input.userId || input.id, 64);
  const username = cleanText(input.username || input.name, 24);
  if (!userId || !username) return null;
  return { userId, username };
}

function cleanDeviceId(input = {}) {
  return cleanId(input.deviceId || input.device || "", 96);
}

function cleanAppId(value = "") {
  return cleanId(value, 48);
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

function normalizeAdminDevice(input = {}) {
  const raw = typeof input === "string" ? { deviceId: input } : input || {};
  const deviceId = cleanId(raw.deviceId || raw.id, 96);
  if (!deviceId) return null;
  return {
    deviceId,
    username: cleanText(raw.username, 24) || "Whitelisted",
    deviceName: cleanText(raw.deviceName, 60) || "Unknown device",
    addedAt: Number(raw.addedAt) || Date.now(),
    addedBy: cleanText(raw.addedBy, 24) || "Owner"
  };
}

function normalizeAnnouncement(value = null) {
  if (!value || typeof value !== "object") return null;
  const text = cleanText(value.text, 220);
  if (!text) return null;
  return {
    id: cleanId(value.id, 80) || `announce-${Date.now()}`,
    text,
    createdAt: Number(value.createdAt) || Date.now(),
    createdBy: cleanText(value.createdBy, 24) || "Owner"
  };
}

function getEnvAdminDevices() {
  return ADMIN_DEVICE_IDS.map((deviceId) => ({
    deviceId,
    username: deviceId === "3fa56c0a"
      ? "Owner iPad"
      : deviceId === "f1a9b3e9-a51e-4f20-9ffe-ada48165a354"
        ? "Owner PC"
        : "Owner",
    deviceName: "Permanent whitelist",
    addedAt: 0,
    addedBy: "Vercel env",
    protected: true
  }));
}

function getAdminDevices(store = {}) {
  const map = new Map();
  getEnvAdminDevices().forEach((device) => map.set(device.deviceId, device));
  Object.values(store.adminDevices || {}).forEach((device) => {
    const normalized = normalizeAdminDevice(device);
    if (!normalized || map.has(normalized.deviceId)) return;
    map.set(normalized.deviceId, { ...normalized, protected: false });
  });
  return [...map.values()];
}

function isAllowedAdminDevice(deviceId = "", store = {}) {
  const currentDeviceId = cleanId(deviceId, 96);
  if (!currentDeviceId) return false;
  return getAdminDevices(store).some((adminDevice) => (
    currentDeviceId === adminDevice.deviceId || currentDeviceId.startsWith(adminDevice.deviceId)
  ));
}

function getAdminAccessError(req, body = {}, store = {}) {
  if (getAdminCode(req, body) !== ADMIN_CODE) {
    return {
      error: "admin_required",
      message: "Admin code required."
    };
  }
  if (!isAllowedAdminDevice(getAdminDeviceId(req, body), store)) {
    return {
      error: "device_required",
      message: "You're not whitelisted for Dev Panel."
    };
  }
  return null;
}

function hasAdminAccess(req, body = {}, store = {}) {
  return !getAdminAccessError(req, body, store);
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
    if (raw.length > 20000) break;
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

function controlKey(deviceId = "", userId = "") {
  return deviceId ? `device:${deviceId}` : `user:${userId}`;
}

function normalizeControl(control = {}, type = "ban") {
  const deviceId = cleanDeviceId(control);
  const user = cleanUser(control) || {
    userId: cleanId(control.userId, 64),
    username: cleanText(control.username, 24) || "Unknown"
  };
  if (!deviceId && !user.userId) return null;
  const createdAt = Number(control.createdAt) || Date.now();
  const expiresAt = Number(control.expiresAt) || 0;
  return {
    id: cleanText(control.id, 120) || controlKey(deviceId, user.userId),
    type,
    deviceId,
    userId: user.userId,
    username: user.username || "Unknown",
    reason: cleanText(control.reason, 120),
    durationLabel: cleanText(control.durationLabel, 40) || (expiresAt ? "Temporary" : "Permanent"),
    createdAt,
    expiresAt,
    createdBy: cleanText(control.createdBy, 24) || "Admin"
  };
}

function normalizeStore(value = {}) {
  const users = {};
  Object.entries(value?.users || {}).forEach(([key, user]) => {
    const person = cleanUser({ userId: user.userId || key, username: user.username });
    if (!person) return;
    users[person.userId] = {
      ...person,
      deviceId: cleanDeviceId(user),
      deviceName: cleanText(user.deviceName, 60) || "Unknown device",
      app: cleanText(user.app, 40) || "desktop",
      appTitle: cleanText(user.appTitle, 80) || "Desktop",
      activity: cleanText(user.activity, 120) || "",
      activityAt: Number(user.activityAt) || Number(user.lastSeen) || 0,
      panel: cleanText(user.panel, 40) || "desktop",
      path: cleanText(user.path, 120) || "/",
      lastSeen: Number(user.lastSeen) || 0
    };
  });

  const bans = {};
  Object.entries(value?.bans || {}).forEach(([key, ban]) => {
    const normalized = normalizeControl({ id: key, ...ban }, "ban");
    if (normalized) bans[normalized.id || key] = normalized;
  });

  const kicks = {};
  Object.entries(value?.kicks || {}).forEach(([key, kick]) => {
    const normalized = normalizeControl({ id: key, ...kick }, "kick");
    if (normalized) kicks[normalized.id || key] = normalized;
  });

  const locks = {};
  Object.entries(value?.locks || {}).forEach(([key, lock]) => {
    const deviceId = cleanDeviceId(lock);
    const userId = cleanId(lock.userId, 64);
    if (!deviceId && !userId) return;
    locks[key] = {
      id: cleanText(lock.id, 120) || key,
      deviceId,
      userId,
      username: cleanText(lock.username, 24) || "Unknown",
      siteLocked: Boolean(lock.siteLocked),
      lockedApps: Array.isArray(lock.lockedApps)
        ? [...new Set(lock.lockedApps.map(cleanAppId).filter(Boolean))].slice(0, 30)
        : [],
      screenRequestAt: Number(lock.screenRequestAt) || 0,
      screenSessionId: cleanId(lock.screenSessionId, 96),
      updatedAt: Number(lock.updatedAt) || Date.now()
    };
  });

  const grants = {};
  Object.entries(value?.grants || {}).forEach(([key, grant]) => {
    const amount = Math.max(0, Number.parseInt(grant.amount, 10) || 0);
    if (!amount) return;
    grants[key] = {
      id: cleanText(grant.id, 120) || key,
      deviceId: cleanDeviceId(grant),
      userId: cleanId(grant.userId, 64),
      username: cleanText(grant.username, 24) || "Unknown",
      amount,
      createdAt: Number(grant.createdAt) || Date.now()
    };
  });

  const adminDevices = {};
  Object.entries(value?.adminDevices || {}).forEach(([key, device]) => {
    const normalized = normalizeAdminDevice({ id: key, ...device });
    if (normalized) adminDevices[normalized.deviceId] = normalized;
  });

  return { users, bans, kicks, locks, grants, adminDevices, announcement: normalizeAnnouncement(value?.announcement) };
}

function prunePresence(store) {
  const now = Date.now();
  Object.entries(store.users || {}).forEach(([id, user]) => {
    if (!user?.lastSeen || now - user.lastSeen > USER_ACTIVE_MS) {
      delete store.users[id];
    }
  });
  Object.entries(store.bans || {}).forEach(([id, ban]) => {
    if (ban?.expiresAt && ban.expiresAt <= now) {
      delete store.bans[id];
    }
  });
  Object.entries(store.kicks || {}).forEach(([id, kick]) => {
    if (!kick?.createdAt || now - kick.createdAt > KICK_ACTIVE_MS) {
      delete store.kicks[id];
    }
  });
}

async function readJsonFromStorage(key) {
  if (restKvConfigured()) {
    const raw = await kvCommand(["GET", key]);
    return raw ? JSON.parse(raw) : {};
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : {};
  }
  return null;
}

async function readStore() {
  if (restKvConfigured() || redisUrlConfigured()) {
    let parsed = {};
    try {
      parsed = await readJsonFromStorage(PRESENCE_KEY);
      if (!parsed || !Object.keys(parsed).length) parsed = await readJsonFromStorage(LEGACY_PRESENCE_KEY);
      return { ...normalizeStore(parsed), storage: restKvConfigured() ? "kv" : "redis", persistent: true };
    } catch (error) {
      console.error("vel.os dev presence storage read failed; using memory fallback:", error.message);
    }
  }
  globalThis[MEMORY_KEY] = normalizeStore(globalThis[MEMORY_KEY] || {});
  return { ...globalThis[MEMORY_KEY], storage: "memory", persistent: false };
}

async function writeStore(store) {
  const normalized = normalizeStore(store);
  try {
    if (restKvConfigured()) {
      await kvCommand(["SET", PRESENCE_KEY, JSON.stringify(normalized)]);
      return { ...normalized, storage: "kv", persistent: true };
    }
    if (redisUrlConfigured()) {
      const client = await getRedisClient();
      await client.set(PRESENCE_KEY, JSON.stringify(normalized));
      return { ...normalized, storage: "redis", persistent: true };
    }
  } catch (error) {
    console.error("vel.os dev presence storage write failed; using memory fallback:", error.message);
  }
  globalThis[MEMORY_KEY] = normalized;
  return { ...normalized, storage: "memory", persistent: false };
}

function getIdentity(body = {}) {
  const user = cleanUser(body) || {
    userId: cleanId(body.userId, 64),
    username: cleanText(body.username, 24) || "Guest"
  };
  return {
    deviceId: cleanDeviceId(body),
    userId: user.userId,
    username: user.username
  };
}

function matchesControl(control, identity = {}) {
  return Boolean(
    control
      && ((control.deviceId && identity.deviceId && control.deviceId === identity.deviceId)
        || (control.userId && identity.userId && control.userId === identity.userId))
  );
}

function findActiveLock(store, identity) {
  prunePresence(store);
  return Object.values(store.locks || {}).find((lock) => matchesControl(lock, identity)) || null;
}

function consumeGrant(store, identity) {
  const entry = Object.entries(store.grants || {}).find(([, grant]) => matchesControl(grant, identity));
  if (!entry) return null;
  delete store.grants[entry[0]];
  return entry[1];
}

function findActiveBan(store, identity) {
  prunePresence(store);
  return Object.values(store.bans || {}).find((ban) => matchesControl(ban, identity)) || null;
}

function consumeKick(store, identity) {
  prunePresence(store);
  const entry = Object.entries(store.kicks || {}).find(([, kick]) => matchesControl(kick, identity));
  if (!entry) return null;
  delete store.kicks[entry[0]];
  return entry[1];
}

function resolveTarget(store, body = {}) {
  const targetUserId = cleanId(body.targetUserId || body.userId, 64);
  const targetDeviceId = cleanId(body.targetDeviceId || body.deviceId, 96);
  const user = targetUserId ? store.users[targetUserId] : Object.values(store.users || {}).find((item) => item.deviceId === targetDeviceId);
  const deviceId = targetDeviceId || user?.deviceId || "";
  const userId = targetUserId || user?.userId || "";
  const username = cleanText(body.targetUsername || user?.username, 24) || "Unknown";
  const deviceName = cleanText(body.targetDeviceName || user?.deviceName, 60) || "Unknown device";
  if (!deviceId && !userId) return null;
  return { deviceId, userId, username, deviceName };
}

function getDuration(body = {}) {
  const rawMs = Number(body.durationMs);
  if (Number.isFinite(rawMs) && rawMs > 0) {
    return {
      durationMs: Math.min(rawMs, 1000 * 60 * 60 * 24 * 365),
      label: cleanText(body.durationLabel, 40) || "Temporary"
    };
  }
  const duration = cleanText(body.duration, 24).toLowerCase();
  const presets = {
    "5m": [1000 * 60 * 5, "5 minutes"],
    "10m": [1000 * 60 * 10, "10 minutes"],
    "30m": [1000 * 60 * 30, "30 minutes"],
    "1h": [1000 * 60 * 60, "1 hour"],
    "12h": [1000 * 60 * 60 * 12, "12 hours"],
    "24h": [1000 * 60 * 60 * 24, "24 hours"],
    "3d": [1000 * 60 * 60 * 24 * 3, "3 days"],
    "7d": [1000 * 60 * 60 * 24 * 7, "7 days"],
    "30d": [1000 * 60 * 60 * 24 * 30, "30 days"],
    permanent: [0, "Permanent"]
  };
  const [durationMs, label] = presets[duration] || presets.permanent;
  return { durationMs, label };
}

function accessPayload(status, control = null) {
  if (status === "ok") return { status: "ok", ok: true };
  const until = control?.expiresAt || 0;
  return {
    status,
    ok: false,
    reason: control?.reason || "",
    durationLabel: control?.durationLabel || (until ? "Temporary" : "Permanent"),
    until,
    message: status === "banned"
      ? `This device is banned${until ? " until the timer ends" : " permanently"}.`
      : "This device was kicked back to the startup screen."
  };
}

function serialize(store) {
  prunePresence(store);
  const bans = Object.values(store.bans || {})
    .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
    .slice(0, CONTROL_LIMIT);
  return {
    users: Object.values(store.users || {})
      .map((user) => {
        const ban = findActiveBan(store, user);
        const lock = findActiveLock(store, user);
        return {
          ...user,
          isBanned: Boolean(ban),
          banExpiresAt: ban?.expiresAt || 0,
          banDurationLabel: ban?.durationLabel || "",
          siteLocked: Boolean(lock?.siteLocked),
          lockedApps: Array.isArray(lock?.lockedApps) ? lock.lockedApps : [],
          devWhitelisted: isAllowedAdminDevice(user.deviceId, store)
        };
      })
      .sort((left, right) => {
        const nameSort = String(left.username || "").localeCompare(String(right.username || ""));
        if (nameSort) return nameSort;
        return String(left.userId || "").localeCompare(String(right.userId || ""));
      })
      .slice(0, 80),
    bans,
    locks: Object.values(store.locks || {}).slice(0, CONTROL_LIMIT),
    adminDevices: getAdminDevices(store).slice(0, CONTROL_LIMIT),
    announcement: normalizeAnnouncement(store.announcement),
    storage: store.storage || "memory",
    persistent: Boolean(store.persistent)
  };
}

async function handleControl(req, res, body) {
  const store = await readStore();
  const adminError = getAdminAccessError(req, body, store);
  if (adminError) {
    return sendJson(res, 401, adminError);
  }
  const command = cleanText(body.command, 32);
  prunePresence(store);
  if (command === "set-announcement") {
    const text = cleanText(body.text, 220);
    if (!text) {
      return sendJson(res, 400, {
        error: "missing_announcement",
        message: "Type an announcement first."
      });
    }
    store.announcement = normalizeAnnouncement({
      id: `announce-${Date.now()}`,
      text,
      createdAt: Date.now(),
      createdBy: "Owner"
    });
    const saved = await writeStore(store);
    broadcastLiveEvent("dev-control", {
      command,
      announcementId: store.announcement?.id || ""
    });
    return sendJson(res, 200, {
      ...serialize(saved),
      ok: true,
      command
    });
  }
  if (command === "clear-announcement") {
    store.announcement = null;
    const saved = await writeStore(store);
    broadcastLiveEvent("dev-control", { command });
    return sendJson(res, 200, {
      ...serialize(saved),
      ok: true,
      command
    });
  }
  const target = resolveTarget(store, body);
  if (!target) {
    return sendJson(res, 400, {
      error: "missing_target",
      message: "Pick an online user or existing ban first."
    });
  }
  const key = controlKey(target.deviceId, target.userId);
  if (command === "kick") {
    store.kicks[key] = normalizeControl({
      id: key,
      ...target,
      reason: body.reason || "Kicked by admin",
      durationLabel: "One-time kick",
      createdAt: Date.now(),
      createdBy: "Admin"
    }, "kick");
  } else if (command === "ban") {
    const duration = getDuration(body);
    store.bans[key] = normalizeControl({
      id: key,
      ...target,
      reason: body.reason || "Banned by admin",
      durationLabel: duration.label,
      createdAt: Date.now(),
      expiresAt: duration.durationMs ? Date.now() + duration.durationMs : 0,
      createdBy: "Admin"
    }, "ban");
    delete store.kicks[key];
  } else if (command === "revoke-ban") {
    Object.entries(store.bans || {}).forEach(([id, ban]) => {
      if (id === key || matchesControl(ban, target)) delete store.bans[id];
    });
  } else if (command === "lock-site") {
    const existing = store.locks[key] || {};
    store.locks[key] = {
      id: key,
      ...target,
      siteLocked: true,
      lockedApps: Array.isArray(existing.lockedApps) ? existing.lockedApps : [],
      updatedAt: Date.now()
    };
  } else if (command === "unlock-site") {
    const existing = store.locks[key] || {};
    store.locks[key] = {
      id: key,
      ...target,
      siteLocked: false,
      lockedApps: Array.isArray(existing.lockedApps) ? existing.lockedApps : [],
      updatedAt: Date.now()
    };
    if (!store.locks[key].lockedApps.length) delete store.locks[key];
  } else if (command === "clear-locks") {
    delete store.locks[key];
  } else if (command === "lock-app") {
    const app = cleanAppId(body.app || body.targetApp);
    if (!app) {
      return sendJson(res, 400, {
        error: "missing_app",
        message: "Choose an app to lock."
      });
    }
    const existing = store.locks[key] || {};
    const lockedApps = new Set(Array.isArray(existing.lockedApps) ? existing.lockedApps : []);
    lockedApps.add(app);
    store.locks[key] = {
      id: key,
      ...target,
      siteLocked: Boolean(existing.siteLocked),
      lockedApps: [...lockedApps].slice(0, 30),
      updatedAt: Date.now()
    };
  } else if (command === "unlock-app") {
    const app = cleanAppId(body.app || body.targetApp);
    const existing = store.locks[key] || {};
    const lockedApps = (Array.isArray(existing.lockedApps) ? existing.lockedApps : []).filter((item) => item !== app);
    store.locks[key] = {
      id: key,
      ...target,
      siteLocked: Boolean(existing.siteLocked),
      lockedApps,
      updatedAt: Date.now()
    };
    if (!store.locks[key].siteLocked && !store.locks[key].lockedApps.length) delete store.locks[key];
  } else if (command === "grant-vc") {
    const amount = Math.max(1, Number.parseInt(body.amount, 10) || 0);
    store.grants[key] = {
      id: key,
      ...target,
      amount,
      createdAt: Date.now()
    };
  } else if (command === "screen-request") {
    const existing = store.locks[key] || {};
    store.locks[key] = {
      id: key,
      ...target,
      siteLocked: Boolean(existing.siteLocked),
      lockedApps: Array.isArray(existing.lockedApps) ? existing.lockedApps : [],
      screenRequestAt: Date.now(),
      screenSessionId: cleanId(body.sessionId, 96),
      updatedAt: Date.now()
    };
  } else if (command === "whitelist-admin") {
    if (!target.deviceId) {
      return sendJson(res, 400, {
        error: "missing_device",
        message: "That user does not have a device ID to whitelist."
      });
    }
    store.adminDevices[target.deviceId] = normalizeAdminDevice({
      ...target,
      addedAt: Date.now(),
      addedBy: "Owner"
    });
  } else if (command === "revoke-admin") {
    if (!target.deviceId) {
      return sendJson(res, 400, {
        error: "missing_device",
        message: "That user does not have a device ID to remove."
      });
    }
    if (ADMIN_DEVICE_IDS.some((deviceId) => target.deviceId === deviceId || target.deviceId.startsWith(deviceId))) {
      return sendJson(res, 400, {
        error: "protected_device",
        message: "Your owner iPad whitelist cannot be removed here."
      });
    }
    delete store.adminDevices[target.deviceId];
  } else {
    return sendJson(res, 400, {
      error: "bad_command",
      message: "Choose a valid Dev Panel action."
    });
  }
  const saved = await writeStore(store);
  broadcastLiveEvent("dev-control", {
    command,
    targetUserId: target.userId || "",
    targetDeviceId: target.deviceId || ""
  });
  return sendJson(res, 200, {
    ...serialize(saved),
    ok: true,
    command
  });
}

async function handleAccessCheck(res, body) {
  const store = await readStore();
  const identity = getIdentity(body);
  const ban = findActiveBan(store, identity);
  if (ban) {
    const saved = await writeStore(store);
    return sendJson(res, 200, {
      ...accessPayload("banned", ban),
      storage: saved.storage,
      persistent: Boolean(saved.persistent)
    });
  }
  const kick = consumeKick(store, identity);
  if (kick) {
    const saved = await writeStore(store);
    return sendJson(res, 200, {
      ...accessPayload("kicked", kick),
      storage: saved.storage,
      persistent: Boolean(saved.persistent)
    });
  }
  const lock = findActiveLock(store, identity);
  const grant = consumeGrant(store, identity);
  const saved = await writeStore(store);
  const screenRequestAt = Number(lock?.screenRequestAt) || 0;
  const hasFreshScreenRequest = screenRequestAt && Date.now() - screenRequestAt < 1000 * 60 * 5;
  if (lock?.siteLocked) {
    return sendJson(res, 200, {
      status: "locked",
      ok: false,
      message: "Locked by owner.",
      lockedApps: Array.isArray(lock.lockedApps) ? lock.lockedApps : [],
      screenRequestAt: hasFreshScreenRequest ? screenRequestAt : 0,
      screenSessionId: hasFreshScreenRequest ? cleanId(lock.screenSessionId, 96) : "",
      announcement: normalizeAnnouncement(saved.announcement),
      vcGrant: grant ? { amount: grant.amount } : null,
      storage: saved.storage,
      persistent: Boolean(saved.persistent)
    });
  }
  return sendJson(res, 200, {
    ...accessPayload("ok"),
    lockedApps: Array.isArray(lock?.lockedApps) ? lock.lockedApps : [],
    screenRequestAt: hasFreshScreenRequest ? screenRequestAt : 0,
    screenSessionId: hasFreshScreenRequest ? cleanId(lock?.screenSessionId, 96) : "",
    announcement: normalizeAnnouncement(saved.announcement),
    vcGrant: grant ? { amount: grant.amount } : null,
    storage: saved.storage,
    persistent: Boolean(saved.persistent)
  });
}

async function handleLeave(req, res, body) {
  if (!hasSitePin(req, body)) {
    return sendJson(res, 401, {
      error: "pin_required",
      message: "Startup PIN required."
    });
  }
  const identity = getIdentity(body);
  const store = await readStore();
  Object.entries(store.users || {}).forEach(([id, user]) => {
    const sameUser = identity.userId && user.userId === identity.userId;
    const sameDevice = identity.deviceId && user.deviceId === identity.deviceId;
    if (sameUser || sameDevice) delete store.users[id];
  });
  const saved = await writeStore(store);
  return sendJson(res, 200, {
    ...serialize(saved),
    ok: true
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const store = await readStore();
      const adminError = getAdminAccessError(req, {}, store);
      if (adminError) {
        return sendJson(res, 401, adminError);
      }
      const saved = await writeStore(store);
      return sendJson(res, 200, serialize(saved));
    }

    if (req.method === "POST") {
      const body = await readRequestBody(req);
      const action = cleanText(body.action, 32);

      if (action === "control") return handleControl(req, res, body);
      if (action === "check") return handleAccessCheck(res, body);
      if (action === "leave") return handleLeave(req, res, body);

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
      const identity = getIdentity(body);
      const ban = findActiveBan(store, identity);
      if (ban) {
        const saved = await writeStore(store);
        return sendJson(res, 403, {
          ...accessPayload("banned", ban),
          storage: saved.storage,
          persistent: Boolean(saved.persistent)
        });
      }
      const kick = consumeKick(store, identity);
      if (kick) {
        const saved = await writeStore(store);
        return sendJson(res, 423, {
          ...accessPayload("kicked", kick),
          storage: saved.storage,
          persistent: Boolean(saved.persistent)
        });
      }
      prunePresence(store);
      store.users[user.userId] = {
        ...user,
        deviceId: cleanDeviceId(body),
        deviceName: cleanText(body.deviceName, 60) || "Unknown device",
        app: cleanText(body.app, 40) || "desktop",
        appTitle: cleanText(body.appTitle, 80) || "Desktop",
        activity: cleanText(body.activity, 120) || "",
        activityAt: Date.now(),
        panel: cleanText(body.panel, 40) || "desktop",
        path: cleanText(body.path, 120) || "/",
        lastSeen: Date.now()
      };
      const saved = await writeStore(store);
      broadcastLiveEvent("dev-presence", {
        userId: user.userId,
        deviceId: cleanDeviceId(body),
        app: cleanText(body.app, 48)
      });
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
