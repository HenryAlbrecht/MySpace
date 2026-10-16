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

test("desktop config embeds the existing frontend without Node or shell capability", () => {
  const config = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const capability = JSON.parse(fs.readFileSync("src-tauri/capabilities/main.json", "utf8"));
  assert.equal(config.build.frontendDist, "../dist");
  assert.equal(config.build.devUrl, undefined);
  assert.equal(config.bundle.externalBin, undefined);
  assert.deepEqual(capability.permissions, ["core:app:allow-version", "dialog:allow-open", "allow-authorize-folders", "allow-list-folders", "allow-revoke-folder", "allow-discover-steam", "allow-discover-music"]);
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
  const window = {
    localStorage: {
      getItem: () => JSON.stringify({ version: 1, music: [], games: ["C:\\SteamLibrary"] }),
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
        tracks: [{ file_name: "song.mp3", relative_path: "Album/song.mp3", format: "MP3", title: "<music>", artist: null, album: "Album", duration_seconds: 125, state: "missing-metadata" }],
        warnings: ["Limite de descoberta"],
      };
      return { source: "Steam", root: "C:\\SteamLibrary", state: "complete", games: [{ appid: "42", name: "<game>", install_dir: "C:\\SteamLibrary\\steamapps\\common\\Game", state: "missing" }], errors: ["bad.acf: inválido"] };
    } } },
  };
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-folders.js", "utf8"), { window });
  vm.runInNewContext(source, { window, document });
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
  assert.equal(calls.filter(([command]) => command === "discover_music").length, 2);
  assert.equal(calls.find(([command]) => command === "discover_music")[1].id, "music-id");
  assert.equal(calls.find(([command]) => command === "discover_music")[1].path, undefined);
  assert.equal(calls.filter(([command]) => command === "authorize_folders").length, 0);
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
