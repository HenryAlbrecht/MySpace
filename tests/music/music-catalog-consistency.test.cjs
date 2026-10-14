const { test } = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../dist/music/music-model.js");
test("canonical IDs define identity; distinct catalog entries and editions stay separate", () => {
  const song = {
    kind: "music",
    title: "Oops!...I Did It Again",
    artist: "Britney Spears",
    catalogId: "ytmusic:video:dQw4w9WgXcQ",
  };
  assert.ok(
    !model.sameItem(song, {
      ...song,
      title: "Oops!…I Did It Again",
      catalogId: "ytmusic:video:abcdefghijk",
    }),
  );
  assert.ok(model.sameItem(song, { ...song }));
  assert.ok(
    !model.sameItem(song, {
      ...song,
      title: song.title + " (live)",
      catalogId: "ytmusic:video:10z6-vQm23w",
    }),
  );
  assert.ok(
    !model.sameItem(song, {
      ...song,
      artist: "Cover Artist",
      catalogId: "ytmusic:video:LnOts74hPhU",
    }),
  );
});
