const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  parseSearch,
  parseBrowse,
  parseRadio,
  duration,
} = require("../../server/music/youtube-music-parser.cjs");
const { createYouTubeMusicClient, FILTERS } = require("../../server/music/youtube-music.cjs");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const model = require("../../dist/music/music-model.js");
const fixture = structuredClone(require("./fixtures/youtube-music-search.json"));
const artistId = "UCXExK7We8VKsIzFFQYNEgBg",
  albumId = "MPREb_JmBafQLPQZT";

const sectionFixture = require("./fixtures/youtube-music-artist-sections.json");
const searchPageFixture = require("./fixtures/youtube-music-search-continuation.json");
test("explicit Apple search remains first-page only without implicit YouTube pagination", async () => {
  const catalog = createMusicCatalog({
    itunes: { search: async () => ({ provider: "iTunes", items: [] }) },
    youtubeMusic: {
      search: () => {
        throw Error("legacy must not query YouTube");
      },
    },
  });
  assert.equal((await catalog.search("music", "Legacy", "itunes")).next, null);
});
test("search page parser preserves array compatibility, shelf continuation, namesakes and kind", () => {
  const { parseSearchPage } = require("../../server/music/youtube-music-parser.cjs");
  for (const payload of Object.values(searchPageFixture)) {
    assert.deepEqual(parseSearchPage("artist", payload).items, parseSearch("artist", payload));
  }
  assert.equal(parseSearchPage("artist", searchPageFixture.initial).next, "search-page-2");
  const page = parseSearchPage("artist", searchPageFixture.continuation);
  assert.equal(page.items.length, 2);
  assert.notEqual(page.items[0].catalogId, page.items[1].catalogId);
  assert.equal(page.items[0].title, page.items[1].title);
  const repeated = structuredClone(searchPageFixture.continuation);
  const shelf = repeated.continuationContents.musicShelfContinuation;
  shelf.contents.push(structuredClone(shelf.contents[0]));
  assert.equal(parseSearchPage("artist", repeated).items.length, 2);
  delete shelf.continuations;
  assert.equal(parseSearchPage("artist", repeated).next, null);
  shelf.contents.push({
    continuationItemRenderer: {
      continuationEndpoint: { continuationCommand: { token: "item-token" } },
    },
  });
  assert.equal(parseSearchPage("artist", repeated).next, "item-token");
  assert.equal(parseSearchPage("music", fixture).items[0].kind, "music");
  const album = structuredClone(searchPageFixture.initial);
  const endpoint =
    album.contents.musicShelfRenderer.contents[0].musicTwoRowItemRenderer.navigationEndpoint
      .browseEndpoint;
  endpoint.browseId = "MPREsearchalbum123";
  endpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType =
    "MUSIC_PAGE_TYPE_ALBUM";
  assert.equal(parseSearchPage("album", album).items[0].kind, "album");
});
test("search continuation uses one official request, independent bounded cache/pending and rejects invalid tokens", async () => {
  const calls = [];
  let repeat = false,
    failure = false,
    time = 0;
  const client = createYouTubeMusicClient({
    now: () => time,
    ttl: 100,
    fetcher: async (url, options) => {
      if (!options.method)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      assert.ok(url.includes("/search?"), "no details/browse per result");
      const body = JSON.parse(options.body);
      calls.push(body);
      if (failure && body.continuation) throw Error("page outage");
      const payload = structuredClone(
        body.continuation ? searchPageFixture.continuation : searchPageFixture.initial,
      );
      if (repeat && body.continuation)
        payload.continuationContents.musicShelfContinuation.continuations[0].nextContinuationData.continuation =
          body.continuation;
      return { ok: true, json: async () => payload };
    },
  });
  const initial = await client.search("artist", "Boa");
  assert.equal(calls.length, 1);
  const [a, b] = await Promise.all([
    client.search("artist", "Boa", { cursor: initial.next }),
    client.search("artist", "Boa", { cursor: initial.next }),
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].query, undefined);
  assert.equal(calls[1].params, undefined);
  assert.equal(calls[1].continuation, initial.next);
  a.items[0].title = "mutated";
  assert.notEqual(b.items[0].title, a.items[0].title);
  assert.equal((await client.search("artist", "Boa")).items.length, 1);
  await client.search("album", "Boa", { cursor: initial.next });
  await client.search("artist", "Other", { cursor: initial.next });
  await client.search("artist", "Boa", { cursor: "another-token" });
  assert.equal(calls.length, 5);
  for (const cursor of ["", "\x00", "\x7f", "x".repeat(4097), 7])
    assert.throws(() => client.search("artist", "Boa", { cursor }), {
      status: 400,
    });
  failure = true;
  await assert.rejects(client.search("artist", "Failure", { cursor: "retry" }), /outage/);
  failure = false;
  await client.search("artist", "Failure", { cursor: "retry" });
  repeat = true;
  time = 101;
  assert.equal((await client.search("artist", "Boa", { cursor: initial.next })).next, null);
  for (let i = 0; i < 81; i++) await client.search("artist", "Bounded" + i);
  const before = calls.length;
  await client.search("artist", "Boa");
  assert.equal(calls.length, before + 1, "old entries evicted at existing 80-entry cap");
});
const sectionParser = require("../../server/music/youtube-music-parser.cjs");
function sectionClient({
  failSingles = false,
  repeat = false,
  pageFailure = false,
  forever = false,
} = {}) {
  const calls = [];
  const client = createYouTubeMusicClient({
    fetcher: async (url, options) => {
      if (!options?.body)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      assert.ok(url.includes("/browse?"), "section never searches or requests release details");
      const body = JSON.parse(options.body);
      calls.push(body);
      if (failSingles && body.params === "singles%3D") throw Error("section outage");
      if (pageFailure && body.continuation) throw Error("page outage");
      let payload =
        body.params === "albums%3D"
          ? sectionFixture.albums
          : body.params === "singles%3D"
            ? sectionFixture.singles
            : body.params === "songs%3D"
              ? sectionFixture.songs
              : body.params === "related%3D"
                ? sectionFixture.related
                : body.continuation === "songs-next"
                  ? sectionFixture.songsFinal
                  : body.continuation === "page-1"
                    ? sectionFixture.continuation
                    : sectionFixture.final;
      payload = structuredClone(payload);
      if (repeat && body.continuation === "page-1")
        payload.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems.at(
          -1,
        ).continuationItemRenderer.continuationEndpoint.continuationCommand.token = "page-1";
      if (forever)
        ((payload = structuredClone(sectionFixture.continuation)),
          (payload.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems.at(
            -1,
          ).continuationItemRenderer.continuationEndpoint.continuationCommand.token =
            "page-" + calls.length));
      return { ok: true, json: async () => payload };
    },
  });
  return {
    client,
    calls,
    artist: parseBrowse("artist", sectionFixture.artistId, sectionFixture.artist),
  };
}
test("artist previews retain official header/button/bottom section handles, without persisting them", () => {
  const { artist } = sectionClient();
  assert.equal(artist.topAlbums.length, 3);
  assert.equal(artist.topTracks.length, 1);
  assert.equal(artist.relatedArtists.length, 1);
  assert.equal(artist.artistSections.albums.browseId, "MPAD" + sectionFixture.artistId);
  assert.equal(artist.artistSections.albums.params, "albums%3D");
  assert.equal(artist.artistSections.singles.params, "singles%3D");
  assert.equal(artist.artistSections.songs.browseId, "VLfixtureSongs123");
  assert.equal(artist.artistSections.related.params, "related%3D");
  assert.ok(artist.artistSections.videos);
  const saved = require("../../dist/collection/collection.js").validateItem({
    ...artist,
    status: "planned",
    discographyResolution: { status: "complete" },
  });
  assert.equal(saved.artistSections, undefined);
  assert.equal(saved.discographyResolution, undefined);
  assert.equal(saved.topAlbums, undefined);
});
test("section browsing follows params and append continuation, dedupes canonical IDs and shares cache/pending", async () => {
  const { client, calls, artist } = sectionClient();
  const run = () =>
    client.artistSection("albums", artist.artistSections.albums, {
      artist: artist.title,
      artistCatalogId: artist.catalogId,
    });
  const [a, b] = await Promise.all([run(), run()]);
  assert.deepEqual(a, b);
  await run();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].params, "albums%3D");
  assert.equal(calls[1].continuation, "page-1");
  assert.equal(calls[2].continuation, "page-2");
  assert.equal(a.items.length, 4);
  assert.equal(a.items.filter((row) => row.title === "Same title").length, 2);
  assert.equal(a.pages, 3);
  assert.equal(a.partial, false);
  assert.ok(
    a.items.every((row) => row.kind === "album" && row.artistCatalogId === artist.catalogId),
  );
  await client.artistSection(
    "albums",
    artist.artistSections.albums,
    { artist: artist.title, artistCatalogId: artist.catalogId },
    { force: true },
  );
  assert.equal(calls.length, 6);
});
test("discography merges Albums and mixed Singles/EPs without guessing unknown types or shrinking preview", async () => {
  const { client, calls, artist } = sectionClient();
  const result = await client.artistDiscography(artist);
  assert.equal(result.items.length, 7);
  assert.equal(calls.length, 4);
  assert.equal(result.resolution.status, "complete");
  assert.equal(result.items.find((row) => row.title === "Fixture EP").albumType, "ep");
  assert.equal(result.items.find((row) => row.title === "Fixture single").albumType, "single");
  assert.equal(result.items.find((row) => row.title === "Unknown type").albumType, undefined);
  for (const row of artist.topAlbums)
    assert.ok(result.items.some((item) => item.catalogId === row.catalogId));
});
test("songs and related primitives follow preserved handles without expanding artist preview UI", async () => {
  const { client, calls, artist } = sectionClient();
  const songs = await client.artistSection("songs", artist.artistSections.songs);
  const related = await client.artistSection("related", artist.artistSections.related);
  assert.equal(songs.items.length, 1);
  assert.equal(songs.pages, 2);
  assert.equal(related.items[0].kind, "artist");
  assert.equal(calls.length, 3);
  assert.equal(artist.topTracks.length, 1);
  assert.equal(artist.relatedArtists.length, 1);
});
test("repeated continuations, page caps, invalid tokens and late page failures are bounded", async () => {
  for (const [options, pages, reason] of [
    [{ repeat: true }, 2, "repeated-continuation"],
    [{ forever: true }, sectionParser.SECTION_LIMITS.pages, "limit"],
    [{ pageFailure: true }, 2, "unavailable"],
  ]) {
    const { client, calls, artist } = sectionClient(options);
    const result = await client.artistSection("albums", artist.artistSections.albums);
    assert.equal(calls.length, pages);
    assert.equal(result.partial, true);
    assert.equal(result.reason, reason);
    assert.ok(result.items.length > 0);
  }
  const { client, artist } = sectionClient();
  assert.throws(
    () =>
      client.artistSection("albums", {
        ...artist.artistSections.albums,
        continuation: "x".repeat(4097),
      }),
    { status: 400 },
  );
  assert.throws(() => client.artistSection("albums", { browseId: "https://other.test" }), {
    status: 400,
  });
});
test("section item/token limits and empty or missing sections retain the CORE preview", async () => {
  const { artist } = sectionClient();
  for (const [mode, expected, reason] of [
    ["items", 1000, "limit"],
    ["token", 1, "invalid-continuation"],
    ["empty", 0, undefined],
  ]) {
    let requests = 0;
    const client = createYouTubeMusicClient({
      fetcher: async (url, options) => {
        if (!options?.body)
          return {
            ok: true,
            text: async () =>
              'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});',
          };
        requests++;
        const count = mode === "items" ? 1001 : mode === "empty" ? 0 : 1;
        const items = Array.from({ length: count }, (_, index) => ({
          musicTwoRowItemRenderer: {
            title: { simpleText: "Release " + index },
            navigationEndpoint: {
              browseEndpoint: browse("album", "MPREbounded" + index),
            },
          },
        }));
        if (mode === "token")
          items.push({
            continuationItemRenderer: {
              continuationEndpoint: {
                continuationCommand: { token: "x".repeat(4097) },
              },
            },
          });
        return {
          ok: true,
          json: async () => ({ contents: { gridRenderer: { items } } }),
        };
      },
    });
    const section = await client.artistSection("albums", artist.artistSections.albums);
    assert.equal(section.items.length, expected);
    assert.equal(section.reason, reason);
    assert.equal(section.partial, !!reason);
    assert.equal(requests, 1);
    if (mode === "empty") {
      const full = await client.artistDiscography(artist);
      assert.deepEqual(full.items, artist.topAlbums);
    }
  }
  const missing = structuredClone(sectionFixture.artist);
  const removeHandles = (value) => {
    if (!value || typeof value !== "object") return;
    delete value.moreContentButton;
    delete value.bottomEndpoint;
    if (value.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("MPAD"))
      delete value.navigationEndpoint;
    for (const child of Object.values(value)) removeHandles(child);
  };
  removeHandles(missing);
  const preview = parseBrowse("artist", sectionFixture.artistId, missing);
  assert.equal(preview.artistSections.albums.browseId, undefined);
  const { client, calls } = sectionClient();
  const unchanged = await client.artistDiscography(preview);
  assert.equal(unchanged.resolution.status, "preview");
  assert.deepEqual(unchanged.items, preview.topAlbums);
  assert.equal(calls.length, 0);
});

test("CORE performs no section calls; FULL starts editorial/discography concurrently and preserves partial CORE", async () => {
  const { client, calls, artist } = sectionClient({ failSingles: true });
  let editorialStarted = false,
    discographyStarted = false;
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async () => artist,
      artistDiscography: async (row) => {
        discographyStarted = true;
        await Promise.resolve();
        assert.equal(editorialStarted, true);
        return client.artistDiscography(row);
      },
    },
    lastfm: {
      summary: async () => {
        editorialStarted = true;
        assert.equal(discographyStarted, true);
        return { summary: "Editorial" };
      },
      recommendations: () => {
        throw Error("no Last.fm releases");
      },
    },
    itunes: {
      details: () => {
        throw Error("no Apple");
      },
      search: () => {
        throw Error("no Apple");
      },
    },
    artistArtwork: { lookup: async () => "" },
  });
  const core = await catalog.details("artist", artist.catalogId, {
    phase: "core",
  });
  assert.equal(calls.length, 0);
  assert.equal(editorialStarted, false);
  const full = await catalog.details("artist", artist.catalogId, {
    phase: "full",
  });
  assert.equal(full.topAlbums.length, 6);
  assert.equal(full.discographyResolution.status, "partial");
  assert.equal(full.summary, "Editorial");
  assert.equal(calls.length, 4);
  assert.equal(full.catalogId, core.catalogId);
  for (const row of core.topAlbums)
    assert.ok(full.topAlbums.some((item) => item.catalogId === row.catalogId));
});
test("radio parser rejects seed, duplicate, invalid and unavailable entries and retains bound playback metadata", () => {
  const video = {
    videoId: "abcdefghijk",
    title: { simpleText: "Related song" },
    longBylineText: {
      runs: [
        {
          text: "Artist",
          navigationEndpoint: {
            browseEndpoint: {
              browseId: artistId,
              browseEndpointContextSupportedConfigs: {
                browseEndpointContextMusicConfig: {
                  pageType: "MUSIC_PAGE_TYPE_ARTIST",
                },
              },
            },
          },
        },
      ],
    },
    lengthText: { simpleText: "3:20" },
    thumbnail: {
      thumbnails: [
        {
          url: "https://lh3.googleusercontent.com/fixture_radio_123=w544-h544-rj",
          width: 544,
        },
      ],
    },
  };
  const rows = parseRadio(
    {
      contents: [
        video,
        video,
        { ...video, videoId: "seedvideo12" },
        { ...video, videoId: "bad" },
        {
          ...video,
          videoId: "unavailable",
          unplayableText: { simpleText: "Unavailable" },
        },
      ].map((playlistPanelVideoRenderer) => ({ playlistPanelVideoRenderer })),
    },
    "seedvideo12",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playbackSource.videoId, video.videoId);
  assert.equal(rows[0].trackDuration, 200);
  assert.equal(rows[0].artist, "Artist");
});
test("radio cache shares next requests and never queries Last.fm or searches per recommendation", async () => {
  let calls = 0;
  const client = createYouTubeMusicClient({
    fetcher: async (url, options) => {
      if (!options?.body)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"key","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.playlistId, "RDAMVMabcdefghijk");
      assert.ok(url.includes("/next?"));
      return { ok: true, json: async () => ({}) };
    },
  });
  await Promise.all([client.radio("abcdefghijk"), client.radio("abcdefghijk")]);
  await client.radio("abcdefghijk");
  assert.equal(calls, 1);
  assert.throws(() => client.radio("bad"), { status: 400 });
  const row = { kind: "music", catalogId: "ytmusic:video:related1234" };
  const catalog = createMusicCatalog({
    youtubeMusic: {
      radio: async (id) => {
        assert.equal(id, "abcdefghijk");
        return { items: [row] };
      },
    },
    lastfm: {
      recommendations: async () => {
        throw Error("should not query Last.fm");
      },
    },
  });
  assert.equal(
    (
      await catalog.recommendations("music", "Artist", "Song", {
        videoId: "abcdefghijk",
      })
    ).items[0].recommendationSource,
    "YouTube Music",
  );
});
test("existing Last.fm description request exposes its genre tags", async () => {
  const payload = {
    track: {
      wiki: { summary: "Description" },
      toptags: { tag: [{ name: "Rock" }] },
    },
  };
  const client = require("../../server/music/lastfm.cjs").createLastfmClient({
    env: { LASTFM_API_KEY: "fixture" },
    interval: 0,
    fetcher: async () => ({ ok: true, json: async () => payload }),
  });
  assert.deepEqual((await client.summary("music", "Artist", "Song")).genres, ["Rock"]);
});
test("YouTube track details inherit release year from their linked album and optional Last.fm tags without replacing identity", async () => {
  const row = {
    kind: "music",
    catalogId: "ytmusic:video:abcdefghijk",
    title: "Song",
    artist: "Artist",
    albumCatalogId: "ytmusic:album:" + albumId,
    isrc: "JPK652300130",
  };
  const make = (genres) =>
    createMusicCatalog({
      youtubeMusic: {
        details: async (kind) => (kind === "album" ? { releaseDate: "2024" } : { ...row }),
      },
      lastfm: { summary: async () => ({ genres }) },
    });
  const detail = await make(["Rock"]).details("music", row.catalogId);
  assert.equal(detail.catalogId, row.catalogId);
  assert.equal(detail.releaseDate, "2024");
  assert.deepEqual(detail.genres, ["Rock"]);
  assert.equal(detail.genresSource, "Last.fm");
  assert.equal((await make([]).details("music", row.catalogId)).genres, undefined);
});
const txt = (value) => ({ runs: [{ text: value }] }),
  browse = (kind, id) => ({
    browseId: id,
    browseEndpointContextSupportedConfigs: {
      browseEndpointContextMusicConfig: {
        pageType: "MUSIC_PAGE_TYPE_" + kind.toUpperCase(),
      },
    },
  });
const art = {
  musicThumbnailRenderer: {
    thumbnail: {
      thumbnails: [
        { width: 120, url: "https://i.ytimg.com/small.jpg" },
        { width: 600, url: "https://i.ytimg.com/large.jpg" },
        { width: 900, url: "http://bad.test/art.jpg" },
      ],
    },
  },
};
const album = {
  title: txt("Album"),
  subtitle: txt("2024"),
  navigationEndpoint: { browseEndpoint: browse("album", albumId) },
  thumbnailRenderer: art,
};
const song = structuredClone(
  fixture.contents.sectionListRenderer.contents[0].musicShelfRenderer.contents[0]
    .musicResponsiveListItemRenderer,
);
song.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[0].navigationEndpoint.browseEndpoint =
  browse("artist", artistId);
song.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[2].navigationEndpoint.browseEndpoint =
  browse("album", albumId);
fixture.contents.sectionListRenderer.contents[0].musicShelfRenderer.contents[0].musicResponsiveListItemRenderer =
  song;
const albumPayload = {
  header: {
    musicResponsiveHeaderRenderer: {
      title: txt("Album"),
      thumbnail: art,
      straplineTextOne: {
        runs: [
          {
            text: "Artist",
            navigationEndpoint: { browseEndpoint: browse("artist", artistId) },
          },
        ],
      },
    },
  },
  contents: [
    {
      musicPlaylistShelfRenderer: {
        contents: [{ musicResponsiveListItemRenderer: song }],
      },
    },
  ],
};
test("artist recommendations parse related artist identities and bypass Last.fm", async () => {
  const related = {
    title: txt("Related artist"),
    navigationEndpoint: {
      browseEndpoint: browse("artist", "UCrelatedartist123"),
    },
    thumbnailRenderer: art,
  };
  const payload = {
    header: { musicImmersiveHeaderRenderer: { title: txt("Artist") } },
    contents: [
      {
        musicCarouselShelfRenderer: {
          contents: [
            { musicTwoRowItemRenderer: related },
            { musicTwoRowItemRenderer: related },
            { musicTwoRowItemRenderer: album },
          ],
        },
      },
    ],
  };
  const detail = parseBrowse("artist", artistId, payload);
  assert.equal(detail.relatedArtists.length, 1);
  assert.equal(detail.relatedArtists[0].title, "Related artist");
  assert.ok(detail.relatedArtists[0].image);
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async (kind, id) => {
        assert.equal(kind, "artist");
        assert.equal(id, artistId);
        return detail;
      },
    },
    lastfm: {
      recommendations: async () => {
        throw Error("must not query Last.fm");
      },
    },
  });
  const result = await catalog.recommendations("artist", "Artist", "Artist", {
    artistId,
  });
  assert.equal(result.items[0].recommendationSource, "YouTube Music");
});
test("search retains standalone release year and album identity without mistaking album titles for years", () => {
  const dated = structuredClone(song);
  dated.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs.push(
    { text: " · " },
    { text: "2018" },
  );
  const row = parseSearch("music", {
    musicResponsiveListItemRenderer: dated,
  })[0];
  assert.equal(row.releaseDate, "2018");
  assert.equal(row.albumCatalogId, "ytmusic:album:" + albumId);
  const payload = structuredClone(albumPayload);
  payload.header.musicResponsiveHeaderRenderer.subtitle = txt("2018");
  assert.equal(parseBrowse("album", albumId, payload).albumTracks[0].releaseDate, "2018");
});
test("known search year skips album detail fetch; album recommendations classify bounded radio releases", async () => {
  let albumCalls = 0;
  const row = {
    kind: "music",
    catalogId: "ytmusic:video:abcdefghijk",
    title: "Song",
    artist: "Artist",
    releaseDate: "2018",
    albumCatalogId: "ytmusic:album:" + albumId,
    isrc: "JPK652300130",
  };
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async (kind) => {
        if (kind === "music") return row;
        albumCalls++;
        return {
          albumType: "album",
          albumTracks: [{ playbackSource: { videoId: "abcdefghijk" } }],
        };
      },
      radio: async () => ({
        items: [
          {
            albumCatalogId: "ytmusic:album:MPRErelated123",
            albumTitle: "Related album",
            artist: "Artist",
            image: "fixture",
          },
          {
            albumCatalogId: row.albumCatalogId,
            albumTitle: "Seed",
            artist: "Artist",
          },
        ],
      }),
    },
    lastfm: {
      summary: async () => ({}),
      recommendations: async () => {
        throw Error("Last.fm should not seed album recommendations");
      },
    },
  });
  assert.equal((await catalog.details("music", row.catalogId)).releaseDate, "2018");
  assert.equal(albumCalls, 0);
  const result = await catalog.recommendations("album", "Artist", "Album", {
    albumId,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "Related album");
  assert.equal(result.items[0].kind, "album");
});
test("catalog parser validates song identity/source, duration and rejects videos/foreign entities", () => {
  const rows = parseSearch("music", fixture);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].catalogId, "ytmusic:video:10z6-vQm23w");
  assert.equal(rows[0].trackDuration, 216);
  assert.equal(model.queueTrack(rows[0]).playbackSource.videoId, "10z6-vQm23w");
  assert.equal(
    parseSearch("music", {
      contents: [
        { musicResponsiveListItemRenderer: song },
        { musicResponsiveListItemRenderer: song },
      ],
    }).length,
    1,
  );
  const bad = structuredClone(song);
  bad.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType =
    "MUSIC_VIDEO_TYPE_UGC";
  assert.deepEqual(parseSearch("music", { musicResponsiveListItemRenderer: bad }), []);
  assert.equal(duration("1:02:03"), 3723);
  assert.equal(duration("2:60"), undefined);
  const row = { ...album, overlay: song.overlay };
  assert.equal(parseSearch("music", { musicResponsiveListItemRenderer: row }).length, 0);
  assert.equal(
    parseSearch("album", { musicTwoRowItemRenderer: row })[0].image,
    "https://i.ytimg.com/large.jpg",
  );
  assert.equal(parseSearch("artist", { musicTwoRowItemRenderer: row }).length, 0);
});
test("new catalog artwork requests cover resolution from the same resizable CDN asset", () => {
  const withArt = (url) =>
    parseSearch("album", {
      musicTwoRowItemRenderer: {
        ...album,
        thumbnailRenderer: { thumbnails: [{ width: 120, url }] },
      },
    })[0].image;
  assert.equal(
    withArt("https://yt3.googleusercontent.com/same-art=w120-h120-l90-rj"),
    "https://lh3.googleusercontent.com/same-art=w800-h800-l90-rj",
  );
  assert.equal(
    withArt("https://lh3.ggpht.com/same-art=w1200-h1200-rj"),
    "https://lh3.ggpht.com/same-art=w1200-h1200-rj",
  );
  assert.equal(
    withArt("https://i.ytimg.com/vi/10z6-vQm23w/default.jpg"),
    "https://i.ytimg.com/vi/10z6-vQm23w/default.jpg",
  );
  const row = parseSearch("album", {
    musicTwoRowItemRenderer: {
      ...album,
      thumbnailRenderer: {
        thumbnails: [
          {
            width: 120,
            url: "https://yt3.googleusercontent.com/asset=w120-h120-l90-rj",
          },
        ],
      },
    },
  })[0];
  assert.equal(row.imageFallback, "https://yt3.googleusercontent.com/asset=w120-h120-l90-rj");
  assert.notEqual(row.image, row.imageFallback);
});
test("album browse retains official-video first track, ordered shelves and header metadata; artist carousels carry art/type", () => {
  const payload = structuredClone(albumPayload),
    first =
      payload.contents[0].musicPlaylistShelfRenderer.contents[0].musicResponsiveListItemRenderer;
  first.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType =
    "MUSIC_VIDEO_TYPE_OMV";
  first.flexColumns = first.flexColumns.slice(0, 1);
  delete first.thumbnail;
  payload.recommendations = { musicResponsiveListItemRenderer: song };
  const row = parseBrowse("album", albumId, payload);
  assert.equal(row.albumTracks.length, 1);
  assert.equal(row.albumTracks[0].artist, "Artist");
  assert.equal(row.albumTracks[0].albumCatalogId, row.catalogId);
  assert.equal(row.albumTracks[0].image, row.image);
  assert.equal(row.trackNames[0], row.albumTracks[0].title);
  const person = parseBrowse("artist", artistId, {
    header: {
      musicImmersiveHeaderRenderer: { title: txt("Artist"), thumbnail: art },
    },
    contents: [
      {
        musicCarouselShelfRenderer: {
          header: {
            musicCarouselShelfBasicHeaderRenderer: { title: txt("Singles") },
          },
          contents: [{ musicTwoRowItemRenderer: album }],
        },
      },
      {
        musicShelfRenderer: {
          contents: [{ musicResponsiveListItemRenderer: song }],
        },
      },
    ],
  });
  assert.equal(person.topAlbums[0].albumType, "single");
  assert.ok(person.topAlbums[0].image);
  assert.equal(person.topTracks.length, 1);
  assert.throws(() => parseBrowse("album", artistId, payload));
  assert.throws(() => parseBrowse("artist", artistId, {}));
});
test("guest catalog uses separate filters, bounded cache, request dedup and exact song rehydration", async () => {
  const calls = [];
  let time = 0;
  const client = createYouTubeMusicClient({
    now: () => time,
    ttl: 100,
    fetcher: async (url, options) => {
      assert.equal(new URL(url).hostname, "music.youtube.com");
      assert.equal(options.headers.Cookie, undefined);
      if (!options.method)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      return {
        ok: true,
        json: async () =>
          url.includes("/browse?")
            ? albumPayload
            : body.params === FILTERS.music
              ? fixture
              : {
                  musicTwoRowItemRenderer: {
                    ...album,
                    navigationEndpoint: {
                      browseEndpoint: browse(
                        body.params === FILTERS.album ? "album" : "artist",
                        body.params === FILTERS.album ? albumId : artistId,
                      ),
                    },
                  },
                },
      };
    },
  });
  const [a, b] = await Promise.all([
    client.search("music", "Song"),
    client.search("music", "Song"),
  ]);
  assert.equal(calls.length, 1);
  a.items[0].title = "mutated";
  assert.notEqual(b.items[0].title, a.items[0].title);
  assert.equal((await client.details("music", "10z6-vQm23w")).catalogId, b.items[0].catalogId);
  assert.equal(calls.length, 1);
  await client.search("album", "Album");
  await client.search("artist", "Artist");
  assert.deepEqual(
    calls.map((c) => c.body.params),
    Object.values(FILTERS),
  );
  await client.details("album", albumId);
  await client.details("album", albumId);
  assert.equal(calls.filter((c) => c.url.includes("/browse?")).length, 1);
  time = 101;
  await client.details("music", "10z6-vQm23w", { title: "Song" });
  assert.equal(calls.filter((c) => c.body.params === FILTERS.music).length, 2);
  await assert.rejects(client.details("music", "dQw4w9WgXcQ", { title: "Song" }), /disponíveis/);
  assert.throws(() => client.search("playlist", "Song"), { status: 400 });
  assert.throws(() => client.details("artist", albumId), { status: 400 });
});
test("new catalog searches use YouTube only; Apple remains explicit legacy access; browse failure never changes identity", async () => {
  let apple = 0;
  const emptyApple = {
    search: async () => {
      apple++;
      return {
        provider: "iTunes",
        items: [{ kind: "music", catalogId: "itunes:1" }],
      };
    },
    details: async () => {
      throw Error("must not replace browse");
    },
  };
  for (const state of ["success", "empty", "error"]) {
    const c = createMusicCatalog({
      itunes: emptyApple,
      youtubeMusic: {
        search: async () => {
          if (state === "error") throw Error("timeout");
          return {
            provider: "YouTube Music",
            items: state === "success" ? parseSearch("music", fixture) : [],
          };
        },
        details: async () => {
          throw Error("browse offline");
        },
      },
    });
    if (state === "error") await assert.rejects(c.search("music", "Song"), /timeout/);
    else assert.equal((await c.search("music", "Song")).provider, "YouTube Music");
    await assert.rejects(c.details("album", "ytmusic:album:" + albumId), /browse offline/);
  }
  assert.equal(apple, 0);
});

test("Last.fm recommendations resolve only unique matching YouTube catalog entities", async () => {
  const suggestions = ["music", "album", "artist"].map((kind) => ({
    kind,
    title: kind === "artist" ? "Artist" : "Song",
    artist: "Artist",
  }));
  let apple = 0;
  const catalog = createMusicCatalog({
    itunes: {
      search: async () => {
        apple++;
        throw Error("legacy search forbidden");
      },
    },
    lastfm: { recommendations: async () => ({ items: suggestions }) },
    youtubeMusic: {
      search: async (kind) => ({
        items: [
          {
            kind,
            title: kind === "artist" ? "Artist" : "Song",
            artist: "Artist",
            catalogId:
              "ytmusic:" +
              {
                music: "video:abcdefghijk",
                album: "album:MPREtestalbum",
                artist: "artist:UCtestartist123",
              }[kind],
            image: "https://lh3.googleusercontent.com/fixture_123456=w800-h800-rj",
          },
        ],
      }),
    },
  });
  const result = await catalog.recommendations("music", "Artist", "Seed");
  assert.equal(result.items.length, 3);
  assert.equal(apple, 0);
  assert.ok(
    result.items.every(
      (row) => row.catalogId.startsWith("ytmusic:") && row.recommendationSource === "Last.fm",
    ),
  );
});
test("recording dedupe is cross-provider, conservative, edition-aware and leaves ambiguity separate", () => {
  const a = {
    kind: "music",
    id: "old",
    catalogId: "itunes:1",
    title: "Song",
    artist: "Artist",
    albumTitle: "Album",
    trackDuration: 210,
    playbackSource: { type: "local", fileRef: "manual" },
  };
  const b = {
    ...a,
    id: undefined,
    catalogId: "ytmusic:video:10z6-vQm23w",
    playbackSource: { type: "youtube", videoId: "10z6-vQm23w" },
  };
  assert.equal(model.findRecording([a], b), a);
  assert.equal(model.findRecording([a, { ...a, id: "other", catalogId: "itunes:2" }], b), null);
  assert.equal(model.findRecording([{ ...a, catalogId: "ytmusic:video:dQw4w9WgXcQ" }], b), null);
  for (const patch of [
    { albumTitle: "" },
    { trackDuration: 230 },
    { title: "Song (Live)" },
    { isrc: "USABC1234567" },
  ])
    assert.equal(model.recordingMatch({ ...a, isrc: "USABC1234568" }, { ...b, ...patch }), 0);
  assert.ok(model.sameWork(a, { ...b, albumTitle: "Other" }));
  assert.equal(model.recordingMatch(a, { ...b, albumTitle: "Other" }), 0);
  assert.equal(
    model.library({ ...a, metadataSources: { youtubeMusicId: "10z6-vQm23w" } }).metadataSources
      .youtubeMusicId,
    "10z6-vQm23w",
  );
  assert.equal(model.queueTrack(a).fileRef, "manual");
  assert.ok(model.validCatalogId("music", "itunes:1"));
});

test("artist discography dates follow exact edition IDs and own track year wins", () => {
  const second = structuredClone(song);
  second.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.videoId =
    "abcdefghijk";
  second.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[2].navigationEndpoint.browseEndpoint =
    browse("album", "MPREsecond123");
  const payload = {
    header: { musicImmersiveHeaderRenderer: { title: txt("Artist") } },
    contents: [
      {
        musicShelfRenderer: {
          contents: [song, second].map((musicResponsiveListItemRenderer) => ({
            musicResponsiveListItemRenderer,
          })),
        },
      },
      {
        musicCarouselShelfRenderer: {
          contents: [
            { ...album, subtitle: txt("2021") },
            {
              ...album,
              subtitle: txt("2018"),
              navigationEndpoint: {
                browseEndpoint: browse("album", "MPREsecond123"),
              },
            },
          ].map((musicTwoRowItemRenderer) => ({ musicTwoRowItemRenderer })),
        },
      },
    ],
  };
  assert.deepEqual(
    parseBrowse("artist", artistId, payload).topTracks.map((row) => row.releaseDate),
    ["2021", "2018"],
  );
  song.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs.push({
    text: "2005",
  });
  try {
    assert.equal(parseBrowse("artist", artistId, payload).topTracks[0].releaseDate, "2005");
    const p = structuredClone(albumPayload);
    p.header.musicResponsiveHeaderRenderer.subtitle = txt("2014");
    assert.equal(parseBrowse("album", albumId, p).albumTracks[0].releaseDate, "2005");
  } finally {
    song.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs.pop();
  }
});

test("cached album date enriches search and details without browse per search result", async () => {
  let browses = 0,
    searches = 0;
  const client = createYouTubeMusicClient({
    fetcher: async (url, options) => {
      if (!options?.body)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"key","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      if (url.includes("/browse?")) {
        browses++;
        const payload = structuredClone(albumPayload);
        payload.header.musicResponsiveHeaderRenderer.subtitle = txt("2014");
        return { ok: true, json: async () => payload };
      }
      searches++;
      return { ok: true, json: async () => fixture };
    },
  });
  await client.search("music", "Before album");
  assert.equal((await client.details("music", "10z6-vQm23w")).releaseDate, undefined);
  await client.details("album", albumId);
  assert.equal((await client.details("music", "10z6-vQm23w")).releaseDate, "2014");
  const result = await client.search("music", "Song Artist");
  assert.equal(result.items[0].releaseDate, "2014");
  assert.equal(
    (await client.details("music", result.items[0].playbackSource.videoId)).releaseDate,
    "2014",
  );
  assert.equal(browses, 1);
  assert.equal(searches, 2);
  const fresh = createYouTubeMusicClient({
    fetcher: async (url, options) => {
      if (!options?.body)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"key","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      assert.ok(url.includes("/search?"));
      return { ok: true, json: async () => fixture };
    },
  });
  assert.equal((await fresh.search("music", "Song Artist")).items[0].releaseDate, undefined);
});

test("album carousel parser keeps valid related albums across languages, excluding seed and duplicates", () => {
  const a = {
    ...album,
    title: txt("A"),
    navigationEndpoint: { browseEndpoint: browse("album", "MPRErelated111") },
  };
  const b = {
    ...album,
    title: txt("B"),
    navigationEndpoint: { browseEndpoint: browse("album", "MPRErelated222") },
  };
  const artist = {
    ...album,
    title: txt("Artist C"),
    navigationEndpoint: {
      browseEndpoint: browse("artist", "UCrelatedartist123"),
    },
  };
  const payload = structuredClone(albumPayload);
  payload.contents.push({
    musicCarouselShelfRenderer: {
      header: {
        musicCarouselShelfBasicHeaderRenderer: { title: txt("おすすめ") },
      },
      contents: [a, b, artist, album, a].map((musicTwoRowItemRenderer) => ({
        musicTwoRowItemRenderer,
      })),
    },
  });
  const detail = parseBrowse("album", albumId, payload);
  assert.deepEqual(
    detail.relatedAlbums.map((row) => row.title),
    ["A", "B"],
  );
  assert.equal(detail.relatedAlbums[0].releaseDate, "2024");
  assert.ok(detail.relatedAlbums[0].image);
});
test("album recommendations prefer browse carousels without invoking track radio", async () => {
  const catalog = createMusicCatalog({
    youtubeMusic: {
      details: async () => ({
        relatedAlbums: [
          {
            kind: "album",
            catalogId: "ytmusic:album:MPRErelated111",
            title: "A",
          },
        ],
      }),
      radio: async () => {
        throw Error("Radio must not be used");
      },
    },
  });
  assert.equal(
    (await catalog.recommendations("album", "Artist", "Album", { albumId })).items[0].title,
    "A",
  );
});

test("one real client album browse supplies music year/context and cached album navigation", async () => {
  let browses = 0;
  const client = createYouTubeMusicClient({
    fetcher: async (url, options) => {
      if (!options?.body)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"key","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      if (url.includes("/browse?")) {
        browses++;
        const payload = structuredClone(albumPayload);
        payload.header.musicResponsiveHeaderRenderer.subtitle = txt("2015");
        return { ok: true, json: async () => payload };
      }
      return { ok: true, json: async () => fixture };
    },
  });
  const found = (await client.search("music", "Song Artist")).items[0];
  const catalog = createMusicCatalog({
    youtubeMusic: client,
    lastfm: { summary: async () => ({ summary: "Editorial" }) },
    musicbrainz: { recordingIsrc: async () => null },
    isrcEdition: async () => null,
  });
  const core = await catalog.details("music", found.catalogId, {
    phase: "core",
  });
  assert.equal(core.releaseDate, "2015");
  assert.equal(core.albumContext.catalogId, found.albumCatalogId);
  assert.ok(core.albumContext.albumTracks.length);
  await catalog.details("music", found.catalogId);
  await catalog.details("album", found.albumCatalogId, { phase: "core" });
  assert.equal(browses, 1);
  const collection = require("../../dist/collection/collection.js");
  const saved = collection.validateItem({ ...core, status: "planned" });
  assert.equal(saved.albumContext, undefined);
});

test("canonical search and details retain YouTube identity and relationships without Apple fallback", async () => {
  const row = { ...parseSearch("music", fixture)[0] };
  const catalog = createMusicCatalog({
    youtubeMusic: {
      search: async (kind, query) => {
        assert.equal(kind, "music");
        assert.equal(query, "Song");
        return { items: [row] };
      },
      details: async (kind, id) => {
        assert.equal(kind, "music");
        assert.equal(id, row.playbackSource.videoId);
        return { ...row, releaseDate: "2024" };
      },
    },
    itunes: {
      search: () => {
        throw Error("Apple must not supply canonical search");
      },
      details: () => {
        throw Error("Apple must not supply YouTube details");
      },
    },
  });
  const found = (await catalog.search("music", "Song")).items[0];
  assert.equal(found.kind, "music");
  assert.equal(found.source, "YouTube Music");
  assert.equal(found.catalogId, "ytmusic:video:10z6-vQm23w");
  assert.equal(
    require("../../dist/catalog/catalog.js").normalize("music", { items: [found] })[0].source,
    "YouTube Music",
    "real YouTube payload source wins over Catalog.names legacy default",
  );
  assert.equal(found.artistCatalogId, "ytmusic:artist:" + artistId);
  assert.equal(found.albumCatalogId, "ytmusic:album:" + albumId);
  const detail = await catalog.details("music", found.catalogId, {
    phase: "core",
  });
  assert.equal(detail.catalogId, found.catalogId);
  const saved = require("../../dist/collection/collection.js").validateItem({
    ...detail,
    status: "planned",
  });
  assert.equal(saved.catalogId, found.catalogId);
  assert.equal(model.sameItem(saved, { ...detail }), true);
  assert.equal(model.sameItem(saved, { ...detail, catalogId: "itunes:1" }), false);
});
