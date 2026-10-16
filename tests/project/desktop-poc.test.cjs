const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("dist/desktop/desktop-poc.js", "utf8");

test("desktop PoC stays absent in the browser and does not access browser storage", () => {
  for (const window of [{}, { __TAURI__: {} }, { __TAURI__: { core: {} } }]) {
    vm.runInNewContext(source, { window });
  }
});

test("desktop bridge invokes native file selection without launching or persisting", async () => {
  const calls = [];
  const nodes = [];
  let selection = "C:\\Games\\game.exe";
  let selectionError;
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; }
    setAttribute() {}
    addEventListener() {}
    append(...children) { this.children.push(...children); }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const document = {
    documentElement: new Node("html"), body: new Node("body"),
    createElement(tag) { const node = new Node(tag); nodes.push(node); return node; },
    addEventListener() {},
  };
  const window = { __TAURI__: { core: { invoke: async (command, args) => {
    calls.push([command, args]);
    if (command === "plugin:app|version") return "0.1.0";
    if (selectionError) throw selectionError;
    return selection;
  } } } };
  vm.runInNewContext(source, { window, document });
  assert.equal(document.body.children[0].open, true);
  const picker = nodes.find((node) => node.textContent === "Testar seletor nativo de arquivo");
  await picker.onclick();
  assert.deepEqual(calls.map(([name]) => name), ["plugin:app|version", "plugin:dialog|open"]);
  assert.equal(calls[1][1].options.multiple, false);
  assert.equal(calls[1][1].options.directory, false);
  assert.match(nodes.find((node) => node.tag === "p" && node.textContent?.startsWith("Arquivo selecionado:")).textContent, /game\.exe/);
  assert.equal(picker.disabled, false);
  selection = null;
  await picker.onclick();
  assert.ok(nodes.some((node) => node.textContent === "Seleção cancelada."));
  assert.equal(picker.disabled, false);
  selectionError = new Error("dialog denied");
  await picker.onclick();
  assert.ok(nodes.some((node) => node.textContent === "Não foi possível abrir o seletor nativo: Error: dialog denied"));
  assert.equal(picker.disabled, false);
  selectionError = null;
  selection = "C:\\Games\\retry.exe";
  await picker.onclick();
  assert.ok(nodes.some((node) => node.textContent === "Arquivo selecionado: C:\\Games\\retry.exe"));
  assert.deepEqual(calls.slice(2).map(([name]) => name), Array(3).fill("plugin:dialog|open"));
});

test("Desktop YouTube Music bridge is idle at boot and parses only explicit searches", async () => {
  const calls = [];
  class Node {
    constructor() { this.children = []; this.dataset = {}; }
    setAttribute() {}
    addEventListener() {}
    append(...children) { this.children.push(...children); }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const document = {
    documentElement: new Node(),
    body: new Node(),
    createElement() { return new Node(); },
    addEventListener() {},
  };
  const window = {
    YouTubeMusicParser: {
      parseSearchPage(kind, payload) {
        return { items: payload.results.map((title) => ({ kind, title })), next: payload.next };
      },
    },
    __TAURI__: {
      core: {
        async invoke(command, args) {
          calls.push([command, args]);
          if (command === "plugin:app|version") return "0.1.0";
          if (command === "search_youtube_music") return { results: ["Track"], next: "next-token" };
          return null;
        },
      },
    },
  };
  vm.runInNewContext(source, { window, document });
  await Promise.resolve();
  assert.deepEqual(calls.map(([command]) => command), ["plugin:app|version"]);
  const page = await window.DesktopMusicSearch.search("music", "Track query", "cursor-1");
  assert.deepEqual(JSON.parse(JSON.stringify(page)), {
    provider: "YouTube Music",
    items: [{ kind: "music", title: "Track" }],
    next: "next-token",
  });
  assert.equal(JSON.stringify(calls[1]), JSON.stringify(["search_youtube_music", {
    kind: "music",
    query: "Track query",
    cursor: "cursor-1",
  }]));
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(window.DesktopMusicSearch.search("music", "Track query", null, {
    signal: abort.signal,
  }), { name: "AbortError" });
  assert.equal(calls.length, 2);
});

test("desktop config embeds the existing frontend without Node or shell capability", () => {
  const config = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const capability = JSON.parse(fs.readFileSync("src-tauri/capabilities/main.json", "utf8"));
  assert.equal(config.build.frontendDist, "../dist");
  assert.equal(config.build.devUrl, undefined);
  assert.equal(config.bundle.externalBin, undefined);
  assert.deepEqual(capability.permissions, ["core:app:allow-version", "dialog:allow-open", "allow-authorize-folders", "allow-list-folders", "allow-revoke-folder", "allow-discover-steam", "allow-discover-music", "allow-open-music", "allow-check-music", "allow-close-music", "allow-launch-steam", "allow-search-youtube-music"]);
  assert.equal(capability.remote, undefined);
});

test("desktop diagnostic renders Steam/music metadata and handles native failure", async () => {
  const nodes = [];
  const calls = [];
  let failure = false;
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; }
    setAttribute() {}
    addEventListener() {}
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; this.textContent = ""; }
    showModal() { this.open = true; }
    focus() {}
  }
  const document = {
    documentElement: new Node("html"), body: new Node("body"),
    createElement(tag) { const node = new Node(tag); nodes.push(node); return node; },
    addEventListener() {},
  };
  let localCache = JSON.stringify({ version: 1, games: {}, music: {} });
  const window = {
    Catalog: { normalize: (kind, { items }) => items.map((item) => ({ kind, catalogId: "steam:" + item.id, title: item.name })) },
    dispatchEvent() {},
    localStorage: {
      getItem: (key) => { assert.equal(key, "myspace-desktop-library-cache-v1"); return localCache; },
      setItem: (key, value) => { assert.equal(key, "myspace-desktop-library-cache-v1"); localCache = value; },
    },
    __TAURI__: { core: { invoke: async (command, args) => {
      calls.push([command, args]);
      if (command === "plugin:app|version") return "0.1.0";
      if (command === "list_folders") return [
        { id: "game-id", category: "games", path: "C:\\SteamLibrary", state: "available" },
        { id: "music-id", category: "music", path: "C:\\Music", state: "available" },
      ];
      if (failure) throw new Error("denied");
      if (command === "discover_music") return {
        root: "C:\\Music", state: "partial", entries: 3,
        tracks: [{ file_id: "1:2:3", file_name: "song.mp3", relative_path: "Album/song.mp3", format: "MP3", title: "<music>", artist: null, album: "Album", duration_seconds: 125, state: "missing-metadata" }],
        warnings: ["Limite de descoberta"],
      };
      return { source: "Steam", root: "C:\\SteamLibrary", state: "complete", games: [{ appid: "42", name: "<game>", install_dir: "C:\\SteamLibrary\\steamapps\\common\\Game", state: "missing" }], errors: ["bad.acf: inválido"] };
    } } },
  };
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-folders.js", "utf8"), { window });
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-game-library.js", "utf8"), { window });
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-music-library.js", "utf8"), { window });
  vm.runInNewContext(source, { window, document, CustomEvent: class CustomEvent {} });
  await new Promise(setImmediate);
  const discover = nodes.find((node) => node.textContent === "Descobrir jogos Steam");
  await discover.onclick();
  await new Promise(setImmediate);
  assert.ok(nodes.some((node) => node.textContent?.includes("Steam · <game> · AppID 42 · instalação ausente")));
  assert.ok(nodes.some((node) => node.textContent === "Aviso: bad.acf: inválido"));
  assert.equal(calls.find(([command]) => command === "discover_steam")[1].id, "game-id");
  assert.equal(calls.find(([command]) => command === "discover_steam")[1].path, undefined);
  const music = nodes.find((node) => node.textContent === "Descobrir / atualizar músicas");
  await music.onclick();
  await new Promise(setImmediate);
  assert.ok(nodes.some((node) => node.textContent?.includes("MP3 · song.mp3 · <music> · artista ausente · Album · 2:05")));
  assert.ok(nodes.some((node) => node.textContent === "Aviso: Limite de descoberta"));
  await music.onclick();
  await new Promise(setImmediate);
  assert.equal(calls.filter(([command]) => command === "discover_music").length, 3);
  assert.equal(calls.find(([command]) => command === "discover_music")[1].id, "music-id");
  assert.equal(calls.find(([command]) => command === "discover_music")[1].path, undefined);
  assert.equal(calls.filter(([command]) => command === "authorize_folders").length, 0);
  const cache = JSON.parse(localCache);
  assert.ok(cache.games["game-id"], localCache);
  assert.equal(cache.games["game-id"][0].appid, "42");
  assert.equal(cache.games["game-id"][0].name, "<game>");
  assert.equal(cache.music["music-id"][0].file_id, "1:2:3");
  assert.doesNotMatch(localCache, /C:\\\\SteamLibrary|C:\\\\Music|relative_path|Album\/song\.mp3|install_dir/);
  failure = true;
  await discover.onclick();
  await new Promise(setImmediate);
  assert.ok(nodes.some((node) => node.textContent === "Falha na descoberta: Error: denied"));
  assert.equal(discover.disabled, false);
  await music.onclick();
  await new Promise(setImmediate);
  assert.ok(nodes.some((node) => node.textContent === "Falha na descoberta musical: Error: denied"));
  assert.equal(music.disabled, false);
});
