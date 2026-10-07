// Presentation contracts: decode gates pixels; generations reject stale results.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function fixture() {
  const candidates = [];
  class Image {
    constructor() {
      this.dataset = {};
      this.style = {};
      this.naturalWidth = 1;
      candidates.push(this);
    }
    removeAttribute(name) {
      delete this[name];
    }
    decode() {
      return new Promise((resolve) => {
        this.finishDecode = resolve;
      });
    }
  }
  const context = { Image };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("dist/artwork.js", "utf8"), context);
  return { artwork: context.Artwork, image: new Image(), candidates };
}
test("first image reserves its box and keeps semantic alt while waiting for decode", async () => {
  const { artwork, image } = fixture();
  image.alt = "Artist";
  artwork.set(image, "first");
  assert.equal(image.style.visibility, "hidden");
  assert.equal(image.alt, "Artist");
  const loaded = image.onload();
  assert.equal(image.dataset.artworkState, "loading");
  image.finishDecode();
  await loaded;
  assert.equal(image.style.visibility, "");
  assert.equal(image.dataset.artworkState, "ready");
});
test("ready artwork survives rapid replacement and late decode never overwrites the latest", async () => {
  const { artwork, image, candidates } = fixture();
  image.src = "first";
  image.dataset.artworkReady = "true";
  artwork.set(image, "second");
  const second = candidates.at(-1);
  const secondLoaded = second.onload();
  artwork.set(image, "third");
  const third = candidates.at(-1);
  const thirdLoaded = third.onload();
  assert.equal(image.src, "first");
  third.finishDecode();
  await thirdLoaded;
  second.finishDecode();
  await secondLoaded;
  assert.equal(image.src, "third");
});
test("removing artwork invalidates pending decode and allows the same source again", async () => {
  const { artwork, image } = fixture();
  artwork.set(image, "first");
  const pending = image.onload();
  artwork.clear(image);
  image.finishDecode();
  await pending;
  assert.equal(image.dataset.artworkState, "empty");
  assert.equal(image.src, undefined);
  artwork.set(image, "first");
  assert.equal(image.dataset.artworkState, "loading");
  assert.equal(image.src, "first");
});
