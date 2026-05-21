const fs = require("node:fs");
const path = require("node:path");

const SOUNDBOARD_DIR = path.join(process.cwd(), "assets", "soundboard");
const SECRET_VIDEO_DIR = path.join(process.cwd(), "assets", "secret-videos");
const SECRET_VIDEO_MANIFEST = path.join(process.cwd(), "data", "vault-videos.json");
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

function isGitLfsPointer(filePath, stat) {
  if (!stat || stat.size > 1024) return false;
  try {
    const head = fs.readFileSync(filePath, "utf8").slice(0, 220);
    return head.startsWith("version https://git-lfs.github.com/spec/v1");
  } catch (error) {
    return false;
  }
}

function cleanVideoName(fileName, extension) {
  return path.basename(fileName, extension)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Vault Video";
}

function normalizeManifestVideo(video) {
  if (!video || typeof video !== "object") return null;
  const rawFileName = String(video.fileName || "").split(/[\\/]/).pop();
  const rawUrl = String(video.url || "").trim();
  const fileName = rawFileName || decodeURIComponent(rawUrl.split("/").pop() || "");
  const extension = path.extname(fileName || rawUrl).toLowerCase();
  if (!VIDEO_EXTENSIONS.has(extension)) return null;

  const size = Number(video.size) || 0;
  const lfsPointer = Boolean(video.lfsPointer) || size > 0 && size <= 1024 && Boolean(video.issue);
  const url = rawUrl || `/assets/secret-videos/${encodeURIComponent(fileName)}`;
  const playable = video.playable !== false && !lfsPointer;
  return {
    name: String(video.name || cleanVideoName(fileName || rawUrl, extension)).slice(0, 80),
    fileName,
    url,
    type: String(video.type || getVideoType(extension)),
    size,
    playable,
    lfsPointer,
    issue: lfsPointer
      ? "This deploy has a Git LFS pointer instead of the real video file. Enable Git LFS in Vercel and redeploy."
      : String(video.issue || "")
  };
}

function readSecretVideoManifest() {
  try {
    const raw = fs.readFileSync(SECRET_VIDEO_MANIFEST, "utf8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed.videos;
    if (!Array.isArray(list)) return [];
    return list
      .map(normalizeManifestVideo)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    return [];
  }
}

function scanSecretVideos() {
  let files = [];
  try {
    files = fs.readdirSync(SECRET_VIDEO_DIR, { withFileTypes: true });
  } catch (error) {
    files = [];
  }

  return files
    .filter((file) => file.isFile())
    .map((file) => {
      const extension = path.extname(file.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(extension)) return null;
      const filePath = path.join(SECRET_VIDEO_DIR, file.name);
      const stat = fs.statSync(filePath);
      const lfsPointer = isGitLfsPointer(filePath, stat);
      return {
        name: cleanVideoName(file.name, extension),
        fileName: file.name,
        url: `/assets/secret-videos/${encodeURIComponent(file.name)}`,
        type: getVideoType(extension),
        size: stat.size,
        playable: !lfsPointer,
        lfsPointer,
        issue: lfsPointer
          ? "This deploy has a Git LFS pointer instead of the real video file. Enable Git LFS in Vercel and redeploy."
          : ""
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
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
    const videos = readSecretVideoManifest();

    return sendJson(res, 200, {
      videos: videos.length ? videos : scanSecretVideos(),
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
