const assert = require("node:assert/strict");
const { createServer } = require("../server.cjs");
const { createMusicCatalog } = require("../server/music-catalog.cjs");

(async () => {
  const videoId = "abcdefghijk",
    artistId = "UCfixtureartist123",
    albumId = "MPREfixture123";
  const track = {
    kind: "music",
    catalogId: "ytmusic:video:" + videoId,
    source: "YouTube Music",
    title: "Song",
    artist: "Artist",
    image: "https://lh3.googleusercontent.com/fixture",
    artistCatalogId: "ytmusic:artist:" + artistId,
    albumCatalogId: "ytmusic:album:" + albumId,
    releaseDate: "2024",
    trackDuration: 210,
    playbackSource: { type: "youtube", videoId },
  };
  const rows = {
    music: track,
    artist: {
      kind: "artist",
      catalogId: "ytmusic:artist:" + artistId,
      source: "YouTube Music",
      title: "Artist",
      image: track.image,
    },
    album: {
      kind: "album",
      albumType: "album",
      catalogId: "ytmusic:album:" + albumId,
      source: "YouTube Music",
      title: "Album",
      artist: "Artist",
      artistCatalogId: track.artistCatalogId,
      image: track.image,
      albumTracks: [track],
    },
  };
  const calls = { identifiers: 0, radio: 0, legacy: 0, playback: 0 };
  const music = createMusicCatalog({
    youtubeMusic: {
      search: async (kind, query) => {
        if (query === "Unavailable") {
          const error = Error("fixture outage");
          error.status = 503;
          throw error;
        }
        return { items: [rows[kind]] };
      },
      details: async (kind, id) => {
        assert.equal(
          id,
          { music: videoId, artist: artistId, album: albumId }[kind],
        );
        return { ...rows[kind] };
      },
      radio: async (id) => {
        assert.equal(id, videoId);
        calls.radio++;
        return {
          items: [
            {
              ...track,
              catalogId: "ytmusic:video:related1234",
              title: "Related",
              playbackSource: { type: "youtube", videoId: "related1234" },
            },
          ],
        };
      },
      searchTracks: async (target) => {
        calls.playback++;
        assert.equal(target.albumTitle, "Album");
        assert.equal(target.trackDuration, 210);
        return [
          {
            title: "Song",
            artist: "Artist",
            album: "Album",
            duration: 210,
            videoId,
            url: "https://www.youtube.com/watch?v=" + videoId,
            resultType: "song",
          },
        ];
      },
    },
    itunes: {
      search: () => {
        throw Error("implicit Apple search forbidden");
      },
      details: async (kind, id) => {
        calls.legacy++;
        return {
          kind,
          catalogId: "itunes:" + id,
          title: "Legacy",
          source: "iTunes",
        };
      },
    },
    artistArtwork: { lookup: async () => "" },
    lastfm: {
      summary: async () => ({ summary: "Editorial", genres: ["Rock"] }),
      recommendations: async () => ({ items: [] }),
    },
    musicbrainz: {
      recordingIsrc: async (row) => {
        assert.equal(row.catalogId, track.catalogId);
        calls.identifiers++;
        return { isrc: "GBABC2400001", recordingId: "fixture-recording" };
      },
      playbackSource: () => {
        throw Error("matched YouTube must not use fallback");
      },
    },
    isrcEdition: async () => null,
  });
  const server = createServer({ music });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const get = async (path) => {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type"), /application\/json/);
      return response.json();
    };
    for (const kind of ["music", "album", "artist"]) {
      const found = (await get("/api/music/search?kind=" + kind + "&q=Artist"))
        .items[0];
      assert.equal(found.kind, kind);
      assert.equal(found.catalogId, rows[kind].catalogId);
      assert.equal(found.source, "YouTube Music");
      const id = { music: videoId, artist: artistId, album: albumId }[kind];
      const core = await get(
        "/api/music/ytmusic/" + kind + "/" + id + "?phase=core",
      );
      assert.equal(core.catalogId, found.catalogId);
      assert.equal(core.source, "YouTube Music");
    }
    assert.equal(calls.identifiers, 0, "CORE must not wait for identifiers");
    const detail = await get("/api/music/ytmusic/music/" + videoId);
    assert.equal(detail.catalogId, track.catalogId);
    assert.equal(detail.isrc, "GBABC2400001");
    assert.equal(detail.isrcRecordingId, "fixture-recording");
    assert.equal(detail.summarySource, "Last.fm");
    assert.equal(detail.artistCatalogId, track.artistCatalogId);
    assert.equal(detail.albumCatalogId, track.albumCatalogId);
    assert.equal(calls.identifiers, 1);
    assert.equal(
      (await get("/api/music/summary?kind=artist&artist=Artist&title=Artist"))
        .summary,
      "Editorial",
    );
    const recommendations = await get(
      "/api/music/recommendations?kind=music&artist=Artist&title=Song&videoId=" +
        videoId,
    );
    assert.equal(
      recommendations.items[0].catalogId,
      "ytmusic:video:related1234",
    );
    assert.equal(
      recommendations.items[0].recommendationSource,
      "YouTube Music",
    );
    assert.equal(calls.radio, 1);
    const playback = await get(
      "/api/music/playback-source?title=Song&artist=Artist&album=Album&duration=210",
    );
    assert.equal(playback.status, "matched");
    assert.equal(playback.source.videoId, videoId);
    assert.equal(calls.playback, 1);
    assert.equal(calls.legacy, 0, "current HTTP flow never uses Apple");
    assert.equal((await get("/api/music/artist/1")).catalogId, "itunes:1");
    assert.equal(calls.legacy, 1);
    for (const [path, status] of [
      ["/api/music/deezer/artist/1", 410],
      ["/api/music/search?kind=music&q=Song&provider=deezer", 400],
      ["/api/music/search?kind=other&q=Song", 400],
      ["/api/music/search?kind=music&q=Unavailable", 503],
      ["/api/music/playback-source?title=Song&artist=Artist&duration=-1", 400],
      ["/api/music/not-a-route", 404],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, status, path);
      assert.equal(typeof (await response.json()).error, "string");
    }
    assert.equal(
      (
        await fetch(base + "/api/music/search?kind=music&q=Song", {
          method: "POST",
        })
      ).status,
      405,
    );
    console.log(
      "PASS: local HTTP YouTube search/details/relationships, CORE/full identifiers, editorial, radio/playback, errors and explicit legacy detail; no real providers.",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
