const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const Collection = require("../../dist/collection.js");
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
class Storage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
const storage = new Storage(),
  children = [];
const element = () => ({
  children: [],
  append(...nodes) {
    this.children.push(...nodes);
  },
  setAttribute() {},
});
const session = new Storage();
const context = {
  localStorage: storage,
  sessionStorage: session,
  document: {
    createElement: element,
    body: {
      append(node) {
        children.push(node);
      },
    },
  },
  setTimeout,
  clearTimeout,
  location: {
    reload() {
      context.reloaded = true;
    },
  },
  addEventListener() {},
};
context.window = context;
storage.setItem("myspace-extras-v1", JSON.stringify({ items: [base], featuredVideo: {} }));
storage.setItem("secret", "private");
vm.runInNewContext(fs.readFileSync("dist/undo.js", "utf8"), context);
(async () => {
  storage.setItem("myspace-extras-v1", JSON.stringify({ items: [], featuredVideo: {} }));
  storage.setItem("myspace.titleCover:game:1", "https://example.com/new.jpg");
  await new Promise((resolve) => setTimeout(resolve, 10));
  children[0].children[0].onclick();
  assert.equal(JSON.parse(storage.getItem("myspace-extras-v1")).items.length, 1);
  assert.equal(storage.getItem("myspace.titleCover:game:1"), null);
  assert.equal(storage.getItem("secret"), "private");
  assert.equal(context.reloaded, true);
  storage.setItem("myspace.titleCover:game:1", "https://example.com/first.jpg");
  await new Promise((resolve) => setTimeout(resolve, 10));
  storage.setItem("myspace.titleCover:game:1", "https://example.com/second.jpg");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(context.Undo.count(), 2);
  children[0].children[0].onclick();
  assert.equal(storage.getItem("myspace.titleCover:game:1"), "https://example.com/first.jpg");
  assert.equal(JSON.parse(session.getItem("myspace-undo-session")).length, 1);
  const reloadedStorage = new Storage();
  reloadedStorage.values = storage.values;
  const reloadedNodes = [];
  const reloaded = {
    ...context,
    localStorage: reloadedStorage,
    document: {
      createElement: element,
      body: {
        append(node) {
          reloadedNodes.push(node);
        },
      },
    },
  };
  reloaded.window = reloaded;
  vm.runInNewContext(fs.readFileSync("dist/undo.js", "utf8"), reloaded);
  assert.equal(reloaded.Undo.count(), 1);
  reloadedNodes[0].children[0].onclick();
  assert.equal(storage.getItem("myspace.titleCover:game:1"), null);
  assert.equal(reloaded.Undo.count(), 0);
  context.Undo.clear();
  storage.setItem(
    "myspace-extras-v1",
    JSON.stringify({ items: [], featuredVideo: { localId: "new" } }),
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(children[0].hidden, true);
  const Catalog = require("../../dist/catalog.js");
  const fetcher = async (url) => ({
    ok: true,
    json: async () =>
      url.includes("/search?")
        ? {
            items: [
              {
                kind: "music",
                catalogId: "deezer:101",
                title: "Duvet",
                artist: "bôa",
                artistCatalogId: "deezer:742",
                source: "Deezer",
              },
            ],
          }
        : {
            kind: "artist",
            catalogId: "deezer:742",
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
  console.log("Controles pessoais: datas, filtros, desfazer e busca contextual OK.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
