"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  page,
  setComponentMode
}) {
  // Failure of the current local vendor module cannot affect transport or controls.
  setComponentMode("failed");
  await page.reload();
  await page.waitForSelector("#globalSpaceAmp", {
    state: "attached"
  });
  await page.evaluate(() => {
    SPACEAMP.update({
      title: "Offline",
      artist: "",
      source: "YouTube",
      sourceUrl: "offline"
    }, true, {
      available: true
    });
    SpaceAmpNowPlaying.open();
  });
  await page.waitForFunction(() => document.querySelector(".np-status").textContent.includes("Não foi possível"));
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
  await page.keyboard.press("Escape");
};
