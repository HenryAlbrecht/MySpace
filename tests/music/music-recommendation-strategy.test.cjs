const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { sameArtist, rankCandidates } = require("../../server/music/music-recommendation-ranking.cjs");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const artist = (id) => "ytmusic:artist:UCfixture" + id;
const release = (id, who = "A", albumType = "single", signal = "related") => ({
  kind: "album",
  catalogId: "ytmusic:album:MPREfixture" + id,
  title: id,
  artist: who,
  artistCatalogId: artist(who),
  albumType,
  recommendationSignal: signal,
});
const seed = release("seed");
function frontend() {
  const Catalog = {};
  vm.runInNewContext(fs.readFileSync("dist/catalog-discovery.js", "utf8"), {
    Catalog,
    Map,
    Set,
    Date,
    URLSearchParams,
    Object,
    fetch: () => {},
    console,
  });
  return Catalog;
}
test("identity prefers IDs, falls back to normalized names, and handles collaborations", () => {
  assert.equal(
    sameArtist(
      { artist: "Artist", artistCatalogId: artist("A") },
      { artist: "Artist", artistCatalogId: artist("B") },
    ),
    false,
  );
  assert.equal(sameArtist({ artist: "Ａrtist!" }, { artist: "artist" }), true);
  assert.equal(
    sameArtist(
      { artistCatalogId: artist("A") },
      {
        artist: "Other",
        artists: [{ catalogId: artist("B") }, { catalogId: artist("A") }],
      },
    ),
    true,
  );
  assert.equal(sameArtist({ artist: "Artist" }, { artist: "Other · Artist" }), true);
  assert.equal(sameArtist({}, { artist: "Other" }), false);
});
test("local quota prioritizes cross artists, respects scarcity, subtype and seed exclusion", () => {
  const rows = [
    seed,
    ...Array.from({ length: 10 }, (_, i) => release("own" + i)),
    release("B", "B"),
    release("C", "C"),
    release("D", "D"),
    release("wrong", "B", "ep"),
  ];
  const result = rankCandidates(seed, rows);
  assert.deepEqual(
    result.items.map((row) => row.title),
    ["B", "C", "own0", "D", "own1"],
  );
  assert.equal(result.items.filter((row) => sameArtist(seed, row)).length, 2);
  assert.equal(
    rankCandidates(seed, [release("B", "B"), ...rows.filter((row) => row.artist === "A")]).items
      .length,
    3,
  );
  assert.equal(
    result.audit.find((row) => row.catalogId.endsWith("wrong")).reason,
    "release-subtype",
  );
  for (const type of ["album", "ep", "single"])
    assert.ok(
      rankCandidates(
        { ...seed, albumType: type },
        ["album", "ep", "single"].map((t) => release(t, "B", t)),
      ).items.every((row) => row.albumType === type),
    );
  const unknown = release("unknown", "B", undefined);
  delete unknown.albumType;
  assert.equal(
    rankCandidates(seed, [{ ...unknown, recommendationSignal: "radio" }]).items.length,
    0,
  );
  assert.equal(rankCandidates(seed, [unknown]).items.length, 0);
  assert.equal(
    rankCandidates(seed, [
      unknown,
      { ...unknown, albumType: "album", recommendationSignal: "radio" },
    ]).items.length,
    0,
    "later known metadata must invalidate an incompatible unknown duplicate",
  );
});
test("music radio quota and artist page dedup keep entity classes", async () => {
  const music = {
    kind: "music",
    catalogId: "ytmusic:video:abcdefghijk",
    artist: "A",
    artistCatalogId: artist("A"),
  };
  const catalog = createMusicCatalog({
    youtubeMusic: {
      peek: () => music,
      radio: async () => ({
        items: Array.from({ length: 12 }, (_, i) => ({
          ...music,
          catalogId: "ytmusic:video:" + String(i).padStart(11, "0"),
          artist: i < 10 ? "A" : "B",
          artistCatalogId: artist(i < 10 ? "A" : "B"),
        })),
      }),
      details: async () => ({
        relatedArtists: [
          { kind: "artist", catalogId: artist("A") },
          { kind: "artist", catalogId: artist("B") },
          { kind: "artist", catalogId: artist("B") },
        ],
      }),
    },
  });
  const result = await catalog.recommendations("music", "A", "Track", {
    videoId: "abcdefghijk",
    artistId: artist("A").split(":")[2],
  });
  assert.equal(result.items.length, 4);
  assert.equal(result.items[0].artist, "B");
  assert.equal(
    (
      await catalog.recommendations("artist", "A", "A", {
        artistId: artist("A").split(":")[2],
      })
    ).items.length,
    1,
  );
});
test("release sources run radio before own discography with bounded concurrency and canonical Last.fm fallback", async () => {
  const calls = [];
  let active = 0,
    max = 0;
  const current = {
    relatedArtists: [
      { kind: "artist", catalogId: artist("B") },
      { kind: "artist", catalogId: artist("C") },
    ],
    topAlbums: Array.from({ length: 10 }, (_, i) => release("own" + i)),
  };
  const yt = {
    peek: () => null,
    radio: async () => {
      calls.push("radio");
      return {
        items: Array.from({ length: 20 }, (_, i) => ({
          albumCatalogId: "ytmusic:album:MPREradio" + i,
          albumTitle: "Radio" + i,
          artist: "R",
          artistCatalogId: artist("R"),
        })),
      };
    },
    details: async (kind, id) => {
      calls.push(kind + ":" + id);
      if (id === seed.catalogId.split(":")[2])
        return {
          ...seed,
          albumTracks: [{ playbackSource: { videoId: "abcdefghijk" } }],
        };
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      if (kind === "album") return release(id, "R", "album");
      if (id === artist("A").split(":")[2]) return current;
      return { topAlbums: [release("from" + id, id, "single")] };
    },
    search: async () => ({
      items: [{ kind: "artist", catalogId: artist("D"), title: "D" }],
    }),
  };
  const catalog = createMusicCatalog({
    youtubeMusic: yt,
    lastfm: {
      recommendations: async (kind) => {
        assert.equal(kind, "artist");
        return { items: [{ kind: "artist", title: "D" }] };
      },
    },
  });
  const result = await catalog.recommendations("album", "A", "Seed", {
    albumId: seed.catalogId.split(":")[2],
  });
  assert.ok(calls.indexOf("radio") < calls.indexOf("artist:" + artist("A").split(":")[2]));
  assert.ok(max <= 2);
  assert.equal(result.requestBudget.releaseDetails, 4);
  assert.equal(result.requestBudget.relatedArtistDetails, 3);
  assert.equal(result.requestBudget.currentArtistDetails, 1);
  assert.equal(result.items.filter((row) => row.recommendationSource === "Last.fm").length, 1);
  assert.ok(
    result.items.every(
      (row) => row.albumType === "single" && row.catalogId.startsWith("ytmusic:album:"),
    ),
  );
  assert.equal(result.items.filter((row) => sameArtist(seed, row)).length, 2);
});
test("ambiguous Last.fm artist resolution does not create a parallel identity", async () => {
  let details = 0;
  const catalog = createMusicCatalog({
    lastfm: {
      recommendations: async () => ({
        items: [{ kind: "artist", title: "B" }],
      }),
    },
    youtubeMusic: {
      details: async () => {
        details++;
        return seed;
      },
      search: async () => ({
        items: [
          { kind: "artist", catalogId: artist("B"), title: "B" },
          { kind: "artist", catalogId: artist("C"), title: "B" },
        ],
      }),
    },
  });
  const result = await catalog.recommendations("album", "A", "Seed", {
    albumId: seed.catalogId.split(":")[2],
  });
  assert.deepEqual(result.items, []);
  assert.equal(result.requestBudget.relatedArtistDetails, 0);
});
test("global blender interleaves A/B/C, exhausts scarce pools, and uses artist and subtype diversity", () => {
  const Catalog = frontend();
  const pools = ["A", "B", "C"].map((name, index) =>
    Array.from({ length: 4 - index }, (_, i) => ({
      kind: "music",
      catalogId: name + i,
      title: name + (i + 1),
      seedTitle: name,
    })),
  );
  assert.deepEqual(
    Array.from(Catalog.blendDiscoveryPools(pools), (row) => row.title),
    ["A1", "B1", "C1", "A2", "B2", "C2", "A3", "B3", "A4"],
  );
  const repeated = [
    [release("x1", "X"), release("x2", "X")],
    [release("x3", "X"), release("y", "Y", "ep")],
    [release("z", "Z", "album")],
  ];
  const result = Catalog.blendDiscoveryPools(repeated);
  assert.equal(result.length, 5);
  assert.equal(result[1].artist, "Z");
  assert.equal(result[2].artist, "X");
  assert.equal(result[3].artist, "Y");
  assert.equal(Catalog.blendDiscoveryPools([pools[0]]).length, 4);
});
test("partial and final share ranking, rotation stays in adjacent top peers, saved items remain excluded", async () => {
  const Catalog = frontend(),
    partials = [];
  const seeds = ["A", "B", "C"].map((title, i) => ({
    kind: ["music", "album", "game"][i],
    catalogId: "seed:" + title,
    title,
    featured: true,
  }));
  const recommend = async (seed) =>
    Array.from({ length: 12 }, (_, i) => ({
      kind: seed.kind,
      catalogId: seed.title + i,
      title: seed.title + (i + 1),
      recommendationSignal: "radio",
    }));
  const result = await Catalog.forCollection(seeds, {
    recommend,
    partial: (rows) => partials.push(rows),
  });
  assert.deepEqual(
    Array.from(partials.at(-1), (row) => row.catalogId),
    Array.from(result.items, (row) => row.catalogId),
  );
  const rotated = await Catalog.forCollection(seeds, {
    recommend,
    rotation: 2,
  });
  assert.ok(
    rotated.items.slice(0, 3).every((row) => row.title.endsWith("1")),
    "#9 is never promoted by rotation",
  );
  const second = await Catalog.forCollection(seeds, { recommend, rotation: 1 });
  assert.ok(second.items.slice(0, 3).every((row) => row.title.endsWith("2")));
  assert.deepEqual(
    Array.from(second.items, (row) => row.catalogId),
    Array.from(
      (await Catalog.forCollection(seeds, { recommend, rotation: 1 })).items,
      (row) => row.catalogId,
    ),
  );
});
test("frontend does not bypass backend ranking with raw related releases", async () => {
  const Catalog = frontend();
  let calls = 0;
  const result = await Catalog.recommendations(
    {
      ...seed,
      relatedAlbums: Array.from({ length: 15 }, (_, i) => release("raw" + i)),
    },
    {
      fetcher: async () => {
        calls++;
        return {
          ok: true,
          json: async () => ({ items: [release("ranked", "B")] }),
        };
      },
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    Array.from(result, (row) => row.title),
    ["ranked"],
  );
});
test("release requests share pending ranking; partial upstream failure remains retryable", async () => {
  let calls = 0;
  const catalog = createMusicCatalog({
    lastfm: { recommendations: async () => ({ items: [] }) },
    youtubeMusic: {
      details: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return {
          ...seed,
          relatedAlbums: [release("B", "B")],
          albumTracks: [{ playbackSource: { videoId: "abcdefghijk" } }],
        };
      },
      radio: async () => {
        throw Error("offline");
      },
    },
  });
  const options = { albumId: seed.catalogId.split(":")[2] };
  const [a, b] = await Promise.all([
    catalog.recommendations("album", "A", "Seed", options),
    catalog.recommendations("album", "A", "Seed", options),
  ]);
  assert.equal(calls, 2, "one seed and one current-artist detail for the shared task");
  assert.deepEqual(a, b);
  assert.equal(a.resolution.status, "partial");
  assert.equal(a.items[0].title, "B");
});
