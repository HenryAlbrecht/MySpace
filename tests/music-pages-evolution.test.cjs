const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { parseBrowse } = require("../server/youtube-music-parser.cjs");
const { createLastfmClient } = require("../server/lastfm.cjs");
const { createMusicCatalog } = require("../server/music-catalog.cjs");
const MusicModel = require("../dist/music-model.js");
const artist = "UCfixtureartist123",
  album = "MPREfixturealbum123";
const header = (name, image) => ({
  [name]: { title: { simpleText: "Artist" }, thumbnail: { thumbnails: image } },
});
for (const variant of [
  "musicImmersiveHeaderRenderer",
  "musicVisualHeaderRenderer",
  "musicResponsiveHeaderRenderer",
  "musicDetailHeaderRenderer",
])
  test(variant + " accepts only a real landscape artist banner", () => {
    const images = [
      {
        url: "https://lh3.googleusercontent.com/fixturebanner123=w1200-h600",
        width: 1200,
        height: 600,
      },
    ];
    assert.ok(parseBrowse("artist", artist, { header: header(variant, images) }).bannerImage);
    for (const bad of [
      [{ ...images[0], width: 600, height: 600 }],
      [{ ...images[0], url: "javascript:bad" }],
      [],
    ])
      assert.equal(
        parseBrowse("artist", artist, { header: header(variant, bad) }).bannerImage,
        undefined,
      );
    assert.equal(
      parseBrowse("album", album, { header: header(variant, images) }).bannerImage,
      undefined,
    );
  });
test("Last.fm tag API validates, safely encodes and caches each section independently", async () => {
  let requests = 0;
  const client = createLastfmClient({
    env: { LASTFM_API_KEY: "fixture" },
    interval: 0,
    fetcher: async (url) => {
      requests++;
      const u = new URL(url);
      assert.equal(u.searchParams.get("tag"), "dream pop & noise");
      assert.equal(u.searchParams.get("method"), "tag.getInfo");
      return {
        ok: true,
        json: async () => ({
          tag: { name: "dream pop", wiki: { summary: "Editorial text" } },
        }),
      };
    },
  });
  const info = await client.tag("dream pop & noise");
  assert.equal(info.summary, "Editorial text");
  await client.tag("dream pop & noise");
  assert.equal(requests, 1);
  for (const invalid of ["", null, "a".repeat(81), "<bad>", "a\n"])
    await assert.rejects(client.tag(invalid), { status: 400 });
});
test("tag entity resolution omits ambiguous results, keeps sections independent and limits concurrency", async () => {
  let active = 0,
    max = 0;
  const catalog = createMusicCatalog({
    lastfm: {
      tag: async (tag, kind) => ({
        items: [
          { kind, title: "Unique", artist: "Artist" },
          { kind, title: "Ambiguous", artist: "Artist" },
          { kind, title: "Failed", artist: "Artist" },
        ],
      }),
    },
    youtubeMusic: {
      search: async (kind, q) => {
        max = Math.max(max, ++active);
        await new Promise((r) => setTimeout(r, 1));
        active--;
        if (q.startsWith("Failed")) throw Error("partial");
        const id =
          kind === "music"
            ? "ytmusic:video:abcdefghijk"
            : kind === "album"
              ? "ytmusic:album:" + album
              : "ytmusic:artist:" + artist;
        const row = {
          kind,
          title: q.split(" ")[0],
          artist: "Artist",
          catalogId: id,
        };
        return {
          items: q.startsWith("Ambiguous")
            ? [
                row,
                {
                  ...row,
                  catalogId:
                    kind === "music"
                      ? "ytmusic:video:related1234"
                      : kind === "album"
                        ? "ytmusic:album:MPREalternate123"
                        : "ytmusic:artist:UCalternateartist123",
                },
              ]
            : [row, row],
        };
      },
    },
  });
  for (const kind of ["music", "album", "artist"]) {
    const result = await catalog.tag("shoegaze", kind);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].title, "Unique");
    assert.equal(result.partial, true);
  }
  assert.ok(max <= 2);
});
test("queue metadata retains catalog, duration and albumTitle while album stays artwork", () => {
  const track = MusicModel.queueTrack({
    kind: "music",
    title: "Song",
    artist: "Artist",
    image: "cover",
    albumTitle: "Album",
    catalogId: "ytmusic:video:abcdefghijk",
    trackDuration: 210,
    playbackSource: { type: "youtube", videoId: "abcdefghijk" },
  });
  assert.equal(track.album, "cover");
  assert.equal(track.albumTitle, "Album");
  assert.equal(track.trackDuration, 210);
  assert.equal(track.catalogId, "ytmusic:video:abcdefghijk");
});
test("Last.fm tags enrich all three entities without replacing YouTube identities", async () => {
  for (const kind of ["music", "album", "artist"]) {
    const id = {
      music: "ytmusic:video:abcdefghijk",
      album: "ytmusic:album:" + album,
      artist: "ytmusic:artist:" + artist,
    }[kind];
    const row = {
      kind,
      catalogId: id,
      title: "Title",
      artist: "Artist",
      image: "original",
      isrc: "JPB451202866",
    };
    const catalog = createMusicCatalog({
      youtubeMusic: { details: async () => row },
      lastfm: {
        summary: async () => ({
          summary: "Editorial",
          genres: ["shoegaze", "seen live"],
        }),
      },
    });
    const detail = await catalog.details(kind, id);
    assert.equal(detail.catalogId, id);
    assert.equal(detail.image, row.image);
    assert.deepEqual(detail.genres, ["shoegaze", "seen live"]);
    assert.equal(detail.genresSource, "Last.fm");
  }
});
test("tag top sections call the appropriate Last.fm methods and retain safe pagination", async () => {
  const methods = [];
  const client = createLastfmClient({
    env: { LASTFM_API_KEY: "fixture" },
    interval: 0,
    fetcher: async (url) => {
      const method = new URL(url).searchParams.get("method");
      methods.push(method);
      return {
        ok: true,
        json: async () => ({
          tracks: {
            track: [{ name: "Song", artist: { name: "Artist" } }],
            "@attr": { totalPages: "2" },
          },
          albums: { album: [{ name: "Album", artist: { name: "Artist" } }] },
          topartists: { artist: [{ name: "Artist" }] },
          similartags: { tag: [{ name: "dream pop" }] },
        }),
      };
    },
  });
  assert.equal((await client.tag("shoegaze", "music")).next, 2);
  assert.equal((await client.tag("shoegaze", "album")).items[0].kind, "album");
  assert.equal((await client.tag("shoegaze", "artist")).items[0].kind, "artist");
  assert.deepEqual((await client.tag("shoegaze", "related")).tags, ["dream pop"]);
  assert.deepEqual(methods, [
    "tag.getTopTracks",
    "tag.getTopAlbums",
    "tag.getTopArtists",
    "tag.getSimilar",
  ]);
});

test("Last.fm removes only trailing editorial boilerplate", () => {
  const { editorial } = require("../server/lastfm.cjs");
  assert.equal(
    editorial('Real biography. <a href="https://last.fm">Read more on Last.fm</a>'),
    "Real biography.",
  );
  assert.equal(editorial('<p><a href="https://last.fm">Read more on Last.fm</a></p>'), "");
  assert.equal(editorial("Real biography."), "Real biography.");
  assert.equal(
    editorial("Read more on Last.fm is mentioned here. More biography."),
    "Read more on Last.fm is mentioned here. More biography.",
  );
});
test("banner height respects artist and keeps stored settings untouched", () => {
  const vm = require("node:vm"),
    fs = require("node:fs");
  const context = {
    window: {},
    safeUrl: (value) => value,
    localStorage: { getItem: () => null },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../dist/title-banner.js"), "utf8"), context);
  const settings = { height: 300, x: 40, y: 60, zoom: 1.2 },
    image = { style: {} };
  for (const [kind, height] of [
    ["artist", "300px"],
    ["game", "300px"],
    ["anime", "300px"],
  ]) {
    const hero = { dataset: { kind }, style: {} };
    context.window.TitleBanner.apply(hero, image, settings);
    assert.equal(hero.style.height, height);
    assert.equal(image.style.objectPosition, "40% 60%");
    assert.equal(image.style.transform, "scale(1.2)");
  }
  assert.equal(settings.height, 300);
});
test("artist stats reuse editorial request and preserve canonical identity", async () => {
  let calls = 0;
  const lastfm = createLastfmClient({
    env: { LASTFM_API_KEY: "fixture" },
    interval: 0,
    fetcher: async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          artist: {
            bio: { content: "Bio" },
            stats: { listeners: "123", playcount: "456" },
          },
        }),
      };
    },
  });
  const row = {
    kind: "artist",
    catalogId: "ytmusic:artist:UCfixtureartist123",
    title: "Artist",
    image: "https://fixture.test/photo",
    bannerImage: "https://fixture.test/banner",
  };
  const catalog = createMusicCatalog({
    youtubeMusic: { details: async () => row },
    lastfm,
  });
  const result = await catalog.details("artist", row.catalogId);
  assert.equal(result.listeners, "123");
  assert.equal(result.playcount, "456");
  assert.equal(result.catalogId, row.catalogId);
  assert.equal(result.image, row.image);
  assert.equal(result.bannerImage, row.bannerImage);
  assert.equal(calls, 1);
});
test("release sort and filters are independent, missing dates stay at end", () => {
  const vm = require("node:vm"),
    fs = require("node:fs");
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("../dist/music-page-ui.js"), "utf8"), context);
  const releases = context.window.MusicPageUI.releases;
  const rows = [
    { title: "Z", albumType: "ep", releaseDate: "2020" },
    { title: "B", albumType: "ep", releaseDate: "2010" },
    { title: "A", albumType: "album", releaseDate: "2018" },
    { title: "Missing" },
  ];
  assert.deepEqual(
    Array.from(releases(rows, "ep", "old"), (row) => row.title),
    ["B", "Z"],
  );
  assert.deepEqual(
    Array.from(releases(rows, "ep", "recent"), (row) => row.title),
    ["Z", "B"],
  );
  assert.deepEqual(
    Array.from(releases(rows, "all", "title"), (row) => row.title),
    ["A", "B", "Missing", "Z"],
  );
  assert.equal(releases(rows, "all", "old").at(-1).title, "Missing");
  assert.equal(rows[0].title, "Z");
});
test("inline play delegates to SPACEAMP without creating collection entries", () => {
  const vm = require("node:vm"),
    fs = require("node:fs");
  let selected,
    queueCalls = 0;
  const window = {
    SPACEAMP: {
      play: (value) => {
        selected = value;
      },
    },
    CollectionActions: {
      getItems: () => [],
      saveMusic: () => {
        throw Error("Unexpected collection write");
      },
    },
  };
  const context = { window, MusicModel, localStorage: { getItem: () => null } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../dist/music-bridge.js"), "utf8"), context);
  const item = {
    kind: "music",
    title: "Track",
    catalogId: "ytmusic:video:abcdefghijk",
    playbackSource: { type: "youtube", videoId: "abcdefghijk" },
  };
  window.MusicBridge.configurePlaylist({
    getTracks: () => [],
    add: () => {
      queueCalls++;
    },
  });
  window.MusicBridge.play(item);
  assert.equal(selected.catalogId, item.catalogId);
  assert.equal(queueCalls, 0);
  assert.equal(window.MusicBridge.canPlay({ ...item, playbackSource: null }), false);
  assert.equal(
    window.MusicBridge.canPlay({
      ...item,
      playbackSource: { type: "youtube", videoId: "invalid" },
    }),
    false,
  );
});
test("artist banner default is taller but saved heights and legacy settings remain authoritative", () => {
  const vm = require("node:vm"),
    fs = require("node:fs");
  let stored = null;
  const context = {
    window: {},
    safeUrl: (value) => value,
    localStorage: {
      getItem: (key) => (key.includes("Settings") ? stored : null),
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../dist/title-banner.js"), "utf8"), context);
  const api = context.window.TitleBanner;
  assert.equal(api.get({ kind: "artist" }).height, 390);
  assert.equal(api.get({ kind: "game" }).height, 300);
  stored = JSON.stringify({
    height: 300,
    zoom: 1.4,
    x: 20,
    y: 70,
    image: "https://fixture.test/manual",
  });
  const settings = api.get({ kind: "artist" });
  assert.equal(settings.height, 300);
  assert.equal(settings.zoom, 1.4);
  assert.equal(settings.x, 20);
  assert.equal(settings.y, 70);
  stored = JSON.stringify({ image: "https://fixture.test/manual" });
  assert.equal(api.get({ kind: "artist" }).height, 390);
});
