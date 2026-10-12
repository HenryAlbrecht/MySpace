const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicClient } = require("../../server/music/music.cjs"),
  { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
test("legacy Apple optional artist search and discography failure cannot discard valid song/album results", async () => {
  for (const kind of ["music", "album"])
    for (const mode of ["search", "lookup"]) {
      const c = createMusicClient({
        fetcher: async (url) => {
          const u = new URL(url),
            entity = u.searchParams.get("entity");
          if (entity === "musicArtist")
            return mode === "search"
              ? { ok: false, status: 403 }
              : {
                  ok: true,
                  json: async () => ({
                    results: [{ artistId: 9, artistName: "Oasis" }],
                  }),
                };
          if (u.pathname === "/lookup") return { ok: false, status: 403 };
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  wrapperType: "collection",
                  kind: "song",
                  trackId: 1,
                  collectionId: 2,
                  artistName: "Oasis",
                  trackName: "Oasis",
                  collectionName: "Oasis",
                },
              ],
            }),
          };
        },
      });
      assert.equal((await c.search(kind, "Oasis")).items.length, 1);
    }
});
test("legacy Apple adapter failures remain visible in all three kinds", async () => {
  for (const kind of ["music", "album", "artist"])
    await assert.rejects(
      createMusicClient({
        fetcher: async () => ({ ok: false, status: 403 }),
      }).search(kind, "Oasis"),
      (e) => e.providerFailure.httpStatus === 403,
    );
});
test("legacy Apple foreground search does not wait for the same auxiliary request queued behind recommendations", async () => {
  let release;
  const gate = new Promise((r) => (release = r)),
    calls = [];
  const c = createMusicClient({
    recommendationInterval: 0,
    fetcher: async (url) => {
      const u = new URL(url);
      calls.push(u);
      if (u.searchParams.get("term") === "Hold") await gate;
      return {
        ok: true,
        json: async () => ({
          results:
            u.searchParams.get("entity") === "song"
              ? [
                  {
                    kind: "song",
                    trackId: 1,
                    trackName: "Alpha",
                    artistName: "Alpha",
                  },
                ]
              : [],
        }),
      };
    },
  });
  const held = c.resolveRecommendation({ kind: "artist", title: "Hold" }),
    queued = c.resolveRecommendation({
      kind: "album",
      title: "Other",
      artist: "Alpha",
    });
  const search = c.search("music", "Alpha");
  try {
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(
      calls.some(
        (u) =>
          u.searchParams.get("term") === "Alpha" && u.searchParams.get("entity") === "musicArtist",
      ),
    );
    assert.equal((await search).items.length, 1);
  } finally {
    release();
    await Promise.all([held, queued]);
  }
});
test("reserve is bounded and incremental, retains editions and does not resolve old successes again", async () => {
  let seeds = 0;
  const calls = [];
  const rows = Array.from({ length: 48 }, (_, i) => ({
    kind: "album",
    title: i === 25 ? "Album (Remastered)" : "Album " + i,
    artist: "Artist",
    catalogId: "ytmusic:album:MPREreserve" + (i + 1),
  }));
  const c = createMusicCatalog({
    lastfm: {
      recommendations: async () => {
        seeds++;
        return { items: rows };
      },
    },
    youtubeMusic: {
      search: async (kind, query) => {
        assert.equal(kind, "album");
        const row = rows.find((row) => query === row.title + " " + row.artist);
        calls.push(row.catalogId);
        return { items: rows.indexOf(row) < 20 ? [] : [row] };
      },
    },
  });
  const initial = await c.recommendations("album", "Artist", "Seed");
  assert.equal(initial.items.length, 0);
  assert.equal(calls.length, 6);
  assert.equal(initial.reserveAvailable, true);
  await c.recommendations("album", "Artist", "Seed", { reserve: true });
  await c.recommendations("album", "Artist", "Seed", { reserve: true });
  const first = await c.recommendations("album", "Artist", "Seed", {
    reserve: true,
  });
  assert.equal(first.items.length, 4);
  assert.equal(calls.length, 24);
  assert.equal(first.reserveAvailable, true);
  const more = await c.recommendations("album", "Artist", "Seed", {
    reserve: true,
  });
  assert.equal(more.items.length, 10);
  assert.equal(calls.length, 30);
  assert.ok(more.items.some((r) => r.title === "Album (Remastered)"));
  assert.deepEqual(more.items.slice(0, 4), first.items);
  await c.recommendations("album", "Artist", "Seed", { reserve: true });
  assert.equal(calls.length, 36);
  assert.equal(seeds, 1);
  await c.recommendations("album", "Artist", "Seed");
  assert.equal(calls.length, 36);
});
