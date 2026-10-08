"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.exports = async function ({ page, pad, selected, testArtifacts }) {
  // Other media keeps details and full-page behavior.
  await page.evaluate(() => __xmb.enter());
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page
      .locator("#xmb-fixture .xmb-category[aria-pressed=true]")
      .getAttribute("data-category"),
    "game",
  );
  await page.evaluate(() =>
    document.querySelector("#xmb-fixture .xmb-category[data-category=game]").click(),
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#xmb-fixture").getAttribute("data-level"), "details");
  await page.keyboard.press("Escape");
  await pad(3, 500);
  assert.deepEqual(await page.evaluate(() => __pages), ["game-0"]);
  fs.mkdirSync(testArtifacts, {
    recursive: true,
  });
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({
      width,
      height: 900,
    });
    await page.emulateMedia({
      reducedMotion: "reduce",
    });
    await page.evaluate(() => __xmb.enter());
    await page.evaluate(() =>
      document.querySelector("#xmb-fixture .xmb-category[data-category=music]").click(),
    );
    await page.screenshot({
      path: path.join(testArtifacts, `xmb-${width}.png`),
    });
    await pad(0);
    await page.waitForSelector("#spaceampNowPlaying[open]");
    assert.equal(await page.locator(".xmb-handoff-artwork").count(), 0);
    // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
    await page.waitForTimeout(300);
    const first = await page.locator(".np-artwork").boundingBox();
    // Compare geometry across a later frame to detect continued movement.
    await page.waitForTimeout(120);
    const second = await page.locator(".np-artwork").boundingBox();
    assert.ok(
      Math.abs(first.x - second.x) < 0.5 && Math.abs(first.y - second.y) < 0.5,
      "settled artwork geometry stays stable",
    );
    await page.screenshot({
      path: path.join(testArtifacts, `now-playing-${width}.png`),
    });
    await pad(1);
    await page.evaluate(() => __xmb.close());
  }
  await page.emulateMedia({
    reducedMotion: "no-preference",
  });
  await page.evaluate(() => __xmb.enter());
  await pad(0);
  await page.waitForSelector("#spaceampNowPlaying[open]");
  const stableId = await selected().getAttribute("data-item-id");
  await page.evaluate(() =>
    __rows.unshift({
      ...__rows[0],
      id: "inserted-track",
      title: "Inserted track",
    }),
  );
  await pad(1);
  // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
  await page.waitForTimeout(300);
  assert.equal(await selected().getAttribute("data-item-id"), stableId);
  await page.evaluate(() => __xmb.close());
  await page.evaluate(() => {
    __pad = null;
    __xmb.enter();
  });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
};
