"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, np, toggle, setComponentMode }) {
  // Validated preferences survive reload; playback state is never stored.
  setComponentMode("fixture");
  await page.evaluate(() =>
    localStorage.setItem(
      "spaceamp-now-playing-preferences-v1",
      JSON.stringify({
        lyricsEnabled: false,
        visualizerMode: "ambient",
        uiMode: "visible",
        backgroundMode: "static",
        videoEnabled: true,
        romanizationEnabled: true,
        translationEnabled: true,
        currentTime: 999,
      }),
    ),
  );
  await page.reload();
  await page.waitForSelector("#globalSpaceAmp", {
    state: "attached",
  });
  await page.evaluate(() => SpaceAmpNowPlaying.open());
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  assert.equal(await np.getAttribute("data-visualizer-mode"), "ambient");
  assert.equal(await np.getAttribute("data-ui-mode"), "visible");
  assert.equal(await np.getAttribute("data-background-mode"), "static");
  await page.waitForFunction(
    () =>
      customElements.get("am-lyrics") &&
      document.querySelector("am-lyrics").showRomanization &&
      document.querySelector("am-lyrics").showTranslation,
  );
  await toggle.click();
  assert.deepEqual(
    await page.evaluate(() =>
      Object.keys(JSON.parse(localStorage.getItem("spaceamp-now-playing-preferences-v1"))).sort(),
    ),
    [
      "backgroundMode",
      "lyricsEnabled",
      "romanizationEnabled",
      "translationEnabled",
      "uiMode",
      "videoEnabled",
      "visualizerMode",
    ],
  );
  await page.keyboard.press("Escape");
  for (const saved of [
    "{bad",
    JSON.stringify({
      lyricsEnabled: "false",
      visualizerMode: "bad",
      uiMode: "bad",
      backgroundMode: "bad",
    }),
    "null",
  ]) {
    await page.evaluate(
      (saved) => localStorage.setItem("spaceamp-now-playing-preferences-v1", saved),
      saved,
    );
    await page.reload();
    await page.waitForSelector("#globalSpaceAmp", {
      state: "attached",
    });
    await page.evaluate(() => SpaceAmpNowPlaying.open());
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    assert.equal(await np.getAttribute("data-visualizer-mode"), "auto");
    assert.equal(await np.getAttribute("data-ui-mode"), "auto");
    await toggle.click();
    const restored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("spaceamp-now-playing-preferences-v1")),
    );
    for (const key of ["videoEnabled", "romanizationEnabled", "translationEnabled"])
      assert.equal(restored[key], false);
    await page.keyboard.press("Escape");
  }
};
