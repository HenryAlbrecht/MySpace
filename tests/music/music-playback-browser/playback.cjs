const assert = require("node:assert/strict");

async function local({ page, playLocal, playing, route }) {
  await playLocal();
  assert.equal(await page.evaluate(() => navigator.mediaSession.metadata.title), "Catalog song");
  await page.evaluate(() => SPACEAMP.share(false));
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), "playing");
  assert.equal(await page.evaluate(() => SPACEAMP.getNowPlaying()), null);
  await route("colecao");
  await page
    .locator("#globalSpaceAmp .amp-mini")
    .getByRole("button", { name: "Pausar música" })
    .click();
  await playing(false);
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), "paused");
  await page.evaluate(() => SPACEAMP.play());
  await playing(true);
  await page.evaluate(() => __handlers.pause());
  await playing(false);
  await page.evaluate(() => __handlers.play());
  await playing(true);
  await page.evaluate(() => {
    SPACEAMP.enqueue(MusicModel.queueTrack(CollectionActions.getItems()[0]));
    SPACEAMP.addToCollection();
  });
  assert.equal(await page.evaluate(() => SPACEAMP.getState().queue.length), 1);
  assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
  assert.equal(await page.evaluate(() => CollectionActions.getItems()[0].catalogId), "deezer:123");
  await page.evaluate(() => SPACEAMP.setVolume(0.2));
  assert.equal(await page.locator("#audio").evaluate((audio) => audio.volume), 0.2);
  await page.evaluate(() => SPACEAMP.stop());
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator("#globalSpaceAmp")
      .evaluate((node) => getComputedStyle(node).transitionDuration),
    "0s",
  );
}

async function youtube({ page, playLocal, linkLegacy, confirmYouTube, playing }) {
  await playLocal();
  await linkLegacy();
  assert.equal(await page.evaluate(() => document.querySelector("#audio").paused), true);
  assert.equal(
    await page.evaluate(() => SPACEAMP.getState().playing),
    false,
    "Creating the iframe is not confirmed playback",
  );
  await confirmYouTube();
  assert.equal(await page.locator("#music iframe").isVisible(), true);
  await page.evaluate(() => SPACEAMP.share(true));
  assert.equal(await page.evaluate(() => SPACEAMP.getNowPlaying().title), "Old music");
  await page.evaluate(() => SPACEAMP.setVolume(0.35));
  assert.equal(await page.evaluate(() => __ytTest.volume), 35);
  await page.evaluate(() => __handlers.pause());
  await playing(false);
  await page.evaluate(() => __handlers.play());
  await playing(true);
  await page.evaluate(() => SPACEAMP.addToCollection());
  assert.equal(
    await page.evaluate(
      () => CollectionActions.getItems().filter((item) => item.title === "Old music").length,
    ),
    1,
  );
  assert.equal(
    await page.evaluate(
      () => CollectionActions.getItems().find((item) => item.title === "Old music").catalogId,
    ),
    "lastfm:old",
  );
  await page.evaluate(() => SPACEAMP.previous());
  await page.waitForFunction(
    () => SPACEAMP.getState().source === "local" && SPACEAMP.getState().playing,
  );
  assert.equal(await page.locator("#music iframe").count(), 0);
  assert.equal(await page.evaluate(() => __ytTest.destroyed), true);
  await page.evaluate(() => SPACEAMP.next());
  await page.waitForFunction(
    () => SPACEAMP.getState().source === "YouTube Music" && !__ytTest.destroyed,
  );
  await confirmYouTube();
  await page.evaluate(() => __ytTest.emit(0));
  assert.equal(await page.evaluate(() => SPACEAMP.getNowPlaying()), null);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.CollectionActions);
  assert.equal(
    await page.evaluate(
      () =>
        CollectionActions.getItems().find((item) => item.title === "Old music").playbackSource.type,
    ),
    "youtube",
  );
  assert.ok(
    await page.evaluate(() =>
      SPACEAMP.getState().queue.some(
        (track) =>
          track.collectionId ===
          CollectionActions.getItems().find((item) => item.title === "Old music").id,
      ),
    ),
  );
}

module.exports = { local, youtube };
