// One browser/context; local fixtures, no microphone or WebRTC negotiation.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../server.cjs");
const output = path.resolve("artifacts/organization-pass");
fs.mkdirSync(output, { recursive: true });
const errors = [],
  checks = [],
  layouts = [];
const web = createServer({
  music: {
    search: async () => ({ items: [] }),
    summary: async () => ({}),
    recommendations: async () => ({ items: [] }),
    artistPhoto: async () => ({}),
    details: async () => ({}),
  },
});
let browser;
(async () => {
  try {
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + web.address().port;
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await context.route("**/spacevoice.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body:
          fs.readFileSync("dist/spacevoice.js", "utf8") +
          ";const originalPartyUI=createSpaceVoice;createSpaceVoice=options=>(window.__partyUI=originalPartyUI(options));",
      }),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/?voiceTransport=local#perfil");
    await page.waitForFunction(() => window.CollectionActions && document.querySelector("#globalSpaceAmp"));
    await page.evaluate((base) => {
      const music = {
        id: "org-track",
        kind: "music",
        title: "Faixa de teste",
        artist: "Artista",
        image: base + "/profile-art.png",
        playbackSource: { type: "audio", url: "https://example.com/song.mp3" },
      };
      CollectionActions.saveMusic(music);
      Catalog.forCollection = async () => ({ items: [], seeds: 1, failures: 0 });
      SPACEAMP.update(
        { title: music.title, artist: music.artist, artwork: music.image, source: "local" },
        true,
        { available: true, stopped: false },
      );
      SPACEAMP.progress({ position: 20, duration: 120 });
    }, base);
    async function capture(name) {
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        audio: document.querySelectorAll("audio").length,
      }));
      assert.equal(layout.overflow, false, name);
      assert.equal(layout.audio, 1, name);
      layouts.push({ name, ...layout });
      await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
    }
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [hash, name] of [
        ["#perfil", "profile"],
        ["#colecao", "collection"],
        ["#buscar/music/test", "search"],
        ["#spacevoice", "party"],
      ]) {
        await page.evaluate((hash) => {
          location.hash = hash;
        }, hash);
        await page.waitForTimeout(150);
        await capture(name + "-" + width);
      }
    }
    await page.evaluate(() => (location.hash = "#perfil"));
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "▧ APARÊNCIA", exact: true }).click();
    await page.locator('#resourceEditor [role="tab"]').filter({ hasText: "Estilo" }).click();
    const opacity = page.locator('#resourceEditor [name="opacity"]');
    await opacity.focus();
    await page.keyboard.press("Home");
    for (let step = 0; step < 30; step++) await page.keyboard.press("ArrowRight");
    await page.locator('#resourceEditor button[type="submit"]').click();
    assert.equal(await page.evaluate(() => document.body.style.getPropertyValue("--panel-opacity")), "75%");
    checks.push("appearance editor saves and applies existing opacity preference");
    await page.evaluate(() => (location.hash = "#colecao"));
    await page.waitForTimeout(100);
    await page.evaluate(() => MusicBridge.link(CollectionActions.getItems()[0]));
    await page.waitForSelector(".music-link-dialog[open]");
    await page.keyboard.press("Escape");
    checks.push("MusicBridge facade opens/closes extracted source dialog");
    await page.evaluate(() => (location.hash = "#spacevoice"));
    await page.waitForTimeout(100);
    await page.evaluate(() => __partyUI.enterRoom());
    const toggle = page.locator(".party-chat-toggle");
    await toggle.click();
    await page.locator(".spacevoice-chat-input").fill("mensagem de teste");
    await page.locator(".spacevoice-chat-compose button").click();
    await page.waitForFunction(
      () => document.querySelector(".spacevoice-chat-text")?.textContent === "mensagem de teste",
    );
    await capture("party-chat-1440");
    await toggle.click();
    await toggle.click();
    assert.equal(await page.locator(".spacevoice-chat-line").count(), 1);
    checks.push("local room chat sends, retains DOM and renders after reopening without microphone");
    await page.evaluate(() => __partyUI.leaveRoom());
    await page.evaluate((base) => {
      Catalog.details = async (item) => item;
      TitlePages.open({
        id: "gallery-test",
        kind: "game",
        title: "Galeria de teste",
        source: "IGDB",
        catalogId: "igdb:999999",
        description: "Resumo de teste",
        image: base + "/profile-art.png",
        screenshots: [base + "/profile-art.png", base + "/profile-art.png?second"],
      });
    }, base);
    await page.waitForSelector("#titlePage h1");
    const fold = page
      .locator("#titlePage details")
      .filter({ has: page.locator("summary", { hasText: "screenshots" }) });
    await fold.locator("summary").click();
    await page.locator("#titlePage .gallery-preview").first().click();
    await page.locator(".gallery-next").click();
    await page.locator(".gallery-set-banner").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".gallery-viewer[open]").count(), 0);
    checks.push("extracted title gallery advances, selects banner and closes");
    await capture("gallery-detail-1440");
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify({ errors, checks, layouts, browserContexts: 1 }, null, 2),
    );
    console.log(JSON.stringify({ errors, checks, layouts }));
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
