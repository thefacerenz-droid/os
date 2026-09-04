const crypto = require("node:crypto");
const { broadcastLiveEvent } = require("../live.js");

const STORE_KEY = "velos:messenger-v1";
const MEMORY_KEY = "__velos_messenger_store";
const REDIS_CLIENT_KEY = "__velos_messenger_redis_client_promise";
const ONLINE_TTL_MS = 45000;
const CALL_TTL_MS = 35000;
const SIGNAL_TTL_MS = 90000;
const MESSAGE_LIMIT = 140;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function clean(value = "", limit = 80) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanId(value = "", limit = 80) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, limit);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (error) { return {}; }
  }
  if (!req || typeof req[Symbol.asyncIterator] !== "function") return {};
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1000000) break;
  }
  try { return JSON.parse(raw || "{}"); } catch (error) { return {}; }
}

function blankStore() {
  return {
    users: {},
    conversations: {
      global: { id: "global", type: "global", name: "Everyone", members: [], createdAt: Date.now() }
    },
    messages: { global: [] },
    calls: {},
    signals: []
  };
}

function normalizeStore(value) {
  const source = value && typeof value === "object" ? value : {};
  const store = blankStore();
  store.users = source.users && typeof source.users === "object" ? source.users : {};
  store.conversations = source.conversations && typeof source.conversations === "object"
    ? source.conversations
    : store.conversations;
  store.conversations.global = store.conversations.global || blankStore().conversations.global;
  store.messages = source.messages && typeof source.messages === "object" ? source.messages : { global: [] };
  store.messages.global = Array.isArray(store.messages.global) ? store.messages.global.slice(-MESSAGE_LIMIT) : [];
  store.calls = source.calls && typeof source.calls === "object" ? source.calls : {};
  store.signals = Array.isArray(source.signals) ? source.signals : [];
  return store;
}

function getKvConfig() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
  };
}

async function kvCommand(command) {
  const config = getKvConfig();
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Messenger storage failed.");
  return data.result;
}

function getRedisUrl() {
  return clean(process.env.REDIS_URL, 2000).replace(/^REDIS_URL\s*=\s*/i, "").replace(/^["']|["']$/g, "");
}

async function getRedisClient() {
  const url = getRedisUrl();
  if (!url) return null;
  if (!globalThis[REDIS_CLIENT_KEY]) {
    globalThis[REDIS_CLIENT_KEY] = (async () => {
      const { createClient } = require("redis");
      const client = createClient({ url });
      client.on("error", (error) => console.error("vel.os messenger Redis error:", error.message));
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
}

function storageMode() {
  const kv = getKvConfig();
  if (kv.url && kv.token) return "kv";
  if (getRedisUrl()) return "redis";
  return "memory";
}

async function readStore() {
  const mode = storageMode();
  let raw = "";
  if (mode === "kv") raw = await kvCommand(["GET", STORE_KEY]);
  if (mode === "redis") raw = await (await getRedisClient()).get(STORE_KEY);
  if (mode === "memory") return normalizeStore(globalThis[MEMORY_KEY]);
  try { return normalizeStore(raw ? JSON.parse(raw) : null); } catch (error) { return blankStore(); }
}

async function writeStore(store) {
  const normalized = normalizeStore(store);
  const mode = storageMode();
  if (mode === "kv") await kvCommand(["SET", STORE_KEY, JSON.stringify(normalized)]);
  if (mode === "redis") await (await getRedisClient()).set(STORE_KEY, JSON.stringify(normalized));
  if (mode === "memory") globalThis[MEMORY_KEY] = normalized;
  return mode;
}

function pruneStore(store, now = Date.now()) {
  Object.entries(store.users).forEach(([id, user]) => {
    if (!user || now - Number(user.lastSeen || 0) > ONLINE_TTL_MS * 4) delete store.users[id];
  });
  Object.entries(store.calls).forEach(([conversationId, call]) => {
    const participants = call?.participants || {};
    Object.entries(participants).forEach(([id, participant]) => {
      if (now - Number(participant.lastSeen || 0) > CALL_TTL_MS) delete participants[id];
    });
    if (!Object.keys(participants).length) delete store.calls[conversationId];
  });
  store.signals = store.signals
    .filter((signal) => now - Number(signal.createdAt || 0) <= SIGNAL_TTL_MS)
    .slice(-600);
}

function identity(body = {}) {
  return {
    id: cleanId(body.userId, 64),
    deviceId: cleanId(body.deviceId, 96),
    username: clean(body.username, 24)
  };
}

function upsertUser(store, user, now = Date.now()) {
  if (!user.id || !user.deviceId || !user.username) return false;
  store.users[user.id] = { ...user, lastSeen: now };
  Object.values(store.calls).forEach((call) => {
    if (call?.participants?.[user.id]) call.participants[user.id].lastSeen = now;
  });
  return true;
}

function canAccess(conversation, userId) {
  return conversation?.type === "global" || conversation?.members?.includes(userId);
}

function conversationTitle(conversation, users, userId) {
  if (conversation.type !== "direct") return conversation.name;
  const otherId = conversation.members.find((id) => id !== userId);
  return users[otherId]?.username || "Direct message";
}

function snapshot(store, userId, selectedId = "global") {
  const now = Date.now();
  const conversations = Object.values(store.conversations)
    .filter((conversation) => canAccess(conversation, userId))
    .map((conversation) => {
      const messages = Array.isArray(store.messages[conversation.id]) ? store.messages[conversation.id] : [];
      const lastMessage = messages[messages.length - 1] || null;
      const call = store.calls[conversation.id];
      return {
        ...conversation,
        name: conversationTitle(conversation, store.users, userId),
        lastMessage: lastMessage ? { text: lastMessage.text, username: lastMessage.username, createdAt: lastMessage.createdAt } : null,
        callCount: Object.keys(call?.participants || {}).length
      };
    })
    .sort((a, b) => Number(b.lastMessage?.createdAt || b.createdAt) - Number(a.lastMessage?.createdAt || a.createdAt));
  const selected = store.conversations[selectedId] && canAccess(store.conversations[selectedId], userId)
    ? selectedId
    : conversations[0]?.id || "global";
  return {
    persistent: storageMode() !== "memory",
    users: Object.values(store.users)
      .map((user) => ({ ...user, online: now - Number(user.lastSeen || 0) <= ONLINE_TTL_MS }))
      .filter((user) => user.online)
      .sort((a, b) => a.username.localeCompare(b.username)),
    conversations,
    selectedConversationId: selected,
    messages: (store.messages[selected] || []).slice(-MESSAGE_LIMIT),
    call: store.calls[selected] || null,
    signals: store.signals.filter((signal) => signal.toUserId === userId)
  };
}

function directId(firstId, secondId) {
  const pair = [firstId, secondId].sort().join(":");
  return `direct-${crypto.createHash("sha256").update(pair).digest("hex").slice(0, 18)}`;
}

function createConversation(store, body, user) {
  const requested = Array.isArray(body.memberIds) ? body.memberIds.map((id) => cleanId(id, 64)).filter(Boolean) : [];
  const members = [...new Set([user.id, ...requested])].filter((id) => store.users[id]);
  const type = body.type === "direct" ? "direct" : "group";
  if (members.length < 2) throw Object.assign(new Error("Choose at least one online person."), { code: "missing_members" });
  const id = type === "direct"
    ? directId(members[0], members[1])
    : `group-${crypto.randomBytes(8).toString("hex")}`;
  if (!store.conversations[id]) {
    store.conversations[id] = {
      id,
      type,
      name: type === "group" ? clean(body.name, 38) || "New group" : "Direct message",
      members,
      createdBy: user.id,
      createdAt: Date.now()
    };
    store.messages[id] = [];
  }
  return id;
}

module.exports = async function handleMessenger(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed", message: "Use POST for Messenger." });
  }

  try {
    const body = await readBody(req);
    const action = clean(body.action, 32) || "snapshot";
    const user = identity(body);
    if (!user.id || !user.deviceId || !user.username) {
      return sendJson(res, 400, { error: "identity_required", message: "Choose a chat name before opening Messages." });
    }

    const store = await readStore();
    const now = Date.now();
    pruneStore(store, now);
    upsertUser(store, user, now);
    let selectedId = cleanId(body.conversationId, 80) || "global";

    if (action === "create") {
      selectedId = createConversation(store, body, user);
    } else if (action === "message") {
      const conversation = store.conversations[selectedId];
      if (!canAccess(conversation, user.id)) throw Object.assign(new Error("That conversation is unavailable."), { code: "forbidden" });
      const text = clean(body.text, 1000);
      if (!text) throw Object.assign(new Error("Type a message first."), { code: "empty_message" });
      const message = {
        id: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
        userId: user.id,
        username: user.username,
        text,
        createdAt: now
      };
      store.messages[selectedId] = [...(store.messages[selectedId] || []), message].slice(-MESSAGE_LIMIT);
      broadcastLiveEvent("messenger", { action: "message", conversationId: selectedId });
    } else if (action === "call-join") {
      const conversation = store.conversations[selectedId];
      if (!canAccess(conversation, user.id)) throw Object.assign(new Error("That call is unavailable."), { code: "forbidden" });
      const call = store.calls[selectedId] || { id: `call-${crypto.randomBytes(8).toString("hex")}`, conversationId: selectedId, startedAt: now, participants: {} };
      call.participants[user.id] = { userId: user.id, username: user.username, deviceId: user.deviceId, joinedAt: now, lastSeen: now };
      store.calls[selectedId] = call;
      broadcastLiveEvent("messenger", { action: "call", conversationId: selectedId });
    } else if (action === "call-leave") {
      const call = store.calls[selectedId];
      if (call?.participants) delete call.participants[user.id];
      if (call && !Object.keys(call.participants).length) delete store.calls[selectedId];
      store.signals = store.signals.filter((signal) => signal.fromUserId !== user.id && signal.toUserId !== user.id);
      broadcastLiveEvent("messenger", { action: "call", conversationId: selectedId });
    } else if (action === "signal") {
      const call = store.calls[selectedId];
      const toUserId = cleanId(body.toUserId, 64);
      if (!call?.participants?.[user.id] || !call.participants[toUserId]) {
        throw Object.assign(new Error("The call participant is no longer available."), { code: "call_unavailable" });
      }
      if (!body.signal || typeof body.signal !== "object") {
        throw Object.assign(new Error("Call signal is missing."), { code: "invalid_signal" });
      }
      store.signals.push({
        id: `signal-${crypto.randomBytes(8).toString("hex")}`,
        callId: call.id,
        conversationId: selectedId,
        fromUserId: user.id,
        toUserId,
        signal: body.signal,
        createdAt: now
      });
    }

    const mode = await writeStore(store);
    return sendJson(res, action === "message" || action === "create" ? 201 : 200, {
      ...snapshot(store, user.id, selectedId),
      storage: mode
    });
  } catch (error) {
    const status = ["missing_members", "empty_message", "invalid_signal"].includes(error.code)
      ? 400
      : ["forbidden", "call_unavailable"].includes(error.code) ? 403 : 500;
    return sendJson(res, status, { error: error.code || "messenger_error", message: error.message || "Messenger failed." });
  }
};
