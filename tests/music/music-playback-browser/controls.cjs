const assert = require("node:assert/strict");

async function profile({ page, playLocal, linkImported, confirmYouTube, playing, route }) {
  await playLocal();
  assert.equal(
    await page.locator("#songTitle .spaceamp-metadata-link").getAttribute("href"),
    "#titulo/music/ytmusic%3Avideo%3AdQw4w9WgXcQ",
  );
  assert.equal(
    await page.locator("#songArtist .spaceamp-metadata-link").getAttribute("href"),
    "#titulo/artist/lastfm-artist%3AArtist",
  );
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
  assert.equal(
    await page.locator("#globalSpaceAmp .amp-mini-info strong a").getAttribute("href"),
    "#titulo/music/ytmusic%3Avideo%3AdQw4w9WgXcQ",
  );
  assert.equal(
    await page.locator("#globalSpaceAmp .amp-mini-info span a").getAttribute("href"),
    "#titulo/artist/lastfm-artist%3AArtist",
  );
  await page.locator("#globalSpaceAmp .amp-mini-info span a").click();
  await page.waitForFunction(() => location.hash.startsWith("#titulo/artist/"));
  await route("perfil");
  await page.locator("#songTitle .spaceamp-metadata-link").click();
  await page.waitForFunction(() => location.hash.startsWith("#titulo/music/"));
  await route("perfil");
  await linkImported();
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
  assert.equal(await page.evaluate(() => SPACEAMP.getState().source), "YouTube Music");
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playbackContext.type), "single");
  await page.locator("#music").getByRole("button", { name: "Próxima faixa", exact: true }).click();
  assert.equal(await page.evaluate(() => __ytTest === __player), true);
  assert.equal(await page.locator("#music iframe").count(), 1);
  await page.locator("#music .volume input").fill("0.35");
  await page.locator("#music .volume input").dispatchEvent("input");
  assert.equal(await page.evaluate(() => __ytTest.volume), 35);
}

module.exports = { profile };
