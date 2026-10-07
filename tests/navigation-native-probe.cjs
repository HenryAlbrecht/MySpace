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

    await page.evaluate((policy) => {
      history.scrollRestoration = policy;
      scrollTo({ top: 900, behavior: "instant" });
    }, process.argv[2] || "auto");
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      location.hash = "#spacevoice";
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.scrollTo = () => {};
    });
    await page.goBack();
    await page.waitForTimeout(300);
    console.log(
      JSON.stringify(
        await page.evaluate(() => ({
          nativePolicy: history.scrollRestoration,
          y: scrollY,
        })),
      ),
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
