const fs = require("node:fs");
const path = require("node:path");

const VIDEO_DIR = path.join(process.cwd(), "assets", "secret-videos");
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".mov"]);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function getVideoType(extension) {
  if (extension === ".webm") return "video/webm";
  if (extension === ".ogg") return "video/ogg";
  if (extension === ".mov") return "video/quicktime";
  return "video/mp4";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET for vault videos."
    });
  }

  let files = [];
  try {
    files = fs.readdirSync(VIDEO_DIR, { withFileTypes: true });
  } catch (error) {
    files = [];
  }

  const videos = files
    .filter((file) => file.isFile())
    .map((file) => {
      const extension = path.extname(file.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(extension)) return null;
      const filePath = path.join(VIDEO_DIR, file.name);
      const stat = fs.statSync(filePath);
      return {
        name: path.basename(file.name, extension).replace(/[-_]+/g, " "),
        fileName: file.name,
        url: `/assets/secret-videos/${encodeURIComponent(file.name)}`,
        type: getVideoType(extension),
        size: stat.size
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  return sendJson(res, 200, {
    videos,
    folder: "assets/secret-videos"
  });
};
