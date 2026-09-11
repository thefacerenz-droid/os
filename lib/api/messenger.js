const crypto = require("node:crypto");
const { createMessengerStore } = require("../messengerStore.js");
const ONLINE_TTL = 45000;
const CALL_TTL = 45000;
const SIGNAL_TTL = 90000;
const MESSAGE_LIMIT = 140;
const clean = (value = "", limit = 80) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
const cleanId = (value = "") => /^[a-zA-Z0-9_.-]{1,80}$/.test(String(value)) ? String(value) : "";
const failure = (message, status = 400, code = "invalid_request") => Object.assign(new Error(message), { status, code });
const randomId = (prefix) => `${prefix}-${crypto.randomBytes(12).toString("hex")}`;
const canAccess = (conversation, id) => conversation?.type === "global" || conversation?.members?.includes(id);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = typeof req.body === "string" ? req.body : "";
  if (!raw && req[Symbol.asyncIterator]) {
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 64000) throw failure("Request is too large.", 413);
    }
  }
  try { return JSON.parse(raw || "{}"); } catch { throw failure("Invalid JSON."); }
}

function normalizeStore(value, now) {
  const store = value || {};
  store.revision = Number(store.revision || 0);
  store.users ||= {};
  store.conversations ||= {};
  store.conversations.global ||= { id: "global", type: "global", name: "Everyone", members: [], createdAt: now };
  store.messages ||= { global: [] };
  store.calls ||= {};
  store.signals = (store.signals || []).filter((item) => now - item.createdAt <= SIGNAL_TTL);
  for (const [id, call] of Object.entries(store.calls)) {
    for (const [userId, participant] of Object.entries(call.participants || {})) {
      if (now - participant.lastSeen > CALL_TTL) delete call.participants[userId];
    }
    if (!Object.keys(call.participants || {}).length) delete store.calls[id];
  }
  return store;
}

function rtcConfig(env, userId, now) {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const urls = (env.MESSENGER_TURN_URLS || "").split(",").map((url) => url.trim()).filter((url) => /^turns?:/.test(url));
  if (urls.length && env.MESSENGER_TURN_SECRET) {
    const username = `${Math.floor(now / 1000) + 3600}:${userId}`;
    iceServers.push({ urls, username, credential: crypto.createHmac("sha1", env.MESSENGER_TURN_SECRET).update(username).digest("base64") });
  } else if (urls.length && env.MESSENGER_TURN_USERNAME && env.MESSENGER_TURN_PASSWORD) {
    iceServers.push({ urls, username: env.MESSENGER_TURN_USERNAME, credential: env.MESSENGER_TURN_PASSWORD });
  }
  return { iceServers, relayConfigured: iceServers.length > 1 };
}

function snapshot(store, userId, selectedId, now) {
  const conversations = Object.values(store.conversations).filter((item) => canAccess(item, userId)).map((item) => {
    const lastMessage = (store.messages[item.id] || []).at(-1) || null;
    const other = item.members.find((id) => id !== userId);
    const call = store.calls[item.id];
    return { ...item, name: item.type === "direct" ? store.users[other]?.username || "Direct message" : item.name, lastMessage, callCount: Object.keys(call?.participants || {}).length, callVideo: Boolean(call?.video) };
  }).sort((a, b) => Number(b.lastMessage?.createdAt || b.createdAt) - Number(a.lastMessage?.createdAt || a.createdAt));
  const selected = conversations.some((item) => item.id === selectedId) ? selectedId : "global";
  return {
    revision: store.revision,
    users: Object.values(store.users).filter((user) => now - user.lastSeen <= ONLINE_TTL).map(({ id, username, lastSeen }) => ({ id, username, lastSeen, online: true })),
    conversations,
    selectedConversationId: selected,
    messages: (store.messages[selected] || []).slice(-MESSAGE_LIMIT),
    call: store.calls[selected] || null,
    signals: store.signals.filter((item) => item.toUserId === userId && store.calls[item.conversationId]?.id === item.callId)
  };
}

function createHandler({ storage = createMessengerStore(), now = Date.now, env = process.env } = {}) {
  return async function handleMessenger(req, res) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        throw failure("Use POST for Messages.", 405);
      }
      const body = await readBody(req);
      const userId = cleanId(body.userId);
      const username = clean(body.username, 24);
      const authToken = String(body.authToken || "");
      if (!userId || !username || !/^[a-zA-Z0-9-]{32,128}$/.test(authToken)) throw failure("Choose a name to connect to Messages.", 401, "identity_required");
      const action = body.action || "snapshot";
      if (!["snapshot", "presence", "create", "message", "call-join", "call-leave", "signal", "leave"].includes(action)) throw failure("Unknown Messages action.");
      const time = now();
      const authHash = hash(authToken);
      const output = await storage.transact((raw) => {
        const store = normalizeStore(raw, time);
        const existing = store.users[userId];
        if (existing?.authHash && existing.authHash !== authHash) throw failure("This chat identity belongs to another session. Choose a new identity.", 403, "identity_mismatch");
        store.users[userId] = { id: userId, username, authHash, lastSeen: action === "leave" ? 0 : time };
        let selectedId = cleanId(body.conversationId) || "global";
        const conversation = store.conversations[selectedId];
        const acknowledged = new Set(Array.isArray(body.ackSignals) ? body.ackSignals.slice(0, 600) : []);
        store.signals = store.signals.filter((item) => item.toUserId !== userId || !acknowledged.has(item.id));
        if (action === "create") {
          const members = [...new Set([userId, ...(Array.isArray(body.memberIds) ? body.memberIds.map(cleanId).filter(Boolean) : [])])];
          const type = body.type === "direct" ? "direct" : "group";
          if (members.length < 2 || members.length > 24 || members.some((id) => !store.users[id])) throw failure("Choose 1 to 23 people for this conversation.");
          if (type === "direct" && members.length !== 2) throw failure("A private chat needs exactly two people.");
          selectedId = type === "direct" ? `direct-${hash([...members].sort().join(":")).slice(0, 18)}` : randomId("group");
          store.conversations[selectedId] ||= { id: selectedId, type, name: clean(body.name, 38) || "New group", members, createdBy: userId, createdAt: time };
          store.messages[selectedId] ||= [];
        } else if (action === "message") {
          if (!canAccess(conversation, userId)) throw failure("This conversation is private.", 403);
          const text = clean(body.text, 1000);
          if (!text) throw failure("Type a message first.");
          const clientId = cleanId(body.clientMessageId);
          const messages = store.messages[selectedId] || [];
          if (!clientId || !messages.some((item) => item.userId === userId && item.clientId === clientId)) {
            store.messages[selectedId] = [...messages, { id: randomId("message"), clientId, userId, username, text, createdAt: time }].slice(-MESSAGE_LIMIT);
          }
        } else if (action === "call-join") {
          if (!canAccess(conversation, userId)) throw failure("This call is private.", 403);
          const call = store.calls[selectedId] || { id: randomId("call"), conversationId: selectedId, video: Boolean(body.video), startedAt: time, participants: {} };
          if (Object.keys(call.participants).length >= 8 && !call.participants[userId]) throw failure("This call is full (8 people).", 409);
          for (const other of Object.values(store.calls)) delete other.participants[userId];
          call.participants[userId] = { userId, username, joinedAt: time, lastSeen: time };
          store.calls[selectedId] = call;
        } else if (action === "call-leave" || action === "leave") {
          for (const [id, call] of Object.entries(store.calls)) {
            if (action === "leave" || id === selectedId) delete call.participants[userId];
            if (!Object.keys(call.participants).length) delete store.calls[id];
          }
          store.signals = store.signals.filter((item) => !(item.conversationId === selectedId && (item.fromUserId === userId || item.toUserId === userId)));
        } else if (action === "signal") {
          const call = store.calls[selectedId];
          const target = cleanId(body.toUserId);
          if (!call || call.id !== body.callId || !call.participants[userId] || !call.participants[target] || target === userId) throw failure("The call has ended or this participant has left.", 409, "call_unavailable");
          const signal = body.signal;
          if (!signal || !["candidate", "description"].includes(signal.type) || JSON.stringify(signal).length > 40000) throw failure("Invalid call signal.");
          if (signal.type === "description" && !["offer", "answer"].includes(signal.description?.type)) throw failure("Invalid call description.");
          store.signals.push({ id: randomId("signal"), callId: call.id, conversationId: selectedId, fromUserId: userId, toUserId: target, signal, createdAt: time });
        }
        const heartbeatCall = store.calls[cleanId(body.activeCallConversationId)];
        if (heartbeatCall && heartbeatCall.id === body.activeCallId && heartbeatCall.participants[userId]) heartbeatCall.participants[userId].lastSeen = time;
        store.revision += 1;
        return { store, result: snapshot(store, userId, selectedId, time) };
      });
      res.statusCode = ["message", "create"].includes(action) ? 201 : 200;
      res.end(JSON.stringify({ ...output, persistent: true, storage: storage.mode, ...rtcConfig(env, userId, time) }));
    } catch (error) {
      res.statusCode = error.status || 503;
      res.end(JSON.stringify({ error: error.code || "messenger_unavailable", message: error.status ? error.message : "Messages storage could not connect. Check the server configuration." }));
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
