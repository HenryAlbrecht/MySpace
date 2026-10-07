const assert = require("node:assert/strict");

async function auto({ page, item }) {
  // Automatic resolution is still supported for unlinked imported records.
  await page.evaluate(() =>
    MusicBridge.autoLink(CollectionActions.getItems().find((item) => item.title === "Auto Song")),
  );
  const resolved = await item("Auto Song");
  assert.equal(resolved.playbackSource.type, "youtube");
  assert.equal(resolved.playbackSource.videoId, "dQw4w9WgXcQ");
  assert.equal(resolved.metadataSources.deezerId, "999");
  assert.equal(resolved.catalogId, "deezer:999");
}

async function manual({ page, item }) {
  await page.evaluate(() =>
    MusicBridge.autoLink(CollectionActions.getItems().find((item) => item.title === "Auto Song")),
  );
  await page.evaluate(() =>
    MusicBridge.link(CollectionActions.getItems().find((item) => item.title === "Auto Song")),
  );
  await page
    .getByRole("textbox", { name: "Link de reprodução" })
    .fill("https://www.youtube.com/watch?v=M7lc1UVf-VE");
  await page
    .locator(".music-link-dialog")
    .getByRole("button", { name: "salvar", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      CollectionActions.getItems().find((item) => item.title === "Auto Song").playbackSource
        .videoId === "M7lc1UVf-VE",
  );
  assert.equal((await item("Auto Song")).playbackSource.videoId, "M7lc1UVf-VE");
  assert.equal((await item("Auto Song")).metadataSources.deezerId, "999");
}

async function notFound({ page, item }) {
  await page.evaluate(() =>
    MusicBridge.autoLink(
      CollectionActions.getItems().find((item) => item.title === "Unknown Song"),
    ),
  );
  const unresolved = await item("Unknown Song");
  assert.equal(unresolved.playbackLookup, "not-found");
  assert.equal(unresolved.playbackSource, null);
}

async function choose({ page, item }) {
  await page.evaluate(() =>
    MusicBridge.autoLink(
      CollectionActions.getItems().find((item) => item.title === "Ambiguous Song"),
    ),
  );
  const unresolved = await item("Ambiguous Song");
  assert.equal(unresolved.playbackLookup, "choose");
  assert.equal(unresolved.playbackSource, null);
  await page.evaluate(() =>
    MusicBridge.link(CollectionActions.getItems().find((item) => item.title === "Ambiguous Song")),
  );
  await page.getByRole("button", { name: /Version B/ }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Link de reprodução" }).inputValue(),
    "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  );
  await page
    .locator(".music-link-dialog")
    .getByRole("button", { name: "salvar", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      CollectionActions.getItems().find((item) => item.title === "Ambiguous Song").playbackSource
        ?.videoId === "M7lc1UVf-VE",
  );
  assert.equal((await item("Ambiguous Song")).playbackSource.videoId, "M7lc1UVf-VE");
}

module.exports = { auto, manual, notFound, choose };
