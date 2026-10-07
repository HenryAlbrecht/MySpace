"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");
async function createFixture(runtime) {
  const {
    browser,
    web,
    testArtifacts
  } = runtime;
  let context;
  try {
    context = await browser.newContext({
      viewport: {
        width: 1440,
        height: 900
      }
    });
    await context.addInitScript(() => {
      window.__dynamicDraws = 0;
      const draw = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas.classList.contains("np-dynamic-atmosphere")) __dynamicDraws++;
        return draw.apply(this, args);
      };
    });
    await context.route("**/vendor/kawarp/dist/index.js", r => r.fulfill({
      contentType: "text/javascript",
      body: fs.readFileSync("dist/vendor/kawarp/dist/index.js", "utf8") + "\nconst Official=Kawarp;Kawarp=class extends Official{constructor(...args){super(...args);window.__kawarp=this;} };"
    }));
    let componentMode = "fixture";
    await context.route("https://**/*", route => route.abort());
    const lyricsTtml = "<tt xmlns=\"http://www.w3.org/ns/ttml\"><body><div>" + Array.from({
      length: 30
    }, (_, i) => `<p begin="${i}s" end="${i + 1}s">Deterministic shell lyric ${i + 1}</p>`).join("") + "</div></body></tt>";
    await context.route("**/vendor/am-lyrics-1.7.4.js", route => componentMode === "failed" ? route.abort() : route.fulfill({
      contentType: "text/javascript",
      body: `for(const component of document.querySelectorAll('am-lyrics'))component.setAttribute('ttml',${JSON.stringify(lyricsTtml)});\n` + fs.readFileSync("dist/vendor/am-lyrics-1.7.4.js", "utf8")
    }));
    // Feed each newly created official component before connection, independent of earlier scenarios.
    await context.addInitScript(ttml => {
      const create = document.createElement.bind(document);
      document.createElement = (tag, options) => {
        const element = create(tag, options);
        if (tag === "am-lyrics") element.setAttribute("ttml", ttml);
        return element;
      };
    }, lyricsTtml);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + web.address().port + "/?voiceTransport=local#perfil");
    await page.waitForSelector("#globalSpaceAmp");
    await page.evaluate(() => {
      const a = SPACEAMP;
      window.__calls = [];
      window.__time = {
        position: 12.5,
        duration: 180
      };
      a.configure({
        getPlaybackTime: () => __time,
        play: () => {
          __calls.push("play");
          a.update(a.getState(), true);
        },
        pause: () => {
          __calls.push("pause");
          a.update(a.getState(), false);
        },
        seek: t => {
          __calls.push(["seek", t]);
          __time.position = t;
          a.progress({
            position: t
          });
        },
        setVolume: v => a.progress({
          volume: v
        })
      });
      a.update({
        title: "First",
        artist: "Artist",
        source: "YouTube",
        sourceUrl: "fixture",
        artwork: "profile-art.png"
      }, true, {
        available: true
      });
      document.body.style.minHeight = "2400px";
      window.scrollTo(0, 300);
    });
    await page.waitForFunction(() => scrollY === 300);
    const before = await page.evaluate(() => scrollY);
    const np = page.locator("#spaceampNowPlaying");
    const toggle = page.getByRole("button", {
      name: "Lyrics",
      exact: true
    });
    async function open() {
      await page.locator("#album").click();
      await page.waitForSelector("#spaceampNowPlaying[open]");
      await page.waitForFunction(() => customElements.get("am-lyrics"));
    }
    async function mode(index, value) {
      const summary = page.locator(".np-menu summary").nth(index);
      await summary.click();
      await page.getByRole("combobox", {
        name: index === 0 ? "Visualizer" : "Interface",
        exact: true
      }).selectOption(value);
      await summary.click();
    }
    async function settled() {
      await page.waitForFunction(() => !document.querySelector("#spaceampNowPlaying").getAnimations({
        subtree: true
      }).some(a => a.playState === "running" && Number.isFinite(a.effect.getComputedTiming().endTime)));
    }
    async function artwork() {
      await page.evaluate(() => {
        const make = (a, b) => {
          const c = document.createElement("canvas");
          c.width = c.height = 80;
          const ctx = c.getContext("2d");
          ctx.fillStyle = a;
          ctx.fillRect(0, 0, 80, 80);
          ctx.fillStyle = b;
          ctx.fillRect(45, 0, 35, 80);
          return c.toDataURL();
        };
        window.__art = [make("#bd653a", "#834b3e"), make("#396fa8", "#344d7e"), make("#558652", "#374e40")];
        window.__artIndex = 0;
        window.__globalTheme = document.documentElement.style.cssText;
        window.__changeArt = index => {
          __artIndex = index;
          SPACEAMP.update({
            title: "Palette " + index,
            artist: "Local fixture",
            source: "local",
            sourceUrl: "local-" + index,
            artwork: __art[index]
          }, true, {
            available: true
          });
        };
        SPACEAMP.setNavigation({
          next: () => __changeArt(1),
          previous: () => __changeArt(0),
          ended: () => __changeArt(2)
        });
        __changeArt(0);
        SpaceAmpNowPlaying.open();
      });
      await page.evaluate(() => {
        const make = (base, accent, neutral = false) => {
          const c = document.createElement("canvas");
          c.width = c.height = 80;
          const x = c.getContext("2d");
          x.fillStyle = base;
          x.fillRect(0, 0, 80, 80);
          x.fillStyle = neutral ? "#a0a0a0" : "#b69a89";
          x.fillRect(0, 40, 32, 40);
          x.fillStyle = accent;
          x.fillRect(50, 10, neutral ? 2 : 22, neutral ? 2 : 60);
          return c.toDataURL();
        };
        window.__atmosphereFixtures = [make("#777777", "#ce397d"), make("#287fab", "#246197"), make("#398964", "#235b49"), make("#747474", "#ff00ff", true)];
      });
      await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.palette === "artwork" && document.querySelector(".np-cover").dataset.artworkReady === "true");
      await page.waitForFunction(() => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp");
    }
    await open();
    return {
      page,
      context,
      np,
      toggle,
      mode,
      lyricsTtml,
      before,
      open,
      artwork,
      settled,
      testArtifacts,
      setComponentMode(value) {
        componentMode = value;
      },
      async close() {
        try {
          await page.evaluate(() => {
            XmbQuickMenu.close();
            SpaceAmpNowPlaying.close();
            SPACEAMP.pause();
          });
          const draws = await page.evaluate(() => __dynamicDraws);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await page.evaluate(() => __dynamicDraws), draws, "GPU loop stops after closing presentation");
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
        assert.equal(browser.contexts().length, 0, "scenario context is released");
      }
    };
  } catch (error) {
    await context?.close();
    throw error;
  }
}
module.exports = {
  createFixture
};
