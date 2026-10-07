"use strict";

// Setup establishes preconditions without executing another scenario's assertions.
async function player(fixture) {
  fixture.before = await fixture.preparePlayer();
}
async function volume(fixture) {
  await player(fixture);
  await fixture.focusVolume();
}
async function menu(fixture) {
  await volume(fixture);
  await fixture.action("menu");
}
async function xmb(fixture) {
  await player(fixture);
  await fixture.page.evaluate(() => {
    __clock.position = 40;
    SpaceAmpNowPlaying.close();
  });
  await fixture.page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
}
async function system(fixture) {
  await xmb(fixture);
  await fixture.page.evaluate(() => {
    __pad = null;
    __xmb.enter();
  });
  await fixture.page.keyboard.press("ArrowDown");
  await fixture.page.keyboard.press("Escape");
}
async function video(fixture) {
  await menu(fixture);
  const {
    page,
    qmClick,
    settleStage
  } = fixture;
  await page.waitForFunction(() => document.querySelector(".np-cover").dataset.artworkReady === "true");
  await page.evaluate(() => {
    window.__videoState = SPACEAMP.getPlaybackState;
    window.__videoHold = false;
    SPACEAMP.getPlaybackState = () => ({
      ...__videoState(),
      videoReadyUrl: __videoHold ? "" : window.__readyOverride ?? __videoState().sourceUrl,
      ...(window.__videoFailure ? {
        playbackStatus: "error"
      } : __videoHold ? {
        playbackStatus: "loading"
      } : {})
    });
    window.__controllerFrame = document.createElement("iframe");
    __controllerFrame.src = "about:blank";
    document.querySelector("#music .music-embed").append(__controllerFrame);
    SPACEAMP.update({
      ...SPACEAMP.getPlaybackState(),
      source: "YouTube"
    }, true);
  });
  await qmClick("video");
  await page.waitForFunction(() => document.querySelector(".np-video-host")?.classList.contains("np-video-ready"));
  await settleStage();
  fixture.videoBox = await page.locator(".np-artwork").boundingBox();
}
async function gamepad(fixture) {
  await player(fixture);
  await fixture.page.evaluate(() => {
    __clock.position = 90;
  });
}
async function firstItem(fixture) {
  await xmb(fixture);
  await fixture.page.evaluate(() => {
    __clock.position = 90;
    document.querySelectorAll("#xmb-fixture .xmb-item")[0].click();
    __pad = {
      index: 0,
      mapping: "standard",
      buttons: Array.from({
        length: 16
      }, () => ({
        pressed: false,
        value: 0
      })),
      axes: [0, 0]
    };
  });
}
module.exports = {
  player,
  volume,
  menu,
  xmb,
  system,
  video,
  gamepad,
  firstItem
};
