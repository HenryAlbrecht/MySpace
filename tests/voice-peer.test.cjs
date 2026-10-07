const { test } = require("node:test");
const assert = require("node:assert/strict");
const signaling = require("../dist/voice/signaling-local.js");
const peer = require("../dist/voice/peer.js");
const session = require("../dist/voice/session.js");
class Channel {
  static channels = new Set();
  constructor() {
    Channel.channels.add(this);
  }
  postMessage(data) {
    for (const channel of Channel.channels)
      if (channel !== this) queueMicrotask(() => channel.onmessage?.({ data }));
  }
  close() {
    Channel.channels.delete(this);
  }
}
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
class Stream {
  constructor() {
    this.tracks = [];
  }
  addTrack(t) {
    this.tracks.push(t);
  }
  getTracks() {
    return this.tracks;
  }
}
class Peer {
  static instances = [];
  constructor(options) {
    assert.deepEqual(options, {
      iceServers: require("../dist/voice/ice-config.js").fallback().iceServers,
      iceTransportPolicy: "all",
    });
    this.ice = [];
    this.tracks = [];
    Peer.instances.push(this);
  }
  addTrack(track) {
    this.tracks.push(track);
  }
  async createOffer() {
    return { type: "offer", sdp: "offer" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "answer" };
  }
  async setLocalDescription(d) {
    this.localDescription = d;
  }
  async setRemoteDescription(d) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c) {
    this.ice.push(c);
  }
  close() {
    this.closed = true;
  }
}
test("signaling filters sender, room and destination and closes its listener", async () => {
  Channel.channels.clear();
  const received = [];
  const transport = signaling({
    clientId: "a",
    roomId: "geral",
    Channel,
    onMessage: (m) => received.push(m),
  });
  const input = [...Channel.channels][0];
  for (const msg of [
    { from: "a", roomId: "geral" },
    { from: "b", roomId: "other" },
    { from: "b", roomId: "geral", to: "c" },
  ])
    input.onmessage({ data: { type: "join", ...msg } });
  input.onmessage({
    data: { type: "join", from: "b", roomId: "geral", to: "a" },
  });
  assert.equal(received.length, 1);
  transport.close();
  assert.equal(input.onmessage, null);
  assert.equal(Channel.channels.size, 0);
});
test("peer buffers ICE, answers offers, associates remote tracks and closes", async () => {
  Peer.instances = [];
  const sent = [],
    streams = [];
  const stream = new Stream();
  const track = {
    stop() {
      this.stopped = true;
    },
  };
  stream.addTrack(track);
  const endpoint = peer({
    localStream: stream,
    Peer,
    Stream,
    send: (...args) => sent.push(args),
    onStream: (s) => streams.push(s),
    onState() {},
    onError: (e) => {
      throw e;
    },
  });
  const pc = Peer.instances[0];
  await endpoint.receive("ice", { candidate: "early" });
  assert.equal(pc.ice.length, 0);
  await endpoint.receive("offer", { type: "offer", sdp: "remote" });
  assert.equal(sent[0][0], "answer");
  assert.equal(pc.ice.length, 1);
  pc.onicecandidate({ candidate: { candidate: "outgoing" } });
  assert.equal(sent[1][0], "ice");
  pc.ontrack({ track });
  assert.equal(streams[0].getTracks()[0], track);
  endpoint.close();
  assert.equal(pc.closed, true);
  assert.equal(track.stopped, true);
  assert.equal(pc.ontrack, null);
});
test("two sessions discover each other; only smaller id offers; ICE routes; reentry cleans listeners", async () => {
  Channel.channels.clear();
  Peer.instances = [];
  const messages = [],
    lists = { a: [], b: [] };
  const create = (id) =>
    session({
      clientId: id,
      signaling: (opts) => signaling({ ...opts, Channel }),
      peer: (opts) =>
        peer({
          ...opts,
          Peer,
          Stream,
          send: (type, payload) => {
            messages.push([id, type]);
            opts.send(type, payload);
          },
        }),
      onPeers: (p) => (lists[id] = p),
      onStream() {},
      onRemove() {},
      onError: (e) => {
        throw Error(e);
      },
    });
  const a = create("a"),
    b = create("b"),
    local = new Stream();
  local.addTrack({});
  // Larger id enters first: discovery handshake still elects the smaller id.
  b.start(local, "geral");
  a.start(local, "geral");
  await tick();
  assert.deepEqual(
    messages.filter((m) => m[1] === "offer"),
    [["a", "offer"]],
  );
  assert.deepEqual(
    messages.filter((m) => m[1] === "answer"),
    [["b", "answer"]],
  );
  assert.equal(lists.a.length, 1);
  assert.equal(lists.b.length, 1);
  const offerer = Peer.instances.find((pc) => pc.localDescription?.type === "offer");
  offerer.onicecandidate({ candidate: { candidate: "route" } });
  await tick();
  assert.equal(Peer.instances.find((pc) => pc !== offerer).ice[0].candidate, "route");
  a.close();
  await tick();
  assert.equal(lists.b.length, 0);
  assert.ok(Peer.instances.every((pc) => pc.closed));
  a.start(local, "geral");
  await tick();
  assert.equal(lists.a.length, 1);
  assert.equal(lists.b.length, 1);
  assert.equal(Channel.channels.size, 2);
  a.close();
  b.close();
  await tick();
  assert.equal(Channel.channels.size, 0);
});
