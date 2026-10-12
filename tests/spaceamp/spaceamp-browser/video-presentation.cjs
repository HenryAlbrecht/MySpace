"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.exports = async function ({
  frames,
  page,
  pad,
  action,
  playerNode,
  qmRow,
  qmClick,
  before,
  testArtifacts,
  settleStage,
}) {
  // Video promotion preserves the same stage and keeps artwork until owner readiness.
  await page.waitForFunction(
    () => document.querySelector(".np-cover").dataset.artworkReady === "true",
  );
  const lyricsBefore = await page.locator(".np-lyrics").boundingBox();
  await page.evaluate(() => {
    window.__geometryLyrics = document.querySelector("am-lyrics");
    window.__geometryScroll =
      __geometryLyrics.shadowRoot.querySelector(".lyrics-container").scrollTop;
  });
  const stageBefore = await page.locator(".np-artwork").boundingBox();
  await page.evaluate(() => {
    window.__videoState = SPACEAMP.getPlaybackState;
    window.__videoHold = true;
    SPACEAMP.getPlaybackState = () => ({
      ...__videoState(),
      videoReadyUrl: __videoHold ? "" : (window.__readyOverride ?? __videoState().sourceUrl),
      ...(window.__videoFailure
        ? {
            playbackStatus: "error",
          }
        : __videoHold
          ? {
              playbackStatus: "loading",
            }
          : {}),
    });
  });
  // Video keeps its iframe; the system dialog is promoted above both popovers.
  await page.evaluate(() => {
    window.__controllerFrame = document.createElement("iframe");
    __controllerFrame.src = "about:blank";
    document.querySelector("#music .music-embed").append(__controllerFrame);
    SPACEAMP.update(
      {
        ...SPACEAMP.getPlaybackState(),
        source: "YouTube",
      },
      true,
    );
  });
  await qmClick("video");
  assert.equal(
    await page.locator(".np-cover").evaluate((n) => getComputedStyle(n).visibility),
    "visible",
  );
  assert.equal(
    await page.locator(".np-video-host").evaluate((n) => getComputedStyle(n).opacity),
    "0",
  );
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector(".np-artwork").clientWidth /
          document.querySelector(".np-artwork").clientHeight -
          16 / 9,
      ) < 0.02,
  );
  await page.evaluate(() => {
    __videoHold = false;
    SPACEAMP.progress({});
  });
  await page.waitForFunction(() =>
    document.querySelector(".np-video-host").classList.contains("np-video-ready"),
  );
  await settleStage();
  const videoBox = await page.locator(".np-artwork").boundingBox();
  assert.ok(Math.abs(videoBox.width / videoBox.height - 16 / 9) < 0.02);
  assert.deepEqual(await page.locator(".np-lyrics").boundingBox(), lyricsBefore);
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector("am-lyrics") === __geometryLyrics &&
        __geometryLyrics.shadowRoot.querySelector(".lyrics-container").scrollTop ===
          __geometryScroll,
    ),
    true,
  );
  const hostBox = await page.locator(".np-video-host").boundingBox();
  assert.ok(Math.abs(hostBox.width / hostBox.height - 16 / 9) < 0.02);
  assert.equal(
    await page.evaluate(() => document.querySelector(".np-quick").matches(":popover-open")),
    true,
  );
  assert.equal(
    await page.evaluate(() => document.querySelector("#xmbQuickMenu").matches(":modal")),
    true,
  );
  assert.equal(
    await qmRow("video").evaluate((node) => {
      const r = node.getBoundingClientRect();
      return !!document
        .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        ?.closest("#xmbQuickMenu");
    }),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => __controllerFrame.isConnected && document.querySelectorAll("audio,iframe").length,
    ),
    before.players + 1,
  );
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getPlaybackState(),
        source: "local",
      },
      true,
    ),
  );
  assert.equal(
    await page
      .locator("#spaceampNowPlaying")
      .evaluate((n) => n.classList.contains("np-video-mode")),
    false,
  );
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("spaceamp-now-playing-preferences-v1")).videoEnabled,
    ),
    true,
  );
  await qmRow("play").focus();
  await action("left");
  const railBefore = await page.evaluate(() => ({
    focus: document.activeElement.dataset.section,
    scroll: document.querySelector("#xmbQuickMenu").scrollTop,
  }));
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getPlaybackState(),
        source: "YouTube",
      },
      true,
    ),
  );
  await page.waitForFunction(() =>
    document.querySelector(".np-video-host").classList.contains("np-video-ready"),
  );
  assert.deepEqual(
    await page.evaluate(() => ({
      focus: document.activeElement.dataset.section,
      scroll: document.querySelector("#xmbQuickMenu").scrollTop,
    })),
    railBefore,
  );
  assert.equal(await page.locator("#xmbQuickMenu").evaluate((n) => n.getAnimations().length), 0);
  assert.ok(
    await page
      .locator(".np-artwork")
      .evaluate((n) => Math.abs(n.clientWidth / n.clientHeight - 16 / 9) < 0.02),
  );
  assert.equal(
    await page
      .locator("#spaceampNowPlaying")
      .evaluate((n) => n.classList.contains("np-video-mode")),
    true,
  );
  await action("tertiary");
  await frames();
  await action("tertiary");
  await frames();
  await pad(4);
  await pad(5);
  await action("secondary");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "volume");
  fs.mkdirSync(testArtifacts, {
    recursive: true,
  });
  await page.screenshot({
    path: path.join(testArtifacts, "video.png"),
  });
  await action("back");
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  await action("back");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  await action("secondary");
  assert.equal(await playerNode(), "volume");
  await action("right");
  await action("back");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  await action("menu");
  await qmClick("video");
  await action("menu");
  assert.equal(await page.evaluate(() => __controllerFrame.isConnected), true);
  // Central presentation uses a wide 16:9 frame, with metadata below it.
  await action("menu");
  await qmClick("lyricsEnabled");
  await qmClick("video");
  await page.waitForFunction(() =>
    document.querySelector(".np-video-host")?.classList.contains("np-video-ready"),
  );
  const central = await page.locator(".np-artwork").boundingBox();
  assert.ok(Math.abs(central.width / central.height - 16 / 9) < 0.02);
  assert.ok(central.width > stageBefore.width);
  assert.ok(
    (await page.locator(".np-track>.np-chrome").boundingBox()).y >= central.y + central.height - 1,
  );
  assert.equal(
    await page.evaluate(() => document.querySelector("am-lyrics") === __geometryLyrics),
    true,
  );
  await page.emulateMedia({
    reducedMotion: "reduce",
  });
  await qmClick("video");
  assert.ok(
    await page
      .locator(".np-artwork")
      .evaluate((n) => Math.abs(n.clientWidth / n.clientHeight - 1) < 0.02),
  );
  await qmClick("video");
  await page.waitForFunction(() =>
    document.querySelector(".np-video-host")?.classList.contains("np-video-ready"),
  );
  assert.ok(
    await page
      .locator(".np-artwork")
      .evaluate((n) => Math.abs(n.clientWidth / n.clientHeight - 16 / 9) < 0.02),
  );
  await qmClick("video");
  await qmClick("lyricsEnabled");
  await action("back");
  await page.emulateMedia({
    reducedMotion: "no-preference",
  });
  await page.evaluate(() => {
    SPACEAMP.getPlaybackState = __videoState;
    __controllerFrame.remove();
    SPACEAMP.update(__originalPlayback, true);
  });
  await settleStage();
  assert.ok(
    await page
      .locator(".np-artwork")
      .evaluate((n) => Math.abs(n.clientWidth / n.clientHeight - 1) < 0.02),
  );
};
