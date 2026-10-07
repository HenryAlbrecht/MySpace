const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music-catalog.cjs");
const { createLastfmClient } = require("../../server/lastfm.cjs");
test("recommendations resolve six at a time and expose the reserve up to 24", async () => {
  const rows = Array.from({ length: 24 }, (_, i) => ({
    kind: "music",
    title: "Song " + i,
    artist: "Artist",
    catalogId: "ytmusic:video:" + String(i).padStart(11, "0"),
  }));
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async (kind, q) => ({
        items: rows.filter((row) => q === row.title + " Artist"),
      }),
    },
    lastfm: { recommendations: async () => ({ items: rows }) },
  });
  const result = await c.recommendations("music", "Artist", "Seed");
  assert.equal(result.items.length, 6);
  assert.equal(result.reserveAvailable, true);
  for (const count of [12, 18, 24]) {
    const more = await c.recommendations("music", "Artist", "Seed", {
      reserve: true,
    });
    assert.equal(more.items.length, count);
    assert.equal(more.reserveAvailable, count < 24);
  }
});
test("discovery omits already collected musical suggestions", async () => {
  const Catalog = {};
  require("node:vm").runInNewContext(
    require("node:fs").readFileSync("dist/catalog-discovery.js", "utf8"),
    { Catalog, fetch: () => {}, TextEncoder, URLSearchParams },
  );
  const seed = { kind: "music", title: "Duvet", catalogId: "itunes:1" },
    known = { kind: "music", title: "Other", catalogId: "itunes:2" };
  const r = await Catalog.forCollection([seed, known], {
    recommend: async () => [known, known],
  });
  assert.equal(r.items.length, 0);
});
test("Last.fm descriptions enrich Apple without replacing identity, covers or tracks", async () => {
  const row = {
    kind: "artist",
    title: "Lily Chou-Chou",
    catalogId: "itunes:1",
    source: "iTunes",
    topTracks: [{ catalogId: "itunes:2" }],
  };
  const c = createMusicCatalog({
    itunes: { details: async () => row },
    artistArtwork: { lookup: async () => "photo" },
    lastfm: {
      summary: async (kind, artist) => {
        assert.equal(artist, row.title);
        return { summary: "Biography" };
      },
    },
  });
  const result = await c.details("artist", "1");
  assert.equal(result.summary, "Biography");
  assert.equal(result.summarySource, "Last.fm");
  assert.equal(result.source, "iTunes");
  assert.equal(result.catalogId, "itunes:1");
  assert.deepEqual(result.topTracks, row.topTracks);
});
test("legacy Last.fm recommendations resolve to YouTube and reject unrelated matches", async () => {
  for (const kind of ["music", "album", "artist"]) {
    const row = {
      kind,
      title: "Example",
      artist: "Artist",
      catalogId: {
        music: "ytmusic:video:abcdefghijk",
        album: "ytmusic:album:MPREfixture123",
        artist: "ytmusic:artist:UCfixtureartist123",
      }[kind],
      source: "YouTube Music",
    };
    const c = createMusicCatalog({
      youtubeMusic: { search: async () => ({ items: [row] }) },
      artistArtwork: { lookup: async () => "photo" },
      lastfm: {
        recommendations: async () => ({
          items: [
            { ...row, catalogId: "lastfm:x" },
            { ...row, catalogId: "lastfm:duplicate" },
            { ...row, title: "Wrong" },
          ],
          basis: "Last.fm",
        }),
      },
    });
    const r = await c.recommendations(kind, "Artist", "Example");
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].catalogId, row.catalogId);
    assert.equal(r.items[0].recommendationSource, "Last.fm");
  }
});
test("editorial failure preserves Apple detail; recommendations expose missing configuration", async () => {
  const row = {
    kind: "music",
    title: "Duvet",
    artist: "bôa",
    catalogId: "itunes:2",
    isrc: "JPB451202866",
  };
  const c = createMusicCatalog({
    itunes: { details: async () => row },
    lastfm: {
      summary: async () => {
        throw Error("offline");
      },
      recommendations: async () => {
        throw Error("Last.fm não configurado");
      },
    },
  });
  assert.deepEqual(await c.details("music", "2"), {
    ...row,
    summaryStatus: "unavailable",
  });
  await assert.rejects(c.recommendations("music", "bôa", "Duvet"), /não configurado/);
});
test("missing version description remains empty and distinct from lookup failure", async () => {
  const row = {
    kind: "music",
    title: "Bizarre Love Triangle ’94",
    artist: "New Order",
    catalogId: "itunes:2",
    isrc: "JPB451202866",
  };
  const c = createMusicCatalog({
    itunes: { details: async () => row },
    lastfm: {
      summary: async (kind, artist, title) => {
        assert.equal(title, row.title);
        return { summary: "" };
      },
    },
  });
  const result = await c.details("music", "2");
  assert.equal(result.summaryStatus, "missing");
  assert.equal(result.summarySource, undefined);
  assert.equal(result.catalogId, row.catalogId);
  assert.equal(result.summary, undefined);
});
test("Last.fm summary only requests getInfo and artist recommendations use getSimilar", async () => {
  const methods = [];
  const c = createLastfmClient({
    env: { LASTFM_API_KEY: "fixture" },
    interval: 0,
    fetcher: async (url) => {
      const method = new URL(url).searchParams.get("method");
      methods.push(method);
      return {
        ok: true,
        json: async () =>
          method === "artist.getInfo"
            ? { artist: { bio: { content: "Lily biography" } } }
            : { similarartists: { artist: [{ name: "bôa" }] } },
      };
    },
  });
  assert.equal((await c.summary("artist", "Lily Chou-Chou")).summary, "Lily biography");
  assert.equal((await c.recommendations("artist", "Lily Chou-Chou", "")).items[0].kind, "artist");
  assert.deepEqual(methods, ["artist.getInfo", "artist.getSimilar"]);
});
