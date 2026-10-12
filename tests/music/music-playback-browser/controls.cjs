const assert = require("node:assert/strict");

async function profile({ page, playLocal, linkLegacy, confirmYouTube, playing, route }) {
  await playLocal();
  assert.equal(await page.locator("#music .player-controls").isVisible(), true);
  await page.locator("#music #play").click();
  await playing(false);
  await page.locator("#music #play").click();
  await playing(true);
  await route("colecao");
  assert.equal(
    await page
      .locator("#globalSpaceAmp .amp-mini")
      .getByRole("button", { name: "Pausar música" })
      .count(),
    1,
  );
  await route("perfil");
  await linkLegacy();
  await confirmYouTube();
  assert.equal(await page.locator("#music .player-controls").isVisible(), true);
  assert.equal(
    await page
      .locator("#music")
      .getByRole("button", { name: "Faixa anterior", exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await page
      .locator("#music")
      .getByRole("button", { name: "Próxima faixa", exact: true })
      .isVisible(),
    true,
  );
  assert.equal(await page.locator("#music .volume").isVisible(), true);
  await page.evaluate(() => {
    window.__player = __ytTest;
  });
  await page.locator("#music #play").click();
  await playing(false);
  await page.locator("#music #play").click();
  await playing(true);
  assert.equal(await page.evaluate(() => __ytTest === __player), true);
  await page.locator("#music").getByRole("button", { name: "Faixa anterior", exact: true }).click();
  await page.waitForFunction(
    () => SPACEAMP.getState().source === "local" && SPACEAMP.getState().playing,
  );
  assert.equal(await page.locator("#music iframe").count(), 0);
  await page.locator("#music").getByRole("button", { name: "Próxima faixa", exact: true }).click();
  await page.waitForFunction(
    () => __ytTest !== __player && SPACEAMP.getState().source === "YouTube Music",
  );
  await confirmYouTube();
  assert.equal(await page.locator("#music iframe").count(), 1);
  await page.locator("#music .volume input").fill("0.35");
  await page.locator("#music .volume input").dispatchEvent("input");
  assert.equal(await page.evaluate(() => __ytTest.volume), 35);
}

module.exports = { profile };
