"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  page,
  pad,
  selected
}) {
  // Held confirm invokes once; directional controls navigate existing groups.
  await pad(13);
  assert.ok(await page.locator(".np-gamepad-focus").count());
  await pad(1);
  // Observe restored XMB focus/scroll after the return motion.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelectorAll("#xmb-fixture .xmb-item")[0].click();
  });
  // Observe restored XMB focus/scroll after the return motion.
  await page.waitForTimeout(250);
  await pad(12);
  assert.equal(await page.evaluate(() => document.activeElement.className), "xmb-now-playing");
  const count = await page.evaluate(() => __plays.length);
  await pad(0);
  await page.waitForSelector("#spaceampNowPlaying[open]");
  assert.equal(await page.evaluate(() => __plays.length), count);
  assert.equal(await page.evaluate(() => __clock.position), 90);
  assert.equal(await page.locator(".xmb-handoff-artwork").count(), 0, "nowEntry has no unrelated artwork origin");
  await pad(1);
  // Observe restored XMB focus/scroll after the return motion.
  await page.waitForTimeout(250);
  await pad(13);
  assert.equal(await selected().getAttribute("data-index"), "0");
};
