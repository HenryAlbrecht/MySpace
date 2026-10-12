const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const MusicModel = require("../../dist/music/music-model.js"),
  { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const scope = { window: {}, MusicModel };
vm.runInNewContext(fs.readFileSync("dist/music/music-page-ui.js", "utf8"), scope);
const { recommendationWindow: select, recommendationKey: key } = scope.window.MusicPageUI;
const rows = (kind, type, count = 24) =>
  Array.from({ length: count }, (_, i) => ({
    kind,
    catalogId:
      (kind === "music"
        ? "ytmusic:video:"
        : kind === "artist"
          ? "ytmusic:artist:UC"
          : "ytmusic:album:MPRE") +
      "fixture" +
      String(i).padStart(4, "0"),
    title: "Candidate " + i,
    artist: "Artist " + i,
    albumType: type,
  }));
for (const [kind, type] of [
  ["music"],
  ["artist"],
  ["album", "album"],
  ["album", "ep"],
  ["album", "single"],
])
  test(
    kind + " " + (type || "") + " saved soft quota and deterministic significant rotation",
    () => {
      const pool = rows(kind, type, 20),
        saved = pool.slice(0, 5),
        visible = select(pool, { saved });
      assert.equal(visible.length, 12);
      assert.equal(visible.filter((row) => saved.includes(row)).length, 2);
      const seen = new Set(visible.map(key)),
        next = select(pool, {
          saved,
          visible,
          seen,
          rotate: true,
          rotation: 1,
        });
      assert.equal(next.length, 12);
      assert.ok(next.filter((row) => !seen.has(key(row))).length >= 6);
      assert.ok(next.filter((row) => saved.includes(row)).length <= 2);
      assert.deepEqual(
        Array.from(select(pool, { saved, visible, seen, rotate: true, rotation: 1 }), key),
        Array.from(next, key),
      );
      assert.equal(select(pool.slice(0, 2), { saved: pool.slice(0, 2) }).length, 2);
      if (type) assert.ok(next.every((row) => row.albumType === type));
    },
  );
test("24 candidate reserve changes eight of twelve while keeping four anchors", () => {
  const pool = rows("music"),
    first = select(pool),
    seen = new Set(first.map(key)),
    second = select(pool, { visible: first, seen, rotate: true, rotation: 1 });
  assert.equal(second.filter((row) => seen.has(key(row))).length, 4);
  assert.equal(second.filter((row) => !seen.has(key(row))).length, 8);
});
test("larger local backend pools reuse upstream requests and leave default/global size untouched", async () => {
  const candidates = rows("music"),
    artists = rows("artist"),
    releases = rows("album", "ep");
  let radio = 0,
    details = 0;
  const catalog = createMusicCatalog({
    youtubeMusic: {
      radio: async () => {
        radio++;
        return { items: candidates };
      },
      details: async (kind, id) => {
        details++;
        return kind === "artist"
          ? { relatedArtists: artists }
          : {
              kind: "album",
              title: "Seed",
              catalogId: "ytmusic:album:" + id,
              artist: "Seed artist",
              albumType: "ep",
              relatedAlbums: releases,
            };
      },
      peek: () => null,
    },
  });
  assert.equal(
    (
      await catalog.recommendations("music", "Seed artist", "Seed", {
        videoId: "seed0000001",
      })
    ).items.length,
    12,
  );
  assert.equal(
    (
      await catalog.recommendations("music", "Seed artist", "Seed", {
        videoId: "seed0000001",
        localPool: true,
      })
    ).items.length,
    24,
  );
  assert.equal(radio, 2);
  assert.equal(
    (
      await catalog.recommendations("artist", "Seed", "Seed", {
        artistId: "UCseedartist123",
        localPool: true,
      })
    ).items.length,
    24,
  );
  assert.equal(
    (
      await catalog.recommendations("album", "Seed artist", "Seed", {
        albumId: "MPREseedalbum123",
        localPool: true,
      })
    ).items.length,
    24,
  );
  assert.equal(details, 2, "no extra artist/release detail expansion");
});
