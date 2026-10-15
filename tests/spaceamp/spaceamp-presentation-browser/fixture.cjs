"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");
async function createFixture(runtime, options = {}) {
  const { browser, web, testArtifacts } = runtime;
  const lyricsNetworkAudit = options.lyricsNetworkAudit === true;
  const initialTrack = options.initialTrack !== false;
  const autoOpen = options.autoOpen !== false;
  const lyricsStoragePressureBytes = options.lyricsStoragePressureBytes;
  let context;
  try {
    context = await browser.newContext({
      viewport: {
        width: 1440,
        height: 900,
      },
    });
    await context.addInitScript(() => {
      window.__dynamicDraws = 0;
      const draw = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas.classList.contains("np-dynamic-atmosphere")) __dynamicDraws++;
        return draw.apply(this, args);
      };
    });
    if (lyricsNetworkAudit)
      await context.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        window.__lyricsAuditFetches = [];
        window.fetch = (input, init = {}) => {
          const url =
            typeof input === "string" || input instanceof URL ? String(input) : input.url;
          const signal = init.signal || (input instanceof Request ? input.signal : null);
          const entry = {
            url,
            method: init.method || (input instanceof Request ? input.method : "GET"),
            credentials: init.credentials || null,
            referrerPolicy: init.referrerPolicy || null,
            redirect: init.redirect || null,
            aborted: false,
          };
          signal?.addEventListener(
            "abort",
            () => {
              entry.aborted = true;
            },
            { once: true },
          );
          window.__lyricsAuditFetches.push(entry);
          return nativeFetch(input, init);
        };
      });
    await context.route("**/vendor/kawarp/dist/index.js", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body:
          fs.readFileSync("dist/vendor/kawarp/dist/index.js", "utf8") +
          "\nconst Official=Kawarp;Kawarp=class extends Official{constructor(...args){super(...args);window.__kawarp=this;} };",
      }),
    );
    let componentMode = "fixture";
    await context.route("https://**/*", (route) => route.abort());
    let auditPhase = "boot";
    let lyricsMockMode = "no-match";
    let lastMatchQuery = {};
    const externalRequests = [];
    const externalRequestCompletions = [];
    const externalRequestFailures = [];
    const requestEntries = new WeakMap();
    let requestSequence = 0;
    if (lyricsNetworkAudit) {
      await context.route("**/*", async (route) => {
        const request = route.request();
        const target = new URL(request.url());
        if (target.hostname === "127.0.0.1" || target.hostname === "localhost")
          return route.fallback();
        const headers = await request.allHeaders();
        const entry = {
          id: ++requestSequence,
          phase: auditPhase,
          origin: target.origin,
          path: target.pathname,
          query: Object.fromEntries(target.searchParams.entries()),
          method: request.method(),
          referer: headers.referer || null,
          requestHeaderNames: Object.keys(headers).sort(),
          hasCookie: Boolean(headers.cookie),
          hasAuthorization: Boolean(headers.authorization),
          hasBody: Boolean(request.postData()),
          state: "initiated",
        };
        externalRequests.push(entry);
        requestEntries.set(request, entry);
        const corsHeaders = {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "*",
        };
        const json = (body, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            headers: corsHeaders,
            body: JSON.stringify(body),
          });
        if (request.method() === "OPTIONS")
          return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
        if (target.hostname === "lrc.red") {
          if (lyricsMockMode === "timeout") {
            await new Promise((resolve) => setTimeout(resolve, 8500));
            try {
              return await json({ hits: [] });
            } catch {
              return;
            }
          }
          if (lyricsMockMode === "network-error") return route.abort();
          if (target.pathname === "/secondary.ttml")
            return route.fulfill({
              status: 200,
              contentType: "application/ttml+xml",
              headers: corsHeaders,
              body:
                '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
                '<p begin="0s" end="3s">恋人へ</p>' +
                "</div></body></tt>",
            });
          if (target.pathname === "/redirect.ttml")
            return route.fulfill({
              status: 302,
              headers: { ...corsHeaders, location: "https://untrusted.fixture/redirected.ttml" },
              body: "",
            });
          if (target.pathname.startsWith("/s/")) {
            if (target.pathname.endsWith(".json"))
              return json({
                isrc: target.pathname.split("/").at(-1).replace(/\.json$/, ""),
                trackName: lastMatchQuery.track,
                artistName: lastMatchQuery.artist,
                albumName: lastMatchQuery.album,
                duration: Number(lastMatchQuery.duration),
              });
            const retentionDocumentMatch = /^retention-document:(\d+)$/.exec(lyricsMockMode);
            if (retentionDocumentMatch) {
              const textLength = Number(retentionDocumentMatch[1]);
              return route.fulfill({
                status: 200,
                contentType: "application/ttml+xml",
                headers: corsHeaders,
                body:
                  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
                  `<p begin="0s" end="180s">${"x".repeat(textLength)}</p>` +
                  "</div></body></tt>",
              });
            }
            if (lyricsMockMode === "pending-ttml") {
              await new Promise((resolve) => setTimeout(resolve, 400));
              try {
                return await route.fulfill({
                  status: 200,
                  contentType: "application/ttml+xml",
                  headers: corsHeaders,
                  body:
                    '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
                    '<p begin="0s" end="3s">恋人へ</p>' +
                    "</div></body></tt>",
                });
              } catch {
                return;
              }
            }
            const recordingId = target.pathname.split("/").at(-1).replace(/\.ttml$/, "");
            if (lyricsMockMode === "invalid-ttml")
              return route.fulfill({
                status: 200,
                contentType: "application/ttml+xml",
                headers: corsHeaders,
                body: "<not-ttml>",
              });
            if (lyricsMockMode === "fallback" && recordingId !== "USABC0000002")
              return route.fulfill({ status: 404, headers: corsHeaders, body: "" });
            if (
              lyricsMockMode === "matched" ||
              lyricsMockMode === "metadata-only" ||
              lyricsMockMode === "fallback"
            )
              return route.fulfill({
                status: 200,
                contentType: "application/ttml+xml",
                headers: corsHeaders,
                body:
                  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
                  '<p begin="0s" end="3s">恋人へ</p>' +
                  '<p begin="3s" end="6s">青い空</p>' +
                  "</div></body></tt>",
              });
            return route.fulfill({ status: 404, headers: corsHeaders, body: "" });
          }
          if (target.pathname === "/match.json") {
            lastMatchQuery = Object.fromEntries(target.searchParams.entries());
            if (lyricsMockMode === "pending") {
              await new Promise((resolve) => setTimeout(resolve, 350));
              try {
                return await json({ hits: [] });
              } catch {
                return;
              }
            }
            if (lyricsMockMode === "provider-error") return json({ error: "fixture" }, 503);
            if (lyricsMockMode === "ambiguous")
              return json({
                hits: [
                  {
                    isrc: "USABC0000002",
                    title: lastMatchQuery.track,
                    artist: lastMatchQuery.artist,
                    album: lastMatchQuery.album,
                    duration: Number(lastMatchQuery.duration),
                  },
                  {
                    isrc: "USABC0000003",
                    title: lastMatchQuery.track,
                    artist: lastMatchQuery.artist,
                    album: lastMatchQuery.album,
                    duration: Number(lastMatchQuery.duration),
                  },
                ],
              });
            return json(
              lyricsMockMode === "matched" || lyricsMockMode === "fallback"
                ? {
                    hits: [
                      {
                        isrc: "USABC0000002",
                        title: lastMatchQuery.track,
                        artist: lastMatchQuery.artist,
                        album: lastMatchQuery.album,
                        duration: Number(lastMatchQuery.duration),
                        lyricsUrl: "https://untrusted.fixture/remote.ttml",
                      },
                    ],
                  }
                : lyricsMockMode === "metadata-only"
                  ? { hits: [{ isrc: "USABC0000002" }] }
                  : { hits: [] },
            );
          }
          if (target.pathname === "/search.json") return json({ hits: [] });
        }
        if (target.hostname === "lyrics-api.binimum.org" && target.pathname === "/secondary.ttml")
          return route.fulfill({
            status: 200,
            contentType: "application/ttml+xml",
            headers: corsHeaders,
            body:
              '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
              '<p begin="0s" end="3s">恋人へ</p>' +
              "</div></body></tt>",
          });
        if (target.hostname === "lyrics-api.binimum.org") {
          if (lyricsMockMode === "pending-bini") {
            await new Promise((resolve) => setTimeout(resolve, 350));
            try {
              return await json({ results: [] });
            } catch {
              return;
            }
          }
          const suppliedLyricsUrl = lyricsMockMode.startsWith("lyrics-url:")
            ? lyricsMockMode.slice("lyrics-url:".length)
            : lyricsMockMode === "untrusted-lyrics-url"
              ? "https://untrusted.fixture/remote.ttml"
              : null;
          return json(
            suppliedLyricsUrl
              ? { results: [{ lyricsUrl: suppliedLyricsUrl }] }
              : { results: [] },
          );
        }
        if (
          target.hostname === "lyricsplus-seven.vercel.app" ||
          target.hostname.startsWith("lyricsplus.") ||
          target.hostname === "lyrics-plus-backend.vercel.app"
        )
          return json({});
        if (target.hostname === "unison.boidu.dev")
          return json({ success: false, data: null });
        if (target.hostname === "lrclib.net") return json([]);
        if (target.hostname === "fetch-genius.samidy.workers.dev") return json({});
        if (target.hostname === "translate.googleapis.com" && lyricsMockMode === "google-pending") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          try {
            return await json(
              target.searchParams.get("dt") === "rm"
                ? [[ ["fixture", null, null, "fixture romanization"] ]]
                : [[ ["fixture translation"] ]],
            );
          } catch {
            return;
          }
        }
        if (target.hostname === "translate.googleapis.com" && lyricsMockMode === "google-error")
          return json({ error: "fixture" }, 500);
        if (target.hostname === "translate.googleapis.com")
          return json(
            target.searchParams.get("dt") === "rm"
              ? [[ ["fixture", null, null, "fixture romanization"] ]]
              : [[ ["fixture translation"] ]],
          );
        return route.abort();
      });
    }
    if (lyricsNetworkAudit) {
      context.on("requestfailed", (request) => {
        if (!request.url().startsWith("http")) return;
        const target = new URL(request.url());
        if (target.hostname === "127.0.0.1" || target.hostname === "localhost") return;
        const failure = request.failure()?.errorText || "unknown";
        const entry = requestEntries.get(request);
        if (entry) entry.state = /ABORT|CANCEL/i.test(failure) ? "cancelled" : "failed";
        externalRequestFailures.push({
          id: entry?.id,
          phase: entry?.phase,
          origin: target.origin,
          path: target.pathname,
          failure,
        });
      });
      context.on("requestfinished", (request) => {
        if (!request.url().startsWith("http")) return;
        const target = new URL(request.url());
        if (target.hostname === "127.0.0.1" || target.hostname === "localhost") return;
        const entry = requestEntries.get(request);
        if (entry) entry.state = "completed";
        externalRequestCompletions.push({
          id: entry?.id,
          phase: entry?.phase,
          origin: target.origin,
          path: target.pathname,
          query: Object.fromEntries(target.searchParams.entries()),
        });
      });
    }
    const lyricsTtml =
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
      Array.from(
        {
          length: 30,
        },
        (_, i) => `<p begin="${i}s" end="${i + 1}s">Deterministic shell lyric ${i + 1}</p>`,
      ).join("") +
      "</div></body></tt>";
    if (!lyricsNetworkAudit)
      await context.route("https://lrc.red/**", (route) => {
        const target = new URL(route.request().url());
        const corsHeaders = { "access-control-allow-origin": "*" };
        if (target.pathname === "/match.json") {
          const hit = {
            isrc: "USABC0000001",
            title: target.searchParams.get("track"),
            artist: target.searchParams.get("artist"),
          };
          const album = target.searchParams.get("album");
          const duration = Number(target.searchParams.get("duration"));
          if (album) hit.album = album;
          if (duration) hit.duration = duration;
          return route.fulfill({
            contentType: "application/json",
            headers: corsHeaders,
            body: JSON.stringify({ hits: [hit] }),
          });
        }
        return route.fulfill({
          contentType: "application/ttml+xml",
          headers: corsHeaders,
          body: lyricsTtml,
        });
      });
    await context.route("**/vendor/am-lyrics-1.7.4.js", (route) =>
      componentMode === "failed"
        ? route.abort()
        : route.fulfill({
            contentType: "text/javascript",
            body:
              (lyricsNetworkAudit
                ? ""
                : `for(const component of document.querySelectorAll('am-lyrics'))component.setAttribute('ttml',${JSON.stringify(lyricsTtml)});\n`) +
              fs.readFileSync("dist/vendor/am-lyrics-1.7.4.js", "utf8"),
          }),
    );
    if (lyricsStoragePressureBytes !== undefined) {
      assert.ok(
        Number.isSafeInteger(lyricsStoragePressureBytes) &&
          lyricsStoragePressureBytes > 0 &&
          lyricsStoragePressureBytes < 64 * 1024 * 1024,
        "the test-only lyrics storage ceiling must be a positive value below production capacity",
      );
      const source = fs.readFileSync("dist/music/lyrics-repository.js", "utf8");
      const productionLimit = "const MAX_STORAGE_BYTES = 64 * 1024 * 1024;";
      const parts = source.split(productionLimit);
      assert.equal(parts.length, 2, "the production storage ceiling remains a single literal");
      await context.route("**/music/lyrics-repository.js", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: `${parts[0]}const MAX_STORAGE_BYTES = ${lyricsStoragePressureBytes};${parts[1]}`,
        }),
      );
    }
    // Feed each newly created official component before connection, independent of earlier scenarios.
    if (!lyricsNetworkAudit)
      await context.addInitScript((ttml) => {
        const create = document.createElement.bind(document);
        document.createElement = (tag, options) => {
          const element = create(tag, options);
          if (tag === "am-lyrics") element.setAttribute("ttml", ttml);
          return element;
        };
      }, lyricsTtml);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack}`));
    await page.goto("http://127.0.0.1:" + web.address().port + "/?voiceTransport=local#perfil");
    await page.waitForSelector("#globalSpaceAmp");
    await page.evaluate((initialTrack) => {
      const a = SPACEAMP;
      window.__calls = [];
      window.__time = {
        position: 12.5,
        duration: 180,
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
        seek: (t) => {
          __calls.push(["seek", t]);
          __time.position = t;
          a.progress({
            position: t,
          });
        },
        setVolume: (v) =>
          a.progress({
            volume: v,
          }),
      });
      if (initialTrack)
        a.update(
          {
            title: "First",
            artist: "Artist",
            source: "YouTube",
            sourceUrl: "fixture",
            artwork: "profile-art.png",
          },
          true,
          {
            available: true,
          },
        );
      document.body.style.minHeight = "2400px";
      window.scrollTo(0, 300);
    }, initialTrack);
    await page.waitForFunction(() => scrollY === 300);
    const before = await page.evaluate(() => scrollY);
    const np = page.locator("#spaceampNowPlaying");
    const toggle = page.getByRole("button", {
      name: "Lyrics",
      exact: true,
    });
    async function open() {
      await page.locator("#album").click();
      await page.waitForSelector("#spaceampNowPlaying[open]");
      await page.waitForFunction(() => customElements.get("am-lyrics"));
    }
    async function mode(index, value) {
      const summary = page.locator(".np-menu summary").nth(index);
      await summary.click();
      await page
        .getByRole("combobox", {
          name: index === 0 ? "Visualizer" : "Interface",
          exact: true,
        })
        .selectOption(value);
      await summary.click();
    }
    async function settled() {
      await page.waitForFunction(
        () =>
          !document
            .querySelector("#spaceampNowPlaying")
            .getAnimations({
              subtree: true,
            })
            .some(
              (a) =>
                a.playState === "running" && Number.isFinite(a.effect.getComputedTiming().endTime),
            ),
      );
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
        window.__art = [
          make("#bd653a", "#834b3e"),
          make("#396fa8", "#344d7e"),
          make("#558652", "#374e40"),
        ];
        window.__artIndex = 0;
        window.__globalTheme = document.documentElement.style.cssText;
        window.__changeArt = (index) => {
          __artIndex = index;
          SPACEAMP.update(
            {
              title: "Palette " + index,
              artist: "Local fixture",
              source: "local",
              sourceUrl: "local-" + index,
              artwork: __art[index],
            },
            true,
            {
              available: true,
            },
          );
        };
        SPACEAMP.setNavigation({
          next: () => __changeArt(1),
          previous: () => __changeArt(0),
          ended: () => __changeArt(2),
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
        window.__atmosphereFixtures = [
          make("#777777", "#ce397d"),
          make("#287fab", "#246197"),
          make("#398964", "#235b49"),
          make("#747474", "#ff00ff", true),
        ];
      });
      await page.waitForFunction(
        () =>
          document.querySelector("#spaceampNowPlaying").dataset.palette === "artwork" &&
          document.querySelector(".np-cover").dataset.artworkReady === "true",
      );
      await page.waitForFunction(
        () => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp",
      );
    }
    if (autoOpen) await open();
    return {
      page,
      context,
      errors,
      np,
      toggle,
      mode,
      lyricsTtml,
      before,
      open,
      artwork,
      settled,
      testArtifacts,
      externalRequests,
      externalRequestCompletions,
      externalRequestFailures,
      setAuditPhase(value) {
        auditPhase = value;
      },
      setLyricsMockMode(value) {
        lyricsMockMode = value;
      },
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
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          assert.equal(
            await page.evaluate(() => __dynamicDraws),
            draws,
            "GPU loop stops after closing presentation",
          );
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
        assert.equal(browser.contexts().length, 0, "scenario context is released");
      },
    };
  } catch (error) {
    await context?.close();
    throw error;
  }
}
module.exports = {
  createFixture,
};
