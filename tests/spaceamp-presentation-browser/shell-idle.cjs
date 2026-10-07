"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  page,
  np,
  mode,
  before
}) {
  await mode(1, "visible");
  await np.focus(); // Observe the entire idle deadline while visible/focused/details/pointer blocks hiding.
  await page.waitForTimeout(4700);
  assert.doesNotMatch(await np.getAttribute("class"), /np-idle/);
  await page.locator(".np-menu summary").last().click();
  await page.getByRole("button", {
    name: "Ocultar UI agora"
  }).click();
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").classList.contains("np-idle"));
  assert.match(await np.getAttribute("class"), /np-idle/);
  await page.mouse.move(410, 410);
  assert.doesNotMatch(await np.getAttribute("class"), /np-idle/);
  await mode(1, "auto");
  await page.evaluate(() => document.querySelector("#spaceampNowPlaying").focus());
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").classList.contains("np-idle"), null, {
    timeout: 6000
  });
  assert.match(await page.locator("#spaceampNowPlaying").getAttribute("class"), /np-idle/);
  await page.mouse.move(400, 400);
  await page.waitForFunction(() => !document.querySelector("#spaceampNowPlaying").classList.contains("np-idle"));
  assert.doesNotMatch(await page.locator("#spaceampNowPlaying").getAttribute("class"), /np-idle/);
  await page.getByRole("button", {
    name: "Pausar",
    exact: true
  }).focus();
  await page.waitForTimeout(4700);
  assert.doesNotMatch(await page.locator("#spaceampNowPlaying").getAttribute("class"), /np-idle/);
  await page.locator(".np-menu summary").first().click();
  await np.focus();
  await page.waitForTimeout(4700);
  assert.doesNotMatch(await np.getAttribute("class"), /np-idle/);
  await page.locator(".np-menu summary").first().click();
  await np.focus();
  await page.evaluate(() => document.querySelector("#spaceampNowPlaying").dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true
  })));
  await page.waitForTimeout(4700);
  assert.doesNotMatch(await np.getAttribute("class"), /np-idle/);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup")));
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.querySelector("#spaceampNowPlaying").contains(document.activeElement)), true);
  const calls = await page.evaluate(() => __calls.length);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), false);
  assert.equal(await page.evaluate(() => scrollY), before);
  assert.equal(await page.evaluate(() => document.activeElement.id), "album");
  assert.equal(await page.evaluate(() => __calls.length), calls);
};
