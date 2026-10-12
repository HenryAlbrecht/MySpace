const assert = require("node:assert/strict");

async function continuity({ page, route, playLocal, linkLegacy, confirmYouTube }) {
  await playLocal();
  await page.evaluate(() => SPACEAMP.setVolume(0.2));
  const queue = await page.evaluate(() => JSON.stringify(SPACEAMP.getState().queue));
  await page.evaluate(() => {
    window.__audio = document.querySelector("#audio");
    window.__localTime = __audio.currentTime;
  });
  for (const hash of ["colecao", "fotos", "spacevoice", "buscar", "descobrir", "perfil"]) {
    await route(hash);
    assert.equal(await page.locator("#globalSpaceAmp").isVisible(), true);
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
    assert.equal(await page.evaluate(() => document.querySelector("#audio") === __audio), true);
    assert.equal(await page.evaluate(() => JSON.stringify(SPACEAMP.getState().queue)), queue);
  }
  assert.equal(
    await page.locator("#globalSpaceAmp .amp-mini").isVisible(),
    false,
    "Profile uses full presentation",
  );
  const home = await page.locator("#ampHome").boundingBox();
  const full = await page.locator("#globalSpaceAmp").boundingBox();
  assert.ok(Math.abs(home.x - full.x) < 2 && Math.abs(home.y - full.y) < 2);
  await route("colecao");
  const localSize = await page.locator("#globalSpaceAmp").boundingBox();
  await page.waitForFunction(() => __audio.currentTime > __localTime + 0.25);
  assert.equal(await page.locator("#audio").evaluate((audio) => audio.volume), 0.2);
  await page.locator("#globalSpaceAmp .amp-expand").click();
  await page.waitForFunction(() =>
    document.querySelector("#globalSpaceAmp").classList.contains("in-profile"),
  );
  await linkLegacy();
  await confirmYouTube();
  await page.evaluate(() => {
    window.__frame = document.querySelector("#music iframe");
    window.__player = __ytTest;
    window.__frameSrc = __frame.src;
    window.__ytTime = __player.getCurrentTime();
  });
  await route("colecao");
  const ytSize = await page.locator("#globalSpaceAmp").boundingBox();
  assert.equal(ytSize.width, localSize.width);
  assert.equal(ytSize.height, localSize.height);
  for (const hash of ["buscar", "descobrir", "perfil"]) {
    await route(hash);
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("#music iframe") === __frame &&
          __ytTest === __player &&
          __frame.src === __frameSrc,
      ),
      true,
    );
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
  }
  assert.equal(await page.locator("#music iframe").isVisible(), true);
  assert.equal(await page.evaluate(() => __ytCreations), 1);
  await page.waitForFunction(() => __ytTest.getCurrentTime() > __ytTime + 0.25);
}

module.exports = { continuity };
