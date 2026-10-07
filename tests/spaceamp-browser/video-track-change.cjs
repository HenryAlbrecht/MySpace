"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  page,
  videoBox
}) {
  // A -> B -> C keeps a transparent singleton and wide artwork placeholder.
  await page.evaluate(() => {
    window.__videoTrack = SPACEAMP.getState();
    __videoHold = true;
    SPACEAMP.update({
      ...__videoTrack,
      title: "Pending B",
      sourceUrl: "pending-b",
      artwork: "profile-art.png"
    }, true);
  });
  assert.equal(await page.locator(".np-video-host").evaluate(n => getComputedStyle(n).opacity), "0");
  assert.deepEqual(await page.locator(".np-artwork").boundingBox(), videoBox);
  await page.evaluate(() => {
    SPACEAMP.update({
      ...__videoTrack,
      title: "Pending C",
      sourceUrl: "pending-c",
      artwork: "profile-art.png"
    }, true);
    window.__pendingLyrics = document.querySelector("am-lyrics");
    window.__pendingFocus = document.activeElement;
    window.__pendingScroll = document.querySelector("#xmbQuickMenu").scrollTop;
  });
  // Negative assertion: give previously queued reveal frames time to run.
  await page.waitForTimeout(80);
  assert.equal(await page.locator(".np-video-host").evaluate(n => n.classList.contains("np-video-ready")), false);
  await page.evaluate(() => {
    __videoHold = false;
    window.__readyOverride = "pending-b";
    SPACEAMP.progress({});
  });
  // Negative assertion: give previously queued reveal frames time to run.
  await page.waitForTimeout(80);
  assert.equal(await page.locator(".np-video-host").evaluate(n => getComputedStyle(n).opacity), "0", "late B readiness cannot reveal C");
  await page.evaluate(() => {
    delete window.__readyOverride;
  });
  await page.evaluate(() => {
    __videoHold = false;
    SPACEAMP.progress({});
  });
  await page.waitForFunction(() => document.querySelector(".np-video-host").classList.contains("np-video-ready"));
  assert.deepEqual(await page.locator(".np-artwork").boundingBox(), videoBox);
  assert.equal(await page.evaluate(() => document.querySelector("am-lyrics") === __pendingLyrics && document.activeElement === __pendingFocus && document.querySelector("#xmbQuickMenu").scrollTop === __pendingScroll && document.querySelector(".np-video-host iframe") === __controllerFrame), true);
  await page.evaluate(() => {
    __geometryLyrics = document.querySelector("am-lyrics");
  });
  await page.evaluate(() => {
    window.__videoFailure = true;
    SPACEAMP.progress({});
  });
  await page.waitForFunction(() => !document.querySelector(".np-video-host") && Math.abs(document.querySelector(".np-artwork").clientWidth / document.querySelector(".np-artwork").clientHeight - 1) < .02);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("spaceamp-now-playing-preferences-v1")).videoEnabled), true);
  await page.evaluate(() => {
    __videoFailure = false;
    SPACEAMP.progress({});
  });
  await page.waitForFunction(() => document.querySelector(".np-video-host")?.classList.contains("np-video-ready"));
};
