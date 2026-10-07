const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  amp = require("../dist/spaceamp.js"),
  embeds = require("../dist/media-embeds.js"),
  api = require("../dist/voice/room-metadata.js");
test("common track model, square artwork source, YouTube Music provenance", () => {
  const local = amp.track({
    title: "Blind",
    artist: "After",
    album: "cover.png",
    local: true,
  });
  assert.equal(local.source, "local");
  assert.equal(local.artwork, "cover.png");
  const url = "https://music.youtube.com/watch?v=dQw4w9WgXcQ";
  const yt = amp.track({ title: "YT", url }, embeds.parse(url));
  assert.equal(yt.source, "YouTube Music");
  assert.equal(yt.artwork, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.deepEqual(Object.keys(yt), ["title", "artist", "artwork", "source", "sourceUrl"]);
});
test("frequent playback reads omit queue copies while the full snapshot stays isolated", () => {
  const a = amp.create();
  a.setQueue([{ id: "one", title: "One" }]);
  a.update(amp.track({ title: "Current" }), true);
  assert.equal(a.getPlaybackState().playing, true);
  assert.equal(a.getPlaybackState().queue, undefined);
  const full = a.getState();
  full.queue[0].title = "Changed";
  assert.equal(a.getState().queue[0].title, "One");
});
test("event-driven track/play/pause/stop and persisted privacy; only short metadata exported", () => {
  const events = [];
  let saved;
  const a = amp.create({
      target: { dispatchEvent: (e) => events.push(e.type) },
      storage: { getItem: () => null, setItem: (_k, v) => (saved = v) },
    }),
    t = amp.track({
      title: "<img src=x onerror=alert(1)>",
      artist: "After",
      url: "blob:private",
      album: "private-art",
    });
  a.update(t, false);
  assert.equal(a.getNowPlaying(), null);
  a.update(t, true);
  assert.deepEqual(a.getNowPlaying(), {
    title: t.title,
    artist: "After",
    playing: true,
  });
  assert.deepEqual(Object.keys(a.getNowPlaying()), ["title", "artist", "playing"]);
  const length = events.length;
  a.update(t, true);
  assert.equal(events.length, length);
  a.update({ ...t, title: "next" }, true);
  assert.equal(a.getNowPlaying().title, "next");
  assert.equal(events.at(-1), "spaceamp:trackchange");
  a.update(t, false);
  assert.equal(a.getNowPlaying(), null);
  a.update(t, true);
  a.share(false);
  assert.equal(a.getNowPlaying(), null);
  assert.equal(saved, "false");
  assert.equal(a.getState().playing, true);
  assert.equal(events.at(-1), "spaceamp:privacy");
  assert.equal(amp.create({ storage: { getItem: () => saved } }).getState().shared, false);
  a.share(true);
  a.update(t, false);
  assert.equal(a.getNowPlaying(), null);
});
test("Now Playing server validator rejects oversized, typed, control text and private fields", () => {
  const valid = { title: "Blind", artist: "After", playing: true };
  assert.deepEqual(api.presence({ nowPlaying: valid }).nowPlaying, valid);
  assert.equal(api.presence({ nowPlaying: { ...valid, playing: false } }).nowPlaying, null);
  assert.equal(api.presence({ nowPlaying: null }).nowPlaying, null);
  for (const bad of [
    { ...valid, title: "x".repeat(81) },
    { ...valid, artist: "x".repeat(81) },
    { ...valid, title: "a\nb" },
    { ...valid, playing: "true" },
    { ...valid, url: "blob:secret" },
    [],
    { ...valid, artwork: "data:secret" },
  ])
    assert.equal(api.presence({ nowPlaying: bad }), null);
});
