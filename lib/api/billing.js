const crypto = require("node:crypto");

const plans = { week: { amount: 100, label: "7 days" }, month: { amount: 500, label: "1 month" } };
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
function sign(value) {
  return crypto.createHmac("sha256", process.env.PAYWALL_SESSION_SECRET).update(value).digest("base64url");
}
function equal(a, b) {
  const hash = value => crypto.createHash("sha256").update(String(value)).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}
function read(req, name) {
  if (!process.env.PAYWALL_SESSION_SECRET) return null;
  try {
    const raw = (req.headers.cookie || "").split("; ").find(v => v.startsWith(name + "="))?.slice(name.length + 1);
    if (!raw) return null;
    const [value, signature] = raw.split(".");
    if (!equal(sign(value), signature)) return null;
    const data = JSON.parse(Buffer.from(value, "base64url"));
    return data.expires > Date.now() ? data : null;
  } catch { return null; }
}
function cookie(req, res, name, data) {
  const value = Buffer.from(JSON.stringify(data)).toString("base64url");
  const secure = process.env.VERCEL || req.headers["x-forwarded-proto"] === "https";
  const item = `${name}=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.ceil((data.expires - Date.now()) / 1000))}${secure ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", [...(res.getHeader("Set-Cookie") || []), item]);
}
async function body(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  let raw = "";
  for await (const part of req) {
    raw += part;
    if (raw.length > 4096) throw new Error("Request too large.");
  }
  return JSON.parse(raw || "{}");
}
async function stripe(path, fields) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: fields ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(fields ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: fields ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Payment service unavailable. Please try again or contact the site owner.");
  return data;
}
function active(req) {
  const pass = read(req, "vel_pass");
  if (pass?.owner && !equal(pass.owner, crypto.createHash("sha256").update(process.env.PAYWALL_FREE_KEY || "").digest("hex"))) return null;
  return pass;
}
async function handle(req, res, action) {
  try {
    if (!process.env.PAYWALL_SESSION_SECRET || process.env.PAYWALL_SESSION_SECRET.length < 32) return send(res, 503, { message: "Access is not configured yet. Contact the site owner." });
    if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { message: "Method not allowed." });
    if (req.method === "POST" && req.headers.origin) {
      const expected = process.env.APP_BASE_URL || `http://${req.headers.host}`;
      if (new URL(req.headers.origin).origin !== new URL(expected).origin) return send(res, 403, { message: "Invalid request origin." });
    }
    if (action === "status" && req.method === "GET") {
      const pass = active(req);
      return send(res, 200, { active: !!pass, expires: pass?.expires, paymentsReady: !!process.env.STRIPE_SECRET_KEY, pending: !!read(req, "vel_checkout") });
    }
    if (req.method !== "POST") return send(res, 405, { message: "Method not allowed." });
    const input = await body(req);
    if (action === "key") {
      if (!process.env.PAYWALL_FREE_KEY || !equal(input.key || "", process.env.PAYWALL_FREE_KEY)) return send(res, 403, { message: "That private key is not valid." });
      cookie(req, res, "vel_pass", { owner: crypto.createHash("sha256").update(process.env.PAYWALL_FREE_KEY).digest("hex"), expires: Date.now() + 365 * 86400000 });
      return send(res, 200, { active: true });
    }
    if (!process.env.STRIPE_SECRET_KEY) return send(res, 503, { message: "Payments are not configured yet. Contact the site owner." });
    if (action === "checkout") {
      if (active(req)) return send(res, 409, { message: "Your access is already active." });
      const plan = plans[input.plan];
      if (!plan) return send(res, 400, { message: "Choose a valid plan." });
      const base = new URL(process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).origin;
      const nonce = crypto.randomBytes(24).toString("hex");
      const session = await stripe("checkout/sessions", {
        mode: "payment", "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(plan.amount),
        "line_items[0][price_data][product_data][name]": `vel.os access - ${plan.label}`,
        "metadata[plan]": input.plan, "metadata[product]": "vel-access-v1", client_reference_id: nonce,
        success_url: `${base}/?payment=success`, cancel_url: `${base}/?payment=cancelled`
      });
      cookie(req, res, "vel_checkout", { id: session.id, nonce, expires: Date.now() + 32 * 86400000 });
      return send(res, 200, { url: session.url });
    }
    if (action === "verify") {
      const pending = read(req, "vel_checkout");
      if (!pending) return send(res, 400, { message: "No checkout found in this browser." });
      // Retrieve payment state from Stripe on every claim; redirects never grant access.
      const session = await stripe(`checkout/sessions/${encodeURIComponent(pending.id)}?expand[]=payment_intent.latest_charge`);
      const plan = plans[session.metadata?.plan];
      if (!plan || session.metadata.product !== "vel-access-v1" || session.client_reference_id !== pending.nonce || session.amount_total !== plan.amount || session.currency !== "usd" || session.payment_status !== "paid" || session.status !== "complete") return send(res, 409, { message: "Payment is not complete yet. Try checking again in a moment." });
      const charge = session.payment_intent?.latest_charge;
      if (!charge?.paid || charge.refunded || charge.disputed) return send(res, 409, { message: "This payment does not have active access." });
      const expires = new Date(charge.created * 1000);
      if (session.metadata.plan === "week") expires.setUTCDate(expires.getUTCDate() + 7);
      else {
        const day = expires.getUTCDate();
        expires.setUTCDate(1);
        expires.setUTCMonth(expires.getUTCMonth() + 1);
        const last = new Date(Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth() + 1, 0)).getUTCDate();
        expires.setUTCDate(Math.min(day, last));
      }
      if (expires.getTime() <= Date.now()) return send(res, 409, { message: "This pass has expired. Choose a new pass." });
      cookie(req, res, "vel_pass", { session: session.id, expires: expires.getTime() });
      return send(res, 200, { active: true, expires: expires.getTime() });
    }
    return send(res, 404, { message: "Billing route not found." });
  } catch {
    return send(res, 503, { message: "Unable to reach the payment service. Please try again." });
  }
}
handle.requireAccess = (req, res) => {
  if (active(req)) return true;
  send(res, 402, { message: "An active access pass is required." });
  return false;
};
module.exports = handle;
