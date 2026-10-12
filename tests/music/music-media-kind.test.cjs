const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseSearch, parseVideoSearch, parseRadio } = require("../../server/music/youtube-music-parser.cjs");
const { createYouTubeMusicClient } = require("../../server/music/youtube-music.cjs");
const fixture = require("./fixtures/youtube-music-search.json");
const albumId = "MPREb_RUR0rUOX6ug";
const artistId = "UC7d6hou24HcG5sA2lwTgV0A";
const audioId = "DjcCQsRCHUs";
const videoId = "oJL-lCzEXgI";
const cover = "https://lh3.googleusercontent.com/rio=w800-h800";
const title = "Hungry Like the Wolf (2009 Remaster)";
const runs = (text) => ({ runs: [{ text }] });
const browse = (id) => ({ navigationEndpoint: { browseEndpoint: { browseId: id } } });
function track(id, type, width = 120, height = 120) {
  const row = structuredClone(fixture.contents.sectionListRenderer.contents[0].musicShelfRenderer.contents[0].musicResponsiveListItemRenderer);
  row.playlistItemData = { videoId: id };
  const endpoint = row.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint;
  endpoint.videoId = id;
  endpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType = type;
  row.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text = runs(title);
  row.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text = { runs: [
    { text: "Duran Duran", ...browse(artistId) }, { text: " • " },
    { text: "Rio (Collector's Edition)", ...browse(albumId) }, { text: " • " }, { text: "3:41" },
  ] };
  row.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails = [{
    url: width === height ? cover : "https://lh3.googleusercontent.com/clip=w480-h270-l90-rj",
    width,
    height,
  }];
  return row;
}
const payload = (rows) => ({ contents: rows.map((row) => ({ musicResponsiveListItemRenderer: row })) });

test("music search and video search keep separate typed results, including misleading audio labels", () => {
  const data = payload([
    track(videoId, "MUSIC_VIDEO_TYPE_OMV", 480, 270),
    track(audioId, "MUSIC_VIDEO_TYPE_ATV"),
    track("abcdefghijk", "MUSIC_VIDEO_TYPE_ATV", 480, 270),
  ]);
  const songs = parseSearch("music", data);
  assert.deepEqual(songs.map((row) => row.videoId), [audioId]);
  assert.equal(songs[0].mediaType, "audio");
  assert.equal(songs[0].playbackSource.videoId, audioId);
  const videos = parseVideoSearch(data);
  assert.deepEqual(videos.map((row) => row.videoId), [videoId, "abcdefghijk"]);
  assert.ok(videos.every((row) => row.kind === "video" && row.mediaType === "video" && !row.playbackSource));
  assert.ok(videos.every((row) => row.image === "https://lh3.googleusercontent.com/clip=w480-h270-l90-rj"));
});

test("a video-backed album track resolves audio only on selection, preserving its album and sharing lookup", async () => {
  const calls = [];
  const album = {
    header: { musicResponsiveHeaderRenderer: {
      title: runs("Rio (Collector's Edition)"),
      subtitle: runs("Album • 1982"),
      straplineTextOne: { runs: [{ text: "Duran Duran", ...browse(artistId) }] },
      thumbnail: { thumbnails: [{ url: cover, width: 800, height: 800 }] },
    } },
    musicPlaylistShelfRenderer: { contents: payload([track(videoId, "MUSIC_VIDEO_TYPE_OMV")]).contents },
  };
  const client = createYouTubeMusicClient({ fetcher: async (url, options) => {
    assert.equal(new URL(url).hostname, "music.youtube.com");
    if (!options.method) return { ok: true, text: async () => 'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});' };
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    return { ok: true, json: async () => url.includes("/browse?") ? album : payload([track(audioId, "MUSIC_VIDEO_TYPE_ATV")]) };
  } });
  const release = await client.details("album", albumId);
  const row = release.albumTracks[0];
  assert.equal(row.trackNumber, 1);
  assert.equal(row.albumArtist, "Duran Duran");
  assert.equal(row.releaseDate, "1982");
  assert.equal(row.mediaType, "video");
  assert.equal(row.playbackSource, undefined);
  assert.equal(calls.length, 1, "album fetch must not resolve every track");
  await client.details("music", videoId, { phase: "core" });
  assert.equal(calls.length, 1, "CORE retains the album preview");
  const [first, second] = await Promise.all([client.details("music", videoId), client.details("music", videoId)]);
  assert.equal(first.catalogId, "ytmusic:video:" + videoId);
  assert.equal(first.playbackSource.videoId, audioId);
  assert.equal(first.image, cover);
  assert.equal(first.albumCatalogId, "ytmusic:album:" + albumId);
  assert.equal(second.playbackSource.videoId, audioId);
  assert.equal(calls.filter((call) => call.url.includes("/search?")).length, 1);
});

test("radio excludes clip rows by their view byline and keeps audio with album artwork", () => {
  const row = (id, byline) => ({ playlistPanelVideoRenderer: {
    videoId: id, title: runs("Song"), longBylineText: { runs: byline },
    thumbnail: { thumbnails: [{ url: cover, width: 544, height: 544 }] },
  } });
  const data = { contents: [
    row(videoId, [{ text: "Duran Duran", ...browse(artistId) }, { text: " • 417M views" }]),
    row(audioId, [{ text: "Duran Duran", ...browse(artistId) }, { text: " • " }, { text: "Rio", ...browse(albumId) }]),
  ] };
  const songs = parseRadio(data, "abcdefghijk");
  assert.deepEqual(songs.map((song) => song.videoId), [audioId]);
  assert.equal(songs[0].image, cover);
});
