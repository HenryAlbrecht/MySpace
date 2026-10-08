const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  vm = require("vm");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs"),
  {
    releaseRecommendations,
    rankCandidates,
  } = require("../../server/music/music-recommendation-ranking.cjs"),
  MusicModel = require("../../dist/music-model.js");
const artist = (i) => ({
  kind: "artist",
  catalogId: "ytmusic:artist:UCfixture" + String(i).padStart(8, "0"),
  title: "Artist " + i,
  source: "YouTube Music",
});
const release = (i, type = "album", signal = "related") => ({
  kind: "album",
  catalogId: "ytmusic:album:MPREfixture" + i,
  title: "Release " + i,
  artist: "Artist " + i,
  albumType: type,
  recommendationSignal: signal,
});
const seed = {
  ...release("seed"),
  artist: "Seed",
  artistCatalogId: artist(999).catalogId,
  albumTracks: [{ playbackSource: { videoId: "abcdefghijk" } }],
};
for (const type of ["album", "ep", "single"])
  test(type + " local reserve continues beyond 12, normal stops cheaply", async () => {
    async function run(limit) {
      let calls = [],
        active = 0,
        max = 0;
      const initial = Array.from({ length: 7 }, (_, i) => release(i, type)),
        radio = Array.from({ length: 5 }, (_, i) => release(i + 7, type)),
        extra = Array.from({ length: 8 }, (_, i) => release(i + 12, type));
      const yt = {
        peek: (kind, id) =>
          kind === "album" ? radio.find((row) => row.catalogId.endsWith(id)) : null,
        radio: async () => {
          calls.push("radio");
          return {
            items: radio.map((row) => ({
              albumCatalogId: row.catalogId,
              albumTitle: row.title,
              artist: row.artist,
            })),
          };
        },
        details: async (kind, id) => {
          calls.push(kind + ":" + id);
          if (kind === "album") return { ...seed, albumType: type, relatedAlbums: initial };
          active++;
          max = Math.max(max, active);
          await new Promise((r) => setTimeout(r, 1));
          active--;
          return id === artist(999).catalogId.split(":")[2]
            ? { topAlbums: [], relatedArtists: [artist(100), artist(101)] }
            : {
                topAlbums:
                  id === artist(100).catalogId.split(":")[2] ? extra.slice(0, 4) : extra.slice(4),
              };
        },
      };
      const result = await releaseRecommendations(
        yt,
        {
          recommendations: async () => {
            throw Error("not needed");
          },
        },
        () => null,
        "MPREseed",
        { limit },
      );
      return { result, calls, max };
    }
    const normal = await run(12),
      local = await run(24);
    assert.equal(normal.result.items.length, 12);
    assert.equal(normal.result.requestBudget.currentArtistDetails, 0);
    assert.equal(local.result.items.length, 20);
    assert.equal(local.result.requestBudget.relatedArtistDetails, 2);
    assert.equal(local.result.requestBudget.releaseDetails, 0);
    assert.ok(local.max <= 2);
    assert.ok(local.result.items.every((row) => row.albumType === type));
  });
for (const [type, actual, accepted] of [
  ["single", "album", false],
  ["ep", "ep", true],
  ["album", "single", false],
  ["album", "album", true],
])
  test(type + " unknown related validates canonical " + actual, async () => {
    const unknown = release("unknown", type);
    delete unknown.albumType;
    const known = release("known", type),
      radio = release("radio", type, "radio");
    let hydration = 0;
    const yt = {
      peek: (kind, id) => (id === radio.catalogId.split(":")[2] ? radio : null),
      details: async (kind, id) => {
        if (kind === "artist") return { topAlbums: [] };
        if (id === "MPREseed") return { ...seed, albumType: type, relatedAlbums: [unknown, known] };
        hydration++;
        return { ...unknown, albumType: actual };
      },
      radio: async () => ({
        items: [
          {
            albumCatalogId: radio.catalogId,
            albumTitle: radio.title,
            artist: radio.artist,
          },
        ],
      }),
    };
    const result = await releaseRecommendations(
      yt,
      { recommendations: async () => ({ items: [] }) },
      () => null,
      "MPREseed",
      { limit: 24 },
    );
    assert.equal(hydration, 1);
    assert.equal(
      result.items.some((row) => row.catalogId === unknown.catalogId),
      accepted,
    );
    assert.ok(result.items.every((row) => row.albumType === type));
    if (accepted) assert.equal(result.items[0].catalogId, unknown.catalogId);
  });
test("unknown hydration shares four-detail budget across sources and concurrency two", async () => {
  let active = 0,
    max = 0,
    count = 0;
  const unknown = Array.from({ length: 20 }, (_, i) => {
    const row = release(i);
    delete row.albumType;
    return row;
  });
  const yt = {
    peek: () => null,
    details: async (kind, id) => {
      if (id === "MPREseed") return { ...seed, albumType: "ep", relatedAlbums: unknown };
      if (kind === "artist") return { topAlbums: [] };
      count++;
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return { albumType: undefined };
    },
    radio: async () => ({ items: [] }),
  };
  const result = await releaseRecommendations(
    yt,
    { recommendations: async () => ({ items: [] }) },
    () => null,
    "MPREseed",
    { limit: 24 },
  );
  assert.equal(count, 4);
  assert.equal(result.requestBudget.releaseDetails, 4);
  assert.ok(max <= 2);
  assert.equal(result.items.length, 0);
});
test("cached seed subtype survives sparse canonical detail", async () => {
  const catalog = createMusicCatalog({
    youtubeMusic: {
      peek: () => ({ ...seed, albumType: "single" }),
      details: async () => ({
        ...seed,
        albumType: undefined,
        relatedAlbums: [release(1, "album"), release(2, "single")],
      }),
      radio: async () => ({ items: [] }),
    },
    lastfm: { recommendations: async () => ({ items: [] }) },
  });
  const result = await catalog.recommendations("album", "Seed", "Seed", {
    albumId: "MPREseed",
    localPool: true,
  });
  assert.ok(result.items.every((row) => row.albumType === "single"));
  assert.equal(result.items.length, 1);
});
for (const [count, resolve, expected, searches] of [
  [18, true, 18, 0],
  [8, true, 14, 6],
  [7, false, 7, 6],
])
  test("artist pool " + count + " bounded fallback and honest reserve", async () => {
    let details = 0,
      signals = 0,
      search = 0,
      active = 0,
      max = 0;
    const catalog = createMusicCatalog({
      youtubeMusic: {
        details: async () => {
          details++;
          return {
            title: "Seed",
            relatedArtists: Array.from({ length: count }, (_, i) => artist(i)),
          };
        },
        search: async (kind, q) => {
          search++;
          active++;
          max = Math.max(max, active);
          await new Promise((r) => setTimeout(r, 1));
          active--;
          return {
            items: resolve ? [artist(Number(q.split(" ").at(-1)))] : [],
          };
        },
      },
      lastfm: {
        recommendations: async () => {
          signals++;
          return {
            items: Array.from({ length: 8 }, (_, i) => artist(i + 100)),
          };
        },
      },
    });
    const result = await catalog.recommendations("artist", "Seed", "Seed", {
      artistId: "UCseed00000001",
      localPool: true,
    });
    assert.equal(result.items.length, expected);
    assert.equal(details, 1);
    assert.equal(search, searches);
    assert.equal(signals, count >= 18 ? 0 : 1);
    assert.ok(max <= 2);
    assert.equal(result.reserveAvailable, expected > 12);
    assert.equal(result.sourceExhausted, true);
    assert.ok(result.items.every((row) => row.source === "YouTube Music"));
    assert.equal(result.requestBudget.artistSearches, searches);
  });
test("normal artist stays on YT only; ambiguous fallback never creates parallel identities", async () => {
  let signals = 0;
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async () => ({ relatedArtists: [artist(1)] }),
      search: async () => ({
        items: [
          { ...artist(2), title: "Ambiguous" },
          { ...artist(3), title: "Ambiguous" },
        ],
      }),
    },
    lastfm: {
      recommendations: async () => {
        signals++;
        return { items: [{ kind: "artist", title: "Ambiguous" }] };
      },
    },
  });
  assert.equal(
    (
      await catalog.recommendations("artist", "Seed", "Seed", {
        artistId: "UCseed00000001",
      })
    ).items.length,
    1,
  );
  assert.equal(signals, 0);
  const local = await catalog.recommendations("artist", "Seed", "Seed", {
    artistId: "UCseed00000001",
    localPool: true,
  });
  assert.equal(local.items.length, 1);
  assert.equal(local.reserveAvailable, false);
});
test("genre self dedupe excludes same work across provider IDs", () => {
  const scope = { window: {}, MusicModel };
  vm.runInNewContext(fs.readFileSync("dist/music/music-page-ui.js", "utf8"), scope);
  const current = {
    kind: "music",
    catalogId: "ytmusic:video:abcdefghijk",
    title: "Creep",
    artist: "Radiohead",
    genres: ["rock"],
  };
  assert.equal(
    scope.window.MusicPageUI.collectionGenreMatches(current, [
      { ...current, catalogId: "itunes:123" },
    ]).length,
    0,
  );
});

test("artist failed fallback remains retryable, not falsely exhausted", async () => {
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async () => ({ title: "Seed", relatedArtists: [artist(1)] }),
    },
    lastfm: {
      recommendations: async () => {
        throw Error("offline");
      },
    },
  });
  const result = await catalog.recommendations("artist", "Seed", "Seed", {
    artistId: "UCseed00000001",
    localPool: true,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.reserveAvailable, true);
  assert.equal(result.resolution.status, "partial");
});
