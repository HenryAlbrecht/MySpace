const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
test("missing YouTube recommendation photos remain blank", async () => {
  let resolved = 0;
  const row = {
    kind: "artist",
    title: "Artist",
    catalogId: "ytmusic:artist:UCrecovery123",
    source: "YouTube Music",
  };
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => {
        resolved++;
        return { items: [row] };
      },
    },
    lastfm: { recommendations: async () => ({ items: [row] }) },
  });
  assert.equal((await c.recommendations("artist", "Seed", "Seed")).items[0].image, undefined);
  assert.equal((await c.recommendations("artist", "Seed", "Seed")).items[0].image, undefined);
  assert.equal(resolved, 1);
});
test("homonymous YouTube artists keep separate entries without shared artwork", async () => {
  const catalog = createMusicCatalog({
    youtubeMusic: {
      search: async () => ({ items: [
        { kind: "artist", catalogId: "ytmusic:artist:UCfixtureartist123", title: "Frost" },
        { kind: "artist", catalogId: "ytmusic:artist:UCotherartist12345", title: "FROST" },
      ] }),
      searchTracks: async () => [],
    },
  });
  const result = await catalog.search("artist", "frost");
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((row) => !row.image && row.description.includes("homônimos")));
  assert.notEqual(result.items[0].catalogId, result.items[1].catalogId);
});
