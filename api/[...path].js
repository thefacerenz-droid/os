const handleAiChat = require("../lib/api/ai/chat.js");
const handleChatMessages = require("../lib/api/chat/messages.js");
const handleChatTyping = require("../lib/chatTyping.js");
const handleDevPresence = require("../lib/api/dev/presence.js");
const handleDevScreen = require("../lib/api/dev/screen.js");
const handleFlappyLeaderboard = require("../lib/api/games/flappy.js");
const handleLive = require("../lib/live.js");
const handleLobbies = require("../lib/api/lobbies.js");
const handleSoundboard = require("../lib/api/soundboard.js");
const handleSpotifySearch = require("../lib/api/spotify/search.js");
const handleYoutubeGlobal = require("../lib/api/youtube/global.js");
const handleYoutubeSearch = require("../lib/api/youtube/search.js");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function patchResponse(res) {
  if (typeof res.status !== "function") {
    res.status = (statusCode) => {
      res.statusCode = statusCode;
      return res;
    };
  }
  if (typeof res.json !== "function") {
    res.json = (payload) => sendJson(res, res.statusCode || 200, payload);
  }
}

function attachQuery(req, url) {
  const query = {};
  url.searchParams.forEach((value, key) => {
    if (query[key] === undefined) {
      query[key] = value;
      return;
    }
    query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value];
  });
  req.query = { ...(req.query || {}), ...query };
}

function rewriteRequest(req, url) {
  req.url = `${url.pathname}${url.search}`;
  attachQuery(req, url);
}

module.exports = async function handler(req, res) {
  patchResponse(res);
  const url = new URL(req.url || "/", `https://${req.headers.host || "vel.os"}`);
  attachQuery(req, url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/api";

  try {
    if (pathname === "/api/ai/chat") return await handleAiChat(req, res);
    if (pathname === "/api/chat/messages") return await handleChatMessages(req, res);
    if (pathname === "/api/chat/typing") return await handleChatTyping(req, res);
    if (pathname === "/api/dev/presence") return await handleDevPresence(req, res);
    if (pathname === "/api/dev/screen") return await handleDevScreen(req, res);
    if (pathname === "/api/games/flappy") return await handleFlappyLeaderboard(req, res);
    if (pathname === "/api/live") return await handleLive(req, res);
    if (pathname === "/api/lobbies") return await handleLobbies(req, res);
    if (pathname === "/api/soundboard") return await handleSoundboard(req, res);
    if (pathname === "/api/spotify/search") return await handleSpotifySearch(req, res);
    if (pathname === "/api/youtube/global") return await handleYoutubeGlobal(req, res);
    if (pathname === "/api/youtube/search") return await handleYoutubeSearch(req, res);

    if (pathname === "/api/secret/videos") {
      url.pathname = "/api/soundboard";
      url.searchParams.set("__secretVideos", "1");
      rewriteRequest(req, url);
      return await handleSoundboard(req, res);
    }

    return sendJson(res, 404, {
      error: "not_found",
      message: "API route not found."
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "server_error",
      message: error.message || "Unexpected API error."
    });
  }
};
