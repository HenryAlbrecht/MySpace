const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  model = require("../../dist/music/music-model.js");
test("discovery work matching omits alternate album appearances without merging identities or versions", () => {
  const saved = {
    kind: "music",
    title: "iPod Touch",
    artist: "Ninajirachi",
    catalogId: "ytmusic:video:dQw4w9WgXcQ",
  };
  assert.equal(model.sameWork(saved, { ...saved, catalogId: "ytmusic:video:10z6-vQm23w" }), true);
  assert.equal(model.sameItem(saved, { ...saved, catalogId: "ytmusic:video:10z6-vQm23w" }), false);
  assert.equal(
    model.sameWork(saved, {
      ...saved,
      catalogId: "ytmusic:video:LnOts74hPhU",
      title: "iPod Touch (Live)",
    }),
    false,
  );
  assert.equal(
    model.sameWork(saved, { ...saved, catalogId: "ytmusic:video:10z6-vQm23w", artist: "Other" }),
    false,
  );
});
