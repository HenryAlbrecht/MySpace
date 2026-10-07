"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  frames,
  page,
  pad,
  selected
}) {
  await pad(9);
  await page.waitForSelector(".xmb:not([hidden])");
  await pad(1);
  await page.evaluate(() => {
    __xmb.enter();
    [...document.querySelectorAll(".xmb")].at(-1).id = "xmb-fixture";
  });
  await pad(9);
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  assert.equal(await page.locator("#xmbQuickMenu .xqm-system").isVisible(), true);
  await page.locator("#xmbQuickMenu [data-command=fullscreen]").click();
  await frames();
  assert.equal(await page.evaluate(() => __xmb.isActive()), true);
  assert.match(await page.locator("#xmbQuickMenu [role=status]").textContent(), /indisponível/);
  await pad(1);
  await pad(4);
  assert.equal(await page.evaluate(() => __skips.length), 0);
  await page.keyboard.press("ArrowDown");
  assert.equal(await selected().getAttribute("data-index"), "1");
  await page.keyboard.press("d");
  assert.equal(await page.locator("#xmb-fixture").getAttribute("data-level"), "details");
  await page.keyboard.press("Escape");
  for (let i = 0; i < 14; i++) await page.keyboard.press("ArrowDown");
  // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => ({
    index: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true]").dataset.index,
    scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop,
    core: SPACEAMP,
    players: document.querySelectorAll("audio,iframe").length
  }));
  await page.waitForFunction(() => document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true] img")?.complete);
  await page.keyboard.press("Enter");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  assert.deepEqual(await page.evaluate(() => __plays), ["track-15"]);
  // Sample while the shared artwork animation is still running.
  await page.waitForTimeout(40);
  assert.equal(await page.locator(".xmb-handoff-artwork").count(), 1);
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  assert.equal(await page.locator(".xmb-handoff-artwork").count(), 0);
  assert.equal(await page.evaluate(() => document.querySelectorAll("audio,iframe").length), before.players);
};
