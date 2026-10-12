const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const Catalog = require("../../dist/catalog/catalog.js");
const MusicModel = require("../../dist/music/music-model.js");

test("retired catalog APIs reject remote lookup while saved legacy items remain readable", async () => {
  const forbidden = () => { throw Error("no provider should run"); };
  const catalog = createMusicCatalog({
    itunes: { search: forbidden, details: forbidden },
    youtubeMusic: { search: forbidden, details: forbidden },
  });
  for (const kind of ["music", "album", "artist"]) {
    await assert.rejects(catalog.search(kind, "Saved title", "itunes"), { status: 400 });
    await assert.rejects(catalog.details(kind, "123"), { status: 410 });
    const row = { kind, catalogId: "itunes:123", title: "Saved title", image: "saved-art" };
    assert.deepEqual(await Catalog.details(row, { fetcher: forbidden }), row);
    assert.equal(MusicModel.validCatalogId(kind, row.catalogId), true);
  }
});
