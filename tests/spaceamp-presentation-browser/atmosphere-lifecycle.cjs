"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  page,
  np,
  artwork
}) {
  await artwork();
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp");
  // Static means the former palette/blur composition and no GPU loop.
  await page.locator(".np-menu summary").first().click();
  await page.getByRole("combobox", {
    name: "Fundo",
    exact: true
  }).selectOption("static");
  assert.equal(await np.getAttribute("data-atmosphere"), "static");
  const staticDraws = await page.evaluate(() => __dynamicDraws);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => __dynamicDraws), staticDraws);
  assert.equal(await page.locator(".np-atmosphere").evaluate(n => Number(getComputedStyle(n).opacity) > 0), true);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("spaceamp-now-playing-preferences-v1")).backgroundMode), "static");
  await page.getByRole("combobox", {
    name: "Fundo",
    exact: true
  }).selectOption("dynamic");
  await page.locator(".np-menu summary").first().click();
  await page.waitForFunction(before => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp" && __dynamicDraws > before, staticDraws);
  // Source changes do not change the visual policy.
  await page.evaluate(() => SPACEAMP.update({
    ...SPACEAMP.getState(),
    source: "local"
  }, true));
  assert.equal(await np.getAttribute("data-atmosphere"), "kawarp");
  assert.equal(await page.locator(".np-dynamic-atmosphere").evaluate(n => n.width <= 960 && n.height <= 540), true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenDraws = await page.evaluate(() => __dynamicDraws);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __dynamicDraws), hiddenDraws);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => __dynamicDraws > 0);
  await page.evaluate(() => SPACEAMP.update({
    ...SPACEAMP.getState(),
    title: "SPACEAMP · Atmosphere",
    artist: "Artwork fixture",
    artwork: "profile-art.png"
  }, true));
  await page.keyboard.press("Escape");
  const closedDraws = await page.evaluate(() => __dynamicDraws);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __dynamicDraws), closedDraws);
};
