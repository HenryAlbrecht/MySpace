const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
const tick = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve();
};
class Node {
  constructor(tag, cls, text = "") {
    Object.assign(this, {
      tag,
      className: cls,
      textContent: text,
      children: [],
      dataset: {},
      hidden: false,
    });
  }
  append(...nodes) {
    for (const n of nodes) {
      n.remove?.();
      n.parent = this;
      this.children.push(n);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(k, v) {
    this[k] = v;
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this);
    this.parent = null;
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
  focus() {
    this.focused = true;
  }
  select() {
    this.selected = true;
  }
}
const all = (n) => [n, ...n.children.flatMap(all)];
function fixture({
  href = "https://party.example/?party=room-one&voiceTransport=local&keep=yes#spacevoice",
  clipboard = true,
  profile = { name: "Alice", avatar: "data:image/png;base64,AAAA" },
  prepareAvatar,
} = {}) {
  const messages = [],
    connections = [],
    peers = [],
    copied = [],
    monitors = new Map();
  let captures = 0,
    pcClosed = 0;
  const location = new URL(href);
  const media = {
    enumerate: async () => ({ inputs: [], outputs: [] }),
    watchDevices: () => () => {},
    acquire: async () => {
      captures++;
      const track = {
        kind: "audio",
        enabled: true,
        label: "mic",
        readyState: "live",
        stop() {
          this.readyState = "ended";
        },
      };
      return {
        id: "stream",
        getTracks: () => [track],
        getAudioTracks: () => [track],
      };
    },
    release: (s) => s?.getTracks().forEach((t) => t.stop()),
    mute: (s, m) => s?.getAudioTracks().forEach((t) => (t.enabled = !m)),
  };
  const ctx = {
    PARTY_ROOM: require("../../dist/voice/room-metadata.js"),
    createPartyRoom: require("../../dist/voice/room.js"),
    PARTY_MEDIA_SETTINGS: require("../../dist/voice/media-settings.js"),
    createVoiceDevices: require("../../dist/voice/devices.js"),
    createVoiceCall: require("../../dist/voice/state.js"),
    createVoiceChat: require("../../dist/voice/chat.js"),
    createVoiceSession: require("../../dist/voice/session.js"),
    createVoiceMedia: () => media,
    createVoiceLevels: () => ({
      start() {},
      stop() {},
      monitor: (id, _s, fn) => monitors.set(id, fn),
      remove() {},
      setMuted() {},
    }),
    createVoicePeer: (options) => {
      peers.push(options);
      return {
        start() {},
        retry() {
          options.retryCalls = (options.retryCalls || 0) + 1;
        },
        close() {
          pcClosed++;
        },
        setScreen() {},
        setMediaSettings() {},
        receive() {},
      };
    },
    createLocalVoiceSignaling: (options) => {
      let active = false,
        self = {
          clientId: options.clientId,
          displayName: "Alice",
          avatar: "",
          inCall: false,
        };
      const connection = {
        local: true,
        options,
        closed: false,
        send(type, to, payload) {
          messages.push({ type, room: options.roomId });
          if (type === "presence-join") {
            active = true;
            self = { ...self, ...payload };
            options.onMessage({
              type: "presence-snapshot",
              roomId: options.roomId,
              payload: { participants: [self] },
            });
          }
          if (type === "join") {
            self.inCall = true;
            options.onMessage({
              type: "presence-snapshot",
              roomId: options.roomId,
              payload: { participants: [self] },
            });
            options.onMessage({
              type: "peers",
              roomId: options.roomId,
              payload: { peers: [] },
            });
          }
          if (type === "leave") {
            self.inCall = false;
            options.onMessage({
              type: "presence-snapshot",
              roomId: options.roomId,
              payload: { participants: [self] },
            });
          }
          return true;
        },
        close() {
          this.closed = true;
          active = false;
        },
      };
      connections.push(connection);
      options.onStatus("conectado");
      return connection;
    },
    navigator: clipboard ? { clipboard: { writeText: async (text) => copied.push(text) } } : {},
    crypto: require("node:crypto").webcrypto,
    URL,
    URLSearchParams,
    window: {
      location,
      SPACEVOICE_CONFIG: { transport: "local", iceServers: [] },
      history: {
        replaceState(_a, _b, url) {
          location.href = url;
        },
      },
      addEventListener() {},
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync("dist/party/party-chat-ui.js", "utf8"), ctx);
  vm.runInContext(fs.readFileSync("dist/party/spacevoice.js", "utf8"), ctx);
  const ui = ctx.createSpaceVoice({
    getProfile: () => profile,
    prepareAvatar,
    el: (...args) => new Node(...args),
    button: (text, fn) => {
      const n = new Node("button", "", text);
      n.onclick = fn;
      return n;
    },
  });
  const find = (text) => all(ui.root).find((n) => n.tag === "button" && n.textContent === text);
  return {
    ui,
    find,
    connections,
    messages,
    copied,
    location,
    profile,
    peers,
    monitors,
    counts: () => ({ captures, pcClosed }),
  };
}

test("v1.4 mood is text, speaking/sharing/mute priority and room/call activity without duplicate metadata", async () => {
  const f = fixture({
    profile: {
      name: "Alice",
      avatar: "",
      mood: "<img src=x onerror=alert(1)>",
    },
  });
  await f.ui.enterRoom();
  const mood = all(f.ui.root).find((n) => n.className === "party-presence-mood");
  assert.equal(mood.textContent, f.profile.mood);
  assert.equal(mood.hidden, false);
  assert.equal(mood.children.length, 0);
  f.find("[ entrar na chamada ]").onclick();
  await tick();
  const sample = f.monitors.get(f.connections[0].options.clientId),
    indicator = all(f.ui.root).find((n) => n.className === "spacevoice-speaking");
  sample({ level: 0.6, speaking: true });
  assert.equal(indicator.textContent, "● falando");
  const count = f.messages.filter((m) => m.type === "presence-update").length;
  sample({ level: 0.7, speaking: true });
  assert.equal(f.messages.filter((m) => m.type === "presence-update").length, count);
  f.ui.call.state.screenSharing = true;
  sample({ level: 0, speaking: false });
  assert.equal(indicator.textContent, "compartilhando tela");
  f.ui.call.toggleMute();
  assert.equal(indicator.textContent, "compartilhando tela");
  f.ui.call.state.screenSharing = false;
  sample({ level: 0, speaking: false });
  assert.equal(indicator.textContent, "× mutado");
  f.ui.leave();
  assert.equal(indicator.textContent, "fora da chamada");
  assert.equal(f.ui.room.state.roomId, "room-one");
  f.profile.mood = "";
  f.ui.show();
  assert.equal(mood.hidden, true);
  f.ui.hide();
});

test("cold start repeated route entry shares one lifecycle and enables chat before new party", async () => {
  const pending = [];
  const f = fixture({
    href: "https://party.example/?voiceTransport=local#spacevoice",
    prepareAvatar: () => new Promise((resolve) => pending.push(resolve)),
  });
  const first = f.ui.enterRoom(),
    second = f.ui.enterRoom();
  const id = f.location.searchParams.get("party");
  assert.match(id, /^[0-9a-f-]{36}$/);
  pending[0]("");
  await tick();
  if (pending[1]) pending[1]("");
  await Promise.all([first, second]);
  assert.equal(f.ui.chat.state.roomId, id);
  assert.equal(f.ui.chat.state.connected, true);
  const input = all(f.ui.root).find((n) => n.className === "spacevoice-chat-input");
  assert.equal(input.disabled, false);
  input.value = "cold start";
  input.oninput();
  assert.equal(f.ui.chat.submit(), true);
  assert.equal(f.messages.filter((m) => m.type === "chat-message").length, 1);
  assert.equal(f.connections.length, 1);
  assert.equal(pending.length, 1);
  f.ui.hide();
});

test("cancelled entry cannot close the chat of a newer room", async () => {
  const pending = [];
  const f = fixture({
    prepareAvatar: () => new Promise((resolve) => pending.push(resolve)),
  });
  const old = f.ui.enterRoom();
  const next = f.ui.newParty();
  const id = f.location.searchParams.get("party");
  pending[0]("");
  await old;
  assert.equal(f.ui.chat.state.roomId, id);
  pending[1]("");
  await next;
  assert.equal(f.ui.chat.state.roomId, id);
  assert.equal(f.ui.chat.state.connected, true);
  assert.equal(f.connections.length, 1);
  f.ui.hide();
});
test("lobby has no microphone/PC, identity, safe fallback, counts and available media; call enter/leave preserves room", async () => {
  const f = fixture();
  await f.ui.enterRoom();
  assert.equal(f.ui.room.state.roomId, "room-one");
  assert.deepEqual(f.counts(), { captures: 0, pcClosed: 0 });
  assert.equal(f.peers.length, 0);
  assert.equal(f.find("[ chat > ]").hidden, false);
  f.find("[ mídia > ]").onclick();
  assert.equal(f.ui.root.dataset.context, "media");
  f.find("[ mídia < ]").onclick();
  const connection = f.connections[0],
    clientId = connection.options.clientId;
  connection.options.onMessage({
    type: "presence-snapshot",
    roomId: "room-one",
    payload: {
      participants: [
        { clientId, displayName: "Alice", avatar: "", inCall: false },
        {
          clientId: "bob",
          displayName: "<img onerror=alert(1)>",
          avatar: "",
          inCall: true,
        },
      ],
    },
  });
  assert.ok(
    all(f.ui.root).some(
      (n) =>
        n.textContent ===
        " · " +
          require("../../dist/voice/room-metadata.js").shortCode("room-one") +
          " · 2 na sala · 1 em chamada",
    ),
  );
  assert.ok(
    all(f.ui.root).some((n) => n.tag === "span" && n.textContent === "<img onerror=alert(1)>"),
  );
  assert.ok(
    all(f.ui.root).some(
      (n) =>
        n.className === "spacevoice-avatar" &&
        n.children.some((c) => c.textContent === "<O" && c.tag === "span"),
    ),
  );
  assert.equal(f.peers.length, 0);
  assert.equal(f.counts().captures, 0);
  f.find("[ chat > ]").onclick();
  const draft = all(f.ui.root).find((n) => n.className === "spacevoice-chat-input");
  draft.value = "rascunho na sala";
  draft.oninput();
  f.ui.chat.receive({
    type: "typing-start",
    roomId: "room-one",
    from: "bob",
    payload: { authorName: "Bob" },
  });
  assert.equal(f.ui.chat.state.typing.length, 1);
  const originalChat = f.ui.chat;
  f.find("[ entrar na chamada ]").onclick();
  await tick();
  assert.equal(f.ui.call.state.joined, true);
  assert.equal(f.ui.room.inCall, true);
  assert.equal(f.counts().captures, 1);
  assert.equal(f.find("[ chat < ]").hidden, false);
  assert.equal(f.ui.root.dataset.context, "chat");
  assert.equal(f.ui.chat, originalChat);
  assert.equal(draft.value, "rascunho na sala");
  const localStatus = all(f.ui.root).find(
    (n) =>
      n.className === "spacevoice-speaking" &&
      n.parent?.children.some((c) => c.className === "spacevoice-local"),
  );
  assert.equal(localStatus.textContent, "em chamada");
  f.ui.call.toggleMute();
  assert.equal(localStatus.textContent, "× mutado");
  f.ui.leave();
  assert.equal(f.ui.call.state.joined, false);
  assert.equal(f.ui.room.state.roomId, "room-one");
  assert.equal(f.ui.room.inCall, false);
  assert.equal(f.ui.root.dataset.context, "chat");
  assert.equal(f.find("[ chat < ]").hidden, false);
  assert.equal(draft.value, "rascunho na sala");
  assert.equal(f.ui.chat.state.typing.length, 1);
  assert.equal(f.connections[0].closed, false);
  assert.ok(!f.messages.some((m) => m.type === "presence-leave"));
  f.ui.hide();
  assert.equal(f.ui.chat.state.roomId, null);
  assert.equal(f.ui.chat.state.draft, "");
  assert.equal(f.ui.room.state.roomId, null);
  assert.equal(f.connections[0].closed, true);
  assert.equal(f.messages.at(-1).type, "presence-leave");
  assert.equal(all(f.ui.root).filter((n) => n.dataset.peerId).length, 0);
});
test("invite clipboard feedback/fallback and new party cleanly switch room preserving URL params without capture", async () => {
  const f = fixture();
  await f.ui.enterRoom();
  await f.find("[ copiar convite ]").onclick();
  assert.equal(f.copied.length, 1);
  const link = new URL(f.copied[0]);
  assert.equal(link.searchParams.get("party"), "room-one");
  assert.equal(link.searchParams.get("voiceTransport"), "local");
  assert.equal(link.searchParams.get("keep"), "yes");
  assert.ok(all(f.ui.root).some((n) => n.textContent === "convite copiado"));
  await f.ui.newParty();
  assert.equal(f.connections.length, 2);
  assert.equal(f.connections[0].closed, true);
  assert.match(f.ui.room.state.roomId, /^[a-f0-9-]{36}$/);
  assert.equal(f.location.searchParams.get("voiceTransport"), "local");
  assert.equal(f.location.searchParams.get("keep"), "yes");
  assert.equal(f.location.searchParams.get("party"), f.ui.room.state.roomId);
  assert.equal(f.counts().captures, 0);
  assert.equal(f.peers.length, 0);
  f.ui.hide();
  const g = fixture({ clipboard: false });
  await g.ui.enterRoom();
  await g.find("[ copiar convite ]").onclick();
  const input = all(g.ui.root).find((n) => n.className === "party-invite-fallback");
  assert.equal(input.hidden, false);
  assert.equal(input.selected, true);
  assert.ok(input.value.includes("party=room-one"));
  assert.ok(all(g.ui.root).some((n) => n.textContent === "copie o link selecionado"));
  g.ui.hide();
});
test("missing or invalid party creates a UUID in the URL, preserving technical params and avoiding a shared room", async () => {
  const href =
    "https://party.example/?voiceTransport=local&voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787&voiceIcePolicy=relay&keep=yes#spacevoice";
  const a = fixture({ href }),
    b = fixture({ href });
  await a.ui.enterRoom();
  await b.ui.enterRoom();
  for (const f of [a, b]) {
    assert.match(f.ui.room.state.roomId, /^[0-9a-f-]{36}$/);
    assert.equal(f.location.searchParams.get("party"), f.ui.room.state.roomId);
    assert.equal(f.location.searchParams.get("voiceWsUrl"), "ws://localhost:8787");
    assert.equal(f.location.searchParams.get("voiceIcePolicy"), "relay");
    assert.equal(f.location.searchParams.get("keep"), "yes");
    assert.equal(f.counts().captures, 0);
    assert.ok(all(f.ui.root).some((n) => String(n.textContent).startsWith("// geral")));
  }
  assert.notEqual(a.ui.room.state.roomId, b.ui.room.state.roomId);
  const id = a.ui.room.state.roomId;
  await a.ui.enterRoom();
  assert.equal(a.ui.room.state.roomId, id);
  assert.equal(a.connections.length, 1);
  const invited = fixture({ href: a.location.href });
  await invited.ui.enterRoom();
  assert.equal(invited.ui.room.state.roomId, id);
  a.ui.hide();
  b.ui.hide();
  invited.ui.hide();
  const invalid = fixture({
    href: "https://party.example/?party=%3Cinvalid%3E#spacevoice",
  });
  await invalid.ui.enterRoom();
  assert.match(invalid.ui.room.state.roomId, /^[0-9a-f-]{36}$/);
  assert.equal(invalid.counts().captures, 0);
  invalid.ui.hide();
});

test("failed peer exposes contextual retry and diagnostic stays inside advanced media", async () => {
  const f = fixture();
  await f.ui.enterRoom();
  f.find("[ entrar na chamada ]").onclick();
  await tick();
  const c = f.connections[0],
    id = c.options.clientId;
  c.options.onMessage({
    type: "presence-snapshot",
    roomId: "room-one",
    payload: {
      participants: [
        { clientId: id, displayName: "Alice", avatar: "", inCall: true },
        { clientId: "luna", displayName: "Luna", avatar: "", inCall: true },
      ],
    },
  });
  c.options.onMessage({
    type: "peers",
    roomId: "room-one",
    payload: { peers: ["luna"] },
  });
  await tick();
  assert.equal(f.peers.length, 1);
  f.peers[0].onState("failed");
  const retry = f.find("[ tentar novamente ]");
  assert.equal(retry.hidden, false);
  assert.ok(all(f.ui.root).some((n) => n.textContent === "não foi possível conectar"));
  retry.onclick();
  assert.equal(f.peers[0].retryCalls, 1);
  const advanced = all(f.ui.root).find((n) => n.className === "party-media-settings");
  assert.ok(all(advanced).some((n) => n.textContent === "diagnóstico de conexão"));
  f.ui.hide();
});
