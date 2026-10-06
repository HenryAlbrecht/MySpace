const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicClient } = require("../server/music.cjs"),
  { createMusicCatalog } = require("../server/music-catalog.cjs");
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
                row.title === "Found"
                  ? "ytmusic:video:found000001"
                  : "ytmusic:video:failed00001",
            },
          ],
        };
      },
    },
  });
  const initial = await c.recommendations("music", "Artist", "Seed");
  assert.equal(initial.items.length, 1);
  assert.deepEqual(initial.resolution.causes, [
    { type: "rate-limit", httpStatus: 429 },
  ]);
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
test("Legacy Apple adapter diagnostics distinguish HTTP, network and timeout", async () => {
  for (const [fetcher, expected] of [
    [
      async () => ({ ok: false, status: 429 }),
      { type: "rate-limit", httpStatus: 429 },
    ],
    [
      async () => ({ ok: false, status: 503 }),
      { type: "http", httpStatus: 503 },
    ],
    [
      async () => {
        throw Error("offline");
      },
      { type: "network" },
    ],
    [
      async () => {
        const e = Error("timeout");
        e.name = "TimeoutError";
        throw e;
      },
      { type: "timeout" },
    ],
  ]) {
    const c = createMusicClient({ fetcher, recommendationInterval: 0 });
    await assert.rejects(
      c.resolveRecommendation({ kind: "artist", title: "Artist" }),
      (e) => {
        assert.deepEqual(e.providerFailure, expected);
        return true;
      },
    );
  }
});
test("Legacy Apple adapter recommendation requests are serialized and successful cache hits avoid another request", async () => {
  let active = 0,
    max = 0,
    calls = 0;
  const c = createMusicClient({
    recommendationInterval: 0,
    fetcher: async (url) => {
      calls++;
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      const title = new URL(url).searchParams.get("term");
      return {
        ok: true,
        json: async () => ({
          results: [{ artistId: title === "A" ? 1 : 2, artistName: title }],
        }),
      };
    },
  });
  await Promise.all(
    ["A", "B", "A"].map((title) =>
      c.resolveRecommendation({ kind: "artist", title }),
    ),
  );
  assert.equal(max, 1);
  assert.equal(calls, 2);
});
