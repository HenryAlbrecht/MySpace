const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const storage = new Map();
const context = {
  window: {},
  localStorage: {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  safeUrl: (value) => (/^(https?:|data:image\/)/.test(value || "") ? value : ""),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("dist/title/title-banner.js", "utf8"), context);
const banner = context.window.TitleBanner;
const first = { catalogId: "igdb:1" },
  second = { catalogId: "igdb:2" };
storage.set("myspace.titleBanner:igdb:1", "https://example.com/legacy.jpg");
assert.equal(banner.get(first).image, "https://example.com/legacy.jpg");
banner.setImage(first, "data:image/jpeg;base64,abc");
assert.equal(banner.get(first).image, "data:image/jpeg;base64,abc");
assert.equal(banner.get(second).image, "");
storage.set(
  "myspace.titleBannerSettings:igdb:1",
  JSON.stringify({ image: "", height: 999, zoom: 0, x: -20, y: 120 }),
);
const settings = banner.get(first);
assert.equal(settings.image, "", "An explicit original image must override the legacy selection");
assert.equal(settings.height, 600);
assert.equal(settings.zoom, 1);
assert.equal(settings.x, 0);
assert.equal(settings.y, 100);
const hero = { style: {} },
  image = { style: {} };
banner.apply(hero, image, settings);
assert.equal(hero.style.height, "600px");
assert.equal(image.style.objectPosition, "0% 100%");
banner.setImage({ id: "manual-one" }, "https://example.com/local.jpg");
assert.equal(banner.get({ id: "manual-two" }).image, "");
banner.reset(first);
assert.equal(banner.get(first).image, "");
assert.equal(banner.get(first).height, 300);
console.log("Title banner preferences smoke passed");
