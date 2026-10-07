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
const { createServer } = require("../server.cjs");
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
              `for(const n of document.querySelectorAll('am-lyrics'))n.setAttribute('ttml',${JSON.stringify(ttml)});\n` +
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
      await page.evaluate(() => {
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
      });
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
      await page.waitForFunction(() =>
        document
          .querySelector("am-lyrics")
          .shadowRoot.getElementById("spaceamp-lyrics-motion-profile"),
      );
      await page.evaluate(() => {
        window.__real = 188;
        window.__ack = null;
        window.__seeks = [];
        SPACEAMP.configure({
          getPlaybackTime: () => ({ position: __real, duration: 220 }),
          seek: (t) => {
            __seeks.push(t);
            clearTimeout(__ack);
            __ack = setTimeout(() => {
              __real = t;
              SPACEAMP.progress({ position: t });
            }, 350);
          },
        });
      });
      await page.evaluate(() => {
        document
          .querySelector("am-lyrics")
          .dispatchEvent(new CustomEvent("line-click", { detail: { timestamp: 80000 } }));
      });
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(60);
        const t = await page.evaluate(() => document.querySelector("am-lyrics").currentTime);
        assert.ok(t >= 80000 && t < 80500, "stale 188 must not replace pending 80");
      }
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => __real), 80);
      const targets = await page.evaluate(async () => {
        const c = document.querySelector("am-lyrics"),
          rows = [...c.shadowRoot.querySelectorAll(".lyrics-line:not(.lyrics-gap)")];
        const result = [];
        for (const index of [2, 7, 4, 10, 5]) {
          const row = rows[index];
          const target = Number(row.dataset.startTime) / 1000;
          result.push(target);
          row.click();
          await new Promise((r) => setTimeout(r, 70));
        }
        return result;
      });
      const last = targets.at(-1);
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(60);
        assert.ok(
          Math.abs(
            (await page.evaluate(() => document.querySelector("am-lyrics").currentTime)) -
              last * 1000,
          ) < 600,
          "last click wins",
        );
      }
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => __real), last);
      // Local audio acknowledges synchronously; same presentation code.
      await page.evaluate(() =>
        SPACEAMP.configure({
          seek: (t) => {
            __real = t;
            SPACEAMP.progress({ position: t });
          },
        }),
      );
      await page.evaluate(() =>
        document
          .querySelector("am-lyrics")
          .dispatchEvent(new CustomEvent("line-click", { detail: { timestamp: 10000 } })),
      );
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => __real), 10);
      await page.evaluate(() => SPACEAMP.pause());
      const paused = await page.evaluate(() => document.querySelector("am-lyrics").currentTime);
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(() => document.querySelector("am-lyrics").currentTime),
        paused,
      );
      // Real clock with deliberately coarse 200ms reads, five consecutive boundaries.
      await page.evaluate(() => {
        window.__origin = performance.now();
        SPACEAMP.configure({
          getPlaybackTime: () => ({
            position: 23 + Math.floor((performance.now() - __origin) / 200) * 0.2,
            duration: 220,
          }),
        });
        SPACEAMP.play();
      });
      const samples = await page.evaluate(async () => {
        const c = document.querySelector("am-lyrics"),
          root = c.shadowRoot,
          result = [],
          start = performance.now();
        while (performance.now() - start < 14000) {
          await new Promise(requestAnimationFrame);
          result.push({
            presentationTime: c.currentTime,
            realPlayerTime: SPACEAMP.getPlaybackTime().position * 1000,
            active: [...root.querySelectorAll(".lyrics-line.active")].map(
              (n) => n.dataset.startTime,
            ),
            focus: [
              ...root.querySelectorAll(
                ".lyrics-line.active:not(.lyrics-gap) .lyrics-line-container",
              ),
            ].map((n) => ({
              line: n.parentElement.dataset.startTime,
              opacity: Number(getComputedStyle(n).opacity),
              animations: n
                .getAnimations()
                .filter((a) => a.animationName === "spaceamp-lyrics-focus-paint")
                .map((a) => a.startTime),
            })),
            scrollTop: root.querySelector(".lyrics-container").scrollTop,
            rows: [...root.querySelectorAll(".lyrics-line:not(.lyrics-gap)")]
              .slice(6, 12)
              .map((n) => ({
                y: n.getBoundingClientRect().top,
                transform: getComputedStyle(n).transform,
                translate: getComputedStyle(n).translate,
              })),
          });
        }
        return result;
      });
      const starts = new Map();
      for (const sample of samples)
        for (const focus of sample.focus) {
          assert.ok(focus.opacity >= 0.919 && focus.opacity <= 1, "focus paint stays discreet");
          for (const start of focus.animations) {
            if (start === null) continue;
            if (starts.has(focus.line))
              assert.equal(
                start,
                starts.get(focus.line),
                "clock frames must not restart the focus fade",
              );
            else starts.set(focus.line, start);
          }
        }
      const changes = new Set(samples.flatMap((s) => s.active));
      assert.ok(changes.size >= 5, "five consecutive active lines");
      for (let i = 1; i < samples.length; i++)
        assert.ok(
          samples[i].presentationTime >= samples[i - 1].presentationTime,
          "normal presentation clock must not go backwards",
        );
      for (let i = 1; i < samples.length; i++)
        for (let row = 0; row < 6; row++)
          assert.ok(
            Math.abs(samples[i].rows[row].y - samples[i - 1].rows[row].y) < 25,
            "no instantaneous vertical jump in normal playback",
          );
      const backgroundBefore = await page.evaluate(() => ({
        src: document.querySelector(".np-atmosphere").getAttribute("src"),
        palette: document.querySelector("#spaceampNowPlaying").dataset.palette,
      }));
      await page.evaluate(() =>
        SPACEAMP.update(
          {
            title: "Next track awaiting artwork",
            artist: "Fixture",
            source: "YouTube",
            sourceUrl: "next-fixture",
            artwork: "",
          },
          true,
          { available: true },
        ),
      );
      const backgroundAfter = await page.evaluate(() => ({
        src: document.querySelector(".np-atmosphere").getAttribute("src"),
        palette: document.querySelector("#spaceampNowPlaying").dataset.palette,
      }));
      assert.deepEqual(
        backgroundAfter,
        backgroundBefore,
        "track metadata gap must retain the decoded background",
      );
      fs.writeFileSync(
        "artifacts/spaceamp-lyrics-motion/clock-measurements.json",
        JSON.stringify(samples, null, 2),
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: async stale seek, last-click wins, local acknowledgement, pause freeze, five line transitions with coarse player clock.",
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
