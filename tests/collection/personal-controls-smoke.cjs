const assert = require("node:assert/strict");
const Collection = require("../../dist/collection/collection.js");
const base = {
  title: "Teste",
  kind: "game",
  status: "active",
  progress: 2,
  total: 10,
};
assert.equal(
  Collection.validateItem({
    ...base,
    startedAt: "2026-09-01",
    finishedAt: "2026-09-27",
  }).finishedAt,
  "2026-09-27",
);
assert.throws(() => Collection.validateItem({ ...base, startedAt: "2026-02-30" }));
assert.throws(() =>
  Collection.validateItem({
    ...base,
    startedAt: "2026-09-27",
    finishedAt: "2026-09-01",
  }),
);
assert.equal(
  Collection.filterItems(
    [
      { ...base, featured: true, notes: "Meu comentário" },
      { ...base, featured: false },
    ],
    { featured: true, query: "comentario" },
  ).length,
  1,
);
const listed = Collection.validateItem({
  ...base,
  lists: "Amigos, Amigos, Clássicos",
  genres: ["RPG"],
  platforms: ["PC"],
  releaseDate: "2024-02-01",
});
assert.deepEqual(listed.lists, ["Amigos", "Clássicos"]);
assert.equal(
  Collection.filterItems([listed], {
    list: "Amigos",
    genre: "RPG",
    platform: "PC",
    year: "2024",
  }).length,
  1,
);
assert.equal(Collection.filterItems([listed], { year: "2023" }).length, 0);
(async () => {
  const Catalog = require("../../dist/catalog/catalog.js");
  const fetcher = async (url) => ({
    ok: true,
    json: async () =>
      url.includes("/search?")
        ? {
            items: [
              {
                kind: "music",
                catalogId: "ytmusic:video:dQw4w9WgXcQ",
                title: "Duvet",
                artist: "bôa",
                artistCatalogId: "ytmusic:artist:UCXExK7We8VKsIzFFQYNEgBg",
                source: "YouTube Music",
              },
            ],
          }
        : {
            kind: "artist",
            catalogId: "ytmusic:artist:UCXExK7We8VKsIzFFQYNEgBg",
            title: "bôa",
            image: "https://example.com/artist.jpg",
          },
  });
  const artists = await Catalog.search("artist", "Duvet", {
    context: "song",
    fetcher,
  });
  assert.equal(artists[0].title, "bôa");
  assert.equal(artists[0].image, "https://example.com/artist.jpg");
  let queried = "";
  await Catalog.search("book", "Kafka", {
    context: "author",
    fetcher: async (url) => {
      queried = url;
      return { ok: true, json: async () => ({ docs: [] }) };
    },
  });
  assert.equal(new URL(queried).searchParams.get("q"), "author:Kafka");
  console.log("Controles pessoais: datas, filtros e busca contextual OK.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
