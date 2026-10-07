const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music-catalog.cjs"),
  { createArtistArtworkClient } = require("../../server/music/artist-artwork.cjs");
const model = require("../../dist/music-model.js");
test("Explicit legacy Apple adapter searches preserve metadata and only artists request photo enrichment", async () => {
  const calls = [],
    photos = [];
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => ({ items: [] }),
      searchTracks: async () => [],
    },
    itunes: {
      search: async (kind, q) => {
        calls.push([kind, q]);
        return {
          items: [
            {
              kind,
              catalogId: "itunes:1",
              source: "iTunes",
              title: "Oasis",
              image: kind === "artist" ? "" : "apple-cover",
            },
          ],
        };
      },
    },
    artistArtwork: {
      lookup: async (name) => {
        photos.push(name);
        return "deezer-photo";
      },
    },
  });
  for (const kind of ["music", "album", "artist"]) {
    const r = await c.search(kind, "Oasis", "itunes");
    assert.equal(r.items[0].catalogId, "itunes:1");
    assert.equal(r.items[0].source, "iTunes");
    assert.equal(r.items[0].image, kind === "artist" ? "deezer-photo" : "apple-cover");
    assert.ok(!("deezerId" in r.items[0]));
  }
  assert.equal(calls.length, 3);
  assert.deepEqual(photos, ["Oasis"]);
  for (const provider of ["deezer", "lastfm", "musicbrainz", "spotify"])
    await assert.rejects(c.search("music", "Song", provider), { status: 400 });
});
test("legacy details preserve all Apple metadata, nested IDs and album covers", async () => {
  const row = {
    kind: "artist",
    catalogId: "itunes:1",
    source: "iTunes",
    title: "Oasis",
    topAlbums: [{ catalogId: "itunes:2", image: "apple-cover" }],
    topTracks: [{ catalogId: "itunes:3" }],
  };
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => ({ items: [] }),
      searchTracks: async () => [],
    },
    itunes: { details: async () => row },
    artistArtwork: { lookup: async () => "photo" },
  });
  const r = await c.details("artist", "1");
  assert.equal(r.catalogId, "itunes:1");
  assert.equal(r.topAlbums[0].image, "apple-cover");
  assert.equal(r.topTracks[0].catalogId, "itunes:3");
  assert.equal(r.image, "photo");
});
test("photo lookup uses only Deezer artist search, exact accent name before popularity, high resolution and shared cache", async () => {
  let calls = 0;
  const c = createArtistArtworkClient({
    fetcher: async (url) => {
      calls++;
      const u = new URL(url);
      assert.equal(u.hostname, "api.deezer.com");
      assert.equal(u.pathname, "/search/artist");
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 792,
              name: "BoA",
              nb_fan: 99999,
              picture_xl: "https://cdn-images.dzcdn.net/boa.jpg",
            },
            {
              id: 12,
              name: "bôa tribute",
              picture_xl: "https://cdn-images.dzcdn.net/wrong.jpg",
            },
            {
              id: 74211202,
              name: "bôa",
              nb_fan: 100,
              picture_xl: "https://cdn-images.dzcdn.net/boa-band-xl.jpg",
              picture_big: "https://cdn-images.dzcdn.net/small.jpg",
            },
          ],
        }),
      };
    },
  });
  const images = await Promise.all([c.lookup("bôa"), c.lookup("bôa")]);
  assert.deepEqual(images, Array(2).fill("https://cdn-images.dzcdn.net/boa-band-xl.jpg"));
  assert.equal(calls, 1);
  await c.lookup(" BÔA ");
  assert.equal(calls, 1);
});
test("legacy photo enrichment keeps blank artwork on wrong name or outage", async () => {
  for (const fetcher of [
    async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            name: "Oasis Tribute",
            picture_xl: "https://cdn-images.dzcdn.net/wrong.jpg",
          },
        ],
      }),
    }),
    async () => {
      throw Error("offline");
    },
  ])
    assert.equal(await createArtistArtworkClient({ fetcher }).lookup("Oasis"), "");
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => ({ items: [] }),
      searchTracks: async () => [],
    },
    itunes: {
      search: async () => ({
        items: [{ kind: "artist", title: "Oasis", catalogId: "itunes:1" }],
      }),
    },
    artistArtwork: {
      lookup: async () => {
        throw Error("offline");
      },
    },
  });
  assert.equal((await c.search("artist", "Oasis", "itunes")).items[0].catalogId, "itunes:1");
});
test("editorial recommendations never introduce secondary catalog identities", async () => {
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => ({ items: [] }),
      searchTracks: async () => [],
    },
    lastfm: { recommendations: async () => ({ items: [] }) },
    musicbrainz: { playbackSource: async () => ({ items: [] }) },
  });
  assert.deepEqual((await c.recommendations("music", "Oasis", "Wonderwall")).items, []);
  assert.equal((await c.playbackSource("Wonderwall", "Oasis")).status, "not-found");
});
test("collection identity uses only kind plus canonical ID, never a name-based cross-provider match", () => {
  const row = {
    kind: "music",
    catalogId: "itunes:1",
    title: "Wonderwall",
    artist: "Oasis",
  };
  assert.ok(model.sameItem(row, { ...row }));
  assert.ok(!model.sameItem(row, { ...row, catalogId: "deezer:1" }));
  assert.ok(!model.sameItem(row, { ...row, catalogId: "itunes:2" }));
  assert.ok(!model.sameItem(row, { ...row, kind: "album" }));
});

test("legacy Collection records remain valid without implicit YouTube conversion or cross-provider fusion", () => {
  const item = require("../../dist/collection.js").validateItem({
    kind: "music",
    catalogId: "itunes:1",
    title: "Song",
    artist: "Artist",
    source: "iTunes",
    status: "planned",
  });
  assert.equal(item.catalogId, "itunes:1");
  assert.equal(item.source, "iTunes");
  assert.equal(
    model.sameItem(item, {
      kind: "music",
      catalogId: "ytmusic:video:abcdefghijk",
      title: "Song",
      artist: "Artist",
    }),
    false,
  );
});
