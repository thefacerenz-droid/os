const LIVE_CLIENTS_KEY = "__velos_live_clients";
const LIVE_PIN = process.env.VEL_OS_PIN || "74281";
const HEARTBEAT_MS = 25000;

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

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function getClients() {
  if (!globalThis[LIVE_CLIENTS_KEY]) {
    globalThis[LIVE_CLIENTS_KEY] = new Map();
  }
  return globalThis[LIVE_CLIENTS_KEY];
}

function getQuery(req) {
  try {
    return new URL(req.url || "/", "http://localhost").searchParams;
  } catch (error) {
    return new URLSearchParams();
  }
}

function getPin(req, query = getQuery(req)) {
  return cleanText(req.headers?.["x-vel-chat-pin"] || query.get("pin") || "", 32);
}

function writeSse(res, event, data = {}) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastLiveEvent(type = "update", payload = {}) {
  const clients = getClients();
  if (!clients.size) return;
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: cleanId(type, 48) || "update",
    at: Date.now(),
    ...payload
  };
  for (const [id, client] of clients.entries()) {
    if (!client?.res || client.res.destroyed || client.res.writableEnded) {
      clients.delete(id);
      continue;
    }
    try {
      writeSse(client.res, "message", event);
    } catch (error) {
      clients.delete(id);
    }
  }
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET for vel.os live updates."
    });
  }

  const query = getQuery(req);
  if (getPin(req, query) !== LIVE_PIN) {
    return sendJson(res, 401, {
      error: "pin_required",
      message: "Enter the startup PIN before opening live updates."
    });
  }

  const clients = getClients();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const client = {
    res,
    id,
    userId: cleanId(query.get("userId"), 64),
    username: cleanText(query.get("username"), 24),
    deviceId: cleanId(query.get("deviceId"), 96),
    connectedAt: Date.now()
  };

  req.socket?.setTimeout?.(0);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();
  clients.set(id, client);
  writeSse(res, "message", {
    id: `hello-${id}`,
    type: "connected",
    at: Date.now(),
    clientId: id
  });

  const heartbeat = setInterval(() => {
    if (res.destroyed || res.writableEnded) {
      clearInterval(heartbeat);
      clients.delete(id);
      return;
    }
    writeSse(res, "heartbeat", { at: Date.now(), clients: clients.size });
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(id);
  });
}

module.exports = handler;
module.exports.broadcastLiveEvent = broadcastLiveEvent;
