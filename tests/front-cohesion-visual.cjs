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
const output = path.resolve("artifacts/front-polish/" + (process.argv[2] || "after") + "");
const verifyPolish = process.argv[2] !== 'before';
fs.mkdirSync(output, { recursive: true });
const screenshots = new Set([
  'profile-390', 'search-390', 'collection-list-1440',
  'music-detail-1440', 'party-screen-820', 'appearance-390', 'xmb-1440',
]);
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
    await context.route("https://**/*", route => route.abort());
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
      Catalog.search = async () => Array.from({length: 12}, (_, n) => ({
        ...music, id: 'fixture-' + n, catalogId: 'itunes:fixture-' + n,
        title: 'Faixa de teste ' + (n + 1), source: 'iTunes',
      }));
      Catalog.recommendations = async () => Catalog.search();
      Catalog.details = async item => item;
      Catalog.summary = async item => item;
      Catalog.forCollection = async () => ({ items: await Catalog.search(), seeds: 1, failures: 0 });
      SPACEAMP.update(
        { title: music.title, artist: music.artist, artwork: music.image, source: "local" },
        true,
        { available: true, stopped: false },
      );
      SPACEAMP.progress({ position: 20, duration: 120 });
    }, base);
    async function capture(name) {
      await page.evaluate(() => Promise.all(document.getAnimations()
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {}))));
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        audio: document.querySelectorAll("audio").length,
      }));
      assert.equal(layout.overflow, false, name);
      assert.equal(layout.audio, 1, name);
      layouts.push({ name, ...layout });
      if (screenshots.has(name)) {
        await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
      }
    }
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [hash, name] of [
        ["#perfil", "profile"],
        ["#colecao", "collection"],
        ["#buscar/music/test", "search"],
        ["#descobrir", "discover"],
        ["#spacevoice", "party"],
      ]) {
        await page.evaluate((hash) => {
          location.hash = hash;
        }, hash);
        await page.waitForTimeout(150);
        await capture(name + "-" + width);
      }
    }
    await page.evaluate(() => (location.hash = '#colecao'));
    await page.waitForTimeout(150);
    await page.getByLabel('Alternar entre capas e lista').click();
    await page.waitForTimeout(250);
    const originalTint = await page.locator('.list-entry.is-selected').evaluate(element =>
      getComputedStyle(element).backgroundColor);
    await page.evaluate(() => document.body.style.setProperty('--accent', '#b84f2c'));
    await page.waitForTimeout(250);
    const selectedTint = await page.locator('.list-entry.is-selected').evaluate(element =>
      getComputedStyle(element).backgroundColor);
    if (verifyPolish) assert.notEqual(selectedTint, originalTint);
    await page.evaluate(() => document.body.style.removeProperty('--accent'));
    await capture('collection-list-1440');
    await page.getByRole('button', { name: '[ modo XMB ]', exact: true }).click();
    await page.waitForTimeout(250);
    await capture('xmb-1440');
    await page.keyboard.press('Escape');
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
    await page.evaluate(async base => {
      await TitlePages.open({
        id: 'editorial-fixture', kind: 'music', title: 'Uma música com título longo',
        artist: 'Artista de teste', source: 'iTunes', catalogId: 'itunes:99999',
        image: base + '/profile-art.png', summarySource: 'Last.fm',
        summary: 'Um texto editorial de teste. A descrição mantém a identidade de leitura da página, enquanto os controles ficam separados das informações do catálogo.',
      });
    }, base);
    await page.waitForSelector('#titlePage h1');
    await page.getByRole('button', { name: 'carregar recomendações', exact: true }).click();
    await page.waitForTimeout(250);
    await capture('music-detail-1440');
    for (const width of [390, 820]) {
      await page.setViewportSize({width, height: 900});
      await capture('music-detail-' + width);
    }
    for (const theme of ['night', 'terminal', 'candy', 'paper']) {
      await page.evaluate(theme => {
        document.body.dataset.theme = theme;
        document.body.style.setProperty('--accent', '#b84f2c');
      }, theme);
      await capture('theme-' + theme);
      if (verifyPolish) {
        const danger = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--danger').trim());
        assert.equal(danger, ['paper', 'candy'].includes(theme) ? '#a52343' : '#f29cb0');
      }
    }
    await page.emulateMedia({reducedMotion: 'reduce'});
    assert.equal(await page.locator('.discovery-grid .discover-card').first().evaluate(
      element => getComputedStyle(element).animationName), 'none');
    checks.push('all four themes/custom accent, 75% opacity, reduced motion and XMB layout');
    await page.evaluate(() => (location.hash = '#spacevoice'));
    await page.waitForTimeout(150);
    if (await page.locator('.spacevoice').getAttribute('data-context') !== 'none') {
      await page.locator('.party-chat-toggle').click();
    }
    // Visual state only: no media capture, peers, signaling or call-controller mutation.
    await page.evaluate(() => {
      const root = document.querySelector('.spacevoice');
      root.dataset.mode = 'screen';
      root.dataset.joined = 'true';
      root.querySelector('.spacevoice-stage > button').hidden = true;
      root.querySelector('.spacevoice-stage > h3').hidden = true;
      root.querySelector('.spacevoice-stage > p').hidden = true;
      const screens = root.querySelector('.spacevoice-screens');
      screens.hidden = false;
      const viewer = root.querySelector('.spacevoice-screen-viewer');
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'aspect-ratio:16/9;width:100%;display:grid;place-items:center;background:var(--bg);color:var(--muted)';
      placeholder.textContent = 'Compartilhamento · fixture visual';
      viewer.append(placeholder);
    });
    await capture('party-screen-820');
    await page.locator('.party-chat-toggle').click();
    await capture('party-chat-820');
    await page.evaluate(() => (location.hash = '#perfil'));
    await page.setViewportSize({width: 390, height: 900});
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '▧ APARÊNCIA', exact: true }).click();
    await capture('appearance-390');
    if (verifyPolish) {
      assert.equal(await page.locator('.appearance-reset').count(), 1);
      assert.equal(await page.locator('.appearance-reset.dialog-delete').count(), 0);
    }
    await page.keyboard.press('Escape');
    if (verifyPolish) {
      const sizes = await page.locator('#music .player-controls > div button').evaluateAll(buttons =>
        buttons.map(button => ({width: button.offsetWidth, height: button.offsetHeight})));
      assert.ok(sizes.length && sizes.every(size => size.width >= 44 && size.height >= 44));
      checks.push('mobile transport has 44 px targets; theme danger and custom list accent follow tokens');
    }
    const nav = page.locator('.nav a').first();
    await nav.focus();
    assert.equal(await nav.evaluate(element => element.matches(':focus-visible')), true);
    await page.keyboard.press('Tab');
    checks.push('keyboard focus remains visible; appearance reset uses secondary action styling');
    await page.evaluate(() => {
      Catalog.search = () => new Promise(resolve => { window.__finishSearch = resolve; });
      location.hash = '#buscar/music/loading-fixture';
    });
    await page.waitForSelector('.discover-status[data-state="loading"]');
    await capture('search-loading-390');
    await page.evaluate(() => __finishSearch([]));
    await page.waitForSelector('.discover-status[data-state="empty"]');
    await capture('search-empty-390');
    await page.evaluate(() => {
      Catalog.search = async () => { throw new Error('Fixture: unavailable'); };
      location.hash = '#buscar/music/error-fixture';
    });
    await page.waitForSelector('.discover-status[data-state="error"]');
    await capture('search-error-390');
    checks.push('search loading, empty and error states render with local fixtures');
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

