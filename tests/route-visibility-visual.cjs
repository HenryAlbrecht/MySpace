// One local browser/context; frame-level visibility, no real providers or capture.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../server.cjs");
const phase = process.argv[2] || "after";
const output = path.resolve("artifacts/route-visibility", phase);
fs.mkdirSync(output, { recursive: true });
const web = createServer({
  music: {
    search: async () => ({ items: [] }),
    details: async () => ({}),
    summary: async () => ({}),
    recommendations: async () => ({ items: [] }),
    artistPhoto: async () => ({}),
  },
});
let browser;
(async () => {
  try {
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.route("https://**/*", (route) => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${web.address().port}/?voiceTransport=local#perfil`);
    await page.waitForSelector(".motion-nav-indicator");
    await page.evaluate(() => {
      Catalog.search = async () => [];
      Catalog.forCollection = async () => ({
        items: [],
        seeds: 1,
        failures: 0,
      });
      Catalog.details = async (item) => item;
      Catalog.summary = async (item) => item;
      window.__visibility = () => {
        const selectors = [
          ".columns",
          "#collectionPage",
          "#photosPage",
          "#spaceVoicePage",
          "#discoverPage",
          "#personalizedDiscovery",
          "#titlePage",
        ];
        const states = selectors.map((selector) => {
          const node = document.querySelector(selector);
          return {
            selector,
            hidden: node.hidden,
            visible:
              !node.hidden &&
              node.getClientRects().length > 0 &&
              getComputedStyle(node).display !== "none",
          };
        });
        return {
          hash: location.hash,
          page: document.body.dataset.page,
          y: scrollY,
          visible: states.filter((state) => state.visible).map((state) => state.selector),
          states,
        };
      };
    });
    const runs = [];
    async function setup(hash) {
      await page.evaluate(async (hash) => {
        if (hash === location.hash) return;
        const routed = new Promise((resolve) =>
          addEventListener("hashchange", resolve, { once: true }),
        );
        location.hash = hash;
        await routed;
      }, hash);
    }
    async function transition(target) {
      const run = await page.evaluate(async (target) => {
        const frames = [{ ...__visibility(), phase: "before" }];
        if (target === "title") {
          TitlePages.open({
            kind: "music",
            catalogId: "itunes:route-fixture",
            title: "Route fixture",
            artist: "Fixture",
          });
        } else {
          document.querySelector(`.nav a[data-route="${target}"]`).click();
        }
        frames.push({ ...__visibility(), phase: "click" });
        const start = performance.now();
        await new Promise((resolve) => {
          function sample(time) {
            frames.push({ ...__visibility(), elapsed: time - start });
            if (time - start < 320) requestAnimationFrame(sample);
            else resolve();
          }
          requestAnimationFrame(sample);
        });
        return frames;
      }, target);
      runs.push(run);
      if (phase === "after")
        for (const frame of run) assert.equal(frame.visible.length, 1, JSON.stringify(frame));
    }
    for (const [from, to] of [
      ["#descobrir", "spacevoice"],
      ["#buscar", "spacevoice"],
      ["#spacevoice", "descobrir"],
      ["#spacevoice", "buscar"],
      ["#colecao", "spacevoice"],
      ["#perfil", "spacevoice"],
      ["#titulo/music/local:fixture", "spacevoice"],
      ["#spacevoice", "colecao"],
    ]) {
      await setup(from);
      await transition(to);
    }
    await setup("#colecao");
    await transition("title");
    await transition("spacevoice");
    const delayed = [];
    for (const source of ["search", "discover"]) {
      await page.evaluate((source) => {
        const pending = () =>
          new Promise((resolve) => {
            window.__finishPending = resolve;
          });
        if (source === "search") Catalog.search = pending;
        else Catalog.forCollection = pending;
      }, source);
      await setup(source === "search" ? "#buscar/music/delayed" : "#descobrir");
      if (source === "discover")
        await page
          .locator("#personalizedDiscovery button")
          .filter({ hasText: /carregar|tentar/ })
          .first()
          .click();
      await page.waitForFunction(() => typeof __finishPending === "function");
      await transition("spacevoice");
      const before = await page.evaluate(() => ({
        ...__visibility(),
        focus: document.activeElement.tagName + document.activeElement.className,
      }));
      await page.evaluate((source) => {
        const items = [
          {
            kind: "music",
            catalogId: "itunes:late",
            title: "Late fixture",
            artist: "Fixture",
          },
        ];
        __finishPending(source === "search" ? items : { items, seeds: 1, failures: 0 });
        delete window.__finishPending;
      }, source);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const after = await page.evaluate(() => ({
        ...__visibility(),
        focus: document.activeElement.tagName + document.activeElement.className,
        staleAnimations: Array.from(
          document.querySelectorAll("#discoverPage, #personalizedDiscovery"),
        ).some((node) => node.getAnimations({ subtree: true }).length > 0),
      }));
      if (phase === "after") {
        assert.deepEqual(after.visible, ["#spaceVoicePage"]);
        assert.equal(after.y, before.y);
        assert.equal(after.focus, before.focus);
        assert.equal(after.staleAnimations, false);
      }
      delayed.push({ source, before, after });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, "frames.json"),
      JSON.stringify({ errors, runs, delayed }, null, 2),
    );
    console.log(
      JSON.stringify({
        phase,
        transitions: runs.length,
        mixed: runs.flat().filter((frame) => frame.visible.length !== 1).length,
      }),
    );
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
