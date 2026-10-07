"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
module.exports = async function ({
  page,
  pad,
  selected,
  testArtifacts
}) {
  // Options opens over XMB without route/category/selection/scroll changes.
  await page.evaluate(() => {
    window.__quickXmbOrigin = document.activeElement;
  });
  const menuContext = await page.evaluate(() => ({
    category: document.querySelector("#xmb-fixture .xmb-category[aria-pressed=true]").dataset.category,
    hash: location.hash,
    scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop,
    index: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true]").dataset.index
  }));
  await pad(9);
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains("xmb-active")), true);
  assert.deepEqual(await page.evaluate(() => ({
    category: document.querySelector("#xmb-fixture .xmb-category[aria-pressed=true]").dataset.category,
    hash: location.hash,
    scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop,
    index: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true]").dataset.index
  })), menuContext);
  await page.locator("#xmbQuickMenu").evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const menuBox = await page.locator("#xmbQuickMenu").boundingBox();
  assert.equal(menuBox.x, 0);
  assert.equal(menuBox.y, 0);
  assert.equal(menuBox.height, 900);
  await page.screenshot({
    path: path.join(testArtifacts, "xmb.png")
  });
  await page.emulateMedia({
    reducedMotion: "reduce"
  });
  assert.equal(await page.locator("#xmbQuickMenu").evaluate(node => getComputedStyle(node).animationName), "none");
  await page.emulateMedia({
    reducedMotion: "no-preference"
  });
  await pad(1);
  assert.equal(await page.evaluate(() => document.activeElement === __quickXmbOrigin), true, JSON.stringify(await page.evaluate(() => ({
    active: document.activeElement.className,
    origin: __quickXmbOrigin.className,
    connected: __quickXmbOrigin.isConnected,
    inert: __quickXmbOrigin.closest("[inert]")?.className
  }))));
  await pad(9);
  assert.equal(await page.locator("#xmbQuickMenu").count(), 1);
  await pad(9);
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), false);
  await pad(9);
  await page.locator("#xmbQuickMenu [data-command=\"now-playing\"]").click();
  await page.waitForSelector("#spaceampNowPlaying[open]");
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), false);
  assert.equal(await page.evaluate(() => __plays.length), 1);
  assert.equal(await page.evaluate(() => __clock.position), 40);
  await pad(1);
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  assert.equal(await selected().getAttribute("data-index"), menuContext.index);
  assert.equal(await page.locator("#xmb-fixture .xmb-items").evaluate(n => n.scrollTop), menuContext.scroll);
  await page.evaluate(() => {
    SPACEAMP.update(__originalPlayback, true);
  });
};
