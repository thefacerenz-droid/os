const { test } = require("node:test");
const assert = require("node:assert/strict");
const handle = require("../lib/api/billing");
process.env.PAYWALL_SESSION_SECRET = "test-secret-with-at-least-32-characters";
process.env.PAYWALL_FREE_KEY = "test-owner-key";
process.env.STRIPE_SECRET_KEY = "test-only";
process.env.APP_BASE_URL = "https://example.test";
async function call(action, body, cookie = "") {
  const headers = {};
  const res = { setHeader: (k, v) => headers[k] = v, getHeader: k => headers[k], end: value => res.data = JSON.parse(value) };
  await handle({ method: body ? "POST" : "GET", body, headers: { cookie, origin: "https://example.test" } }, res, action);
  return { ...res, cookie: (headers["Set-Cookie"] || []).map(v => v.split(";")[0]).join("; ") };
}
test("private key creates signed access; modified and revoked cookies fail", async () => {
  assert.equal((await call("key", { key: "wrong" })).statusCode, 403);
  const owner = await call("key", { key: "test-owner-key" });
  assert.equal((await call("status", null, owner.cookie)).data.active, true);
  assert.equal((await call("status", null, owner.cookie + "x")).data.active, false);
  process.env.PAYWALL_FREE_KEY = "changed";
  assert.equal((await call("status", null, owner.cookie)).data.active, false);
  process.env.PAYWALL_FREE_KEY = "test-owner-key";
});
test("checkout uses server prices; unpaid sessions fail and paid claims have fixed expiry", async () => {
  const original = global.fetch;
  let nonce;
  let paid = false;
  global.fetch = async (url, options) => {
    if (options.method === "POST") {
      assert.equal(options.body.get("line_items[0][price_data][unit_amount]"), "100");
      assert.equal(options.body.get("mode"), "payment");
      nonce = options.body.get("client_reference_id");
      return { ok: true, json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/test" }) };
    }
    return { ok: true, json: async () => ({ metadata: { plan: "week", product: "vel-access-v1" }, client_reference_id: nonce, amount_total: 100, currency: "usd", status: "complete", payment_status: paid ? "paid" : "unpaid", payment_intent: { latest_charge: { paid: true, created: Math.floor(Date.now() / 1000) } } }) };
  };
  try {
    assert.equal((await call("checkout", { plan: "fake" })).statusCode, 400);
    const checkout = await call("checkout", { plan: "week", amount: 0 });
    assert.equal((await call("verify", {}, checkout.cookie)).statusCode, 409);
    paid = true;
    const verified = await call("verify", {}, checkout.cookie);
    assert.equal(verified.data.active, true);
    assert.ok(Math.abs(verified.data.expires - Date.now() - 7 * 86400000) < 2000);
    assert.equal((await call("status", null, verified.cookie)).data.active, true);
  } finally { global.fetch = original; }
});
