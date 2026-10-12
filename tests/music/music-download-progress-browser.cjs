const assert = require("node:assert/strict");
const { startRuntime } = require("./music-playback-browser/runtime.cjs");

(async () => {
  const runtime = await startRuntime();
  try {
    const context = await runtime.browser.newContext();
    await context.route("https://**/*", (route) => route.abort());
    await context.route("**/api/xmb/media-download-progress?*", (route) => route.fulfill({
      json: { phase: "download", percent: 25 },
    }));
    let complete = false;
    await context.route("**/api/xmb/media-download", async (route) => {
      if (!complete) await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 200, body: "fixture", headers: {
          "Content-Type": "audio/mpeg", "Content-Length": "7", "X-Media-Cover-Embedded": "true",
        },
      }).catch(() => {});
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + runtime.web.address().port + "/?voiceTransport=local#colecao");
    await page.waitForFunction(() => window.MediaDownload);
    for (const kind of ["audio", "video"]) {
      await page.evaluate((kind) => {
        window.downloadOutcome = null;
        MediaDownload.download("https://example.org/media", kind).then(
          () => { downloadOutcome = "unexpected-success"; },
          (error) => { downloadOutcome = error.name; },
        );
      }, kind);
      await page.waitForFunction(() => document.querySelector(".media-download-progress progress")?.value === 25);
      await page.locator(".media-download-progress button").click();
      await page.waitForFunction(() => window.downloadOutcome === "AbortError");
      assert.equal(await page.locator(".media-download-progress").count(), 0);
    }
    complete = true;
    const result = await page.evaluate(async () => {
      const blob = await MediaDownload.download("https://example.org/media", "audio");
      return { size: blob.size, type: blob.type, cover: blob.albumCoverEmbedded };
    });
    assert.deepEqual(result, { size: 7, type: "audio/mpeg", cover: true });
    assert.equal(await page.locator(".media-download-progress").count(), 0);
    assert.deepEqual(errors, []);
    console.log("Download UI: progress, audio/video cancellation, cleanup and successful file passed.");
    await context.close();
  } finally {
    await runtime.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
