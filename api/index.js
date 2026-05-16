const handleDevPresence = require("../lib/api/dev/presence.js");
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
  if (apiPath === "dev/presence") return handleDevPresence(req, res);

  return sendJson(res, 404, {
    error: "not_found",
    message: "API route not found."
  });
};
