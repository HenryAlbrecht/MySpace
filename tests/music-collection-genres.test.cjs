const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const MusicModel = require("../dist/music-model.js"),
  scope = { window: {}, MusicModel };
vm.runInNewContext(fs.readFileSync("dist/music-page-ui.js", "utf8"), scope);
const match = scope.window.MusicPageUI.collectionGenreMatches;
const item = (id, genres, extra = {}) => ({
  kind: "music",
  catalogId: "ytmusic:video:" + id,
  title: id,
  genres,
  ...extra,
});
test("unique exact normalized genres rank music and exclude current/different kinds", () => {
  const current = item("current0001", [" Shoegaze ", "ＤＲＥＡＭ POP", "rock"]);
  const a = item("matching001", ["shoegaze", "dream pop", "rock", "rock"]),
    b = item("matching002", ["shoegaze"]),
    c = item("matching003", ["indie"]);
  assert.deepEqual(
    Array.from(match(current, [b, c, a, current, { ...a, kind: "artist" }]), (row) => row.title),
    [a.title, b.title],
  );
  assert.equal(match(item("empty000001", []), [a]).length, 0);
});
test("ties use featured then score then updated; artists and mixed releases match", () => {
  for (const kind of ["artist", "album"]) {
    const current = item("current0001", ["rock"], { kind }),
      rows = [
        item("matching001", ["rock"], {
          kind,
          albumType: "album",
          score: 5,
          updated: 2,
        }),
        item("matching002", ["rock"], {
          kind,
          albumType: "ep",
          featured: true,
        }),
        item("matching003", ["rock"], {
          kind,
          albumType: "single",
          score: 5,
          updated: 3,
        }),
      ];
    assert.deepEqual(
      Array.from(match(current, rows), (row) => row.title),
      ["matching002", "matching003", "matching001"],
    );
  }
});
