const assert = require("node:assert/strict");

async function local({ page, route, playLocal, playing }) {
  await playLocal();
  await route("colecao");
  await page.evaluate(() => {
    SPACEAMP.share(true);
    SPACEAMP.setVolume(0.2);
    window.__audio = document.querySelector("#audio");
    window.__queue = JSON.stringify(SPACEAMP.getState().queue);
    window.__time = __audio.currentTime;
  });
  await page.getByRole("button", { name: "Ocultar SPACEAMP compacto", exact: true }).click();
  assert.equal(await page.locator("#globalSpaceAmp").isVisible(), false);
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
  await page.waitForFunction(() => __audio.currentTime > __time + 0.2);
  await page.getByRole("button", { name: "Abrir SPACEAMP compacto", exact: true }).click();
  assert.equal(await page.locator("#globalSpaceAmp").isVisible(), true);
  assert.equal(await page.evaluate(() => document.querySelector("#audio") === __audio), true);
  assert.equal(
    await page.evaluate(() => JSON.stringify(SPACEAMP.getState().queue)),
    await page.evaluate(() => __queue),
  );
  assert.equal(await page.evaluate(() => SPACEAMP.getNowPlaying().title), "Catalog song");
  assert.equal(await page.locator("#audio").evaluate((audio) => audio.volume), 0.2);
  await page
    .locator("#globalSpaceAmp .amp-mini")
    .getByRole("button", { name: "Pausar música" })
    .click();
  await playing(false);
  assert.equal(await page.locator("#music #play").getAttribute("aria-label"), "Reproduzir música");
  await page
    .locator("#globalSpaceAmp .amp-mini")
    .getByRole("button", { name: "Reproduzir música" })
    .click();
  await playing(true);
  assert.equal(await page.locator("#music #play").innerText(), "❚❚");
}

async function youtube({ page, route, linkLegacy, confirmYouTube }) {
  await linkLegacy();
  await confirmYouTube();
  await page.evaluate(() => {
    SPACEAMP.share(true);
    SPACEAMP.setVolume(0.35);
    window.__frame = document.querySelector("#music iframe");
    window.__player = __ytTest;
    window.__frameSrc = __frame.src;
    window.__time = __player.getCurrentTime();
  });
  await route("colecao");
  await page.getByRole("button", { name: "Ocultar SPACEAMP compacto", exact: true }).click();
  assert.equal(await page.locator("#music iframe").isVisible(), false);
  assert.equal(await page.locator("#globalSpaceAmp").isVisible(), false);
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector("#music iframe") === __frame &&
        __ytTest === __player &&
        SPACEAMP.getState().playing,
    ),
    true,
  );
  await page.waitForFunction(() => __ytTest.getCurrentTime() > __time + 0.25);
  await page.getByRole("button", { name: "Abrir SPACEAMP compacto", exact: true }).click();
  assert.equal(await page.locator("#music iframe").count(), 1);
  assert.equal(await page.locator("#music iframe").isVisible(), true);
  const frame = await page.locator("#music iframe").boundingBox();
  assert.ok(frame.width >= 200 && frame.height >= 200);
  assert.equal(await page.evaluate(() => __ytCreations), 1);
  assert.equal(
    await page.evaluate(() => __frame.src === __frameSrc && __ytTest.volume === 35),
    true,
  );
  assert.equal(await page.evaluate(() => SPACEAMP.getNowPlaying().title), "Old music");
  await page.locator("#globalSpaceAmp .amp-expand").click();
  await page.waitForFunction(() =>
    document.querySelector("#globalSpaceAmp").classList.contains("in-profile"),
  );
  assert.equal(
    await page.evaluate(
      () => __ytTest === __player && document.querySelector("#music iframe") === __frame,
    ),
    true,
  );
}

module.exports = { local, youtube };
