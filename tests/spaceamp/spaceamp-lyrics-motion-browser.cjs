// Official component, deterministic TTML and provider clock; one browser/context.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
const web = createServer({
  music: {
    search: async () => ({ items: [] }),
    details: async () => ({}),
    summary: async () => ({}),
    recommendations: async () => ({ items: [] }),
  },
});
let browser;
(async () => {
  try {
    fs.mkdirSync("artifacts/spaceamp-lyrics-motion", { recursive: true });
    const modulePath = "dist/vendor/am-lyrics-1.7.4.js";
    let official = fs.existsSync(modulePath)
      ? fs.readFileSync(modulePath, "utf8")
      : await (
          await fetch(
            "https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics@1.7.4/dist/src/am-lyrics.min.js",
          )
        ).text();
    if (process.env.SPACEAMP_DIAGNOSE_CLICK === "1") {
      const start = official.indexOf("handleLineClick(t){if(this.cachedIsUnsynced)");
      assert.ok(start >= 0);
      const cancel = official.indexOf("this.cancelLineScrollAnimation(),", start);
      official =
        official.slice(0, cancel) +
        official.slice(cancel + "this.cancelLineScrollAnimation(),".length);
    }
    const ttml = fs.existsSync("artifacts/golden-hour.ttml")
      ? fs.readFileSync("artifacts/golden-hour.ttml", "utf8")
      : '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
        Array.from(
          { length: 30 },
          (_, i) => `<p begin="${i}s" end="${i + 1}s">Deterministic baseline line ${i + 1}</p>`,
        ).join("") +
        "</div></body></tt>";
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
    });
    await context.route("**/*", (r) =>
      r.request().url().includes("/vendor/am-lyrics-1.7.4.js")
        ? r.fulfill({
            contentType: "text/javascript",
            body:
              official +
              "\nwindow.__lyricsLoads=0;const Component=customElements.get('am-lyrics'),fetchLyrics=Component.prototype.fetchLyrics;Component.prototype.fetchLyrics=function(...args){__lyricsLoads++;return fetchLyrics.apply(this,args);};",
          })
        : r.request().url().startsWith("https://")
          ? r.abort()
          : r.continue(),
    );
    const mode = "B";
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const variant of ["B"]) {
      await page.goto("http://127.0.0.1:" + web.address().port + "/?voiceTransport=local");
      await page.waitForSelector("#globalSpaceAmp");
      await page.evaluate((lyricsFixtureTTML) => {
        window.LyricsRepository = {
          resolve: (input, signal) => {
            if (input.title === "Word-sync fixture")
              return new Promise((resolve) => {
                signal.addEventListener("abort", () => resolve({ status: "cancelled" }), {
                  once: true,
                });
              });
            return Promise.resolve({
              status: "found",
              document: lyricsFixtureTTML,
              format: "ttml",
              provider: "lrc.red",
              recordingId: null,
            });
          },
        };
        window.__position = 20;
        SPACEAMP.configure({
          getPlaybackTime: () => ({ position: __position, duration: 184.135 }),
          pause: () => SPACEAMP.update(SPACEAMP.getPlaybackState(), false),
          play: () => SPACEAMP.update(SPACEAMP.getPlaybackState(), true),
          seek: (t) => {
            __position = t;
            SPACEAMP.progress({ position: t });
          },
        });
        SPACEAMP.update(
          {
            title: "Prime Time Golden Hour Show (Soundtrack)",
            artist: "Shiori Sasaki, ATLUS Sound Team & ATLUS GAME MUSIC",
            source: "YouTube",
            sourceUrl: "fixture",
            artwork: "profile-art.png",
          },
          true,
          { available: true },
        );
        SpaceAmpNowPlaying.open();
      }, ttml);
      await page.waitForFunction(() =>
        document.querySelector("am-lyrics")?.shadowRoot?.querySelector(".lyrics-line"),
      );
      if (mode === "B") {
        const component = page.locator("am-lyrics");
        assert.equal(await component.getAttribute("line-motion"), null);
        assert.equal(await component.getAttribute("no-blur"), null);
        assert.equal(await component.getAttribute("autoscroll"), "");
        assert.equal(await component.getAttribute("interpolate"), "");
        assert.ok(await page.evaluate(() => document.querySelector("am-lyrics").duration > 0));
      }
      const scrollStart = await page.evaluate(
        () =>
          document.querySelector("am-lyrics").shadowRoot.querySelector(".lyrics-container")
            .scrollTop,
      );
      await page.waitForFunction(() =>
        document
          .querySelector("am-lyrics")
          .shadowRoot.getElementById("spaceamp-lyrics-motion-profile"),
      );
      const measurements = [];
      for (const [index, boundary] of [23.4, 25.74, 28.38].entries()) {
        const samples = [];
        for (const offset of [-200, -100, 0, 100, 200, 400]) {
          await page.evaluate(
            (position) => {
              __position = position;
              SPACEAMP.progress({ position });
            },
            boundary + offset / 1000,
          );
          await page.waitForTimeout(100);
          samples.push(
            await page.evaluate((index) => {
              const root = document.querySelector("am-lyrics").shadowRoot;
              const line = [...root.querySelectorAll(".lyrics-line:not(.lyrics-gap)")][6 + index];
              const selectors = [
                ".lyrics-line-container",
                ".main-vocal-container",
                ".lyrics-word",
                ".char",
              ];
              const nodes = selectors.map((selector) =>
                line.querySelector(selector) ||
                  (selector === ".char" ? line.querySelector(".lyrics-word") : null),
              );
              if (nodes.slice(0, 3).some((node) => !node))
                throw Error("Missing stable lyric layout anchor");
              const lineRect = line.getBoundingClientRect();
              const containerRect = root
                .querySelector(".lyrics-container")
                .getBoundingClientRect();
              return {
                layout: nodes.map((node) => ({
                  x: node?.offsetLeft ?? null,
                  y: node?.offsetTop ?? null,
                  width: node?.offsetWidth ?? null,
                  height: node?.offsetHeight ?? null,
                })),
                transforms: nodes.map((node) => {
                  const target = node?.parentElement?.classList.contains("char-motion")
                    ? node.parentElement
                    : node;
                  return target ? getComputedStyle(target).transform : null;
                }),
                visible:
                  lineRect.width > 0 &&
                  lineRect.height > 0 &&
                  lineRect.right > containerRect.left &&
                  lineRect.left < containerRect.right,
              };
            }, index),
          );
          await page.screenshot({
            path: `artifacts/spaceamp-lyrics-motion/transition-${index}-${offset}.png`,
          });
        }
        for (let part = 0; part < 4; part++)
          assert.ok(
            Math.max(...samples.map((s) => s.layout[part].x)) -
              Math.min(...samples.map((s) => s.layout[part].x)) <
              0.5,
            "horizontal layout drift " + part,
          );
        assert.ok(
          samples.every((s) => s.visible),
          "animated lyric text must remain visible in the lyric viewport",
        );
        assert.ok(
          samples.every((sample) =>
            sample.layout.every(
              (box) => Number.isFinite(box.x) && box.width > 0 && box.height > 0,
            ),
          ),
          "stable lyric layout anchors remain measurable",
        );
        measurements.push(samples);
      }
      // Continuous vertical timing and asynchronous seek are covered by the clock browser test.
      fs.writeFileSync(
        "artifacts/spaceamp-lyrics-motion/measurements.json",
        JSON.stringify(measurements, null, 2),
      );
      await page.evaluate(() => {
        __position = 25.9;
        SPACEAMP.progress({ position: 25.9 });
      });
      await page.waitForTimeout(100);
      const blurredLineIndex = await page.evaluate(() => {
        const root = document.querySelector("am-lyrics").shadowRoot;
        const container = root.querySelector(".lyrics-container").getBoundingClientRect();
        return [...root.querySelectorAll(".lyrics-line")].findIndex((line) => {
          const rect = line.getBoundingClientRect();
          return (
            getComputedStyle(line).filter !== "none" &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > container.top &&
            rect.top < container.bottom
          );
        });
      });
      assert.ok(blurredLineIndex >= 0, "native inactive-line blur remains active");
      await page.locator("am-lyrics").locator(".lyrics-line").nth(blurredLineIndex).hover();
      await page.waitForFunction((index) => {
        const root = document.querySelector("am-lyrics").shadowRoot;
        return getComputedStyle(root.querySelectorAll(".lyrics-line")[index]).filter === "none";
      }, blurredLineIndex);
      if (mode === "B") {
        const scrollEnd = await page.evaluate(
          () =>
            document.querySelector("am-lyrics").shadowRoot.querySelector(".lyrics-container")
              .scrollTop,
        );
        assert.ok(Math.abs(scrollEnd - scrollStart) > 10, "upstream autoscroll must move");

        await page.evaluate(() => SPACEAMP.pause());
        assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), false);
        const frozen = await page.evaluate(() => document.querySelector("am-lyrics").currentTime);
        await page.waitForTimeout(150);
        assert.equal(
          await page.evaluate(() => document.querySelector("am-lyrics").currentTime),
          frozen,
        );
        await page.evaluate(() => SPACEAMP.play());
        await page.locator("am-lyrics").locator(".lyrics-line").nth(8).click();
        assert.notEqual(await page.evaluate(() => __position), 25.9);
        // Word-sync exercises the upstream WAAPI glyph animations as well as line scale.
        await page.evaluate(async () => {
          __position = 0;
          SPACEAMP.update(
            {
              title: "Word-sync fixture",
              artist: "Fixture",
              source: "local",
              sourceUrl: "word-fixture",
            },
            true,
            { available: true },
          );
          await document.querySelector("am-lyrics").updateComplete;
          const ttml =
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word"><body><div>' +
            Array.from(
              { length: 4 },
              (_, i) =>
                `<p begin="${i * 2}s" end="${i * 2 + 2}s"><span begin="${i * 2}s" end="${i * 2 + 1}s">Stable </span><span begin="${i * 2 + 1}s" end="${i * 2 + 2}s">highlight</span></p>`,
            ).join("") +
            "</div></body></tt>";
          document.querySelector("am-lyrics").setAttribute("ttml", ttml);
          __position = 0;
          SPACEAMP.progress({ position: 0 });
        });
        await page.waitForFunction(() =>
          document.querySelector("am-lyrics").shadowRoot.querySelector(".char"),
        );
        const wordFrames = [];
        for (const boundary of [2, 4, 6]) {
          const samples = [];
          for (const offset of [-200, -100, 0, 100, 200, 400]) {
            await page.evaluate(
              (t) => {
                __position = t;
                SPACEAMP.progress({ position: t });
              },
              boundary + offset / 1000,
            );
            await page.waitForTimeout(100);
            samples.push(
              await page.evaluate((index) => {
                const root = document.querySelector("am-lyrics").shadowRoot,
                  line = [...root.querySelectorAll(".lyrics-line:not(.lyrics-gap)")][index];
                const selectors = [
                  ".lyrics-line-container",
                  ".main-vocal-container",
                  ".lyrics-word",
                  ".char",
                ];
                const nodes = selectors.map((selector) =>
                  line.querySelector(selector) ||
                    (selector === ".char" ? line.querySelector(".lyrics-word") : null),
                );
                const lineRect = line.getBoundingClientRect();
                const chars = [...line.querySelectorAll(".char")].filter((node) =>
                  node.textContent.trim(),
                );
                return {
                  layout: nodes.map((node) => ({
                    x: node?.offsetLeft ?? null,
                    y: node?.offsetTop ?? null,
                    width: node?.offsetWidth ?? null,
                    height: node?.offsetHeight ?? null,
                  })),
                  transforms: [...line.querySelectorAll(".char")].map((node) =>
                    getComputedStyle(
                      node.parentElement?.classList.contains("char-motion")
                        ? node.parentElement
                        : node,
                    ).transform,
                  ),
                  visible: lineRect.width > 0 && lineRect.height > 0,
                  glyphsVisible:
                    chars.length > 0 &&
                    chars.every((node) => {
                      const rect = node.getBoundingClientRect();
                      const style = getComputedStyle(node);
                      return (
                        rect.width > 0 &&
                        rect.height > 0 &&
                        style.display !== "none" &&
                        style.visibility !== "hidden"
                      );
                    }),
                  paint: [...root.querySelectorAll(".char")]
                    .map((n) => n.getAttribute("style"))
                    .join("|"),
                };
              }, boundary / 2),
            );
          }
          for (let part = 0; part < 4; part++)
            assert.ok(
              Math.max(...samples.map((s) => s.layout[part].x)) -
                Math.min(...samples.map((s) => s.layout[part].x)) <
                0.5,
              "word-sync horizontal layout drift",
            );
          assert.ok(
            samples.every((sample) => sample.visible && sample.glyphsVisible),
            "word-sync glyphs remain legible and positioned",
          );
          assert.ok(
            samples.some((sample) => sample.transforms.some((value) => value !== "none")),
            "native syllable transforms remain enabled",
          );
          wordFrames.push(samples);
        }
        assert.ok(
          new Set(wordFrames.flat(2).map((sample) => sample.transforms.join("|"))).size > 1,
          "native character motion changes over time",
        );
        assert.ok(
          new Set(wordFrames.flat().map((s) => s.paint)).size > 1,
          "temporal glyph paint must continue changing",
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(() =>
          document
            .querySelector("am-lyrics")
            .shadowRoot.querySelector(".lyrics-container")
            .classList.contains("reduced-motion"),
        );
        const reducedMotion = await page.evaluate(() => {
          const root = document.querySelector("am-lyrics").shadowRoot;
          const line = root.querySelector(".lyrics-line-container");
          const glyph = root.querySelector(".char-motion") || root.querySelector(".char");
          return {
            line: getComputedStyle(line).transform,
            glyph: getComputedStyle(glyph).transform,
          };
        });
        assert.deepEqual(reducedMotion, { line: "none", glyph: "none" });
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.waitForFunction(
          () =>
            !document
              .querySelector("am-lyrics")
              .shadowRoot.querySelector(".lyrics-container")
              .classList.contains("reduced-motion"),
        );
        fs.writeFileSync(
          "artifacts/spaceamp-lyrics-motion/word-measurements.json",
          JSON.stringify(wordFrames, null, 2),
        );
        await page.evaluate(() =>
          SPACEAMP.update(
            {
              title: "Track change",
              artist: "Fixture",
              source: "local",
              sourceUrl: "other",
            },
            true,
            { available: true },
          ),
        );
        assert.equal(await page.locator("am-lyrics").getAttribute("song-title"), "Track change");
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: native blur/hover and motion; stable layout, autoscroll, seek, pause/resume, reduced motion, track change.",
    );
    await context.close();
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
