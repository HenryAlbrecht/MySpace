const { test } = require("node:test"),
  assert = require("node:assert/strict");
const media = require("../dist/voice/media.js"),
  peer = require("../dist/voice/peer.js");
class Stream {
  constructor(tracks) {
    this.tracks = tracks;
    this.id = "s";
  }
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
}
const track = (kind, id) => ({ kind, id, readyState: "live", contentHint: "" });
test("screen capture disables speech processing and hints music without changing microphone acquisition", async () => {
  const requests = [],
    audio = track("audio", "screen"),
    video = track("video", "video");
  const m = media({
    secureContext: true,
    mediaDevices: {
      getUserMedia: async (o) => requests.push(o),
      getDisplayMedia: async (o) => {
        requests.push(o);
        return new Stream([video, audio]);
      },
    },
  });
  await m.acquire();
  await m.acquire("mic-id");
  await m.acquireScreen();
  assert.deepEqual(requests.slice(0, 2), [
    {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    },
    {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        deviceId: { exact: "mic-id" },
      },
    },
  ]);
  assert.deepEqual(requests[2].audio, {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
  });
  assert.equal(audio.contentHint, "music");
  assert.equal(video.contentHint, "motion");
});
function fixture({ reject = false, pending = false, preferences = true } = {}) {
  const codecs = [
      { mimeType: "audio/PCMU", clockRate: 8000 },
      {
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
        sdpFmtpLine: "minptime=10;useinbandfec=1",
      },
    ],
    pcs = [],
    errors = [];
  class PC {
    constructor() {
      pcs.push(this);
      this.signalingState = "stable";
      this.transceivers = [];
    }
    addTrack(track) {
      const sender = {
        track,
        parameters: {
          codecs,
          encodings: [{ active: true }],
          rtcp: { cname: "unchanged" },
        },
        calls: 0,
        getParameters() {
          return structuredClone(this.parameters);
        },
        async setParameters(p) {
          this.calls++;
          assert.deepEqual(p.codecs, codecs);
          assert.deepEqual(p.rtcp, { cname: "unchanged" });
          assert.deepEqual(Object.keys(p.encodings[0]).sort(), ["active", "maxBitrate"]);
          if (reject) throw Error("Unsupported");
          if (pending) return new Promise(() => {});
          this.parameters = p;
        },
      };
      const t = { sender, mid: null, currentDirection: null };
      if (preferences)
        t.setCodecPreferences = (p) => {
          t.preferences = p;
        };
      this.transceivers.push(t);
      return sender;
    }
    getTransceivers() {
      return this.transceivers;
    }
    removeTrack(s) {
      s.track = null;
    }
    async createOffer() {
      return { type: "offer", sdp: "offer" };
    }
    async setLocalDescription(d) {
      this.localDescription = d;
      this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
    }
    async setRemoteDescription(d) {
      this.remoteDescription = d;
      this.signalingState = "stable";
      this.transceivers.forEach((t, i) => {
        t.mid = String(i);
        t.currentDirection = "sendrecv";
      });
    }
    close() {
      this.signalingState = "closed";
    }
  }
  const screen = new Stream([track("video", "v"), track("audio", "a")]);
  const p = peer({
    localStream: new Stream([track("audio", "mic")]),
    screenStream: screen,
    screenBitrate: 10000000,
    Peer: PC,
    Stream,
    Sender: { getCapabilities: () => ({ codecs }) },
    send() {},
    onStream() {},
    onState() {},
    onError: (e) => errors.push(e),
  });
  return { p, pc: pcs[0], codecs, screen, errors };
}
test("only screen audio prefers unmodified Opus capabilities and receives 192 kbps after negotiation", async () => {
  const f = fixture(),
    [mic, video, audio] = f.pc.transceivers;
  assert.equal(mic.preferences, undefined);
  assert.equal(video.preferences, undefined);
  assert.deepEqual(audio.preferences, [f.codecs[1], f.codecs[0]]);
  assert.equal(audio.preferences[0], f.codecs[1]);
  await f.p.start();
  assert.equal(audio.sender.calls, 0);
  await f.p.receive("answer", { type: "answer", sdp: "answer" });
  assert.equal(audio.sender.parameters.encodings[0].maxBitrate, 192000);
  assert.equal(video.sender.parameters.encodings[0].maxBitrate, 10000000);
  assert.deepEqual(mic.sender.parameters.encodings, [{ active: true }]);
  await f.p.setScreen(f.screen, 10000000);
  assert.equal(audio.sender.calls, 1);
  await f.p.setScreen(null);
  await f.p.setScreen(new Stream([track("video", "v2"), track("audio", "a2")]), 10000000);
  await f.p.receive("answer", { type: "answer", sdp: "answer" });
  assert.equal(f.pc.transceivers.at(-1).sender.parameters.encodings[0].maxBitrate, 192000);
  assert.deepEqual(f.errors, []);
  f.p.close();
});
test("unsupported codec preferences/encoding rejection and pending optional tuning do not block SDP or voice", async () => {
  for (const options of [{ reject: true, preferences: false }, { pending: true }]) {
    const f = fixture(options);
    await f.p.start();
    await f.p.receive("answer", { type: "answer", sdp: "answer" });
    await f.p.setScreen(null);
    assert.equal(f.pc.transceivers[0].sender.track.id, "mic");
    assert.deepEqual(f.errors, []);
    f.p.close();
  }
});
