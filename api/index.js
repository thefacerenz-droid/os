const handleLobbies = require("../lib/api/lobbies.js");
const handleSoundboard = require("../lib/api/soundboard.js");
const handleChatMessages = require("../lib/api/chat/messages.js");
const handleDevPresence = require("../lib/api/dev/presence.js");
const handleDevScreen = require("../lib/api/dev/screen.js");
const handleFlappyLeaderboard = require("../lib/api/games/flappy.js");
const handleYoutubeGlobal = require("../lib/api/youtube/global.js");
const handleYoutubeSearch = require("../lib/api/youtube/search.js");

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

module.exports = async function handler(req, res) {
  const apiPath = getApiPath(req);

  if (apiPath === "youtube/search") return handleYoutubeSearch(req, res);
  if (apiPath === "youtube/global") return handleYoutubeGlobal(req, res);
  if (apiPath === "dev/presence") return handleDevPresence(req, res);
  if (apiPath === "dev/screen") return handleDevScreen(req, res);
  if (apiPath === "chat/messages") return handleChatMessages(req, res);
  if (apiPath === "lobbies") return handleLobbies(req, res);
  if (apiPath === "soundboard") return handleSoundboard(req, res);
  if (apiPath === "games/flappy") return handleFlappyLeaderboard(req, res);

  return sendJson(res, 404, {
    error: "not_found",
    message: "API route not found."
  });
};
