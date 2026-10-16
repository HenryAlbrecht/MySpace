const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function setup() {
  const window = {};
  vm.runInNewContext(fs.readFileSync("dist/desktop/desktop-music-library.js", "utf8"), { window });
  return window.createDesktopMusicLibrary();
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
test("complete, partial, unavailable, refresh and revoke preserve snapshots without stale resurrection", () => {
  const owner = setup();
  owner.grants([grant("a")]);
  scan(owner, "a", [track]);
  scan(owner, "a", [], "partial");
  assert.equal(owner.tracks()[0].state, "unverified");
  scan(owner, "a", []);
  assert.equal(owner.tracks()[0].state, "missing");
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
