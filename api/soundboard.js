const fs = require("node:fs");
const path = require("node:path");

const SOUNDBOARD_DIR = path.join(process.cwd(), "assets", "soundboard");
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"]);

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
