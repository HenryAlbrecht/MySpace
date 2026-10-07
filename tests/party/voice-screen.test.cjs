const { test } = require("node:test"),
  assert = require("node:assert/strict");
const createMedia = require("../../dist/voice/media.js"),
  createCall = require("../../dist/voice/state.js");
const createPeer = require("../../dist/voice/peer.js"),
  createSession = require("../../dist/voice/session.js");
const tick = async () => {
  for (let i = 0; i < 80; i++) await Promise.resolve();
};
let serial = 0;
class Track {
  constructor(kind) {
    this.id = "track-" + serial++;
    this.kind = kind;
    this.enabled = true;
    this.readyState = "live";
    this.listeners = new Set();
    this.contentHint = "";
  }
  stop() {
    this.readyState = "ended";
  }
  addEventListener(type, fn) {
    if (type === "ended") this.listeners.add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.delete(fn);
  }
  ended() {
    this.readyState = "ended";
    for (const fn of this.listeners) fn();
  }
  getSettings() {
    return { width: 960, height: 540, frameRate: 24, displaySurface: "window" };
  }
}
class Stream {
  constructor(tracks = []) {
    this.id = "stream-" + serial++;
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  addTrack(t) {
    this.tracks.push(t);
  }
}
class PC {
  static all = [];
  constructor() {
    PC.all.push(this);
    this.signalingState = "stable";
    this.transceivers = [];
    this.ice = [];
    this.rollbacks = 0;
  }
  addTrack(track, stream) {
    const sender = {
      track,
      stream,
      getParameters: () => ({ encodings: [{}] }),
      setParameters: async (p) => {
        sender.parameters = p;
        if (track.kind === "video") this.parameters = p;
        if (this.bitrateFailure) throw Error("Unsupported");
      },
    };
    this.transceivers.push({ mid: String(this.transceivers.length), sender });
    queueMicrotask(() => this.onnegotiationneeded?.());
    return sender;
  }
  removeTrack(sender) {
    sender.track = null;
    queueMicrotask(() => this.onnegotiationneeded?.());
  }
  getTransceivers() {
    return this.transceivers;
  }
  async createOffer() {
    return { type: "offer", sdp: "offer" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "answer" };
  }
  async setLocalDescription(d) {
    this.localDescription = d;
    this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(d) {
    if (d.type === "offer" && this.signalingState === "have-local-offer") this.rollbacks++;
    this.remoteDescription = d;
    this.signalingState = d.type === "offer" ? "have-remote-offer" : "stable";
  }
  async addIceCandidate(c) {
    this.ice.push(c);
  }
  close() {
    this.signalingState = "closed";
    this.closed = true;
  }
}
function endpoint(polite = true) {
  const microphone = new Stream([new Track("audio")]),
    sent = [],
    screens = [],
    voices = [],
    errors = [];
  const peer = createPeer({
    localStream: microphone,
    polite,
    Peer: PC,
    Stream,
    send: (type, payload) => sent.push({ type, payload }),
    onScreen: (s) => screens.push(s),
    onStream: (s) => voices.push(s),
    onState() {},
    onError: (e) => errors.push(e),
  });
  return { peer, pc: PC.all.at(-1), sent, screens, voices, microphone, errors };
}
test("display capture is explicit, single-flight, video-only works, presets are ideal and actual settings remain real", async () => {
  let captures = 0,
    options;
  const screen = new Stream([new Track("video")]);
  const call = createCall(
    createMedia({
      secureContext: true,
      mediaDevices: {
        getUserMedia: async () => new Stream([new Track("audio")]),
        getDisplayMedia: async (o) => {
          captures++;
          options = o;
          return screen;
        },
      },
    }),
  );
  assert.equal(captures, 0);
  await call.join();
  await Promise.all([call.startScreenShare(), call.startScreenShare()]);
  assert.equal(captures, 1);
  assert.deepEqual(options.audio, {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
  });
  assert.deepEqual(options.video.width, { ideal: 1920 });
  assert.equal(options.video.frameRate.max, 60);
  assert.ok(call.state.joined && call.state.screenSharing);
  assert.equal(screen.getAudioTracks().length, 0);
  assert.equal(screen.getVideoTracks()[0].contentHint, "motion");
  assert.equal(screen.getVideoTracks()[0].getSettings().width, 960);
  screen.getVideoTracks()[0].ended();
  assert.equal(call.state.screenSharing, false);
  assert.equal(call.state.screenStream, null);
  assert.equal(call.state.localStream.getAudioTracks()[0].readyState, "live");
  call.leave();
});
test("picker cancellation/API unavailable/no video preserve voice and release invalid streams", async () => {
  for (const mode of ["cancel", "unavailable", "no-video"]) {
    const screen = new Stream([new Track("audio")]);
    const devices = {
      getUserMedia: async () => new Stream([new Track("audio")]),
    };
    if (mode !== "unavailable")
      devices.getDisplayMedia = async () => {
        if (mode === "cancel") throw Object.assign(Error(), { name: "NotAllowedError" });
        return screen;
      };
    const call = createCall(createMedia({ secureContext: true, mediaDevices: devices }));
    await call.join();
    await call.startScreenShare();
    assert.equal(call.state.joined, true);
    assert.equal(call.state.screenStarting, false);
    assert.ok(call.state.screenError);
    assert.equal(call.state.localStream.getAudioTracks()[0].readyState, "live");
    if (mode === "no-video") assert.equal(screen.getTracks()[0].readyState, "ended");
    call.leave();
  }
});
test("late picker result after leave cannot leak display capture; total cleanup stops video/system audio", async () => {
  let resolve;
  const screen = new Stream([new Track("video"), new Track("audio")]);
  const call = createCall(
    createMedia({
      secureContext: true,
      mediaDevices: {
        getUserMedia: async () => new Stream([new Track("audio")]),
        getDisplayMedia: () => new Promise((r) => (resolve = r)),
      },
    }),
  );
  await call.join();
  const pending = call.startScreenShare();
  call.leave();
  resolve(screen);
  await pending;
  assert.ok(screen.getTracks().every((t) => t.readyState === "ended"));
  assert.equal(call.state.screenStream, null);
  await call.join();
  const again = call.startScreenShare();
  const live = new Stream([new Track("video"), new Track("audio")]);
  resolve(live);
  await again;
  const mic = call.state.localStream;
  call.leave();
  assert.ok([...live.getTracks(), ...mic.getTracks()].every((t) => t.readyState === "ended"));
  assert.equal(live.getVideoTracks()[0].listeners.size, 0);
});
test("screen purpose senders add/remove independently, negotiate on changes, metadata and bitrate failure stay nonfatal", async () => {
  const f = endpoint(false);
  await f.peer.start();
  await f.peer.receive("answer", { type: "answer", sdp: "remote", media: [] });
  const screen = new Stream([new Track("video"), new Track("audio")]);
  f.pc.bitrateFailure = true;
  await f.peer.setScreen(screen, 10000000);
  await tick();
  assert.deepEqual(
    f.sent
      .filter((m) => m.type === "offer")
      .at(-1)
      .payload.media.map((m) => m.purpose),
    ["microphone", "screen-video", "screen-audio"],
  );
  assert.equal(f.pc.parameters.encodings[0].maxBitrate, 10000000);
  assert.equal(f.errors.length, 0);
  await f.peer.receive("answer", { type: "answer", sdp: "remote", media: [] });
  await f.peer.setScreen(null);
  await tick();
  assert.equal(f.pc.transceivers.filter((t) => t.sender.track).length, 1);
  assert.equal(f.pc.transceivers[0].sender.track, f.microphone.getTracks()[0]);
  assert.ok(!f.pc.closed);
  assert.deepEqual(
    f.sent
      .filter((m) => m.type === "offer")
      .at(-1)
      .payload.media.map((m) => m.purpose),
    ["microphone"],
  );
  await f.peer.receive("answer", { type: "answer", sdp: "remote", media: [] });
  await f.peer.setScreen(new Stream([new Track("video")]), 4000000);
  await tick();
  await f.peer.receive("answer", { type: "answer", sdp: "remote", media: [] });
  assert.equal(f.pc.signalingState, "stable");
  f.peer.close();
});
test("perfect negotiation: impolite ignores collision and its ICE, polite implicitly rolls back, both return stable", async () => {
  const impolite = endpoint(false),
    polite = endpoint(true);
  await impolite.peer.start();
  await polite.peer.start();
  const left = impolite.sent.find((m) => m.type === "offer").payload,
    right = polite.sent.find((m) => m.type === "offer").payload;
  await impolite.peer.receive("offer", right);
  await impolite.peer.receive("ice", { candidate: "ignored" });
  assert.equal(impolite.pc.ice.length, 0);
  assert.equal(impolite.sent.filter((m) => m.type === "answer").length, 0);
  await polite.peer.receive("offer", left);
  assert.equal(polite.pc.rollbacks, 1);
  assert.equal(polite.pc.signalingState, "stable");
  await impolite.peer.receive("answer", polite.sent.find((m) => m.type === "answer").payload);
  assert.equal(impolite.pc.signalingState, "stable");
  assert.equal(impolite.errors.length + polite.errors.length, 0);
  impolite.peer.close();
  polite.peer.close();
});
test("remote purpose metadata routes out-of-order screen/system audio separately from microphone and clears stopped share", async () => {
  const f = endpoint(),
    video = new Track("video"),
    audio = new Track("audio"),
    microphone = new Track("audio");
  const media = [
    { purpose: "microphone", mid: "0" },
    { purpose: "screen-video", mid: "2" },
    { purpose: "screen-audio", mid: "1" },
  ];
  await f.peer.receive("offer", { type: "offer", sdp: "screen", media });
  f.pc.ontrack({ track: audio, transceiver: { mid: "1" } });
  assert.equal(f.voices.length, 0);
  f.pc.ontrack({ track: video, transceiver: { mid: "2" } });
  assert.deepEqual(f.screens.at(-1).getTracks(), [video, audio]);
  f.pc.ontrack({ track: microphone, transceiver: { mid: "0" } });
  assert.deepEqual(f.voices.at(-1).getTracks(), [microphone]);
  await f.peer.receive("offer", {
    type: "offer",
    sdp: "stopped",
    media: [media[0]],
  });
  assert.equal(f.screens.at(-1), null);
  assert.equal(microphone.readyState, "live");
  f.peer.close();
  assert.ok([video, audio, microphone].every((t) => t.readyState === "ended"));
});
test("polite rollback preserves an unassociated local screen through a follow-up offer, without timer-based collision workarounds", async () => {
  class RollbackPC extends PC {
    async setRemoteDescription(d) {
      if (d.type === "offer" && this.signalingState === "have-local-offer")
        this.transceivers
          .filter((t) => t.sender.track?.kind === "video")
          .forEach((t) => (t.mid = null));
      await super.setRemoteDescription(d);
    }
    async createOffer() {
      this.transceivers.forEach((t, i) => {
        t.mid = String(i);
      });
      return super.createOffer();
    }
  }
  const sent = [],
    screen = new Stream([new Track("video")]),
    mic = new Stream([new Track("audio")]);
  const peer = createPeer({
    localStream: mic,
    screenStream: screen,
    polite: true,
    Peer: RollbackPC,
    Stream,
    send: (type, payload) => sent.push({ type, payload }),
    onStream() {},
    onScreen() {},
    onState() {},
    onError: (e) => assert.fail(e.message),
  });
  await peer.start();
  await peer.receive("offer", { type: "offer", sdp: "collision", media: [] });
  assert.deepEqual(
    sent.map((m) => m.type),
    ["offer", "answer", "offer"],
  );
  assert.notEqual(sent.at(-1).payload.media.find((m) => m.purpose === "screen-video").mid, null);
  await peer.receive("answer", { type: "answer", sdp: "accepted", media: [] });
  assert.equal(PC.all.at(-1).signalingState, "stable");
  peer.close();
});
test("session fans a single screen to all peers, late joins/reconnect inherit it, remote shares stay associated and selective", () => {
  let receive, status;
  const controllers = [],
    shares = new Map(),
    local = new Stream([new Track("audio")]),
    screen = new Stream([new Track("video"), new Track("audio")]);
  const session = createSession({
    clientId: "a",
    signaling: (o) => {
      receive = o.onMessage;
      status = o.onStatus;
      return { send() {}, close() {} };
    },
    peer: (o) => {
      const p = {
        options: o,
        setScreen(stream) {
          this.screen = stream;
        },
        start() {},
        close() {
          this.closed = true;
        },
        receive() {},
      };
      controllers.push(p);
      return p;
    },
    onPeers() {},
    onStream() {},
    onScreen: (id, s) => {
      if (s) shares.set(id, s);
      else shares.delete(id);
    },
    onRemove: (id) => shares.delete(id),
    onError: (e) => assert.fail(e),
  });
  session.start(local, "geral");
  receive({ type: "peers", payload: { peers: ["b", "c"] } });
  session.setScreen(screen, 10000000);
  assert.ok(controllers.every((p) => p.screen === screen));
  receive({ type: "join", from: "d", payload: { reply: true } });
  assert.equal(controllers.at(-1).options.screenStream, screen);
  controllers[0].options.onScreen(new Stream([new Track("video")]));
  controllers[1].options.onScreen(new Stream([new Track("video")]));
  assert.equal(shares.size, 2);
  controllers[0].options.onScreen(null);
  assert.deepEqual([...shares.keys()], ["c"]);
  status("desconectado");
  assert.equal(shares.size, 0);
  assert.equal(screen.getVideoTracks()[0].readyState, "live");
  receive({ type: "peers", payload: { peers: ["b", "c", "d"] } });
  assert.ok(controllers.slice(-3).every((p) => p.options.screenStream === screen));
  session.setScreen(null);
  assert.ok(controllers.slice(-3).every((p) => p.screen === null));
  assert.equal(local.getAudioTracks()[0].readyState, "live");
  session.close();
  assert.ok(controllers.every((p) => p.closed));
});
