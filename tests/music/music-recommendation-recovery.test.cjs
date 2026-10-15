const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
test("retry resolves only failed suggestions and shares concurrent recovery", async () => {
  const calls = [],
    rows = ["Found", "Missing", "Failed"].map((title) => ({
      kind: "music",
      title,
      artist: "Artist",
    }));
  let seeds = 0,
    fail = true;
  const c = createMusicCatalog({
    lastfm: {
      recommendations: async () => {
        seeds++;
        return { items: rows };
      },
    },
    youtubeMusic: {
      search: async (kind, query) => {
        const row = rows.find((row) => query === row.title + " " + row.artist);
        assert.equal(kind, "music");
        calls.push(row.title);
        if (row.title === "Missing") return { items: [] };
        if (row.title === "Failed" && fail) {
          const e = Error("limited");
          e.providerFailure = { type: "rate-limit", httpStatus: 429 };
          throw e;
        }
        return {
          items: [
            {
              ...row,
              catalogId:
                row.title === "Found" ? "ytmusic:video:found000001" : "ytmusic:video:failed00001",
            },
          ],
        };
      },
    },
  });
  const initial = await c.recommendations("music", "Artist", "Seed");
  assert.equal(initial.items.length, 1);
  assert.deepEqual(initial.resolution.causes, [{ type: "rate-limit", httpStatus: 429 }]);
  fail = false;
  const [a, b] = await Promise.all([
    c.recommendations("music", "Artist", "Seed"),
    c.recommendations("music", "Artist", "Seed"),
  ]);
  assert.equal(a.items.length, 2);
  assert.equal(b.items.length, 2);
  assert.equal(seeds, 1);
  assert.deepEqual(calls, ["Found", "Missing", "Failed", "Failed"]);
  await c.recommendations("music", "Artist", "Seed");
  assert.equal(calls.length, 4);
});
