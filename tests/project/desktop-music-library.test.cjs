const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function setup(cache, extras = {}) {
  const window = {};
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-music-library.js", "utf8"), { window });
  return window.createDesktopMusicLibrary({ ...extras, loadCache: cache?.load, saveCache: cache?.save });
}
function cacheStore() {
  let value = {};
  return {
    load: () => structuredClone(value),
    save: (next) => { value = structuredClone(next); },
    value: () => structuredClone(value),
  };
}
const track = { file_id: "1:2:3", file_name: "fallback.mp3", relative_path: "private/song.mp3", format: "MP3", title: "Title", artist: "Artist", album: "Album", duration_seconds: 123, state: "ready" };
const grant = (id, state = "available") => ({ id, state });
function scan(owner, id, tracks, state = "complete") {
  owner.complete(id, owner.begin(id), { state, tracks });
}
test("native file identity deduplicates overlaps, retains metadata and never creates playable sources", () => {
  const owner = setup();
  owner.grants([grant("a"), grant("b")]);
  scan(owner, "a", [track]);
  scan(owner, "b", [track, { ...track, file_id: "1:2:4", title: null }]);
  const rows = owner.tracks();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "Title");
  assert.equal(rows[0].artist, "Artist");
  assert.equal(rows[0].album, "Album");
  assert.equal(rows[0].duration, 123);
  assert.equal(rows[1].title, "fallback.mp3");
  assert.equal(rows[0].playbackSource, undefined);
  assert.equal(rows[0].relative_path, undefined);
  rows[0].title = "Mutation";
  assert.equal(owner.tracks()[0].title, "Title");
});
test("complete discovery prunes removed files while partial, unavailable and revoke stay scoped", () => {
  const owner = setup();
  owner.grants([grant("a")]);
  scan(owner, "a", [track]);
  scan(owner, "a", [], "partial");
  assert.equal(owner.tracks()[0].state, "unverified");
  scan(owner, "a", []);
  assert.equal(owner.tracks().length, 0);
  scan(owner, "a", [track]);
  owner.grants([grant("a", "unavailable")]);
  assert.equal(owner.tracks()[0].state, "unavailable");
  owner.grants([grant("a")]);
  assert.equal(owner.tracks()[0].state, "unavailable");
  const old = owner.begin("a");
  scan(owner, "a", [{ ...track, title: "Updated" }]);
  owner.complete("a", old, { state: "complete", tracks: [track] });
  assert.equal(owner.tracks()[0].title, "Updated");
  const pending = owner.begin("a");
  owner.grants([]);
  owner.complete("a", pending, { state: "complete", tracks: [track] });
  assert.equal(owner.tracks().length, 0);
});

test("errors and timed-out complete reports retain prior music as unverified", () => {
  const owner = setup();
  owner.grants([grant("a")]);
  scan(owner, "a", [track]);
  owner.complete("a", owner.begin("a"), { state: "complete", tracks: [], errors: ["fixture read error"] });
  assert.equal(owner.tracks().length, 1);
  assert.equal(owner.tracks()[0].state, "unverified");
  owner.complete("a", owner.begin("a"), { state: "complete", tracks: [], timed_out: true });
  assert.equal(owner.tracks().length, 1);
  assert.equal(owner.tracks()[0].state, "unverified");
});
test("offline cache restores metadata across restart, survives failures and requires discovery after recovery", async () => {
  const cache = cacheStore();
  const first = setup(cache);
  first.grants([grant("music-grant")]);
  const secondTrack = { ...track, file_id: "1:2:4", title: "Also Known" };
  scan(first, "music-grant", [track, secondTrack]);
  assert.doesNotMatch(JSON.stringify(cache.value()), /relative_path|playbackSource|private/);

  const opened = [];
  const restarted = setup(cache, {
    openFile: async (id) => { opened.push(id); return "ticket"; },
    sourceUrl: (token) => "local://" + token,
  });
  assert.equal(restarted.tracks().length, 2);
  assert.ok(restarted.tracks().every((row) => row.state === "unverified"));
  await assert.rejects(restarted.open(restarted.tracks()[0].id), /não disponível/);
  assert.deepEqual(opened, []);
  restarted.grants([grant("music-grant", "unavailable")]);
  assert.equal(restarted.tracks()[0].state, "unavailable");
  const failed = restarted.begin("music-grant");
  restarted.fail("music-grant", failed);
  assert.equal(setup(cache).tracks().length, 2);

  restarted.grants([grant("music-grant")]);
  scan(restarted, "music-grant", [{ ...track, title: "Recovered" }], "partial");
  assert.equal(restarted.tracks()[0].title, "Recovered");
  assert.equal(restarted.tracks()[0].state, "available");
  assert.equal(restarted.tracks().find((row) => row.id.endsWith("1:2:4")).state, "unverified");
  scan(restarted, "music-grant", [{ ...track, title: "Recovered" }]);
  assert.equal(restarted.tracks().length, 1);
  assert.equal(restarted.tracks()[0].state, "available");
  assert.equal(restarted.tracks()[0].title, "Recovered");
  assert.equal((await restarted.open(restarted.tracks()[0].id)).url, "local://ticket");
  assert.deepEqual(opened, ["1:2:3"]);

  restarted.grants([]);
  assert.equal(restarted.tracks().length, 0);
  assert.equal(Object.keys(cache.value()).length, 0);
});
test("malformed identities and unsupported formats do not enter the library", () => {
  const owner = setup();
  owner.grants([grant("a")]);
  scan(owner, "a", [{ ...track, file_id: "../path" }, { ...track, format: "WAV" }]);
  assert.equal(owner.tracks().length, 0);
});

test("stream handles use only native file identity and release tickets without persisting a source", async () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-music-library.js", "utf8"), { window });
  const calls = [];
  const owner = window.createDesktopMusicLibrary({
    openFile: async (id) => { calls.push(["open", id]); return "ticket"; },
    checkFile: async (token) => calls.push(["check", token]),
    closeFile: async (token) => calls.push(["close", token]),
    sourceUrl: (token) => "http://myspace-music.localhost/" + token,
  });
  owner.grants([grant("a")]);
  scan(owner, "a", [track]);
  const row = owner.queueTrack(owner.tracks()[0]);
  assert.equal(row.desktopMusic, true);
  assert.equal(row.albumTitle, "Album");
  assert.equal(row.album, "");
  assert.equal(row.playbackSource, null);
  const handle = await owner.open(row.id);
  assert.equal(handle.url, "http://myspace-music.localhost/ticket");
  await handle.check();
  await handle.close();
  assert.deepEqual(calls, [["open", "1:2:3"], ["check", "ticket"], ["close", "ticket"]]);
  await assert.rejects(owner.open("C:\\Music\\song.mp3"), /não disponível/);
});

test("artwork reuses authorized IDs, refresh revisions and standard queue fields", () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-music-library.js", "utf8"), { window });
  const calls = [];
  const owner = window.createDesktopMusicLibrary({ artworkUrl: (id, revision) => { calls.push(id); return "native-art:" + id + ":" + revision; } });
  owner.grants([grant("a")]);
  scan(owner, "a", [track]);
  const row = owner.tracks()[0];
  assert.match(row.image, /^native-art:1:2:3:/);
  const queued = owner.queueTrack(row);
  assert.equal(queued.image, row.image);
  assert.equal(queued.album, row.image);
  assert.equal(queued.albumTitle, "Album");
  scan(owner, "a", [track]);
  assert.notEqual(owner.tracks()[0].image, row.image);
  owner.grants([grant("a", "unavailable")]);
  assert.equal(owner.tracks()[0].image, "");
  owner.grants([]);
  assert.equal(owner.tracks().length, 0);
  assert.ok(calls.every((id) => id === "1:2:3"));
});
