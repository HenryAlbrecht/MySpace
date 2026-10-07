"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
module.exports = async function ({
  page,
  np,
  toggle,
  settled,
  testArtifacts
}) {
  // Artwork-only palette, real local canvas samples, no remote provider.
  await page.evaluate(() => {
    const make = (a, b) => {
      const c = document.createElement("canvas");
      c.width = c.height = 80;
      const ctx = c.getContext("2d");
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, 80, 80);
      ctx.fillStyle = b;
      ctx.fillRect(45, 0, 35, 80);
      return c.toDataURL();
    };
    window.__art = [make("#bd653a", "#834b3e"), make("#396fa8", "#344d7e"), make("#558652", "#374e40")];
    window.__artIndex = 0;
    window.__globalTheme = document.documentElement.style.cssText;
    window.__changeArt = index => {
      __artIndex = index;
      SPACEAMP.update({
        title: "Palette " + index,
        artist: "Local fixture",
        source: "local",
        sourceUrl: "local-" + index,
        artwork: __art[index]
      }, true, {
        available: true
      });
    };
    SPACEAMP.setNavigation({
      next: () => __changeArt(1),
      previous: () => __changeArt(0),
      ended: () => __changeArt(2)
    });
    __changeArt(0);
    SpaceAmpNowPlaying.open();
  });
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.palette === "artwork");
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp");
  await settled();
  const warm = await np.evaluate(n => n.style.getPropertyValue("--np-accent"));
  const warmBackground = await np.evaluate(n => getComputedStyle(n).backgroundColor);
  assert.ok(Number(warm.match(/ (\d+)%/)[1]) <= 68);
  const stableBox = await page.locator(".np-artwork").boundingBox();
  await page.getByRole("button", {
    name: "Próxima",
    exact: true
  }).click();
  await page.waitForFunction(warm => document.querySelector("#spaceampNowPlaying").style.getPropertyValue("--np-accent") !== warm, warm);
  assert.equal(await page.locator("am-lyrics").getAttribute("song-title"), "Palette 1");
  await settled();
  assert.deepEqual(await page.locator(".np-artwork").boundingBox(), stableBox);
  assert.notEqual(await np.evaluate(n => getComputedStyle(n).backgroundColor), warmBackground);
  assert.equal(await page.locator(".np-outgoing").count(), 0);
  await page.getByRole("button", {
    name: "Anterior",
    exact: true
  }).click();
  await page.waitForFunction(warm => document.querySelector("#spaceampNowPlaying").style.getPropertyValue("--np-accent") === warm, warm);
  await page.evaluate(() => SPACEAMP.finished());
  await page.waitForFunction(() => document.querySelector("am-lyrics").getAttribute("song-title") === "Palette 2");
  await settled();
  assert.equal(await np.getAttribute("data-palette"), "artwork");
  assert.equal(await page.evaluate(() => document.documentElement.style.cssText), await page.evaluate(() => __globalTheme));
  // A tainted/readback failure resets only local visual tokens; transport stays live.
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.getImageData;
    window.__restoreReadback = () => {
      CanvasRenderingContext2D.prototype.getImageData = original;
    };
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      if (this.canvas.width === 32) throw new DOMException("Fixture CORS", "SecurityError");
      return original.apply(this, args);
    };
    SPACEAMP.update({
      ...SPACEAMP.getState(),
      title: "Readback fallback",
      artwork: __art[0] + "#fallback"
    }, true);
  });
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.palette === "fallback");
  assert.equal(await np.evaluate(n => n.style.getPropertyValue("--np-accent")), "");
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
  await page.evaluate(() => {
    __restoreReadback();
    __changeArt(0);
    __changeArt(1);
    __changeArt(2);
  });
  await page.waitForFunction(() => document.querySelector(".np-cover").getAttribute("src") === __art[2] && document.querySelector("#spaceampNowPlaying").dataset.palette === "artwork");
  await settled();
  assert.equal(await page.locator(".np-outgoing").count(), 0);
  await page.evaluate(() => SPACEAMP.update({
    ...SPACEAMP.getState(),
    title: "SPACEAMP · Atmosphere",
    artist: "Artwork fixture",
    artwork: "profile-art.png"
  }, true));
  await page.waitForFunction(() => document.querySelector(".np-cover").getAttribute("src") === "profile-art.png" && document.querySelector("#spaceampNowPlaying").dataset.palette === "artwork");
  // Character color must survive a largely neutral/skin-toned base; tiny highlights do not count.
  await page.evaluate(() => {
    const make = (base, accent, neutral = false) => {
      const c = document.createElement("canvas");
      c.width = c.height = 80;
      const x = c.getContext("2d");
      x.fillStyle = base;
      x.fillRect(0, 0, 80, 80);
      x.fillStyle = neutral ? "#a0a0a0" : "#b69a89";
      x.fillRect(0, 40, 32, 40);
      x.fillStyle = accent;
      x.fillRect(50, 10, neutral ? 2 : 22, neutral ? 2 : 60);
      return c.toDataURL();
    };
    window.__atmosphereFixtures = [make("#777777", "#ce397d"), make("#287fab", "#246197"), make("#398964", "#235b49"), make("#747474", "#ff00ff", true)];
  });
  const families = [];
  for (const [index, name] of ["pink-character", "blue", "green", "neutral"].entries()) {
    await page.evaluate(index => SPACEAMP.update({
      ...SPACEAMP.getState(),
      title: "Atmosphere " + index,
      artwork: __atmosphereFixtures[index]
    }, true), index);
    await page.waitForFunction(index => document.querySelector(".np-cover").getAttribute("src") === __atmosphereFixtures[index], index);
    await page.waitForFunction(index => {
      const root = document.querySelector("#spaceampNowPlaying");
      const cover = document.querySelector(".np-cover");
      return cover.dataset.artworkReady === "true" && root.dataset.palette === (index < 3 ? "artwork" : "fallback");
    }, index);
    await settled();
    const tokens = await np.evaluate(n => ["--np-accent", "--np-bg-tint", "--np-bg-deep"].map(k => n.style.getPropertyValue(k)));
    if (index < 3) {
      assert.equal(await np.getAttribute("data-palette"), "artwork");
      families.push(tokens[0]);
      assert.ok(Number(tokens[0].match(/ (\d+)%/)[1]) >= 35);
    } else {
      assert.equal(await np.getAttribute("data-palette"), "fallback");
      assert.deepEqual(tokens, ["", "", ""]);
    }
    if (index === 0) {
      const hue = Number(tokens[0].match(/hsl\((\d+)/)[1]);
      assert.ok(hue >= 300 || hue <= 35, "neutral base must not suppress the pink character");
    }
    for (const enabled of [true, false]) {
      if ((await toggle.getAttribute("aria-pressed")) !== String(enabled)) await toggle.click();
      await settled();
      await page.screenshot({
        path: path.join(testArtifacts, `${name}-lyrics-${enabled ? "on" : "off"}.png`)
      });
    }
  }
  assert.equal(new Set(families).size, 3);
  // Hold only the palette image's load handler: the previous color must remain intact.
  await page.evaluate(() => SPACEAMP.update({
    ...SPACEAMP.getState(),
    artwork: __atmosphereFixtures[2]
  }, true));
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.palette === "artwork");
  const previousPalette = await np.evaluate(n => n.style.getPropertyValue("--np-accent"));
  await page.evaluate(() => {
    const OriginalImage = window.Image;
    window.__restorePaletteImage = () => {
      window.Image = OriginalImage;
    };
    window.Image = function (...args) {
      const image = new OriginalImage(...args);
      image.addEventListener("load", event => {
        if (image.crossOrigin === "anonymous" && image.src.endsWith("#delayed-palette")) {
          event.stopImmediatePropagation();
          window.__releasePalette = () => image.onload();
        }
      }, {
        capture: true
      });
      return image;
    };
    SPACEAMP.update({
      ...SPACEAMP.getState(),
      artwork: __atmosphereFixtures[0] + "#delayed-palette"
    }, true);
  });
  await page.waitForFunction(() => typeof __releasePalette === "function");
  assert.equal(await np.evaluate(n => n.style.getPropertyValue("--np-accent")), previousPalette);
  assert.equal(await np.getAttribute("data-palette"), "artwork");
  await page.evaluate(() => {
    __releasePalette();
    __restorePaletteImage();
  });
  await page.waitForFunction(previous => document.querySelector("#spaceampNowPlaying").style.getPropertyValue("--np-accent") !== previous, previousPalette);
};
