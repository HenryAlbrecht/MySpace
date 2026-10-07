// One browser/context; only Collection source linking. No playback or PARTY tests.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs"),
  { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const pending = new Map(),
  requests = [];
const music = createMusicCatalog({
  youtubeMusic: {
    searchTracks: (target) => {
      requests.push(target);
      return new Promise((resolve, reject) =>
        pending.set(target.title, { resolve, reject, target }),
      );
    },
  },
  musicbrainz: {
    playbackSource: async () => {
      throw Error("fixture unavailable");
    },
  },
});
const web = createServer({ music });
let browser;
const candidate = (target, id = "10z6-vQm23w", album = target.albumTitle) => ({
  title: target.title,
  artist: target.artist,
  album,
  duration: target.trackDuration,
  videoId: id,
  url: "https://www.youtube.com/watch?v=" + id,
  image: "",
  resultType: "song",
});
(async () => {
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.route("https://**/*", (r) => r.abort());
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + web.address().port + "/?voiceTransport=local#perfil");
    await page.waitForFunction(() => window.CollectionActions && window.MusicSourceLink);
    async function add(title, id) {
      // Reproduce the catalog-seeded editor, rather than bypassing it with saveMusic.
      await page.evaluate(
        ({ title, id }) =>
          CollectionActions.editItem({
            kind: "music",
            title,
            artist: "Artist",
            catalogId: "itunes:" + id,
            albumTitle: "Album",
            trackDuration: 210,
            image: "profile-art.png",
          }),
        { title, id },
      );
      await page.locator("#resourceEditor button[type=submit]").click();
      await page.waitForFunction(
        (id) => CollectionActions.getItems().some((i) => i.catalogId === "itunes:" + id),
        id,
      );
      return page.evaluate(
        (id) => CollectionActions.getItems().find((i) => i.catalogId === "itunes:" + id),
        id,
      );
    }
    async function waitRequest(title) {
      const end = Date.now() + 5000;
      while (!pending.has(title)) {
        if (Date.now() > end) throw Error("no source request: " + title);
        await new Promise((r) => setTimeout(r, 20));
      }
      return pending.get(title);
    }
    const first = await add("Pursuing My True Self", 1001),
      auto = await waitRequest("Pursuing My True Self");
    assert.equal(
      await page.evaluate(
        (id) => CollectionActions.getItems().find((i) => i.id === id).playbackLookup,
        first.id,
      ),
      "searching",
    );
    assert.equal(auto.target.albumTitle, "Album");
    assert.equal(auto.target.trackDuration, 210);
    auto.resolve([candidate(auto.target)]);
    await page.waitForFunction(
      (id) => !!CollectionActions.getItems().find((i) => i.id === id)?.playbackSource,
      first.id,
    );
    await add("Pursuing My True Self", 1001);
    assert.equal(requests.filter((r) => r.title === "Pursuing My True Self").length, 1);
    assert.equal(
      await page.evaluate(
        () => CollectionActions.getItems().filter((i) => i.catalogId === "itunes:1001").length,
      ),
      1,
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("myspace-extras-v1")).items.find(
            (i) => i.catalogId === "itunes:1001",
          ).playbackSource.videoId,
      ),
      "10z6-vQm23w",
    );
    const manual = await add("Manual", 1002),
      manualRequest = await waitRequest("Manual");
    await page.evaluate(
      (id) =>
        CollectionActions.updateItem(id, {
          playbackSource: { type: "local", fileRef: "user-file" },
        }),
      manual.id,
    );
    manualRequest.resolve([candidate(manualRequest.target)]);
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        (id) => CollectionActions.getItems().find((i) => i.id === id).playbackSource.fileRef,
        manual.id,
      ),
      "user-file",
    );
    const edit = await add("Edit", 1003),
      editRequest = await waitRequest("Edit");
    await page.evaluate((id) => CollectionActions.updateItem(id, { title: "Edited" }), edit.id);
    editRequest.resolve([candidate(editRequest.target)]);
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        (id) => CollectionActions.getItems().find((i) => i.id === id).playbackSource,
        edit.id,
      ),
      null,
    );
    const choice = await add("Signs Of Love", 1004),
      choiceRequest = await waitRequest("Signs Of Love");
    choiceRequest.resolve([
      candidate(choiceRequest.target, "10z6-vQm23w", "Compilation"),
      candidate(choiceRequest.target, "dQw4w9WgXcQ", "Single"),
    ]);
    await page.waitForSelector(".music-link-dialog[open]");
    assert.equal(await page.locator(".music-source-candidates button").count(), 2);
    assert.equal(requests.filter((r) => r.title === "Signs Of Love").length, 1);
    await page.locator(".music-source-candidates button").nth(1).click();
    assert.equal(
      await page.evaluate(
        (id) => CollectionActions.getItems().find((i) => i.id === id).playbackSource,
        choice.id,
      ),
      null,
    );
    assert.ok((await page.locator(".music-source-candidates").textContent()).includes("3:30"));
    fs.mkdirSync("artifacts/music-playback-resolver", { recursive: true });
    await page
      .locator(".music-link-dialog")
      .screenshot({ path: "artifacts/music-playback-resolver/choose.png" });
    await page
      .locator(".music-link-dialog")
      .getByRole("button", { name: "salvar", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        (id) => CollectionActions.getItems().find((i) => i.id === id).playbackSource.videoId,
        choice.id,
      ),
      "dQw4w9WgXcQ",
    );
    const failed = await add("Unavailable", 1005),
      failedRequest = await waitRequest("Unavailable");
    failedRequest.reject(Error("fixture timeout"));
    await page.waitForFunction(
      (id) => CollectionActions.getItems().find((i) => i.id === id)?.playbackLookup === "failed",
      failed.id,
    );
    assert.equal(
      await page.evaluate(
        (id) => CollectionActions.getItems().find((i) => i.id === id).catalogId,
        failed.id,
      ),
      "itunes:1005",
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS: one browser/context; immediate Collection save, persisted auto-link, no duplicate/search, manual/edit wins, cached choice dialog, confirm-before-save, provider-down metadata preserved.",
    );
  } finally {
    await browser?.close();
    for (const task of pending.values()) task.resolve([]);
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
