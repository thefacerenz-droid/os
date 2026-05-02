const CHAT_LIMIT = 180;
const CHAT_KEY = "velos:global-chat-messages";
const REDIS_CLIENT_KEY = "__velos_chat_redis_client_promise";
const MEMORY_KEY = "__velos_chat_messages";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cleanChatText(value = "", limit = 360) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
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
    if (!["redis:", "rediss:"].includes(parsed.protocol)) {
      throw new Error("Redis URL must start with redis:// or rediss://.");
    }
    return value;
  } catch (error) {
    const invalid = new Error("REDIS_URL is invalid. In Vercel, set the key to REDIS_URL and paste only the connection string value, starting with redis:// or rediss://.");
    invalid.code = "invalid_redis_url";
    throw invalid;
  }
}

async function kvCommand(command) {
  const config = getKvConfig();
  if (!config.url || !config.token) {
    const error = new Error("Connect Redis/KV storage to make Global Chat permanent.");
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
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (!globalThis[REDIS_CLIENT_KEY]) {
    globalThis[REDIS_CLIENT_KEY] = (async () => {
      const validRedisUrl = validateRedisUrl(redisUrl);
      let createClient;
      try {
        ({ createClient } = require("redis"));
      } catch (error) {
        throw new Error("The redis package is missing. Run npm install, commit package.json, and redeploy.");
      }
      const client = createClient({ url: validRedisUrl });
      client.on("error", (error) => {
        console.error("vel.os chat Redis error:", error.message);
      });
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
}

function normalizeStoredMessages(value) {
  return (Array.isArray(value) ? value : [])
    .map((message) => ({
      id: cleanChatText(message?.id, 48),
      userId: cleanChatText(message?.userId, 64),
      username: cleanChatText(message?.username, 24) || "Guest",
      text: cleanChatText(message?.text, 360),
      createdAt: Number(message?.createdAt) || Date.now()
    }))
    .filter((message) => message.id && message.text)
    .slice(-CHAT_LIMIT);
}

function getMemoryMessages() {
  globalThis[MEMORY_KEY] = normalizeStoredMessages(globalThis[MEMORY_KEY] || []);
  return globalThis[MEMORY_KEY];
}

async function readChatStore() {
  if (restKvConfigured()) {
    const raw = await kvCommand(["GET", CHAT_KEY]);
    let messages = [];
    try {
      messages = raw ? JSON.parse(raw) : [];
    } catch (error) {
      messages = [];
    }
    return {
      messages: normalizeStoredMessages(messages),
      storage: "kv",
      persistent: true,
      message: "Global Chat is synced through KV."
    };
  }

  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(CHAT_KEY);
    let messages = [];
    try {
      messages = raw ? JSON.parse(raw) : [];
    } catch (error) {
      messages = [];
    }
    return {
      messages: normalizeStoredMessages(messages),
      storage: "redis",
      persistent: true,
      message: "Global Chat is synced through Redis."
    };
  }

  return {
    messages: getMemoryMessages(),
    storage: "memory",
    persistent: false,
    message: "Global Chat is using temporary memory storage. Add REDIS_URL in Vercel for permanent site-wide chat."
  };
}

async function writeChatStore(messages) {
  const nextMessages = normalizeStoredMessages(messages);
  if (restKvConfigured()) {
    await kvCommand(["SET", CHAT_KEY, JSON.stringify(nextMessages)]);
    return "kv";
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(CHAT_KEY, JSON.stringify(nextMessages));
    return "redis";
  }
  globalThis[MEMORY_KEY] = nextMessages;
  return "memory";
}

function normalizeIncomingMessage(body = {}) {
  const username = cleanChatText(body.username, 24) || "Guest";
  const userId = cleanChatText(body.userId, 64) || `guest-${Math.random().toString(36).slice(2, 10)}`;
  const text = cleanChatText(body.text, 360);
  if (!text) return null;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    username,
    text,
    createdAt: Date.now()
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const store = await readChatStore();
      return sendJson(res, 200, store);
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use GET or POST for Global Chat."
      });
    }

    let body = {};
    try {
      body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    } catch (error) {
      body = {};
    }

    const nextMessage = normalizeIncomingMessage(body);
    if (!nextMessage) {
      return sendJson(res, 400, {
        error: "empty_message",
        message: "Type a message before sending."
      });
    }

    const store = await readChatStore();
    const messages = [...store.messages, nextMessage].slice(-CHAT_LIMIT);
    const storage = await writeChatStore(messages);
    return sendJson(res, 201, {
      message: nextMessage,
      messages,
      storage,
      persistent: storage !== "memory"
    });
  } catch (error) {
    return sendJson(res, error.code === "missing_storage" ? 503 : 500, {
      error: error.code || "chat_error",
      message: error.message || "Global Chat failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "memory"
    });
  }
};
