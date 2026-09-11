const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHandler } = require("../lib/api/messenger.js");
const { createMessengerStore } = require("../lib/messengerStore.js");

const users = ["alice", "bob", "carol"].map((id) => ({ userId: id, username: id, authToken: id.repeat(16), deviceId: id }));
async function request(handler, user, action = "snapshot", extra = {}) {
  const response = { statusCode: 200, setHeader() {}, end(value) { this.data = JSON.parse(value); } };
  await handler({ method: "POST", body: { ...user, action, conversationId: "global", ...extra } }, response);
  return { status: response.statusCode, ...response.data };
}

test("Messages: concurrent sends persist, identities and private groups are protected, calls expire", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vel-messenger-test-"));
  const file = path.join(dir, "messages.json");
  let time = Date.now();
  const storage = createMessengerStore({ file, env: {} });
  const handler = createHandler({ storage, now: () => time, env: {} });
  const send = (index, action, extra) => request(handler, users[index], action, extra);
  await Promise.all(users.map((user) => request(handler, user)));
  assert.equal((await send(0)).users.length, 3);
  const response = await Promise.all(Array.from({ length: 40 }, (_, i) => send(i % 3, "message", { text: `message ${i}`, clientMessageId: `client-${i}` })));
  assert.ok(response.every((item) => item.status === 201));
  assert.equal((await send(0)).messages.length, 40);
  await send(0, "message", { text: "message 0", clientMessageId: "client-0" });
  assert.equal((await send(0)).messages.length, 40);
  const restarted = createHandler({ storage: createMessengerStore({ file, env: {} }), now: () => time, env: {} });
  assert.equal((await request(restarted, users[1])).messages.length, 40);

  const direct = await send(0, "create", { type: "direct", memberIds: ["bob"] });
  const id = direct.selectedConversationId;
  assert.equal((await send(1, "create", { type: "direct", memberIds: ["alice"] })).selectedConversationId, id);
  assert.equal((await send(2)).conversations.some((item) => item.id === id), false);
  assert.equal((await send(2, "message", { conversationId: id, text: "intrude" })).status, 403);
  assert.equal((await request(handler, { ...users[0], authToken: "x".repeat(40) })).status, 403);
  const group = await send(0, "create", { name: "Study group", memberIds: ["bob", "carol"] });
  assert.equal(group.conversations.find((item) => item.id === group.selectedConversationId).members.length, 3);

  await send(0, "call-join", { conversationId: id, video: false });
  const joined = await send(1, "call-join", { conversationId: id, video: true });
  assert.equal(Object.keys(joined.call.participants).length, 2);
  assert.equal(joined.call.video, false);
  const callId = joined.call.id;
  const signal = { type: "candidate", candidate: { candidate: "test" } };
  const sentSignals = await Promise.all(Array.from({ length: 12 }, () => send(0, "signal", { conversationId: id, callId, toUserId: "bob", signal })));
  assert.ok(sentSignals.every((item) => item.status === 200));
  const received = await send(1, "snapshot", { conversationId: id });
  assert.equal(received.signals.length, 12);
  assert.equal((await send(2)).signals.length, 0);
  assert.equal((await send(1, "snapshot", { conversationId: id, ackSignals: received.signals.map((item) => item.id) })).signals.length, 0);
  assert.equal((await send(0, "signal", { conversationId: id, callId: "old-call", toUserId: "bob", signal })).status, 409);
  await send(1, "call-leave", { conversationId: id });
  assert.equal(Object.keys((await send(0, "snapshot", { conversationId: id })).call.participants).length, 1);
  time += 46000;
  assert.equal((await send(0, "snapshot", { conversationId: id })).call, null);
  assert.equal((await send(0, "snapshot", { conversationId: id })).conversations.find((item) => item.id === id).name, "bob");
  const raw = await fs.readFile(file, "utf8");
  assert.equal(raw.includes(users[0].authToken), false);
  assert.equal(JSON.stringify(received.users).includes("authHash"), false);
  assert.equal(JSON.stringify(received.users).includes("deviceId"), false);
  await fs.unlink(file);
  await fs.rmdir(dir);
});

test("serverless deployment requires shared storage instead of splitting users across memory stores", async () => {
  const env = { VERCEL: "1" };
  const handler = createHandler({ storage: createMessengerStore({ env }), env });
  const result = await request(handler, users[0]);
  assert.equal(result.status, 503);
  assert.equal(result.error, "storage_unconfigured");
});

test("TURN credentials are generated without exposing the relay signing secret", async () => {
  const env = { MESSENGER_TURN_URLS: "turn:relay.example:3478,turns:relay.example:5349", MESSENGER_TURN_SECRET: "test-secret" };
  let data;
  const storage = { mode: "test", async transact(fn) { const next = fn(data); data = next.store; return next.result; } };
  const result = await request(createHandler({ storage, env }), users[0]);
  assert.equal(result.relayConfigured, true);
  assert.equal(result.iceServers[1].urls.length, 2);
  assert.ok(result.iceServers[1].credential);
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});
