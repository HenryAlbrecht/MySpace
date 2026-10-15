const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const window = {};
vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-folders.js", "utf8"), { window });

test("folder selection persists categories, deduplicates and removes references only", async () => {
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  let selected = ["C:\\Music", "c:/music/", "D:\\Albums"];
  const create = () => window.DesktopFolders.create({
    storage,
    pickFolders: async () => selected,
    checkFolders: async (paths) => paths.map((path) => path.startsWith("D:") ? "unavailable" : "available"),
  });
  const owner = create();
  assert.equal((await owner.add("music")).added, 2);
  assert.equal((await owner.add("music")).added, 0);
  assert.equal(owner.getState().games.length, 0);
  assert.equal((await owner.check("music")).get("D:\\Albums"), "unavailable");
  const restarted = create();
  assert.equal(restarted.getState().music.length, 2);
  restarted.remove("music", "c:/music/");
  assert.equal(create().getState().music.length, 1);
  selected = ["C:\\Music"];
  await restarted.add("games");
  assert.equal(create().getState().games[0], "C:\\Music");
  selected = null;
  assert.equal((await restarted.add("music")).cancelled, true);
  selected = ["relative/path"];
  await assert.rejects(restarted.add("music"), /inválida/);
  assert.equal(create().getState().music.length, 1);
});

test("storage and picker errors preserve the saved references and allow retry", async () => {
  let value = null;
  let fail = true;
  const owner = window.DesktopFolders.create({
    storage: {
      getItem: () => value,
      setItem: (key, next) => { if (fail) throw new Error("quota"); value = next; },
    },
    pickFolders: async () => ["C:\\Games"],
    checkFolders: async () => { throw new Error("native denied"); },
  });
  await assert.rejects(owner.add("games"), /quota/);
  assert.equal(owner.getState().games.length, 0);
  fail = false;
  await owner.add("games");
  await assert.rejects(owner.check("games"), /native denied/);
  assert.equal(owner.getState().games.length, 1);
  fail = true;
  assert.throws(() => owner.remove("games", "C:\\Games"), /quota/);
  assert.equal(owner.getState().games.length, 1);
  const broken = window.DesktopFolders.create({ storage: { getItem: () => "{" } });
  assert.match(broken.getState().error, /carregar/);
  await assert.rejects(broken.add("music"), /carregar/);
});

test("Steam discovery only receives registered game roots and never mutates references", async () => {
  let saved = null;
  let selected = ["C:\\SteamLibrary"];
  const calls = [];
  const owner = window.DesktopFolders.create({
    storage: { getItem: () => saved, setItem: (key, value) => { saved = value; } },
    pickFolders: async () => selected,
    discoverSteam: async (path) => {
      calls.push(path);
      return { source: "Steam", state: "cancelled", games: [], errors: [] };
    },
  });
  await owner.add("music");
  await assert.rejects(owner.discover("C:\\SteamLibrary"), /não registrada/);
  await owner.add("games");
  const before = saved;
  assert.equal((await owner.discover("C:\\SteamLibrary")).state, "cancelled");
  assert.deepEqual(calls, ["C:\\SteamLibrary"]);
  assert.equal(saved, before);
  owner.remove("games", "C:\\SteamLibrary");
  await assert.rejects(owner.discover("C:\\SteamLibrary"), /não registrada/);
});
