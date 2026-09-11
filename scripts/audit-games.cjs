const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");

async function readCatalog() {
  const source = await fs.readFile(path.join(root, "script.js"), "utf8");
  const sandbox = { window: { localStorage: { getItem: () => null, setItem() {} } }, document: { querySelectorAll: () => [], dispatchEvent() {}, addEventListener() {} }, CustomEvent: class {}, URL, URLSearchParams };
  return vm.runInNewContext(source.slice(0, source.indexOf("const utilityApps")) + ";gameCatalog", sandbox, { timeout: 2000 });
}

async function checkSource(game) {
  if (game.title === "2048") return { id: game.id, title: game.title, url: "/assets/games/2048/index.html", status: "local", detail: "Original source bundled" };
  try {
    const response = await fetch(game.url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "vel.os source availability check" } });
    const xFrame = response.headers.get("x-frame-options") || "";
    const policy = response.headers.get("content-security-policy") || "";
    const ancestors = policy.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1] || "";
    await response.body?.cancel();
    const restricted = ancestors ? !/(?:^|\s)(?:\*|https:|http:)(?:\s|$)/.test(ancestors) : /deny|sameorigin/i.test(xFrame);
    return { id: game.id, title: game.title, url: game.url, finalUrl: response.url, httpStatus: response.status, status: !response.ok ? "unavailable" : restricted ? "external-only" : "needs-playtest", detail: !response.ok ? `Source returned HTTP ${response.status}` : restricted ? "Publisher restricts embedding" : "Source responds; gameplay has not been verified", xFrame, ancestors };
  } catch (error) {
    return { id: game.id, title: game.title, url: game.url, status: "unavailable", detail: error.name === "TimeoutError" ? "Source timed out" : "Source could not be reached" };
  }
}

async function main() {
  const catalog = await readCatalog();
  const entries = new Array(catalog.length);
  let index = 0, completed = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (index < catalog.length) {
      const current = index++;
      entries[current] = await checkSource(catalog[current]);
      completed += 1;
      if (completed % 40 === 0) console.log(`${completed}/${catalog.length} checked`);
    }
  }));
  const counts = entries.reduce((result, entry) => ({ ...result, [entry.status]: (result[entry.status] || 0) + 1 }), {});
  const report = { checkedAt: new Date().toISOString(), counts, entries };
  await fs.mkdir(path.join(root, "assets", "games"), { recursive: true });
  await fs.writeFile(path.join(root, "assets", "games", "source-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(counts));
}
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { readCatalog, checkSource };
