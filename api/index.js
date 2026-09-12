const handleLobbies = (...args) => require("../lib/api/lobbies.js")(...args);
const handleSoundboard = (...args) => require("../lib/api/soundboard.js")(...args);
const handleChatMessages = (...args) => require("../lib/api/chat/messages.js")(...args);
const handleChatTyping = (...args) => require("../lib/chatTyping.js")(...args);
const handleDevPresence = (...args) => require("../lib/api/dev/presence.js")(...args);
const handleDevScreen = (...args) => require("../lib/api/dev/screen.js")(...args);
const handleFlappyLeaderboard = (...args) => require("../lib/api/games/flappy.js")(...args);
const handleYoutubeGlobal = (...args) => require("../lib/api/youtube/global.js")(...args);
const handleYoutubeSearch = (...args) => require("../lib/api/youtube/search.js")(...args);
const handleTikTok = (...args) => require("../lib/api/tiktok.js")(...args);
const handleMessenger = (...args) => require("../lib/api/messenger.js")(...args);
const handleProxy = (...args) => require("../lib/api/configuredProxy.js")(...args);
const handleBilling = require("../lib/api/billing.js");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function firstValue(value = "") {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function getApiPath(req) {
  const fromQuery = firstValue(req.query?.path);
  if (fromQuery) return String(fromQuery).replace(/^\/+|\/+$/g, "");

  try {
    const url = new URL(req.url || "/", "https://vel.os");
    const fromUrl = url.searchParams.get("path");
    if (fromUrl) return fromUrl.replace(/^\/+|\/+$/g, "");
    return url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  } catch (error) {
    return "";
  }
}

async function dispatch(req, res) {
  const apiPath = getApiPath(req);
  if (apiPath.startsWith("billing/")) return handleBilling(req, res, apiPath.slice(8));
  if (!handleBilling.requireAccess(req, res)) return;
  if (apiPath === "proxy") return handleProxy(req, res);

  if (apiPath === "youtube/search") return handleYoutubeSearch(req, res);
  if (apiPath === "youtube/global") return handleYoutubeGlobal(req, res);
  if (apiPath.startsWith("tiktok/")) return handleTikTok(req, res, apiPath.slice("tiktok/".length));
  if (apiPath === "messenger") return handleMessenger(req, res);
  if (apiPath === "chat/messages") return handleChatMessages(req, res);
  if (apiPath === "chat/typing") return handleChatTyping(req, res);
  if (apiPath === "dev/presence") return handleDevPresence(req, res);
  if (apiPath === "dev/screen") return handleDevScreen(req, res);
  if (apiPath === "games/flappy") return handleFlappyLeaderboard(req, res);
  if (apiPath === "soundboard") return handleSoundboard(req, res);
  if (apiPath === "lobbies") return handleLobbies(req, res);

  return sendJson(res, 404, {
    error: "not_found",
    message: "API route not found."
  });
}

module.exports = async function handler(req, res) {
  try {
    return await dispatch(req, res);
  } catch (error) {
    console.error("API route failed", { route: getApiPath(req), code: error.code, type: error.name });
    if (!res.headersSent) return sendJson(res, 500, {
      error: "server_error",
      message: error.code === "MODULE_NOT_FOUND"
        ? "A server dependency is missing. Deploy package.json and package-lock.json with the updated code, then rebuild on Vercel."
        : "The server could not complete this request. Check the Vercel function logs."
    });
    if (!res.writableEnded) res.end();
  }
};
