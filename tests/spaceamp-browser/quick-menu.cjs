"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
module.exports = async function ({ frames, page, context, action, qmRow, qmClick }) {
  // Commands use current owners, including the existing preference persistence.
  await action("menu");
  // Presentation timer reads the real owner without interaction events or focus changes.
  await page.evaluate(() => {
    __clock.position = 26;
  });
  await page.waitForFunction(() =>
    document.querySelector(".xqm-track .xqm-status").textContent.includes("0:26"),
  );
  await page.evaluate(() => {
    window.__clockFocus = document.activeElement;
    __clock.position = 31;
  });
  await page.waitForFunction(() =>
    document.querySelector(".xqm-track .xqm-status").textContent.includes("0:31"),
  );
  assert.equal(await page.evaluate(() => document.activeElement === __clockFocus), true);
  assert.equal(await page.evaluate(() => __quickTimers.size), 1);
  await action("back");
  assert.equal(await page.evaluate(() => __quickTimers.size), 0);
  const ticksAtClose = await page.evaluate(() => __quickTicks);
  // Negative assertion: observe a whole 400ms timer period after close.
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => __quickTicks), ticksAtClose);
  await page.evaluate(() => {
    __clock.position = 42;
  });
  await action("menu");
  // Quick Menu uses the shared delivery/decode owner, including stale and empty states.
  const quickArtwork = page.locator("#xmbQuickMenu .xqm-artwork");
  await context.route("**/api/music/artwork?**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: fs.readFileSync("dist/profile-art.png"),
    }),
  );
  await page.evaluate(() => {
    window.__quickArtworkCalls = [];
    window.__quickDecodeRelease = null;
    window.__quickArtworkOriginal = {
      set: Artwork.set,
      clear: Artwork.clear,
      decode: HTMLImageElement.prototype.decode,
    };
    Artwork.set = (image, source, ...args) => {
      if (image.classList.contains("xqm-artwork")) __quickArtworkCalls.push(["set", source]);
      return __quickArtworkOriginal.set(image, source, ...args);
    };
    Artwork.clear = (image) => {
      if (image.classList.contains("xqm-artwork")) __quickArtworkCalls.push(["clear"]);
      return __quickArtworkOriginal.clear(image);
    };
    HTMLImageElement.prototype.decode = function () {
      const decoded = __quickArtworkOriginal.decode.call(this);
      return this.classList.contains("xqm-artwork") && this.src.includes("quick-pending-a")
        ? decoded.then(
            () =>
              new Promise((resolve) => {
                __quickDecodeRelease = resolve;
              }),
          )
        : decoded;
    };
    window.__quickBefore = {
      ...SPACEAMP.getPlaybackState(),
    };
    SPACEAMP.update(
      {
        ...__quickBefore,
        artwork: "",
      },
      true,
    );
  });
  assert.equal(await quickArtwork.getAttribute("src"), null);
  assert.equal(await quickArtwork.getAttribute("data-artwork-state"), "empty");
  const quickA = "https://lh3.googleusercontent.com/quick-pending-a";
  const quickB = "https://yt3.googleusercontent.com/quick-ready-b";
  await page.evaluate(
    (source) =>
      SPACEAMP.update(
        {
          ...SPACEAMP.getPlaybackState(),
          artwork: source,
        },
        true,
      ),
    quickA,
  );
  await page.waitForFunction(() => !!__quickDecodeRelease);
  assert.equal(await quickArtwork.evaluate((n) => n.style.visibility), "hidden");
  assert.equal(
    await quickArtwork.getAttribute("src"),
    "/api/music/artwork?" +
      new URLSearchParams({
        url: quickA,
      }),
  );
  await page.evaluate(
    (source) =>
      SPACEAMP.update(
        {
          ...SPACEAMP.getPlaybackState(),
          artwork: source,
        },
        true,
      ),
    quickB,
  );
  await page.waitForFunction(
    () => document.querySelector(".xqm-artwork").dataset.artworkState === "ready",
  );
  await page.evaluate(() => __quickDecodeRelease());
  await frames();
  assert.equal(
    await quickArtwork.getAttribute("src"),
    "/api/music/artwork?" +
      new URLSearchParams({
        url: quickB,
      }),
  );
  assert.equal(await quickArtwork.evaluate((n) => n.style.visibility), "");
  // A failed replacement keeps the last ready pixels, without a broken image.
  await context.route("**/quick-menu-art-error.png", (route) => route.abort());
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getPlaybackState(),
        artwork: "/quick-menu-art-error.png",
      },
      true,
    ),
  );
  await page.waitForFunction(
    () => document.querySelector(".xqm-artwork").dataset.artworkState === "error",
  );
  assert.equal(
    await quickArtwork.getAttribute("src"),
    "/api/music/artwork?" +
      new URLSearchParams({
        url: quickB,
      }),
  );
  assert.equal(
    await quickArtwork.evaluate((n) => n.naturalWidth > 0 && n.style.visibility !== "hidden"),
    true,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      __quickArtworkCalls
        .filter((call) => call[0] === "set")
        .map((call) => call[1])
        .filter((source) => source.includes("quick-"))
        .filter((source, index, list) => list.indexOf(source) === index),
    ),
    [quickA, quickB, "/quick-menu-art-error.png"],
  );
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getPlaybackState(),
        artwork: "",
      },
      true,
    ),
  );
  assert.equal(await quickArtwork.getAttribute("src"), null);
  assert.equal(await quickArtwork.getAttribute("data-artwork-ready"), null);
  assert.equal(await quickArtwork.isVisible(), false);
  assert.ok(await page.evaluate(() => __quickArtworkCalls.some((call) => call[0] === "clear")));
  assert.equal(
    await page.locator("#xmbQuickMenu h3").textContent(),
    await page.evaluate(() => SPACEAMP.getPlaybackState().title),
  );
  assert.match(
    await page.locator("#xmbQuickMenu .xqm-track .xqm-status").textContent(),
    /Tocando.*0:42/,
  );
  await page.evaluate(() => {
    Artwork.set = __quickArtworkOriginal.set;
    Artwork.clear = __quickArtworkOriginal.clear;
    HTMLImageElement.prototype.decode = __quickArtworkOriginal.decode;
    SPACEAMP.update(__quickBefore, true);
  });
  await context.unroute("**/api/music/artwork?**");
  await context.unroute("**/quick-menu-art-error.png");
  // Normal rows always return LEFT to rail; returning restores the last row.
  for (const id of ["volume", "visualizerMode", "backgroundMode", "uiMode"]) {
    await qmRow(id).focus();
    await action("left");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.section), "music");
    await action("right");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.command), id);
  }
  await qmRow("lyricsEnabled").focus();
  await action("primary");
  await frames();
  assert.equal(
    await page.locator("#spaceampNowPlaying").evaluate((n) => n.classList.contains("np-no-lyrics")),
    true,
  );
  await action("left");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.section), "music");
  await action("primary");
  await action("primary");
  await frames();
  await qmRow("play").focus();
  // Rail topology and music face actions work across sections.
  await action("left");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.section), "music");
  await action("down");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.section), "system");
  await action("primary");
  assert.equal(await page.locator("#xmbQuickMenu .xqm-system").isVisible(), true);
  await action("secondary");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "volume");
  const quickPlaying = await page.evaluate(() => SPACEAMP.getPlaybackState().playing);
  await action("tertiary");
  await frames();
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), !quickPlaying);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "volume");
  await action("tertiary");
  await frames();
  const squareVolume = await page.evaluate(() => SPACEAMP.getPlaybackState().volume);
  await action("left");
  assert.ok((await page.evaluate(() => SPACEAMP.getPlaybackState().volume)) < squareVolume);
  await action("secondary");
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  assert.equal(await qmRow("volume").evaluate((n) => n.classList.contains("xqm-adjusting")), false);
  for (const id of ["romanization", "translation"]) assert.equal(await qmRow(id).isVisible(), true);
  assert.match(await qmRow("lyricsEnabled").textContent(), /Letras/);
  assert.match(await qmRow("visualizerMode").textContent(), /Visualizador/);
  await qmClick("play");
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), false);
  await qmClick("play");
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), true);
  await qmRow("volume").focus();
  const realVolume = await page.evaluate(() => SPACEAMP.getPlaybackState().volume);
  await action("primary");
  await action("left");
  assert.ok((await page.evaluate(() => SPACEAMP.getPlaybackState().volume)) < realVolume);
  await action("right");
  await action("right");
  assert.ok((await page.evaluate(() => SPACEAMP.getPlaybackState().volume)) > realVolume);
  assert.match(await qmRow("volume").textContent(), /%/);
  await action("back");
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "volume");
  await action("left");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.section), "music");
  await action("primary");
  await qmClick("lyricsEnabled");
  assert.equal(
    await page.locator("#spaceampNowPlaying").evaluate((n) => n.classList.contains("np-no-lyrics")),
    true,
  );
  await qmClick("lyricsEnabled");
  for (const [id, attribute, value] of [
    ["visualizerMode", "visualizerMode", "audio"],
    ["backgroundMode", "backgroundMode", "static"],
    ["uiMode", "uiMode", "visible"],
  ]) {
    await qmRow(id).focus();
    await action("primary");
    await action("right");
    assert.equal(
      await page
        .locator("#spaceampNowPlaying")
        .evaluate((node, key) => node.dataset[key], attribute),
      value,
    );
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem("spaceamp-now-playing-preferences-v1"))[key],
        id,
      ),
      value,
    );
    await action("left");
    await action("primary");
    assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
    await action("left");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.section), "music");
    await action("right");
  }
  await qmClick("previous");
  await qmClick("next");
  assert.deepEqual(await page.evaluate(() => __skips.slice(-2)), ["previous", "next"]);
  // Persistent settings remain focused while native buttons disappear during loading.
  await page.evaluate(() => (document.querySelector("am-lyrics").loadingOptions = true));
  for (const id of ["romanization", "translation"]) {
    await qmRow(id).focus();
    await action("primary");
    assert.equal(await qmRow(id).isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.command), id);
    assert.match(await qmRow(id).textContent(), /ON/);
    await page.waitForFunction(() =>
      document.querySelector("am-lyrics").shadowRoot.querySelector(".lyrics-line"),
    );
    assert.equal(await page.evaluate(() => document.activeElement.dataset.command), id);
  }
  await qmClick("lyricsEnabled");
  assert.equal(await qmRow("romanization").isVisible(), false);
  await qmClick("lyricsEnabled");
  for (const id of ["romanization", "translation"])
    assert.match(await qmRow(id).textContent(), /ON/);
  await page.evaluate(() => {
    SPACEAMP.update(
      {
        ...SPACEAMP.getPlaybackState(),
        title: "Inherited preferences",
      },
      true,
    );
  });
  assert.deepEqual(await page.evaluate(() => document.querySelector("am-lyrics").initialOptions), {
    romanization: true,
    translation: true,
  });
  for (const id of ["romanization", "translation"]) {
    await qmClick(id);
    await page.waitForFunction(() =>
      document.querySelector("am-lyrics").shadowRoot.querySelector(".lyrics-line"),
    );
  }
};
