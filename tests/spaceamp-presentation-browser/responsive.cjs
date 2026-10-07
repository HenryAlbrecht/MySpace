"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
module.exports = async function ({
  page,
  np,
  toggle,
  artwork,
  settled,
  testArtifacts
}) {
  await artwork();
  await page.keyboard.press("Escape");
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({
      width,
      height: 900
    });
    await page.evaluate(() => SpaceAmpNowPlaying.open());
    for (const enabled of [false, true]) {
      if ((await toggle.getAttribute("aria-pressed")) !== String(enabled)) await toggle.click();
      await settled();
      if (enabled) {
        const box = await page.locator(".np-lyrics-slot").boundingBox();
        assert.ok(box.width > 180 && box.height > 180);
      }
      const bounds = await page.locator(".np-track").boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 900);
      assert.equal(await np.evaluate(n => n.scrollWidth <= innerWidth && n.scrollHeight <= innerHeight), true);
      await page.screenshot({
        path: path.join(testArtifacts, `${width}-lyrics-${enabled ? "on" : "off"}.png`)
      });
    }
    assert.equal(await page.evaluate(() => document.querySelector("#spaceampNowPlaying").scrollWidth <= innerWidth), true);
    await page.keyboard.press("Escape");
  }
  await page.emulateMedia({
    reducedMotion: "reduce"
  });
  await page.evaluate(() => SpaceAmpNowPlaying.open());
  assert.equal(await page.locator("#spaceampNowPlaying").evaluate(n => getComputedStyle(n).animationName), "none");
  assert.equal(await np.getAttribute("data-atmosphere"), "static");
  const reducedDraws = await page.evaluate(() => __dynamicDraws);
  // Reduced-motion must keep the GPU loop stopped over an observation window.
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __dynamicDraws), reducedDraws);
  await page.evaluate(() => __changeArt(1));
  await page.waitForFunction(() => document.querySelector(".np-cover").getAttribute("src") === __art[1]);
  await settled();
  assert.equal(await np.evaluate(n => n.getAnimations({
    subtree: true
  }).length), 0);
  assert.equal(await np.evaluate(n => getComputedStyle(n).transitionDuration), "0s");
  await toggle.click();
  assert.equal(await page.locator(".np-cover").evaluate(n => getComputedStyle(n).transitionDuration), "0s");
  await toggle.click();
  await page.screenshot({
    path: path.join(testArtifacts, "mobile.png")
  });
  await page.keyboard.press("Escape");
};
