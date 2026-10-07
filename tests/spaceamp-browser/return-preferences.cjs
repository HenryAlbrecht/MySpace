"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  page,
  action,
  qmRow,
  qmClick
}) {
  // Default video and a held reveal preserve XMB return context and reject stale work.
  await page.evaluate(() => {
    window.__returnFrame = document.createElement("iframe");
    __returnFrame.src = "about:blank";
    document.querySelector("#music .music-embed").append(__returnFrame);
    SPACEAMP.update({
      ...SPACEAMP.getPlaybackState(),
      source: "YouTube"
    }, true);
    SpaceAmpNowPlaying.open();
    const toggle = document.querySelector("#spaceampNowPlaying [aria-label=\"Exibir v\xEDdeo\"]");
    if (toggle.getAttribute("aria-pressed") !== "true") toggle.click();
    SpaceAmpNowPlaying.close();
    __xmb.enter();
  });
  const videoReturn = await page.evaluate(() => ({
    id: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=\"true\"]").dataset.itemId,
    scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop
  }));
  await page.evaluate(() => {
    window.__returnState = SPACEAMP.getPlaybackState;
    window.__returnRaf = requestAnimationFrame;
    window.__staleReveal = null;
    SPACEAMP.getPlaybackState = () => ({
      ...__returnState(),
      playbackStatus: "",
      videoReadyUrl: __returnState().sourceUrl
    });
    window.requestAnimationFrame = callback => {
      if (callback.name === "reveal") {
        __staleReveal = callback;
        return __returnRaf(() => {});
      }
      return __returnRaf(callback);
    };
  });
  await action("menu");
  await qmClick("now-playing");
  await page.waitForFunction(() => !!__staleReveal);
  assert.equal(await page.locator(".np-video-host").evaluate(n => getComputedStyle(n).opacity), "0");
  await page.evaluate(() => {
    SpaceAmpNowPlaying.close();
    __staleReveal();
    requestAnimationFrame = __returnRaf;
    SPACEAMP.getPlaybackState = __returnState;
  });
  assert.equal(await page.locator(".np-video-host").count(), 0);
  assert.deepEqual(await page.evaluate(() => ({
    id: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=\"true\"]").dataset.itemId,
    scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop
  })), videoReturn);
  assert.equal(await page.locator("#xmb-fixture .xmb-item[aria-pressed=true]").count(), 1);
  await page.evaluate(() => {
    const old = [...document.querySelectorAll("#xmb-fixture .xmb-item")].find(n => n.getAttribute("aria-pressed") !== "true");
    old.focus({
      preventScroll: true
    });
  });
  assert.equal(await page.evaluate(() => document.activeElement.matches("#xmb-fixture .xmb-item[aria-pressed=\"true\"]")), true);
  await page.evaluate(() => {
    __returnFrame.remove();
    __xmb.close();
  });
  await page.evaluate(() => {
    SPACEAMP.update({
      ...SPACEAMP.getPlaybackState(),
      title: "Persistent final"
    }, true);
    SpaceAmpNowPlaying.open();
  });
  await action("menu");
  for (const id of ["romanization", "translation"]) if (!(await page.evaluate(key => JSON.parse(localStorage.getItem("spaceamp-now-playing-preferences-v1"))[key], id + "Enabled"))) await qmClick(id);
  await action("back");
  await page.evaluate(() => SpaceAmpNowPlaying.close());
  await page.evaluate(() => SpaceAmpNowPlaying.open());
  await action("menu");
  for (const id of ["romanization", "translation"]) assert.match(await qmRow(id).textContent(), /ON/);
  await action("back");
  await page.evaluate(() => SpaceAmpNowPlaying.close());
  await page.evaluate(() => {
    const key = "spaceamp-now-playing-preferences-v1";
    localStorage.setItem(key, JSON.stringify({
      ...JSON.parse(localStorage.getItem(key)),
      videoEnabled: true
    }));
  });
  await page.reload();
  await page.waitForSelector("#globalSpaceAmp");
  await page.evaluate(() => {
    SPACEAMP.update({
      title: "Reload",
      artist: "Fixture",
      source: "YouTube",
      sourceUrl: "reload"
    }, false, {
      available: true,
      videoReadyUrl: "reload"
    });
    const frame = document.createElement("iframe");
    frame.src = "about:blank";
    document.querySelector("#music .music-embed").append(frame);
    SpaceAmpNowPlaying.open();
  });
  await page.waitForFunction(() => document.querySelector("am-lyrics").initialOptions);
  assert.deepEqual(await page.evaluate(() => document.querySelector("am-lyrics").initialOptions), {
    romanization: true,
    translation: true
  });
  assert.equal(await page.locator("#spaceampNowPlaying").evaluate(n => n.classList.contains("np-video-mode")), true);
  await action("menu");
  for (const id of ["romanization", "translation", "video"]) assert.match(await qmRow(id).textContent(), /ON/);
  await action("back");
  await page.evaluate(() => SpaceAmpNowPlaying.close());
};
