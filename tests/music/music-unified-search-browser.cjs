const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs"),
  { createMusicCatalog } = require("../../server/music-catalog.cjs");
const song = {
  kind: "music",
  catalogId: "ytmusic:video:10z6-vQm23w",
  title: "Wonderwall",
  artist: "Oasis",
  albumTitle: "Morning Glory",
  source: "YouTube Music",
  image: "profile-art.png",
  playbackSource: {
    type: "youtube",
    videoId: "10z6-vQm23w",
    url: "https://www.youtube.com/watch?v=10z6-vQm23w",
  },
};
const music = createMusicCatalog({
  youtubeMusic: {
    search: async () => ({ items: [song] }),
    details: async () => song,
  },
  lastfm: { summary: async () => ({ summary: "Fixture biography" }) },
});
(async () => {
  let browser;
  const web = createServer({ music });
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    const context = await browser.newContext();
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const wav = Buffer.alloc(44 + 8000 * 2 * 4);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(wav.length - 44, 40);
    await context.route("**/fixture.wav", (r) =>
      r.fulfill({ contentType: "audio/wav", body: wav }),
    );
    await context.route("**/api/music/playback-source?**", (r) =>
      r.fulfill({
        json: {
          status: "not-found",
          items: [],
          source: null,
          provider: "MusicBrainz",
        },
      }),
    );
    const base = "http://127.0.0.1:" + web.address().port;
    await page.goto(base + "/?voiceTransport=local#perfil", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => window.Catalog && window.CollectionActions && window.MusicBridge && window.SPACEAMP,
    );
    const saved = await page.evaluate(async () => {
      const rows = await Catalog.search("music", "Wonderwall");
      if (rows.length !== 1 || rows[0].catalogId !== "ytmusic:video:10z6-vQm23w")
        throw Error("Missing canonical catalog result");
      const detail = await Catalog.details(rows[0]);
      if (detail.source !== "YouTube Music" || detail.summarySource !== "Last.fm")
        throw Error("Missing canonical detail/editorial");
      if (
        detail.playbackSource?.type !== "youtube" ||
        detail.playbackSource.videoId !== detail.catalogId.split(":")[2]
      )
        throw Error("Missing matching canonical playback source");
      const item = CollectionActions.saveMusic({
        ...detail,
        status: "planned",
      });
      MusicBridge.link(item);
      return { id: item.id, catalogId: item.catalogId };
    });
    assert.equal(
      await page.evaluate(
        (saved) =>
          CollectionActions.getItems().some(
            (item) => item.id === saved.id && item.catalogId === saved.catalogId,
          ),
        saved,
      ),
      true,
    );
    await page.getByLabel("Link de reprodução").fill(base + "/fixture.wav");
    await page
      .locator(".music-link-dialog")
      .getByRole("button", { name: "salvar", exact: true })
      .click();
    await page.waitForFunction(
      (saved) =>
        CollectionActions.getItems().find((item) => item.id === saved.id)?.playbackSource?.url ===
        location.origin + "/fixture.wav",
      saved,
    );
    const linked = await page.evaluate(
      (saved) => CollectionActions.getItems().find((item) => item.id === saved.id),
      saved,
    );
    assert.equal(linked.playbackSource.type, "audio");
    assert.equal(linked.playbackSource.url, base + "/fixture.wav");
    assert.equal(linked.catalogId, saved.catalogId);
    assert.equal(linked.id, saved.id);
    await page.evaluate(
      (saved) =>
        SPACEAMP.play(
          MusicModel.queueTrack(CollectionActions.getItems().find((item) => item.id === saved.id)),
        ),
      saved,
    );
    await page.waitForFunction(() => SPACEAMP.getState().playing);
    await page.evaluate(() => SPACEAMP.stop());
    assert.equal(
      await page.evaluate(
        (saved) =>
          CollectionActions.getItems().some(
            (item) => item.id === saved.id && item.catalogId === saved.catalogId,
          ),
        saved,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: canonical Catalog -> editorial -> Collection -> manual audio URL -> real SPACEAMP playback; catalog/entity identity retained; zero pageerrors.",
    );
  } finally {
    if (browser) await browser.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
