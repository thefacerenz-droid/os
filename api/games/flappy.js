const REDIS_CLIENT_KEY = "__velos_flappy_redis_client_promise";
const MEMORY_KEY = "__velos_flappy_scores";
const LEADERBOARD_KEY = "velos:flappy-leaderboard-v1";
const SITE_PIN = process.env.VEL_OS_PIN || "74281";
const SCORE_LIMIT = 100;

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

function scoreOwnerKey(score = {}) {
  const userId = cleanId(score.userId, 64);
  const deviceId = cleanId(score.deviceId, 96);
  if (userId) return `user:${userId}`;
  if (deviceId) return `device:${deviceId}`;
  return "";
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
      client.on("error", (error) => console.error("vel.os flappy Redis error:", error.message));
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
    if (raw.length > 20000) break;
  }
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    return {};
  }
}

function normalizeScores(value = []) {
  const bestByOwner = new Map();
  (Array.isArray(value) ? value : [])
    .map((score) => {
      const normalized = {
      id: cleanId(score.id, 80) || `score-${Date.now()}`,
      userId: cleanId(score.userId, 64),
      deviceId: cleanId(score.deviceId, 96),
      username: cleanText(score.username, 24) || "Guest",
      score: Math.max(0, Math.min(9999, Number.parseInt(score.score, 10) || 0)),
      createdAt: Number(score.createdAt) || Date.now(),
      updatedAt: Number(score.updatedAt) || Number(score.createdAt) || Date.now()
    };
      return normalized;
    })
    .filter((score) => score.score > 0)
    .forEach((score) => {
      const ownerKey = scoreOwnerKey(score) || `score:${score.id}`;
      const existing = bestByOwner.get(ownerKey);
      if (!existing || score.score > existing.score) {
        bestByOwner.set(ownerKey, {
          ...score,
          createdAt: existing ? Math.min(existing.createdAt, score.createdAt) : score.createdAt,
          updatedAt: Math.max(existing?.updatedAt || 0, score.updatedAt)
        });
        return;
      }
      bestByOwner.set(ownerKey, {
        ...existing,
        username: score.username || existing.username,
        createdAt: Math.min(existing.createdAt, score.createdAt),
        updatedAt: Math.max(existing.updatedAt || 0, score.updatedAt || 0)
      });
    });

  return [...bestByOwner.values()]
    .sort((left, right) => (right.score - left.score) || (left.createdAt - right.createdAt))
    .slice(0, SCORE_LIMIT);
}

async function readScores() {
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(LEADERBOARD_KEY);
    return { scores: normalizeScores(raw ? JSON.parse(raw) : []), persistent: true };
  }
  globalThis[MEMORY_KEY] = normalizeScores(globalThis[MEMORY_KEY] || []);
  return { scores: globalThis[MEMORY_KEY], persistent: false };
}

async function writeScores(scores = []) {
  const normalized = normalizeScores(scores);
  if (redisUrlConfigured()) {
    const client = await getRedisClient();
    await client.set(LEADERBOARD_KEY, JSON.stringify(normalized));
    return { scores: normalized, persistent: true };
  }
  globalThis[MEMORY_KEY] = normalized;
  return { scores: normalized, persistent: false };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await readScores());
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      if (getPin(req, body) !== SITE_PIN) {
        return sendJson(res, 401, {
          error: "pin_required",
          message: "Enter the startup PIN before saving scores."
        });
      }
      const score = Math.max(0, Math.min(9999, Number.parseInt(body.score, 10) || 0));
      if (!score) {
        return sendJson(res, 400, {
          error: "bad_score",
          message: "Score must be higher than zero."
        });
      }
      const current = await readScores();
      const now = Date.now();
      const incoming = {
        id: `flappy-${now}-${Math.random().toString(36).slice(2, 8)}`,
        userId: cleanId(body.userId, 64),
        deviceId: cleanId(body.deviceId, 96),
        username: cleanText(body.username, 24) || "Guest",
        score,
        createdAt: now,
        updatedAt: now
      };
      const ownerKey = scoreOwnerKey(incoming);
      const next = current.scores.map((entry) => {
        if (!ownerKey || scoreOwnerKey(entry) !== ownerKey) return entry;
        return {
          ...entry,
          userId: incoming.userId || entry.userId,
          deviceId: incoming.deviceId || entry.deviceId,
          username: incoming.username || entry.username,
          score: Math.max(entry.score, incoming.score),
          updatedAt: now
        };
      });
      if (!ownerKey || !next.some((entry) => scoreOwnerKey(entry) === ownerKey)) {
        next.push(incoming);
      }
      return sendJson(res, 200, await writeScores(next));
    }
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET or POST for the Flappy leaderboard."
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "flappy_error",
      message: error.message || "Flappy leaderboard failed."
    });
  }
};
