const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pageRows, neighbour, peelGeometry } = require("../../dist/xmb/xmb-vita.js");
const Collection = require("../../dist/collection/collection.js");

test("Vita peel stays on a 45 degree diagonal in pixels, including beyond the bottom edge", () => {
  const rest = peelGeometry(1000, 500, 100);
  assert.match(rest.lifted, /900\.000px 0\.000px/);
  assert.match(rest.lifted, /1000\.000px 100\.000px/);
  const deep = peelGeometry(1000, 500, 800);
  assert.match(deep.lifted, /200\.000px 0\.000px/);
  assert.match(deep.lifted, /700\.000px 500\.000px/);
  assert.equal(deep.size, 800);
  assert.equal(peelGeometry(1000, 500, 2000).size, 1500);
});

test("Vita groups ten shortcuts in staggered 3/4/3 rows, including partial pages", () => {
  assert.deepEqual(pageRows(13, 0), [[0, 1, 2], [3, 4, 5, 6], [7, 8, 9]]);
  assert.deepEqual(pageRows(13, 1), [[10, 11, 12]]);
  assert.deepEqual(pageRows(13, -1), []);
  assert.deepEqual(pageRows(13, 2), []);
});

test("Vita directions preserve horizontal position between unequal rows and pages", () => {
  assert.equal(neighbour(13, 2, "down"), 6);
  assert.equal(neighbour(13, 6, "down"), 9);
  assert.equal(neighbour(13, 9, "down"), 12);
  assert.equal(neighbour(13, 12, "up"), 9);
  assert.equal(neighbour(13, 0, "up"), 0);
  assert.equal(neighbour(13, 3, "left"), 3);
  assert.equal(neighbour(13, 6, "right"), 6);
  assert.equal(neighbour(13, 12, "down"), 12);
});

test("Vita order survives Collection validation only for a valid game slot", () => {
  const item = { title: "Game", kind: "game", status: "planned", xmbVitaOrder: 0 };
  assert.equal(Collection.validateItem(item).xmbVitaOrder, 0);
  assert.equal(Collection.validateItem({ ...item, kind: "book" }).xmbVitaOrder, undefined);
  for (const value of [-1, 1.5, "0", Infinity])
    assert.equal(Collection.validateItem({ ...item, xmbVitaOrder: value }).xmbVitaOrder, undefined);
});
