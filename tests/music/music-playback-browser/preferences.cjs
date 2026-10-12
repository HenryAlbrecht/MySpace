const assert = require("node:assert/strict");

async function visibility({ page, playLocal, playing, route }) {
  await playLocal();
  await page.evaluate(() => SPACEAMP.pause());
  await playing(false);
  await route("colecao");
  await page.waitForFunction(() =>
    document.querySelector("#globalSpaceAmp").classList.contains("compact-inactive"),
  );
  assert.equal(await page.locator("#globalSpaceAmp").isVisible(), false);
  assert.equal(await page.locator("#ampReopen").isVisible(), false);
  await page.evaluate(() => SPACEAMP.play());
  await playing(true);
  await page.waitForFunction(
    () => !document.querySelector("#globalSpaceAmp").classList.contains("compact-inactive"),
  );
  assert.equal(await page.locator("#globalSpaceAmp").isVisible(), true);
  await route("perfil");
  await page.locator("#showGlobalSpaceAmp").uncheck();
  await route("colecao");
  assert.equal(await page.locator("#globalSpaceAmp").isVisible(), false);
  assert.equal(await page.locator("#ampReopen").isVisible(), false);
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("spaceamp-global-controls-v1")),
    "false",
  );
  await route("perfil");
  await page.locator("#showGlobalSpaceAmp").check();
  await route("colecao");
  assert.equal(await page.locator("#globalSpaceAmp").isVisible(), true);
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
}

module.exports = { visibility };
