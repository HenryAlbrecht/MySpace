"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  frames,
  page,
  pad,
  action,
  markerIndex,
  focusedLabel,
  playerNode,
  clockBefore
}) {
  // Main controller mesh excludes the mouse/keyboard quick bar.
  await page.waitForFunction(() => document.querySelector("am-lyrics")?.shadowRoot?.querySelector(".lyrics-line"));
  await action("up");
  await action("up");
  assert.equal(await focusedLabel(), "Pausar");
  assert.equal(await page.evaluate(() => document.activeElement.closest(".np-quick")), null);
  await action("left");
  await action("left");
  assert.equal(await focusedLabel(), "Anterior");
  await action("right");
  assert.equal(await focusedLabel(), "Pausar");
  await action("right");
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  await action("right");
  assert.equal(await markerIndex(), 1);
  await action("left");
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  assert.equal(await markerIndex(), -1);
  // Face shortcuts preserve player/lyrics origin and consume one layer.
  await pad(3, 500);
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), false);
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  await pad(3, 500);
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), true);
  await pad(2, 500);
  assert.equal(await playerNode(), "volume");
  const shortcutVolume = await page.evaluate(() => SPACEAMP.getPlaybackState().volume);
  await action("left");
  assert.ok((await page.evaluate(() => SPACEAMP.getPlaybackState().volume)) < shortcutVolume);
  await action("back");
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  await action("right");
  await action("down");
  const shortcutLine = await markerIndex();
  await action("tertiary");
  await frames();
  assert.equal(await markerIndex(), shortcutLine);
  await action("tertiary");
  await frames();
  assert.equal(await markerIndex(), shortcutLine);
  const shortcutSeek = await page.evaluate(() => __seeks.length);
  await action("secondary");
  assert.equal(await markerIndex(), -1);
  await action("right");
  await action("primary");
  assert.equal(await markerIndex(), shortcutLine);
  assert.equal(await page.evaluate(() => __seeks.length), shortcutSeek);
  await action("secondary");
  await page.evaluate(() => {
    window.__shortcutOld = document.querySelector("am-lyrics");
    SPACEAMP.update({
      ...SPACEAMP.getPlaybackState(),
      title: "Shortcut replacement"
    }, true);
  });
  await page.waitForFunction(() => document.querySelector("am-lyrics") !== __shortcutOld);
  await action("secondary");
  assert.equal(await markerIndex(), 1);
  assert.equal(await page.evaluate(() => __shortcutOld.shadowRoot.querySelector(".spaceamp-controller-selected")), null);
  await action("back");
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  // Options/B consumes exactly one layer and restores the original control.
  await action("menu");
  await action("up");
  await action("up");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "previous");
  await action("down");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "play");
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  assert.equal(await page.locator("#xmbQuickMenu [data-command=\"now-playing\"]").isVisible(), false);
  await action("back");
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  await pad(4, 500);
  await pad(5, 500);
  assert.deepEqual(await page.evaluate(() => __skips), ["previous", "next"]);
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  await action("down");
  await action("left");
  assert.equal(await playerNode(), "progress");
  await action("right");
  assert.equal(await playerNode(), "volume");
  assert.equal(await page.evaluate(() => __clock.position), clockBefore);
  await page.evaluate(() => SPACEAMP.progress({
    volume: 0.4
  }));
  await action("primary");
  await action("right");
  assert.ok(Number(await page.locator("#spaceampNowPlaying input[aria-label=\"Volume\"]").inputValue()) > 0.4);
  assert.equal(await playerNode(), "volume");
  assert.equal(await markerIndex(), -1);
  await action("primary");
  for (const state of ["hidden", "disabled", "inert"]) {
    await action("right");
    assert.equal(await markerIndex(), 1);
    await page.evaluate(state => {
      const node = document.querySelector("#spaceampNowPlaying input[aria-label=\"Volume\"]");
      if (state === "inert") node.parentElement.inert = true;else node[state] = true;
    }, state);
    await action("left");
    assert.equal(await playerNode(), "progress");
    assert.equal(await markerIndex(), -1);
    await page.evaluate(state => {
      const node = document.querySelector("#spaceampNowPlaying input[aria-label=\"Volume\"]");
      if (state === "inert") node.parentElement.inert = false;else node[state] = false;
    }, state);
    await action("right");
    assert.equal(await playerNode(), "volume");
  }
};
