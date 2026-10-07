const assert = require("node:assert/strict"),
  Catalog = require("../dist/catalog.js");
global.Catalog = Catalog;
require("../dist/catalog-discovery.js");
(async () => {
  const seeds = [
    {
      kind: "game",
      catalogId: "igdb:1",
      title: "Favorite game",
      featured: true,
    },
    { kind: "music", catalogId: "deezer:1", title: "Song" },
    { kind: "book", catalogId: "ol:1", title: "Unavailable book" },
  ];
  const steps = [];
  const result = await Catalog.forCollection(seeds, {
    progress: (done, total) => steps.push([done, total]),
    recommend: async (seed) => {
      if (seed.kind === "book") throw Error("Offline");
      return [
        { kind: "game", catalogId: "igdb:1", title: "Already saved" },
        {
          kind: seed.kind,
          catalogId: seed.kind + ":2",
          title: "New discovery",
        },
        { kind: seed.kind, catalogId: seed.kind + ":2", title: "Duplicate" },
      ];
    },
  });
  assert.equal(result.items.length, 2);
  assert.equal(result.failures, 1);
  assert.equal(result.seeds, 3);
  assert.ok(result.items[0].reason.includes("favoritou Favorite game"));
  assert.equal(steps.at(-1)[0], 3);
  assert.equal((await Catalog.forCollection([])).items.length, 0);
  const recommend = async () =>
    Array.from({ length: 18 }, (_, index) => ({
      kind: "game",
      catalogId: "igdb:" + (index + 10),
      title: "Suggestion " + index,
      source: "IGDB",
    }));
  const first = await Catalog.forCollection([seeds[0]], {
    recommend,
    rotation: 0,
  });
  const rotated = await Catalog.forCollection([seeds[0]], {
    recommend,
    rotation: 1,
  });
  assert.notEqual(first.items[0].catalogId, rotated.items[0].catalogId);
  assert.ok(rotated.items[0].reason.includes("IGDB"));
  const origins = [
    { kind: "game", catalogId: "igdb:101", title: "Burnout 3", featured: true },
    { kind: "game", catalogId: "igdb:102", title: "Sol Trigger" },
  ];
  const blended = await Catalog.forCollection(origins, {
    kind: "game",
    recommend: async (seed) =>
      Array.from({ length: 8 }, (_, index) => ({
        kind: "game",
        catalogId: "igdb:" + seed.catalogId.split(":")[1] + "-" + index,
        title: seed.title + " " + index,
        source: "IGDB",
      })),
  });
  assert.deepEqual(
    blended.items.slice(0, 6).map((item) => item.seedTitle),
    ["Burnout 3", "Sol Trigger", "Burnout 3", "Sol Trigger", "Burnout 3", "Sol Trigger"],
  );
  const targeted = await Catalog.forCollection(
    [
      ...origins,
      ...["music", "anime", "manga", "book", "artist", "album"].map((kind, index) => ({
        kind,
        catalogId: kind + ":" + index,
        title: kind,
      })),
    ],
    {
      kind: "game",
      recommend: async (seed) => [
        {
          kind: "game",
          catalogId: "igdb:other-" + seed.catalogId,
          title: "Another game",
        },
      ],
    },
  );
  assert.equal(targeted.seeds, 2);
  assert.deepEqual(
    targeted.items.map((item) => item.seedTitle),
    ["Burnout 3", "Sol Trigger"],
  );
  let seedCalls = 0,
    active = true;
  const partial = [];
  await Catalog.forCollection(origins, {
    shouldContinue: () => active,
    partial: (rows) => {
      partial.push(rows);
      active = false;
    },
    recommend: async () => {
      seedCalls++;
      return [{ kind: "game", catalogId: "igdb:999", title: "New" }];
    },
  });
  assert.equal(seedCalls, 1);
  assert.equal(partial[0].length, 1);
  console.log(
    "Personalized discovery: favorites, mixed categories, balanced seeds, explanations, duplicates and partial failures OK.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
