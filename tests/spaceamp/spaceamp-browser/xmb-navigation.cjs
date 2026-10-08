"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function ({ page, action, testArtifacts }) {
  await page.evaluate(() => {
    __xmb.enter();
    document.querySelector(".xmb").id = "xmb-fixture";
  });
  const root = page.locator("#xmb-fixture");
  async function capture(name) {
    await root.locator(".xmb-detail").evaluate(node =>
      Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))));
    await page.screenshot({ path: path.join(testArtifacts, name) });
  }
  assert.deepEqual(await root.locator(".xmb-category").allTextContents(),
    ["Perfil", "Jogos", "Música", "Vídeo", "Leitura", "Fotos", "Outros"]);
  assert.equal(await root.getAttribute("data-kind"), "music", "Collection filter opens its folder");
  fs.mkdirSync(testArtifacts, { recursive: true });
  for (const width of [1280, 1920, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 900 : width === 1280 ? 720 : 1080 });
    await page.keyboard.press("Escape");
    assert.equal(await root.getAttribute("data-level"), "folders");
    assert.deepEqual(await root.locator("[data-folder]").allTextContents(), ["Músicas▱", "Álbuns▱", "Artistas▱"]);
    await capture(`xmb-${width}-music-root.png`);
    await action("primary");
    assert.equal(await root.getAttribute("data-kind"), "music");
    await capture(`xmb-${width}-music-tracks.png`);
    const row = root.locator('.xmb-item[aria-pressed="true"]');
    await page.keyboard.press("D");
    assert.equal(await root.getAttribute("data-level"), "details");
    await page.keyboard.press("Escape");
    assert.equal(await row.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Escape");
    await action("down");
    await action("primary");
    assert.equal(await root.getAttribute("data-kind"), "album");
    assert.equal(await root.locator(".xmb-item").count(), 0, "empty folder is navigable");
    await action("back");
    assert.equal(await root.locator('[data-folder="album"]').getAttribute("aria-pressed"), "true");
    await root.locator('[data-category="game"]').click();
    assert.equal(await root.getAttribute("data-kind"), "game");
    assert.equal(await root.locator("[data-folder]").count(), 0, "single-kind area has no folder level");
    await capture(`xmb-${width}-games.png`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await root.locator('[data-category="music"]').click();
    await root.locator('[data-folder="music"]').dblclick();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Escape");
  assert.equal(await root.locator(".xmb-detail").evaluate(node => getComputedStyle(node).animationName), "none");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => __xmb.isActive()), false);
};
