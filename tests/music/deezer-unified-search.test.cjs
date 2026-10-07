// Historical Deezer adapter coverage; first case protects the CURRENT Apple-only facade.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { createDeezerClient } = require("../../server/music/deezer.cjs");
const { createMusicCatalog } = require("../../server/music-catalog.cjs");
const artist = { id: 927, name: "Oasis", nb_fan: 1000000 },
  cover = { id: 99, name: "Cover Artist" };
test("new searches reject secondary catalogs, saved Apple IDs remain readable", async () => {
  const c = createMusicCatalog({
    itunes: {
      details: async () => ({
        kind: "music",
        source: "iTunes",
        title: "Saved song",
        artist: "Artist",
        playbackSource: { type: "audio", url: "https://example.test/song.mp3" },
      }),
    },
    lastfm: { summary: async () => ({ summary: "Biography" }) },
  });
  for (const provider of ["deezer", "lastfm", "musicbrainz"])
    await assert.rejects(c.search("music", "Song", provider), { status: 400 });
  const row = await c.details("music", "1");
  assert.equal(row.source, "iTunes");
  assert.equal(row.playbackSource.type, "audio");
  assert.equal(row.summarySource, "Last.fm");
});
test("structured title search retains Oasis first and artist matches nearby without details waterfall", async () => {
  const calls = [];
  const c = createDeezerClient({
    fetcher: async (url) => {
      const u = new URL(url);
      calls.push(u);
      let data;
      if (u.pathname === "/search/artist") data = [{ id: 9, name: "Wonderwall", nb_fan: 10 }];
      else if (u.pathname === "/search/track") {
        assert.equal(u.searchParams.get("q"), 'track:"Wonderwall"');
        data = [
          { id: 1, title: "Wonderwall", artist, rank: 100000 },
          { id: 2, title: "Wonderwall", artist: cover, rank: 10 },
        ];
      } else {
        assert.equal(u.pathname, "/artist/9/top");
        data = [{ id: 3, title: "Witchcraft", artist: { id: 9, name: "Wonderwall" } }];
      }
      return { ok: true, json: async () => ({ data }) };
    },
  });
  const r = await c.searchCatalog("music", "Wonderwall");
  assert.equal(r.items[0].artist, "Oasis");
  assert.equal(r.items[1].title, "Witchcraft");
  assert.equal(calls.length, 3);
  await c.searchCatalog("music", "Wonderwall");
  assert.equal(calls.length, 3);
});
test("album edition label affects ranking, never stored title or version identity", async () => {
  const c = createDeezerClient({
    fetcher: async (url) => {
      const u = new URL(url);
      return {
        ok: true,
        json: async () => ({
          data:
            u.pathname === "/search/artist"
              ? []
              : u.searchParams.get("order")
                ? [{ id: 2, title: "Morning Glory", artist: cover }]
                : [{ id: 1, title: "Morning Glory (Remastered)", artist }],
        }),
      };
    },
  });
  const r = await c.searchCatalog("album", "Morning Glory");
  assert.equal(r.items[0].artist, "Oasis");
  assert.equal(r.items[0].title, "Morning Glory (Remastered)");
});
test("versions remain distinct and malformed IDs are ignored", async () => {
  const c = createDeezerClient({
    fetcher: async (url) => ({
      ok: true,
      json: async () => ({
        data:
          new URL(url).pathname === "/search/artist"
            ? []
            : [
                { id: 1, title: "Wonderwall", artist },
                { id: 2, title: "Wonderwall", title_version: "(Live)", artist },
                { id: 1, title: "Wonderwall", artist },
                { id: "bad", title: "Bad", artist },
              ],
      }),
    }),
  });
  const r = await c.searchCatalog("music", "Wonderwall");
  assert.equal(r.items.length, 2);
  assert.ok(r.items.some((i) => i.title === "Wonderwall (Live)"));
});
