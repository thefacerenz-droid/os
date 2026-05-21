const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const videoDir = path.join(root, "assets", "secret-videos");
const outFile = path.join(root, "data", "vault-videos.json");
const videoExtensions = new Set([".mp4", ".webm", ".ogg", ".mov"]);

function getVideoType(extension) {
  if (extension === ".webm") return "video/webm";
  if (extension === ".ogg") return "video/ogg";
  if (extension === ".mov") return "video/quicktime";
  return "video/mp4";
}

function cleanName(fileName, extension) {
  return path.basename(fileName, extension)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Vault Video";
}

function isGitLfsPointer(filePath, stat) {
  if (!stat || stat.size > 1024) return false;
  try {
    return fs.readFileSync(filePath, "utf8")
      .slice(0, 220)
      .startsWith("version https://git-lfs.github.com/spec/v1");
  } catch (error) {
    return false;
  }
}

function readVideos() {
  let files = [];
  try {
    files = fs.readdirSync(videoDir, { withFileTypes: true });
  } catch (error) {
    files = [];
  }

  return files
    .filter((file) => file.isFile())
    .map((file) => {
      const extension = path.extname(file.name).toLowerCase();
      if (!videoExtensions.has(extension)) return null;

      const filePath = path.join(videoDir, file.name);
      const stat = fs.statSync(filePath);
      const lfsPointer = isGitLfsPointer(filePath, stat);
      return {
        name: cleanName(file.name, extension),
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

const manifest = {
  generatedAt: new Date().toISOString(),
  videos: readVideos()
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${path.relative(root, outFile)} with ${manifest.videos.length} vault video(s).`);
