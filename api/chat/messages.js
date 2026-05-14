const CHAT_LIMIT = 180;
const CHAT_KEY = "velos:global-chat-messages";
const REDIS_CLIENT_KEY = "__velos_chat_redis_client_promise";
const MEMORY_KEY = "__velos_chat_messages";
const CHAT_PIN = process.env.VEL_OS_PIN || "74281";
const ATTACHMENT_URL_LIMIT = 2600000;
const ALLOWED_DATA_MEDIA = /^data:(image\/(?:png|jpe?g|gif|webp)|video\/(?:mp4|webm|ogg));base64,/i;
const { broadcastLiveEvent } = require("../../live.js");
const handleChatTyping = require("../../chatTyping.js");

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

function getRequestPin(req, body = {}) {
  let queryPin = "";
  try {
    const url = new URL(req.url || "/", "http://localhost");
    queryPin = url.searchParams.get("pin") || "";
  } catch (error) {
    queryPin = "";
  }
  return cleanChatText(req.headers?.["x-vel-chat-pin"] || body.pin || queryPin, 12);
}

function hasValidPin(req, body = {}) {
  return getRequestPin(req, body) === CHAT_PIN;
}

function sendPinRequired(res) {
  return sendJson(res, 401, {
    error: "pin_required",
    message: "Enter the chat PIN before viewing or sending messages."
  });
}

function getAttachmentTypeFromUrl(url = "") {
  const cleanUrl = String(url).split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/.test(cleanUrl)) return "image";
  if (/\.(mp4|webm|ogg|mov)$/.test(cleanUrl)) return "video";
  return "link";
}

function normalizeAttachment(input = null) {
  if (!input || typeof input !== "object") return null;
  const rawUrl = String(input.url || "").trim();
  if (!rawUrl || rawUrl.length > ATTACHMENT_URL_LIMIT) {
    const error = new Error("That attachment is too large for chat. Use the vault folder for big videos.");
    error.code = "attachment_too_large";
    throw error;
  }

  const requestedType = ["image", "video", "link"].includes(input.type) ? input.type : "";
  const isDataUrl = rawUrl.startsWith("data:");
  let type = requestedType || getAttachmentTypeFromUrl(rawUrl);

  if (isDataUrl) {
    if (!ALLOWED_DATA_MEDIA.test(rawUrl)) {
      const error = new Error("Only PNG, JPG, GIF, WEBP, MP4, WEBM, and OGG attachments are supported.");
      error.code = "unsupported_attachment";
      throw error;
    }
    type = rawUrl.startsWith("data:image/") ? "image" : "video";
  } else {
    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Unsupported protocol.");
      }
    } catch (error) {
      const invalid = new Error("Attachment links must start with http:// or https://.");
      invalid.code = "invalid_attachment_url";
      throw invalid;
    }
  }

  return {
    type,
    url: rawUrl,
    name: cleanChatText(input.name, 90) || (type === "image" ? "Image" : type === "video" ? "Video" : "Link"),
    size: Math.max(0, Number(input.size) || 0)
  };
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
    .map((message) => {
      let attachment = null;
      try {
        attachment = normalizeAttachment(message?.attachment);
      } catch (error) {
        attachment = null;
      }
      return {
        id: cleanChatText(message?.id, 48),
        userId: cleanChatText(message?.userId, 64),
        username: cleanChatText(message?.username, 24) || "Guest",
        text: cleanChatText(message?.text, 360),
        attachment,
        createdAt: Number(message?.createdAt) || Date.now()
      };
    })
    .filter((message) => message.id && (message.text || message.attachment))
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
  const attachment = normalizeAttachment(body.attachment);
  if (!text && !attachment) return null;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    username,
    text,
    attachment,
    createdAt: Date.now()
  };
}

function getDeleteMessageId(body = {}) {
  return cleanChatText(body.messageId || body.id, 48);
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("__typing") === "1") {
      return handleChatTyping(req, res);
    }

    if (req.method === "GET") {
      if (!hasValidPin(req)) return sendPinRequired(res);
      const store = await readChatStore();
      return sendJson(res, 200, store);
    }

    if (!["POST", "DELETE"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST, DELETE");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use GET, POST, or DELETE for Global Chat."
      });
    }

    let body = {};
    try {
      body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    } catch (error) {
      body = {};
    }
    if (!hasValidPin(req, body)) return sendPinRequired(res);

    if (req.method === "DELETE") {
      const store = await readChatStore();
      const shouldClear = body.action === "clear" || body.clear === true;
      const messageId = getDeleteMessageId(body);
      const messages = shouldClear
        ? []
        : store.messages.filter((message) => message.id !== messageId);
      if (!shouldClear && !messageId) {
        return sendJson(res, 400, {
          error: "missing_message_id",
          message: "Choose a message to delete."
        });
      }
      const storage = await writeChatStore(messages);
      broadcastLiveEvent("chat", {
        action: shouldClear ? "clear" : "delete",
        messageId,
        senderUserId: cleanChatText(body.userId, 64),
        senderDeviceId: cleanChatText(body.deviceId, 96)
      });
      return sendJson(res, 200, {
        messages,
        storage,
        persistent: storage !== "memory",
        deleted: shouldClear ? "all" : messageId
      });
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
    broadcastLiveEvent("chat", {
      action: "message",
      messageId: nextMessage.id,
      senderUserId: nextMessage.userId,
      senderDeviceId: cleanChatText(body.deviceId, 96)
    });
    return sendJson(res, 201, {
      message: nextMessage,
      messages,
      storage,
      persistent: storage !== "memory"
    });
  } catch (error) {
    const statusCode = error.code === "missing_storage"
      ? 503
      : error.code === "attachment_too_large"
        ? 413
        : ["unsupported_attachment", "invalid_attachment_url"].includes(error.code) ? 400 : 500;
    return sendJson(res, statusCode, {
      error: error.code || "chat_error",
      message: error.message || "Global Chat failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "memory"
    });
  }
};
