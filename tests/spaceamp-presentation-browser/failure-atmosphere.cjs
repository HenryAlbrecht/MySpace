"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
module.exports = async function ({
  page,
  context,
  np,
  settled
}) {
  // Failures stay inside presentation, all in this same browser/context.
  await page.emulateMedia({
    reducedMotion: "no-preference"
  });
  for (const failure of ["import", "webgl", "cors"]) {
    if (failure === "import") await context.route("**/vendor/kawarp/dist/index.js", route => route.abort());
    await page.reload();
    await page.waitForSelector("#globalSpaceAmp", {
      state: "attached"
    });
    if (failure === "webgl") await page.evaluate(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.startsWith("webgl") ? null : get.call(this, type, ...args);
      };
    });
    if (failure === "cors") await context.route("https://fixture.invalid/art.png", route => route.fulfill({
      contentType: "image/png",
      headers: {
        "access-control-allow-origin": "https://denied.fixture"
      },
      body: fs.readFileSync("dist/profile-art.png")
    }));
    await page.evaluate(failure => {
      SPACEAMP.update({
        title: "Failure " + failure,
        artist: "Fixture",
        source: "YouTube",
        artwork: failure === "cors" ? "https://fixture.invalid/art.png" : "profile-art.png"
      }, true, {
        available: true
      });
      SpaceAmpNowPlaying.open();
    }, failure);
    await page.waitForFunction(() => document.querySelector(".np-cover").dataset.artworkReady === "true");
    await settled();
    assert.equal(await np.getAttribute("data-atmosphere"), "static", failure);
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
    if (failure === "cors") {
      await page.evaluate(() => SPACEAMP.update({
        ...SPACEAMP.getState(),
        artwork: "profile-art.png"
      }, true));
      await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp");
    }
    await page.keyboard.press("Escape");
    if (failure === "import") await context.unroute("**/vendor/kawarp/dist/index.js");
  }
};
