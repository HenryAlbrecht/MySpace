const { test } = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../dist/music/music-model.js");
test("canonical IDs define identity; different providers and editions stay separate", () => {
  const song = {
    kind: "music",
    title: "Oops!...I Did It Again",
    artist: "Britney Spears",
    catalogId: "deezer:1",
  };
  assert.ok(
    !model.sameItem(song, {
      ...song,
      title: "Oops!…I Did It Again",
      catalogId: "lastfm:1",
    }),
  );
  assert.ok(model.sameItem(song, { ...song }));
  assert.ok(
    !model.sameItem(song, {
      ...song,
      title: song.title + " (live)",
      catalogId: "deezer:2",
    }),
  );
  assert.ok(
    !model.sameItem(song, {
      ...song,
      artist: "Cover Artist",
      catalogId: "deezer:3",
    }),
  );
});
