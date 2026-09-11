const fs = require("node:fs/promises");
const path = require("node:path");
const STORE_KEY = "velos:messenger-v1";
const CAS = "if (redis.call('GET', KEYS[1]) or '') == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); return 1 else return 0 end";

function createMessengerStore(options = {}) {
  const env = options.env || process.env;
  const kvUrl = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const kvToken = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = env.REDIS_URL?.trim().replace(/^REDIS_URL\s*=\s*/i, "").replace(/^["']|["']$/g, "");
  const mode = kvUrl && kvToken ? "redis-rest" : redisUrl ? "redis" : env.VERCEL ? "unconfigured" : "file";
  const file = options.file || path.join(__dirname, "..", "data", "messenger.json");
  let queue = Promise.resolve();
  let clientPromise;
  async function command(args) {
    if (mode === "redis-rest") {
      const response = await fetch(kvUrl, { method: "POST", headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" }, body: JSON.stringify(args), signal: AbortSignal.timeout(6000) });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error("Messages database is unavailable.");
      return data.result;
    }
    if (!clientPromise) {
      clientPromise = (async () => {
        const { createClient } = require("redis");
        const client = createClient({ url: redisUrl, socket: { connectTimeout: 5000, reconnectStrategy: false } });
        client.on("error", () => {});
        await client.connect();
        return client;
      })().catch((error) => { clientPromise = null; throw error; });
    }
    return (await clientPromise).sendCommand(args);
  }
  async function transact(update) {
    if (mode === "unconfigured") throw Object.assign(new Error("Messages needs a shared database on this deployment. Configure REDIS_URL or the Upstash REST URL and token, then redeploy."), { code: "storage_unconfigured", status: 503 });
    // Compare-and-set prevents concurrent serverless instances from losing writes.
    if (mode !== "file") {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const raw = await command(["GET", STORE_KEY]) || "";
        const { store, result } = update(raw ? JSON.parse(raw) : null);
        if (Number(await command(["EVAL", CAS, "1", STORE_KEY, raw, JSON.stringify(store)])) === 1) return result;
        await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 50));
      }
      throw Object.assign(new Error("Messages is busy. Please retry."), { status: 503 });
    }
    const task = queue.then(async () => {
      let raw;
      try { raw = await fs.readFile(file, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
      const { store, result } = update(raw ? JSON.parse(raw) : null);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
      await fs.rename(temporary, file);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  }
  return { mode, transact };
}
module.exports = { createMessengerStore };
