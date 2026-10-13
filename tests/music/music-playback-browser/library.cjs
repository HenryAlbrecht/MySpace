"use strict";

const assert = require("node:assert/strict");

async function windows({ page, playLocal, playing }) {
  const snapshot = () =>
    page.evaluate(() => ({
      title: SPACEAMP.getPlaybackState().title,
      playing: SPACEAMP.getPlaybackState().playing,
      players: document.querySelectorAll("audio, iframe").length,
    }));
  await playLocal();
  const before = await snapshot();

  await page.locator("#spaceAmpOpenLibrary").click();
  const library = page.locator("#spaceAmpLibrary");
  await library.waitFor({ state: "visible" });
  assert.deepEqual(await snapshot(), before, "Opening the Library preserves playback");
  assert.equal(await page.locator("#music .saved-playlists-fold").count(), 0);
  await library.getByLabel("Nome da nova playlist").fill("Fixture Mix");
  await library.getByRole("button", { name: "＋ criar playlist" }).click();
  await library.getByLabel("Música da Collection para adicionar").selectOption("song");
  await library.getByRole("button", { name: "＋ adicionar da Collection" }).click();
  assert.equal(await library.locator(".spaceamp-library-track").count(), 1);
  assert.match(await library.locator(".spaceamp-library-track").innerText(), /Catalog song/);
  page.once("dialog", (dialog) => dialog.accept("Renamed Mix"));
  await library.getByRole("button", { name: "renomear" }).click();
  assert.equal(await library.locator(".spaceamp-library-heading h2").textContent(), "Renamed Mix");
  await library.getByRole("button", { name: "▶ tocar playlist" }).click();
  await playing(true);
  await page.waitForFunction(
    () => SPACEAMP.getPlaybackState().title === "Catalog song" && SPACEAMP.getState().queue.length === 1,
  );
  const playingPlaylist = await snapshot();
  await library.getByRole("button", { name: "Fechar biblioteca musical" }).click();

  await page.locator("#spaceAmpOpenQueue").click();
  const queue = page.locator("#spaceAmpQueue");
  await queue.waitFor({ state: "visible" });
  assert.deepEqual(await snapshot(), playingPlaylist, "Opening the Queue preserves playback");
  assert.equal(await queue.locator(".spaceamp-queue-row").count(), 1);
  assert.match(await queue.locator(".spaceamp-queue-context").innerText(), /Renamed Mix/);
  assert.match(await queue.locator(".spaceamp-queue-current").innerText(), /Catalog song/);
  await queue.getByRole("button", { name: "Fechar fila de reprodução" }).click();
  assert.deepEqual(await snapshot(), playingPlaylist, "Closing both windows preserves playback");

  await page.locator("#spaceAmpOpenLibrary").click();
  await library.waitFor({ state: "visible" });
  page.once("dialog", (dialog) => dialog.accept());
  await library.getByRole("button", { name: "excluir" }).click();
  assert.equal(await library.locator(".spaceamp-library-empty").count(), 1);
  assert.deepEqual(await snapshot(), playingPlaylist, "Deleting the saved playlist does not stop its active session");
}

module.exports = { windows };
