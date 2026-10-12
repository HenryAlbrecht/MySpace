"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, np, toggle }) {
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  const initialCalls = await page.evaluate(() => __calls.length);
  await toggle.click();
  assert.match(await np.getAttribute("class"), /np-no-lyrics/);
  assert.equal(await page.evaluate(() => document.querySelector(".np-lyrics").inert), true);
  await page.evaluate(() => {
    __time.position = 31;
    SPACEAMP.progress({
      position: 31,
    });
    SPACEAMP.update(
      {
        ...SPACEAMP.getState(),
        title: "Changed hidden",
      },
      true,
    );
  });
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await toggle.click();
  const resumedLyricsTime = await page.evaluate(
    () => document.querySelector("am-lyrics").currentTime,
  );
  assert.ok(
    resumedLyricsTime >= 31000 && resumedLyricsTime < 31600,
    "reenabled lyrics follow the latest provider sample",
  );
  assert.equal(await page.locator("am-lyrics").getAttribute("song-title"), "Changed hidden");
  assert.equal(await page.evaluate(() => __calls.length), initialCalls);
};
