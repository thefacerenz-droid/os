const crypto = require("crypto");

const ACCOUNT_KEY = "velos:accounts-v1";
const REDIS_CLIENT_KEY = "__velos_accounts_redis_client_promise";
const MEMORY_KEY = "__velos_accounts_store";
const SESSION_BYTES = 32;

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

function cleanUsername(value = "") {
  return cleanText(value, 24)
    .replace(/[^\w .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function accountKey(username = "") {
  return cleanUsername(username).toLowerCase();
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

function validateRedisUrl(value = "") {
  const url = new URL(value);
  if (!["redis:", "rediss:"].includes(url.protocol)) {
    throw new Error("REDIS_URL must start with redis:// or rediss://");
  }
  return url.toString();
}

async function kvCommand(command) {
  const config = getKvConfig();
  if (!config.url || !config.token) {
    const error = new Error("Connect Redis/KV storage to keep accounts after deploy restarts.");
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
  if (!globalThis[REDIS_CLIENT_KEY]) {
    globalThis[REDIS_CLIENT_KEY] = (async () => {
      const { createClient } = require("redis");
      const client = createClient({ url: validateRedisUrl(getRedisUrl()) });
      client.on("error", (error) => console.error("vel.os accounts Redis error:", error.message));
      await client.connect();
      return client;
    })();
  }
  return globalThis[REDIS_CLIENT_KEY];
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
    if (raw.length > 40000) break;
  }
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    return {};
  }
}

function normalizeAccountRecord(record = {}) {
  const username = cleanUsername(record.username);
  const key = accountKey(username);
  const id = cleanText(record.id, 64).replace(/[^\w.-]/g, "").slice(0, 64);
  const passwordHash = cleanText(record.passwordHash, 180);
  const salt = cleanText(record.salt, 80);
  if (!username || !key || !id || !passwordHash || !salt) return null;
  return {
    id,
    username,
    passwordHash,
    salt,
    sessionHash: cleanText(record.sessionHash, 180),
    createdAt: Number(record.createdAt) || Date.now(),
    lastLoginAt: Number(record.lastLoginAt) || 0
  };
}

function normalizeAccountsStore(value = {}) {
  const accounts = {};
  Object.values(value?.accounts || value || {}).forEach((record) => {
    const normalized = normalizeAccountRecord(record);
    if (normalized) accounts[accountKey(normalized.username)] = normalized;
  });
  return { accounts };
}

async function readAccountsStore() {
  if (restKvConfigured()) {
    const raw = await kvCommand(["GET", ACCOUNT_KEY]);
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (error) {
      parsed = {};
    }
    return { ...normalizeAccountsStore(parsed), storage: "kv", persistent: true };
  }

  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(ACCOUNT_KEY);
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (error) {
      parsed = {};
    }
    return { ...normalizeAccountsStore(parsed), storage: "redis", persistent: true };
  }

  globalThis[MEMORY_KEY] = normalizeAccountsStore(globalThis[MEMORY_KEY] || {});
  return { ...globalThis[MEMORY_KEY], storage: "memory", persistent: false };
}

async function writeAccountsStore(store = {}) {
  const normalized = normalizeAccountsStore(store);
  if (restKvConfigured()) {
    await kvCommand(["SET", ACCOUNT_KEY, JSON.stringify(normalized)]);
    return "kv";
  }
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(ACCOUNT_KEY, JSON.stringify(normalized));
    return "redis";
  }
  globalThis[MEMORY_KEY] = normalized;
  return "memory";
}

function hashPassword(password = "", salt = "") {
  return crypto.scryptSync(String(password), String(salt), 64).toString("hex");
}

function verifyPassword(password = "", record = {}) {
  const nextHash = Buffer.from(hashPassword(password, record.salt), "hex");
  const storedHash = Buffer.from(record.passwordHash || "", "hex");
  return nextHash.length === storedHash.length && crypto.timingSafeEqual(nextHash, storedHash);
}

function createSession() {
  const token = crypto.randomBytes(SESSION_BYTES).toString("base64url");
  return {
    token,
    sessionHash: crypto.createHash("sha256").update(token).digest("hex")
  };
}

function publicUser(record = {}) {
  return {
    id: record.id,
    username: record.username
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, {
        error: "method_not_allowed",
        message: "Use POST for vel.os accounts."
      });
    }

    const body = await readRequestBody(req);
    const action = cleanText(body.action, 32) || "login-or-register";
    const username = cleanUsername(body.username);
    const password = String(body.password || "");
    const key = accountKey(username);

    if (!username || username.length < 2) {
      return sendJson(res, 400, {
        error: "bad_username",
        message: "Pick a username with at least 2 characters."
      });
    }
    if (!password || password.length < 4) {
      return sendJson(res, 400, {
        error: "bad_password",
        message: "Use a password with at least 4 characters."
      });
    }

    const store = await readAccountsStore();
    const existing = store.accounts[key];

    if (action === "register" && existing) {
      return sendJson(res, 409, {
        error: "account_exists",
        message: "That username already has an account."
      });
    }
    if (action === "login" && !existing) {
      return sendJson(res, 404, {
        error: "account_missing",
        message: "No account found for that username."
      });
    }
    if (existing && !verifyPassword(password, existing)) {
      return sendJson(res, 401, {
        error: "bad_login",
        message: "Wrong password for that username."
      });
    }

    const session = createSession();
    const now = Date.now();
    const account = existing || {
      id: `acct-${crypto.randomBytes(10).toString("hex")}`,
      username,
      salt: crypto.randomBytes(16).toString("hex"),
      createdAt: now
    };

    account.passwordHash = existing?.passwordHash || hashPassword(password, account.salt);
    account.sessionHash = session.sessionHash;
    account.lastLoginAt = now;
    store.accounts[key] = normalizeAccountRecord(account);
    const storage = await writeAccountsStore(store);

    return sendJson(res, existing ? 200 : 201, {
      user: publicUser(store.accounts[key]),
      token: session.token,
      created: !existing,
      storage,
      persistent: storage !== "memory"
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "account_error",
      message: error.message || "vel.os account login failed.",
      storage: restKvConfigured() ? "kv" : redisUrlConfigured() ? "redis" : "memory"
    });
  }
};
