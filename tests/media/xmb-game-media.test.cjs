const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGameMediaSearch } = require("../../server/media/xmb-game-media.cjs");

test("media picker searches YouTube directly and returns selectable videos without yt-dlp", async () => {
  const calls = [];
  const search = createGameMediaSearch({
    music: { async search() { return { items: [] }; } },
    youtube: {
      async search(query, limit) {
        calls.push({ query, limit });
        return {
          provider: "YouTube",
          items: [
            {
              id: "abcdefghijk",
              title: "Persona 3 Reload Opening",
              channel: "Atlus",
              thumbnail: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
            },
            { id: "invalid", title: "Ignored" },
            { id: "abcdefghijk", title: "Duplicate" },
          ],
        };
      },
    },
    canDownload: () => false,
  });

  const result = await search.searchOptions("Persona 3 Reload", "video");

  assert.deepEqual(calls, [{ query: "Persona 3 Reload", limit: 50 }]);
  assert.equal(result.source, "YouTube");
  assert.deepEqual(result.items, [
    {
      id: "abcdefghijk",
      kind: "video",
      title: "Persona 3 Reload Opening",
      artist: "Atlus",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      thumbnail: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
      source: "YouTube",
      downloadAllowed: false,
    },
  ]);
});
