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
const output = path.resolve("artifacts/scroll-continuity", phase);
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
    await page.waitForSelector(".shelf-card");
    await page.evaluate(() => {
      window.__scrollCalls = [];
      const original = window.scrollTo.bind(window);
      window.scrollTo = (options) => {
        __scrollCalls.push(options);
        return original(options);
      };
    });
    async function change(hash, start = 900, header = false) {
      return page.evaluate(
        async ({ hash, start, header }) => {
          scrollTo({ top: start, behavior: "instant" });
          await new Promise(requestAnimationFrame);
          __scrollCalls.length = 0;
          const before = scrollY;
          if (header) document.querySelector('.nav a[data-route="colecao"]').click();
          else
            document
              .querySelector(`.collection-tabs button[data-kind="${hash.split("/")[1] || "all"}"]`)
              .click();
          const frames = [];
          const begun = performance.now();
          await new Promise((resolve) => {
            function sample(time) {
              frames.push({ elapsed: time - begun, y: scrollY });
              if (time - begun < 900) requestAnimationFrame(sample);
              else resolve();
            }
            requestAnimationFrame(sample);
          });
          return {
            hash,
            before,
            frames,
            calls: __scrollCalls.slice(),
            minHeight: document.querySelector(".collection-summary").parentElement.style.minHeight,
          };
        },
        { hash, start, header },
      );
    }
    const series = await change("#colecao/series");
    const game = await change("#colecao/game");
    const header = await change("#colecao", 900, true);
    const empty = await change("#colecao/music", 1600);
    if (phase === "after") {
      for (const run of [series, game, header]) {
        assert.ok(
          run.frames.every((frame) => Math.abs(frame.y - run.before) <= 1),
          run.hash,
        );
        assert.equal(run.calls.length, 0, "No restoration within Collection");
      }
      assert.ok(Math.abs(empty.frames[0].y - empty.before) <= 2, "No first-frame clamp");
      assert.ok(
        empty.frames.some((frame) => frame.y < empty.before - 20),
        "Short page settles deliberately",
      );
      assert.ok(empty.calls.some((call) => call.behavior === "smooth"));
      assert.equal(empty.minHeight, "", "Temporary reservation released");
    }
    await change("#colecao/film", 0);
    await page.evaluate(async () => {
      scrollTo({ top: 900, behavior: "instant" });
      await new Promise(requestAnimationFrame);
      Catalog.details = async (item) => item;
      Catalog.summary = async (item) => item;
      TitlePages.open(CollectionActions.getItems().find((item) => item.kind === "film"));
    });
    await page.waitForSelector("#titlePage:not([hidden]) h1");
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const titleY = await page.evaluate(() => scrollY);
    await page.locator("#titlePage button").filter({ hasText: "voltar" }).click();
    await page.waitForFunction(() => !document.querySelector("#collectionPage").hidden);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const returnY = await page.evaluate(() => scrollY);
    if (phase === "after") {
      assert.equal(titleY, 0);
      assert.ok(returnY <= 1);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await change("#colecao/music", 1600);
    if (phase === "after") {
      assert.equal(reduced.minHeight, "");
      assert.ok(reduced.calls.every((call) => call.behavior !== "smooth"));
    }
    await page.screenshot({ path: path.join(output, "short-category.png") });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, "frames.json"),
      JSON.stringify({ errors, series, game, header, empty, titleY, returnY, reduced }, null, 2),
    );
    console.log(
      JSON.stringify({
        phase,
        before: series.before,
        after: series.frames.at(-1).y,
        emptyFirst: empty.frames[0].y,
        emptyLast: empty.frames.at(-1).y,
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
