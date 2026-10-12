const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const row = {
  title: "Song", artist: "Artist", album: "Album", duration: 210,
  videoId: "abcdefghijk", url: "https://music.youtube.com/watch?v=abcdefghijk", resultType: "song",
};
test("ambiguous music suggestions require selection and video candidates cannot win", async () => {
  const result = await createMusicCatalog({ youtubeMusic: { searchTracks: async () => [
    row,
    { ...row, videoId: "bcdefghijkl", url: "https://music.youtube.com/watch?v=bcdefghijkl" },
    { ...row, videoId: "cdefghijklm", url: "https://music.youtube.com/watch?v=cdefghijklm", resultType: "video" },
  ] } }).playbackSource("Song", "Artist", { album: "Album", duration: 210 });
  assert.equal(result.status, "choose");
  assert.equal(result.source, null);
  assert.deepEqual(result.items.map((item) => item.videoId), ["abcdefghijk", "bcdefghijkl"]);
});
