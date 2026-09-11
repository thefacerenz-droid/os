const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { RTCPeerConnection, MediaStream, MediaStreamTrack, RtpPacket, RtpHeader } = require("werift");
const VelCallPeer = require("../assets/js/call-peer.js");
const { createHandler } = require("../lib/api/messenger.js");

class LoopbackPeer extends RTCPeerConnection {
  constructor(config) { super({ ...config, iceServers: [], iceUseIpv6: false, iceAdditionalHostAddresses: ["127.0.0.1"] }); }
}

test("three callers negotiate through Messages and exchange audio and video packets", { timeout: 30000 }, async (t) => {
  let stored;
  const storage = { mode: "test", async transact(fn) { const next = fn(stored); stored = next.store; return next.result; } };
  const handler = createHandler({ storage, env: {} });
  const clients = ["alice", "bob", "carol"].map((id) => ({
    id, token: crypto.randomBytes(24).toString("hex"), seen: new Set(), peers: new Map(),
    stream: new MediaStream([new MediaStreamTrack({ kind: "audio", id: `${id}-audio` }), new MediaStreamTrack({ kind: "video", id: `${id}-video` })])
  }));
  const allPeers = [];
  const delivered = new Set();
  const errors = [];
  t.after(async () => { await Promise.all(allPeers.map((peer) => peer.close())); });
  async function api(client, action, extra = {}) {
    const res = { setHeader() {}, end(text) { this.data = JSON.parse(text); } };
    await handler({ method: "POST", body: { userId: client.id, username: client.id, authToken: client.token, action, conversationId: "global", ...extra } }, res);
    assert.ok(res.statusCode < 400, JSON.stringify(res.data));
    return res.data;
  }
  for (const client of clients) await api(client, "snapshot");
  let callId;
  for (const client of clients) callId = (await api(client, "call-join", { video: true })).call.id;
  for (const client of clients) {
    for (const other of clients.filter((item) => item !== client)) {
      const record = new VelCallPeer({
        Peer: LoopbackPeer, Stream: MediaStream, iceServers: [], localStream: client.stream,
        onSignal: (signal) => api(client, "signal", { callId, toUserId: other.id, signal }),
        onState: (state, error) => { if (error) errors.push(error); },
        onStream: (stream) => {
          for (const track of stream.getTracks()) {
            if (track.testSubscribed) continue;
            track.testSubscribed = true;
            track.onReceiveRtp.subscribe(() => delivered.add(`${other.id}-${client.id}-${track.kind}`));
          }
        }
      });
      client.peers.set(other.id, record);
      allPeers.push(record);
    }
  }
  await Promise.all(clients.flatMap((client) => [...client.peers].filter(([id]) => client.id < id).map(([, record]) => record.offer())));
  const deadline = Date.now() + 20000;
  let packetNumber = 1;
  while (Date.now() < deadline && delivered.size < 12) {
    for (const client of clients) {
      const data = await api(client, "snapshot", { ackSignals: [...client.seen], activeCallId: callId, activeCallConversationId: "global" });
      for (const item of data.signals) {
        if (client.seen.has(item.id)) continue;
        await client.peers.get(item.fromUserId).accept(item.signal);
        client.seen.add(item.id);
      }
      for (const track of client.stream.getTracks()) {
        track.writeRtp(new RtpPacket(new RtpHeader({ payloadType: track.kind === "audio" ? 111 : 96, sequenceNumber: packetNumber++, timestamp: packetNumber * 960, ssrc: track.kind === "audio" ? 42 : 43 }), Buffer.from([0x10, 0x00, 0x01, 0x02])));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  assert.deepEqual(errors, []);
  assert.ok(allPeers.every((record) => record.peer.connectionState === "connected"), allPeers.map((record) => record.peer.connectionState).join(","));
  assert.equal(delivered.size, 12, `Missing media paths: ${[...delivered].join(",")}`);
});
