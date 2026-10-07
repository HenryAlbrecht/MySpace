const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs"),
  { createLastfmClient } = require("../../server/music/lastfm.cjs");
const make = (kind, extra = {}) => ({
  kind,
  catalogId:
    kind === "music"
      ? "ytmusic:video:abcdefghijk"
      : kind === "artist"
        ? "ytmusic:artist:UCfixture1234"
        : "ytmusic:album:MPREfixture123",
  title: kind === "artist" ? "Beachside talks" : "Mado",
  artist: "Beachside talks",
  isrc: "TEST12345678",
  ...extra,
});
for (const [kind, type] of [["music"], ["album", "album"], ["album", "ep"], ["album", "single"]])
  test(kind + " " + (type || "") + " inherits only artist genres in enrichment", async () => {
    const calls = [],
      row = make(kind, { albumType: type });
    const catalog = createMusicCatalog({
      youtubeMusic: { details: async () => ({ ...row }) },
      lastfm: {
        summary: async (kind, artist, title) => {
          calls.push({ kind, artist, title });
          return kind === "artist"
            ? { genres: ["dream pop", "shoegaze"], summary: "Artist bio" }
            : { genres: [], summary: "Specific description" };
        },
      },
    });
    const core = await catalog.details(kind, row.catalogId, {
      phase: "core",
    });
    assert.equal(calls.length, 0);
    assert.equal(core.genres, undefined);
    const full = await catalog.details(kind, row.catalogId);
    assert.deepEqual(full.genres, ["dream pop", "shoegaze"]);
    assert.equal(full.genresSource, "Last.fm · artista");
    assert.equal(full.summary, "Specific description");
    assert.equal(full.artist, row.artist);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].artist, row.artist);
    assert.equal(calls[1].title, row.artist);
  });
test("known genres win; own Last.fm tags win and skip artist fallback", async () => {
  for (const known of [true, false]) {
    let calls = [];
    const row = make("album", known ? { genres: ["manual"], genresSource: "Manual" } : {});
    const catalog = createMusicCatalog({
      youtubeMusic: { details: async () => ({ ...row }) },
      lastfm: {
        summary: async (kind) => {
          calls.push(kind);
          return { genres: ["specific"] };
        },
      },
    });
    const full = await catalog.details("album", row.catalogId);
    assert.deepEqual(full.genres, [known ? "manual" : "specific"]);
    assert.equal(full.genresSource, known ? "Manual" : "Last.fm");
    assert.deepEqual(calls, ["album"]);
  }
});
test("empty artist tags or failing fallback never invent genres or replace editorial", async () => {
  for (const kind of ["artist", "album"])
    for (const failure of [true, false]) {
      let calls = 0;
      const row = make(kind);
      const catalog = createMusicCatalog({
        youtubeMusic: { details: async () => ({ ...row }) },
        lastfm: {
          summary: async (queried) => {
            calls++;
            if (queried === "artist" && failure) throw Error("offline");
            return {
              genres: [],
              summary: queried === "album" ? "Album editorial" : "",
            };
          },
        },
      });
      const full = await catalog.details(kind, row.catalogId);
      assert.equal(full.genres?.length || 0, 0);
      assert.equal(calls, kind === "artist" ? 1 : 2);
      if (kind === "album") assert.equal(full.summary, "Album editorial");
    }
});
test("five releases reuse the existing artist.getInfo pending/cache, no second cache", async () => {
  const calls = [];
  const lastfm = createLastfmClient({
    env: { LASTFM_API_KEY: "fixture" },
    interval: 0,
    fetcher: async (url) => {
      const method = new URL(url).searchParams.get("method");
      calls.push(method);
      await new Promise((r) => setTimeout(r, 2));
      return {
        ok: true,
        json: async () =>
          method === "artist.getInfo"
            ? { artist: { toptags: { tag: [{ name: "shoegaze" }] } } }
            : { album: { tags: { tag: [] } } },
      };
    },
  });
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async (kind, id) =>
        make(kind, {
          catalogId: "ytmusic:album:" + id,
          title: "Release " + id,
        }),
    },
    lastfm,
  });
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) => catalog.details("album", "ytmusic:album:MPREfixture" + i)),
  );
  assert.ok(results.every((row) => row.genresSource === "Last.fm · artista"));
  assert.equal(calls.filter((method) => method === "album.getInfo").length, 5);
  assert.equal(calls.filter((method) => method === "artist.getInfo").length, 1);
  await catalog.details("album", "ytmusic:album:MPREfixture0");
  assert.equal(calls.length, 6);
});
