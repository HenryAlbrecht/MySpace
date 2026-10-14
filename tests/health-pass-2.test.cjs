const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
function discovery(fetcher) {
  const context = { Catalog: {}, fetch: fetcher, URLSearchParams };
  vm.runInNewContext(fs.readFileSync("dist/catalog/catalog-discovery.js", "utf8"), context);
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
        items: [{ kind: "music", catalogId: "ytmusic:video:10z6-vQm23w" }],
        resolution: { total: 6 },
      }),
    };
  });
  const item = { kind: "music", catalogId: "ytmusic:video:dQw4w9WgXcQ", title: "Seed" };
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
                catalogId: "ytmusic:video:" + String(i + 2).padStart(11, "0"),
              })),
              resolution: { total: url.includes("reserve=1") ? 12 : 6 },
              reserveAvailable: true,
            }),
          }),
        ),
      ),
  );
  const item = { kind: "music", catalogId: "ytmusic:video:dQw4w9WgXcQ", title: "Seed" };
  const first = c.recommendations(item),
    more = c.recommendations(item, { reserve: true });
  releases[1]();
  await more;
  releases[0]();
  await first;
  assert.equal((await c.recommendations(item)).length, 12);
});
