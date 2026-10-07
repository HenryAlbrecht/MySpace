const assert = require("node:assert/strict");
const Catalog = require("../dist/catalog.js");
(async () => {
  const fetcher = async () => ({
    ok: true,
    json: async () => ({
      items: [
        {
          kind: "artist",
          catalogId: "lastfm-artist:Other",
          title: "Approaching Nirvana",
          artist: "Approaching Nirvana",
        },
        {
          kind: "artist",
          catalogId: "lastfm-artist:Nirvana",
          title: "Nirvana",
          artist: "Nirvana",
          image: "https://example.com/photo.jpg",
        },
        {
          kind: "artist",
          catalogId: "lastfm-artist:upper",
          title: "NIRVÁNA",
          artist: "NIRVÁNA",
        },
        {
          kind: "artist",
          catalogId: "lastfm-artist:spaced",
          title: "N i r v a n a",
          artist: "N i r v a n a",
        },
        {
          kind: "artist",
          catalogId: "lastfm-artist:Nirvana",
          title: "Nirvana",
          artist: "Nirvana",
        },
      ],
    }),
  });
  const rows = await Catalog.search("artist", "nirvana", { fetcher });
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => row.catalogId),
    ["lastfm-artist:Other", "lastfm-artist:Nirvana", "lastfm-artist:upper", "lastfm-artist:spaced"],
  );
  const namesakeFetcher = async () => ({
    ok: true,
    json: async () => ({
      items: [
        { kind: "artist", catalogId: "deezer:792", title: "BoA" },
        { kind: "artist", catalogId: "deezer:74211202", title: "bôa" },
        { kind: "artist", catalogId: "deezer:5298187", title: "BOA" },
      ],
    }),
  });
  const boas = await Catalog.search("artist", "boa", {
    fetcher: namesakeFetcher,
  });
  assert.equal(boas.length, 3);
  assert.deepEqual(
    boas.map((row) => row.catalogId),
    ["deezer:792", "deezer:74211202", "deezer:5298187"],
  );
  const accented = await Catalog.search("artist", "bôa", {
    fetcher: namesakeFetcher,
  });
  assert.equal(accented.length, 3);
  assert.deepEqual(
    accented.map((row) => row.catalogId),
    ["deezer:792", "deezer:74211202", "deezer:5298187"],
  );
  const songs = await Catalog.search("music", "Band", {
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            kind: "music",
            catalogId: "deezer:1",
            title: "Band",
            artist: "Someone",
          },
          {
            kind: "music",
            catalogId: "deezer:2",
            title: "Song",
            artist: "Band",
          },
          {
            kind: "music",
            catalogId: "deezer:3",
            title: "Song (Live)",
            artist: "Band",
          },
          {
            kind: "music",
            catalogId: "deezer:4",
            title: "Song",
            artist: "Other artist",
          },
        ],
      }),
    }),
  });
  assert.equal(songs.length, 4, "Live versions and different artists stay distinct");
  assert.deepEqual(
    songs.map((row) => [row.catalogId, row.title, row.artist]),
    [
      ["deezer:1", "Band", "Someone"],
      ["deezer:2", "Song", "Band"],
      ["deezer:3", "Song (Live)", "Band"],
      ["deezer:4", "Song", "Other artist"],
    ],
  );
  let detailCalls = 0;
  const item = {
    kind: "artist",
    catalogId: "ytmusic:artist:UCcachefixture123",
  };
  const detailFetcher = async () => ({
    ok: true,
    json: async () => ({
      kind: "artist",
      catalogId: item.catalogId,
      title: ++detailCalls === 1 ? "Partial" : "Recovered",
    }),
  });
  await Catalog.details(item, { fetcher: detailFetcher });
  await Catalog.details(item, { fetcher: detailFetcher });
  assert.equal(detailCalls, 1);
  assert.equal(
    (await Catalog.details(item, { fetcher: detailFetcher, force: true })).title,
    "Recovered",
  );
  console.log(
    "Search quality: provider order, dedupe, distinct identities/editions and detail cache OK.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
