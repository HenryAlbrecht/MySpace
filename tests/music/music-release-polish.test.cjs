const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { parseBrowse, parseSearch } = require("../../server/music/youtube-music-parser.cjs");
const { createMusicCatalog } = require("../../server/music-catalog.cjs");
const albumId = "MPREfixture123",
  artistId = "UCfixture1234";
const endpoint = (id) => ({
  browseEndpoint: {
    browseId: id,
    browseEndpointContextSupportedConfigs: {
      browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ALBUM" },
    },
  },
});
test("release type comes from subtitle metadata, never title or track count; main card artwork wins", () => {
  const main = "https://yt3.googleusercontent.com/main=w544-h544-rj",
    other = "https://yt3.googleusercontent.com/wrong=w1600-h1600-rj";
  const row = {
    title: { simpleText: "Mado" },
    subtitle: { runs: [{ text: "Single" }, { text: " • 2026" }] },
    navigationEndpoint: endpoint(albumId),
    thumbnailRenderer: {
      musicThumbnailRenderer: {
        thumbnail: {
          thumbnails: [{ url: main, width: 544 }],
          extra: { thumbnails: [{ url: other, width: 1600 }] },
        },
      },
    },
  };
  const card = parseSearch("album", { musicTwoRowItemRenderer: row })[0];
  assert.ok(card.image.includes("/main="));
  assert.equal(card.albumType, "single");
  for (const [subtitle, expected] of [
    ["Single • 2026", "single"],
    ["EP • 2024", "ep"],
    ["Album • 2020", "album"],
    ["2020", undefined],
  ]) {
    const detail = parseBrowse("album", albumId, {
      musicResponsiveHeaderRenderer: {
        title: { simpleText: "An EP Single title" },
        subtitle: { simpleText: subtitle },
        thumbnail: { thumbnails: [{ url: main, width: 544 }] },
      },
    });
    assert.equal(detail.albumType, expected);
  }
});
test("lazy release fallback preserves subtype, uses cached artist and excludes seed", async () => {
  let artistCalls = 0,
    radios = 0;
  const related = {
      kind: "album",
      catalogId: "ytmusic:album:MPRErelated1",
      title: "Related",
      artist: "Other",
      albumType: "single",
    },
    own = {
      kind: "album",
      catalogId: "ytmusic:album:MPREown1234",
      title: "Own",
      artist: "Artist",
      albumType: "single",
    },
    seed = {
      kind: "album",
      catalogId: "ytmusic:album:" + albumId,
      artist: "Artist",
      albumType: "single",
      artistCatalogId: "ytmusic:artist:" + artistId,
      relatedAlbums: [related],
    };
  let cached;
  const catalog = createMusicCatalog({
    youtubeMusic: {
      peek: () => cached,
      details: async (kind) =>
        kind === "album" ? seed : (artistCalls++, (cached = { topAlbums: [seed, related, own] })),
      radio: async () => {
        radios++;
        return { items: [] };
      },
    },
  });
  assert.equal(artistCalls, 0);
  for (let i = 0; i < 2; i++) {
    const result = await catalog.recommendations("album", "Artist", "Single", {
      albumId,
    });
    assert.deepEqual(
      result.items.map((x) => x.catalogId),
      [related.catalogId, own.catalogId],
    );
    assert.equal(result.items[1].albumType, "single");
  }
  assert.equal(artistCalls, 1);
  assert.equal(radios, 0);
});
test("radio follows failed artist fallback and force propagates without invalidating detail", async () => {
  let forceValue;
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async (kind) => {
        if (kind === "artist") throw Error("offline");
        return {
          albumType: "single",
          artist: kind === "album" ? "Artist" : "Other",
          artistCatalogId: "ytmusic:artist:" + artistId,
          albumTracks: [{ playbackSource: { videoId: "abcdefghijk" } }],
        };
      },
      radio: async (id, options) => {
        forceValue = options.force;
        return {
          items: [
            {
              albumCatalogId: "ytmusic:album:MPREother123",
              albumTitle: "Other",
              artist: "Other",
            },
          ],
        };
      },
    },
  });
  const result = await catalog.recommendations("album", "Artist", "Single", {
    albumId,
    force: true,
  });
  assert.equal(forceValue, true);
  assert.equal(result.items.length, 1);
});
test("frontend does not cache empty suggestions and manual force bypasses successful cache", async () => {
  let calls = 0;
  const Catalog = {};
  const context = {
    window: { Catalog },
    Catalog,
    fetch: async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          items:
            calls < 3
              ? []
              : [
                  {
                    kind: "album",
                    catalogId: "ytmusic:album:MPREother123",
                    title: "Other",
                  },
                ],
        }),
      };
    },
    Map,
    Date,
    URLSearchParams,
    Object,
    console,
  };
  vm.runInNewContext(fs.readFileSync("dist/catalog-discovery.js", "utf8"), context);
  const item = {
    kind: "album",
    catalogId: "ytmusic:album:" + albumId,
    title: "Single",
    artist: "Artist",
  };
  await Catalog.recommendations(item);
  await Catalog.recommendations(item);
  assert.equal(calls, 2);
  await Catalog.recommendations(item);
  await Catalog.recommendations(item);
  assert.equal(calls, 3);
  await Catalog.recommendations(item, { force: true });
  assert.equal(calls, 4);
});
