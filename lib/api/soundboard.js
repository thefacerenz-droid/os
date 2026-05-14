const fs = require("node:fs");
const path = require("node:path");

const SOUNDBOARD_DIR = path.join(process.cwd(), "assets", "soundboard");
const SECRET_VIDEO_DIR = path.join(process.cwd(), "assets", "secret-videos");
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".mov"]);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function getAudioType(extension) {
  if (extension === ".wav") return "audio/wav";
  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".aac") return "audio/aac";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".webm") return "audio/webm";
  return "audio/mpeg";
}

function getVideoType(extension) {
  if (extension === ".webm") return "video/webm";
  if (extension === ".ogg") return "video/ogg";
  if (extension === ".mov") return "video/quicktime";
  return "video/mp4";
}

function cleanSoundName(fileName, extension) {
  return path.basename(fileName, extension)
    .replace(/^\d+[-_\s]+/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48) || "Sound Effect";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET for soundboard files."
    });
  }

  const url = new URL(req.url || "/", "http://localhost");
  if (url.searchParams.get("__secretVideos") === "1") {
    let files = [];
    try {
      files = fs.readdirSync(SECRET_VIDEO_DIR, { withFileTypes: true });
    } catch (error) {
      files = [];
    }

    const videos = files
      .filter((file) => file.isFile())
      .map((file) => {
        const extension = path.extname(file.name).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(extension)) return null;
        const filePath = path.join(SECRET_VIDEO_DIR, file.name);
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
  }

  let files = [];
  try {
    files = fs.readdirSync(SOUNDBOARD_DIR, { withFileTypes: true });
  } catch (error) {
    files = [];
  }

  const sounds = files
    .filter((file) => file.isFile())
    .map((file) => {
      const extension = path.extname(file.name).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(extension)) return null;
      const filePath = path.join(SOUNDBOARD_DIR, file.name);
      const stat = fs.statSync(filePath);
      return {
        id: file.name,
        title: cleanSoundName(file.name, extension),
        fileName: file.name,
        url: `/assets/soundboard/${encodeURIComponent(file.name)}`,
        type: getAudioType(extension),
        size: stat.size
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));

  return sendJson(res, 200, {
    sounds,
    folder: "assets/soundboard"
  });
};
