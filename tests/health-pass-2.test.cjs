const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { createArtistArtworkClient } = require("../server/music/artist-artwork.cjs");
test("different Apple evidence shares Deezer candidate and top-track requests", async () => {
  const calls = [];
  const c = createArtistArtworkClient({
    fetcher: async (url) => {
      calls.push(url);
      await new Promise((r) => setTimeout(r, 1));
      return {
        ok: true,
        json: async () =>
          url.includes("/search/")
            ? {
                data: [
                  {
                    id: 1,
                    name: "Artist",
                    picture_xl: "https://cdn-images.dzcdn.net/photo.jpg",
                  },
                ],
              }
            : {
                data: ["One", "Two", "Three"].map((title) => ({
                  title,
                  artist: { name: "Artist" },
                })),
              },
      };
    },
  });
  const photos = await Promise.all([
    c.lookup("Artist", { tracks: ["One", "Two"], verify: true }),
    c.lookup("Artist", { tracks: ["One", "Two", "Three"], verify: true }),
  ]);
  assert.ok(photos.every(Boolean));
  assert.equal(calls.length, 2);
});
function discovery(fetcher) {
  const context = { Catalog: {}, fetch: fetcher, URLSearchParams };
  vm.runInNewContext(fs.readFileSync("dist/catalog-discovery.js", "utf8"), context);
  return context.Catalog;
}
test("equivalent default recommendation requests share a fetch", async () => {
  let calls = 0,
    release;
  const gate = new Promise((r) => (release = r));
  const c = discovery(async () => {
    calls++;
    await gate;
    return {
      ok: true,
      json: async () => ({
        items: [{ kind: "music", catalogId: "itunes:2" }],
        resolution: { total: 6 },
      }),
    };
  });
  const item = { kind: "music", catalogId: "itunes:1", title: "Seed" };
  const a = c.recommendations(item),
    b = c.recommendations(item);
  assert.equal(calls, 1);
  release();
  await Promise.all([a, b]);
  await c.recommendations(item);
  assert.equal(calls, 1);
});
test("older small recommendation response cannot replace a newer larger cached result", async () => {
  const releases = [];
  const c = discovery(
    (url) =>
      new Promise((resolve) =>
        releases.push(() =>
          resolve({
            ok: true,
            json: async () => ({
              items: Array.from({ length: url.includes("reserve=1") ? 12 : 6 }, (_, i) => ({
                kind: "music",
                catalogId: "itunes:" + (i + 2),
              })),
              resolution: { total: url.includes("reserve=1") ? 12 : 6 },
              reserveAvailable: true,
            }),
          }),
        ),
      ),
  );
  const item = { kind: "music", catalogId: "itunes:1", title: "Seed" };
  const first = c.recommendations(item),
    more = c.recommendations(item, { reserve: true });
  releases[1]();
  await more;
  releases[0]();
  await first;
  assert.equal((await c.recommendations(item)).length, 12);
});
