const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const stored = new Map();
const sessionStorage = {
  getItem: (key) => stored.get(key) || null,
  setItem: (key, value) => stored.set(key, value),
};
const create = () => {
  const context = {
    window: { sessionStorage },
    URL,
    URLSearchParams,
    AbortController,
  };
  vm.runInNewContext(fs.readFileSync("dist/catalog.js", "utf8"), context);
  return context.window.Catalog;
};
(async () => {
  let calls = 0;
  const item = { kind: "artist", catalogId: "deezer:10101" };
  const fetcher = async () => ({
    ok: true,
    json: async () => ({
      kind: "artist",
      catalogId: item.catalogId,
      title: "Cached artist " + ++calls,
      image: "https://example.com/artist.jpg",
    }),
  });
  await create().details(item, { fetcher });
  assert.equal(calls, 1);
  const restored = create();
  assert.equal((await restored.details(item, { fetcher })).title, "Cached artist 1");
  assert.equal(calls, 1);
  await restored.details(item, { fetcher, force: true });
  assert.equal(calls, 2);
  const rows = JSON.parse(stored.get("myspace-catalog-session"));
  rows[0].at = Date.now() - 20 * 60 * 1000;
  stored.set("myspace-catalog-session", JSON.stringify(rows));
  await create().details(item, { fetcher });
  assert.equal(calls, 3);
  console.log(
    "Cache de detalhes: reaproveitamento entre páginas, atualização forçada e expiração OK.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
