const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");

test("namesake artist search keeps each YouTube photo without photo requests per result", async () => {
  let searches = 0;
  const rows = ["UCabcdefghijk", "UCbcdefghijkl"].map((id) => ({
    kind: "artist", catalogId: "ytmusic:artist:" + id, title: "Oasis",
    image: "https://lh3.googleusercontent.com/" + id,
  }));
  const catalog = createMusicCatalog({
    youtubeMusic: { search: async () => { searches++; return { items: structuredClone(rows) }; } },
    artistArtwork: { lookup: () => { throw Error("retired photo provider"); } },
  });
  const { items } = await catalog.search("artist", "Oasis");
  assert.equal(searches, 1);
  assert.deepEqual(items.map((row) => row.image), rows.map((row) => row.image));
  assert.ok(items.every((row) => row.description.includes(row.catalogId.split(":")[2])));
  assert.equal((await catalog.artistPhoto("Oasis", rows[0].catalogId)).image, rows[0].image);
  assert.equal((await catalog.artistPhoto("Oasis")).image, "", "ambiguous names have no guessed photo");
});
