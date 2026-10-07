const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
const { createMusicCatalog } = require("../server/music-catalog.cjs");
const seed = {
  kind: "music",
  catalogId: "ytmusic:video:abcdefghijk",
  title: "Song",
  artist: "Artist",
  albumCatalogId: "ytmusic:album:MPREalbum123",
  trackDuration: 228,
  image: "https://i.ytimg.com/cover.jpg",
  playbackSource: { type: "youtube", videoId: "abcdefghijk" },
};
test("core returns before slow editorial and identifiers; full detail preserves core", async () => {
  let started = 0,
    completed = 0;
  const slow = async (value) => {
    started++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    completed++;
    return value;
  };
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async (kind) => (kind === "album" ? { releaseDate: "2015" } : { ...seed }),
    },
    musicbrainz: { recordingIsrc: () => slow({ isrc: "TEST12345678" }) },
    isrcEdition: async () => "TEST12345678",
    lastfm: { summary: () => slow({ summary: "Editorial", genres: ["rock"] }) },
  });
  const begin = performance.now(),
    core = await catalog.details("music", seed.catalogId, { phase: "core" });
  const coreMs = performance.now() - begin;
  assert.equal(core.releaseDate, "2015");
  assert.equal(started, 0);
  assert.ok(performance.now() - begin < 500);
  const full = await catalog.details("music", seed.catalogId);
  assert.equal(completed, 2);
  assert.ok(performance.now() - begin < 3500, "independent providers run concurrently");
  for (const field of ["releaseDate", "albumCatalogId", "trackDuration", "playbackSource", "image"])
    assert.deepEqual(full[field], core[field]);
  assert.equal(full.summary, "Editorial");
  assert.deepEqual(full.genres, ["rock"]);
  assert.equal(full.isrc, "TEST12345678");
  console.log(
    "Measured core " +
      coreMs.toFixed(2) +
      "ms; full detail " +
      Math.round(performance.now() - begin) +
      "ms with two 2s providers in parallel",
  );
});
test("intent core shares pending work, caches early, and restricts enrichment merge", async () => {
  let release,
    calls = 0;
  const gate = new Promise((resolve) => (release = resolve));
  const scope = {
    console,
    URLSearchParams,
    AbortController,
    location: { protocol: "http:", hostname: "localhost" },
    MusicModel: require("../dist/music-model.js"),
    fetch: async (url) => {
      calls++;
      if (new URL("http://localhost" + url).searchParams.get("phase") === "core") {
        await gate;
        return {
          ok: true,
          json: async () => ({ ...seed, releaseDate: "2015" }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          ...seed,
          releaseDate: "1999",
          albumCatalogId: "ytmusic:album:MPREwrong123",
          image: "wrong",
          summary: "Loaded",
          genres: ["rock"],
          isrc: "TEST12345678",
        }),
      };
    },
  };
  vm.runInNewContext(fs.readFileSync("dist/catalog.js", "utf8"), scope);
  const events = {};
  scope.Catalog.intentCore({ addEventListener: (name, handler) => (events[name] = handler) }, seed);
  assert.equal(calls, 0);
  events.pointerenter();
  events.focus();
  const route = scope.Catalog.prefetchCore(seed);
  assert.equal(calls, 1);
  release();
  const core = await route;
  await scope.Catalog.prefetchCore(seed);
  assert.equal(calls, 1);
  assert.equal(scope.Catalog.peekCore(seed).releaseDate, "2015");
  const enriched = await scope.Catalog.enrich(core);
  assert.equal(calls, 2);
  assert.equal(enriched.releaseDate, "2015");
  assert.equal(enriched.albumCatalogId, seed.albumCatalogId);
  assert.equal(enriched.image, seed.image);
  assert.equal(enriched.summary, "Loaded");
});
