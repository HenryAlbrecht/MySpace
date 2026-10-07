// Local scroll/geometry fixture: one browser/context, no providers or capture.
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
const output = path.resolve("artifacts/collection-title-return", phase);
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
    await context.addInitScript(() => {
      localStorage.setItem("myspace-collection-view", "list");
      sessionStorage.setItem(
        "myspace-reading-positions",
        JSON.stringify(
          ["#perfil", "#fotos", "#buscar", "#descobrir", "#spacevoice"].map((hash) => [hash, 500]),
        ),
      );
      localStorage.setItem(
        "myspace-extras-v1",
        JSON.stringify({
          version: 1,
          items: ["film", "series", "game"].flatMap((kind) =>
            Array.from({ length: 40 }, (_, n) => ({
              id: kind + n,
              kind,
              title: kind + " fixture " + n,
              status: "planned",
              progress: 0,
              total: 0,
              image: "/profile-art.png",
            })),
          ),
        }),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${web.address().port}/?voiceTransport=local#colecao/film`);
    await page.waitForSelector("#collectionPage");
    await page.evaluate(() => {
      window.__scrollCalls = [];
      const original = window.scrollTo.bind(window);
      window.scrollTo = (options) => {
        __scrollCalls.push(options);
        return original(options);
      };
    });

    await page.evaluate(() => {
      Catalog.details = async (item) => ({
        ...item,
        summary: Array(80).fill("Long detail fixture.").join("\n\n"),
      });
      Catalog.summary = async (item) => item;
    });
    async function settle() {
      await page.waitForTimeout(300);
    }
    async function mode(value) {
      await page.evaluate((value) => {
        localStorage.setItem("myspace-collection-view", value);
        dispatchEvent(new Event("myspace:preferences-restored"));
      }, value);
      await settle();
    }
    async function openFromCollection(view) {
      return page.evaluate(async (view) => {
        scrollTo({ top: 900, behavior: "instant" });
        await new Promise(requestAnimationFrame);
        const selector = view === "list" ? ".list-entry" : ".shelf-cover";
        const nodes = [...document.querySelectorAll(selector)];
        const node = nodes.find((node) => {
          const box = node.getBoundingClientRect();
          return box.top >= 0 && box.bottom < innerHeight;
        });
        if (!node) throw Error("No visible origin fixture");
        node.focus({ preventScroll: true });
        const id = node.dataset.itemId,
          y = scrollY;
        if (view === "list") {
          node.click();
          node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        } else node.click();
        return { id, y };
      }, view);
    }
    async function returned(origin, view) {
      await settle();
      const state = await page.evaluate(() => ({
        y: scrollY,
        id: document.activeElement.dataset.itemId,
        selected: document.querySelector('.list-entry[aria-pressed="true"]')?.dataset.itemId,
        xmb: !!document.querySelector(".xmb:not([hidden])"),
      }));
      assert.ok(Math.abs(state.y - origin.y) < 2, "return camera " + JSON.stringify(state));
      assert.equal(state.id, origin.id, "origin focus");
      if (view === "list") assert.equal(state.selected, origin.id);
      assert.equal(state.xmb, false);
      return state;
    }
    const runs = [];
    for (const view of ["covers", "list"]) {
      await mode(view);
      const origin = await openFromCollection(view);
      await settle();
      assert.ok((await page.evaluate(() => scrollY)) < 2, "detail entry");
      if (view === "covers") await page.goBack();
      else await page.getByRole("button", { name: "← voltar", exact: true }).click();
      runs.push({ view, origin, returned: await returned(origin, view) });
      await page.locator('.nav a[data-route="spacevoice"]').click();
      await settle();
      await page.locator('.nav a[data-route="colecao"]').click();
      await settle();
      assert.ok((await page.evaluate(() => scrollY)) < 2, "origin does not leak into header entry");
      await page.evaluate(() => {
        location.hash = "#colecao/film";
      });
      await settle();
    }
    await page.locator('.nav a[data-route="buscar"]').click();
    await settle();
    await page.evaluate(() =>
      TitlePages.open({
        kind: "music",
        catalogId: "itunes:search-fixture",
        title: "Search fixture",
      }),
    );
    await settle();
    await page.getByRole("button", { name: "← voltar", exact: true }).click();
    await settle();
    assert.equal(await page.evaluate(() => location.hash), "#buscar");
    assert.ok((await page.evaluate(() => scrollY)) < 2, "search does not restore Collection");
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify({ runs, errors }, null, 2));
    console.log(
      "Collection title return: covers/Back, list/button, scroll/focus, header isolation and Search passed.",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
