const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { normalize } = require("../../dist/catalog/catalog.js");
const window = {};
vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-game-library.js", "utf8"), { window });
function setup(cache) {
  return window.createDesktopGameLibrary({ normalize, loadCache: cache?.load, saveCache: cache?.save });
}
function cacheStore() {
  let value = {};
  return {
    load: () => structuredClone(value),
    save: (next) => { value = structuredClone(next); },
    value: () => structuredClone(value),
  };
}
function report(appid = "42", name = "Native game", state = "present") {
  return { state: "complete", games: [{ appid, name, state, install_dir: "C:\\private" }], errors: [] };
}

test("launch delegates only the discovered AppID, blocks duplicate requests and unavailable references", async () => {
  const calls = [];
  let complete;
  const library = window.createDesktopGameLibrary({ normalize, launchSteam: (appid) => {
    calls.push(appid);
    return new Promise((resolve) => { complete = resolve; });
  } });
  library.grants([{ id: "a", state: "available" }]);
  library.complete("a", library.begin("a"), report());
  const saved = { kind: "game", catalogId: "steam:42", title: "User title" };
  assert.equal(library.canLaunch(saved), true);
  const pending = library.launch(saved);
  await assert.rejects(library.launch(saved), /andamento/);
  assert.deepEqual(calls, ["42"]);
  complete({ state: "delegated" });
  assert.equal((await pending).state, "delegated");
  assert.equal(library.canLaunch({ catalogId: "steam:43" }), false);
  library.grants([{ id: "a", state: "unavailable" }]);
  await assert.rejects(library.launch(saved), /indisponível/);
  library.grants([]);
  assert.equal(library.canLaunch(saved), false);
});

test("Steam AppID dedupes libraries and saved items without changing user data", () => {
  const library = setup();
  library.grants([{ id: "a", state: "available" }, { id: "b", state: "available" }]);
  library.complete("a", library.begin("a"), report());
  library.complete("b", library.begin("b"), report("42", "Other", "missing"));
  const local = library.merge([]);
  assert.equal(local.length, 1);
  assert.equal(local[0].catalogId, "steam:42");
  assert.equal(local[0].desktopLocal.state, "present");
  assert.equal(local[0].image, "");
  assert.doesNotMatch(JSON.stringify(local), /private|desktopLocal|localState/);
  const saved = { id: "user-id", kind: "game", catalogId: "steam:42", title: "User title", status: "done", notes: "Keep", image: "user.png", xmbHidden: true };
  const before = JSON.stringify(saved);
  const merged = library.merge([saved]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, "User title");
  assert.equal(merged[0].id, "user-id");
  assert.equal(merged[0].xmbHidden, true);
  assert.equal(merged[0].desktopLocal.only, false);
  assert.equal(JSON.stringify(saved), before);
  assert.equal(JSON.stringify(merged[0]), before);
  const alias = { ...saved, catalogId: "igdb:99", metadataSources: { catalogId: "steam:42" } };
  assert.equal(library.merge([alias]).length, 1);
  assert.equal(library.merge([alias])[0].catalogId, "igdb:99");
});

test("unavailable retains transient rows, revocation removes only local presence", () => {
  const library = setup();
  library.grants([{ id: "a", state: "available" }]);
  library.complete("a", library.begin("a"), report());
  library.grants([{ id: "a", state: "unavailable" }]);
  assert.equal(library.merge([])[0].desktopLocal.state, "unavailable");
  library.grants([{ id: "a", state: "available" }]);
  assert.equal(library.merge([])[0].desktopLocal.state, "unavailable");
  library.complete("a", library.begin("a"), report());
  assert.equal(library.merge([])[0].desktopLocal.state, "present");
  library.grants([]);
  assert.equal(library.merge([]).length, 0);
  const saved = { id: "user", kind: "game", catalogId: "steam:42", title: "Keep" };
  assert.equal(library.merge([saved])[0], saved);
});

test("offline cache restores Steam rows across restart, survives failures and clears only on revoke", () => {
  const cache = cacheStore();
  const first = setup(cache);
  first.grants([{ id: "game-grant", state: "available" }]);
  first.complete("game-grant", first.begin("game-grant"), report());
  assert.doesNotMatch(JSON.stringify(cache.value()), /private|install_dir|desktopLocal/);

  const restarted = setup(cache);
  assert.equal(restarted.merge([])[0].desktopLocal.state, "unverified");
  restarted.grants([{ id: "game-grant", state: "unavailable" }]);
  assert.equal(restarted.merge([])[0].desktopLocal.state, "unavailable");
  const failed = restarted.begin("game-grant");
  restarted.fail("game-grant", failed);
  assert.equal(setup(cache).merge([]).length, 1);

  restarted.grants([{ id: "game-grant", state: "available" }]);
  const partial = restarted.begin("game-grant");
  restarted.complete("game-grant", partial, { state: "limited", games: [], errors: ["timeout"] });
  assert.equal(restarted.merge([])[0].desktopLocal.state, "unverified");
  assert.equal(setup(cache).merge([]).length, 1);
  const recovered = restarted.begin("game-grant");
  restarted.complete("game-grant", recovered, report("42", "Recovered"));
  assert.equal(restarted.merge([])[0].title, "Recovered");
  const cachedLaunch = window.createDesktopGameLibrary({ normalize, launchSteam: async () => {}, loadCache: cache.load, saveCache: cache.save });
  cachedLaunch.grants([{ id: "game-grant", state: "available" }]);
  assert.equal(cachedLaunch.canLaunch(cachedLaunch.merge([])[0]), false);

  restarted.grants([]);
  assert.equal(restarted.merge([]).length, 0);
  assert.equal(Object.keys(cache.value()).length, 0);
  const saved = { id: "personal", kind: "game", catalogId: "steam:42", title: "Keep" };
  assert.equal(restarted.merge([saved])[0], saved);
});

test("new discoveries replace complete snapshots, partial/error results preserve old metadata", () => {
  const library = setup();
  library.grants([{ id: "a", state: "available" }]);
  library.complete("a", library.begin("a"), report());
  library.complete("a", library.begin("a"), { state: "limited", games: [], errors: [] });
  assert.equal(library.merge([])[0].desktopLocal.state, "unverified");
  library.complete("a", library.begin("a"), report("42", "Renamed"));
  assert.equal(library.merge([])[0].title, "Renamed");
  library.fail("a", library.begin("a"));
  assert.equal(library.merge([])[0].desktopLocal.state, "unavailable");
  library.complete("a", library.begin("a"), { state: "complete", games: [], errors: [] });
  assert.equal(library.merge([]).length, 0);
});

test("late or revoked responses and invalid AppIDs cannot repopulate results", () => {
  const library = setup();
  library.grants([{ id: "a", state: "available" }]);
  const old = library.begin("a");
  library.complete("a", library.begin("a"), report("43", "New"));
  library.complete("a", old, report());
  assert.equal(library.merge([])[0].catalogId, "steam:43");
  const revoked = library.begin("a");
  library.grants([]);
  library.grants([{ id: "a", state: "available" }]);
  library.complete("a", revoked, report());
  assert.equal(library.merge([]).length, 0);
  library.complete("a", library.begin("a"), report("../1"));
  assert.equal(library.merge([]).length, 0);
});

test("native Steam artwork stays transient, below custom artwork, and refreshes on cache grants", () => {
  const library = window.createDesktopGameLibrary({ normalize, artworkUrl: (id, revision) => "http://native.invalid/steam-art-" + id + "-" + revision });
  library.grants([{ id: "a", state: "available" }]);
  library.complete("a", library.begin("a"), report());
  const first = library.merge([])[0];
  assert.match(first.image, /steam-art-42-/);
  const custom = { id: "personal", kind: "game", catalogId: "steam:42", title: "Custom", image: "personal.png", xmbArt: { image: "xmb-art:user" } };
  assert.equal(library.merge([custom])[0].image, "personal.png");
  assert.equal(library.merge([custom])[0].xmbArt.image, "xmb-art:user");
  assert.equal(custom.desktopLocal, undefined);
  library.artworkGrants([{ id: "cache", state: "available" }]);
  assert.notEqual(library.merge([])[0].image, first.image);
  const cached = library.merge([])[0].image;
  library.refreshArtwork();
  assert.notEqual(library.merge([])[0].image, cached);
  const empty = { ...custom, image: "", xmbArt: {} };
  assert.match(library.merge([empty])[0].image, /steam-art-42-/);
  assert.equal(empty.image, "");
  library.grants([]);
  assert.equal(library.merge([custom])[0], custom);
});

test("Steam wallpaper has a separate transient role and never enters saved xmbArt", () => {
  const library = window.createDesktopGameLibrary({ normalize, artworkUrl: (id, revision, kind) => "native:" + id + ":" + kind });
  library.grants([{ id: "a", state: "available" }]);
  library.complete("a", library.begin("a"), report());
  const row = library.merge([])[0];
  assert.equal(row.image, "native:42:cover");
  assert.equal(row.desktopLocal.background, "native:42:background");
  assert.equal(row.desktopLocal.vertical, "native:42:vertical");
  assert.equal(row.xmbArt, undefined);
  assert.doesNotMatch(JSON.stringify(row), /native:42:background/);
  const custom = { id: "personal", kind: "game", catalogId: "steam:42", xmbArt: { image: "my-cover", background: "my-wallpaper" } };
  assert.equal(library.merge([custom])[0].xmbArt.background, "my-wallpaper");
});
