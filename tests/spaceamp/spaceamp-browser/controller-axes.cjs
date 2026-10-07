"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, pad, selected }) {
  await page.evaluate(() => {
    __pad.axes = [0.3, 0.2];
  });
  // Observe gamepad sampling/deadzone or repeat across real frames.
  await page.waitForTimeout(300);
  assert.equal(await selected().getAttribute("data-index"), "0");
  await page.evaluate(() => {
    __pad.axes = [0.6, 0.9];
  });
  // Observe gamepad sampling/deadzone or repeat across real frames.
  await page.waitForTimeout(70);
  await page.evaluate(() => {
    __pad.axes = [0, 0];
  });
  assert.equal(await selected().getAttribute("data-index"), "1");
  await pad(13, 510);
  const afterRepeat = Number(await selected().getAttribute("data-index"));
  assert.ok(afterRepeat >= 3 && afterRepeat <= 5);
  assert.ok((await page.locator("#xmb-fixture .xmb-help").textContent()).includes("D-pad"));
  await page.keyboard.press("ArrowDown");
  assert.ok((await page.locator("#xmb-fixture .xmb-help").textContent()).includes("Enter"));
  await pad(1);
  assert.equal(await page.locator("#xmb-fixture").isVisible(), false);
};
