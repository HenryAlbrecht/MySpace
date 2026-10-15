const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
test("reserve is bounded and incremental, retains editions and does not resolve old successes again", async () => {
  let seeds = 0;
  const calls = [];
  const rows = Array.from({ length: 48 }, (_, i) => ({
    kind: "album",
    title: i === 25 ? "Album (Remastered)" : "Album " + i,
    artist: "Artist",
    catalogId: "ytmusic:album:MPREreserve" + (i + 1),
  }));
  const c = createMusicCatalog({
    lastfm: {
      recommendations: async () => {
        seeds++;
        return { items: rows };
      },
    },
    youtubeMusic: {
      search: async (kind, query) => {
        assert.equal(kind, "album");
        const row = rows.find((row) => query === row.title + " " + row.artist);
        calls.push(row.catalogId);
        return { items: rows.indexOf(row) < 20 ? [] : [row] };
      },
    },
  });
  const initial = await c.recommendations("album", "Artist", "Seed");
  assert.equal(initial.items.length, 0);
  assert.equal(calls.length, 6);
  assert.equal(initial.reserveAvailable, true);
  await c.recommendations("album", "Artist", "Seed", { reserve: true });
  await c.recommendations("album", "Artist", "Seed", { reserve: true });
  const first = await c.recommendations("album", "Artist", "Seed", {
    reserve: true,
  });
  assert.equal(first.items.length, 4);
  assert.equal(calls.length, 24);
  assert.equal(first.reserveAvailable, true);
  const more = await c.recommendations("album", "Artist", "Seed", {
    reserve: true,
  });
  assert.equal(more.items.length, 10);
  assert.equal(calls.length, 30);
  assert.ok(more.items.some((r) => r.title === "Album (Remastered)"));
  assert.deepEqual(more.items.slice(0, 4), first.items);
  await c.recommendations("album", "Artist", "Seed", { reserve: true });
  assert.equal(calls.length, 36);
  assert.equal(seeds, 1);
  await c.recommendations("album", "Artist", "Seed");
  assert.equal(calls.length, 36);
});
