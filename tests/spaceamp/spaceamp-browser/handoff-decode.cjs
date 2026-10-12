"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.exports = async function ({ page, pad, testArtifacts }) {
  // Different artwork: deliberately postpone decoding beyond the handoff duration.
  await page.evaluate(() => {
    __rows[1].image = "profile-art.png?handoff=new";
    const row = document.querySelectorAll("#xmb-fixture .xmb-item")[1];
    row.querySelector("img").src = __rows[1].image;
    row.click();
  });
  // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await __decode.call(this);
      if (this.src.includes("handoff=new")) await new Promise((r) => setTimeout(r, 650));
    };
    window.__differentFrames = [];
    window.__sampleDifferent = true;
    const sample = () => {
      if (!__sampleDifferent) return;
      const cover = document.querySelector(".np-cover");
      if (SpaceAmpNowPlaying.isOpen())
        __differentFrames.push({
          src: cover.getAttribute("src"),
          state: cover.dataset.artworkState,
          source: cover.dataset.artworkSource,
          key: cover.dataset.artworkKey,
          hidden: cover.hidden,
          ghosts: document.querySelectorAll(".np-cover-previous").length,
          clones: document.querySelectorAll(".xmb-handoff-artwork").length,
          visible: getComputedStyle(cover).visibility,
          rect: {
            x: cover.getBoundingClientRect().x,
            y: cover.getBoundingClientRect().y,
            width: cover.getBoundingClientRect().width,
          },
          cloneRect: document
            .querySelector(".xmb-handoff-artwork")
            ?.getBoundingClientRect()
            .toJSON(),
        });
      requestAnimationFrame(sample);
    };
    sample();
  });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  // Checkpoint after animation but before the deliberately delayed 650ms decode.
  await page.waitForTimeout(350);
  assert.equal(
    await page.locator(".xmb-handoff-artwork").count(),
    1,
    "clone survives animation while destination decodes",
  );
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  const differentFrames = await page.evaluate(() => {
    __sampleDifferent = false;
    HTMLImageElement.prototype.decode = __decode;
    return __differentFrames;
  });
  assert.ok(
    differentFrames.every((f) => f.ghosts === 0),
    "handoff and cover crossfade never compete",
  );
  assert.ok(
    differentFrames.every(
      (f) =>
        f.clones > 0 ||
        (f.src === "profile-art.png?handoff=new" &&
          f.state === "ready" &&
          f.key === f.source &&
          !f.hidden &&
          f.visible === "visible"),
    ),
    "no uncovered empty or wrong destination frame",
  );
  fs.writeFileSync(
    path.join(testArtifacts, "different-track-frames.json"),
    JSON.stringify(differentFrames, null, 2),
  );
  await pad(1);
  // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelectorAll("#xmb-fixture .xmb-item")[0].click());
  // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
  await page.waitForTimeout(250);
};
