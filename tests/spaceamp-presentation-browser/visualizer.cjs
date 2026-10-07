"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  page,
  np,
  toggle,
  mode
}) {
  await mode(0, "audio");
  assert.equal(await np.getAttribute("data-visualizer"), "unavailable");
  assert.equal(await page.locator(".np-visualizer").isVisible(), false);
  await mode(0, "ambient");
  assert.equal(await np.getAttribute("data-visualizer"), "presentation");
  await mode(0, "off");
  assert.equal(await page.locator(".np-visualizer").isVisible(), false);
  await page.evaluate(() => {
    window.__draws = 0;
    const ctx = document.querySelector(".np-visualizer").getContext("2d");
    const stroke = ctx.stroke.bind(ctx);
    ctx.stroke = () => {
      __draws++;
      stroke();
    };
  });
  // Negative window: off mode must not schedule canvas draws.
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => __draws), 0);
  await mode(0, "auto");
  assert.equal(await np.getAttribute("data-visualizer"), "presentation");
  await page.keyboard.press("Escape");
  // Local analyser uses the original audio, never a second audio or iframe PCM.
  await page.evaluate(() => {
    const buffer = new ArrayBuffer(44 + 16000);
    const v = new DataView(buffer);
    const str = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + 16000, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 16000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, 16000, true);
    const audio = document.querySelector("#audio");
    audio.src = URL.createObjectURL(new Blob([buffer], {
      type: "audio/wav"
    }));
    SPACEAMP.update({
      title: "Local",
      artist: "",
      source: "local",
      sourceUrl: "blob:fixture",
      artwork: "profile-art.png"
    }, false, {
      available: true
    });
  });
  await page.locator("#album").click();
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.visualizer === "analyser");
  await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp");
  assert.equal(await page.locator("audio").count(), 1);
  await mode(0, "ambient");
  assert.equal(await np.getAttribute("data-visualizer"), "presentation");
  await mode(0, "audio");
  assert.equal(await np.getAttribute("data-visualizer"), "analyser");
  await mode(0, "auto");
  await toggle.click();
  await mode(1, "visible");
  await page.keyboard.press("Escape");
};
