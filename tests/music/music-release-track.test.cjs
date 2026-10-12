const test = require("node:test");
const assert = require("node:assert/strict");
const MusicModel = require("../../dist/music/music-model.js");
const audio = {
  kind: "music", title: "Ocean Avenue", artist: "Yellowcard",
  albumTitle: "Ocean Avenue", albumCatalogId: "ytmusic:album:MPREb_K4jlzSGylIm",
  catalogId: "ytmusic:video:LvyHVgocP_0", trackDuration: 199,
  playbackSource: { type: "youtube", videoId: "LvyHVgocP_0" },
};
const video = {
  ...audio, catalogId: "ytmusic:video:X9fLbfzCqWw", mediaType: "video",
  playbackSource: undefined, trackNumber: 3, albumArtist: "Yellowcard",
};
test("audio search and video-backed album row match one release position without changing identity", () => {
  const album = { albumTracks: [video] };
  assert.equal(MusicModel.sameItem(audio, video), false);
  assert.equal(MusicModel.findAlbumTrack(album, audio), video);
  assert.equal(MusicModel.findRecording([video], audio), video);
  assert.equal(MusicModel.findRecording([audio], video), audio);
  assert.equal(MusicModel.findAlbumTrack({ albumTracks: [video, { ...video, catalogId: "ytmusic:video:abcdefghijk" }] }, audio), null);
});
test("other editions, versions, artists and conflicting positions stay separate", () => {
  for (const patch of [
    { albumCatalogId: "ytmusic:album:MPREdifferent" }, { title: "Ocean Avenue (Acoustic)" },
    { artist: "Other Artist" }, { trackDuration: 230 }, { trackNumber: 4 },
  ]) {
    assert.equal(MusicModel.sameReleaseTrack({ ...audio, trackNumber: 3 }, { ...video, ...patch }), false);
  }
});
