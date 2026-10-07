const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
const { createMusicCatalog } = require("../../server/music-catalog.cjs");
const { createYouTubeMusicClient, FILTERS } = require("../../server/youtube-music.cjs");
const fixture = require("./fixtures/youtube-music-search.json");

(async () => {
  const calls = [],
    errors = [];
  let fail = true,
    release,
    entered;
  const song = fixture.contents.sectionListRenderer.contents[0].musicShelfRenderer.contents[0];
  function row(kind, i, query) {
    if (kind === "music") {
      const value = structuredClone(song);
      value.musicResponsiveListItemRenderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.videoId =
        "song" + String(i).padStart(7, "0");
      value.musicResponsiveListItemRenderer.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text =
        query + " Song " + i;
      value.musicResponsiveListItemRenderer.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[0].navigationEndpoint.browseEndpoint.browseId =
        "UCfixtureartist123";
      value.musicResponsiveListItemRenderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails =
        [
          {
            url: "https://lh3.googleusercontent.com/search-fixture-image=w800-h800",
          },
        ];
      return value;
    }
    return {
      musicTwoRowItemRenderer: {
        title: {
          runs: [{ text: kind === "artist" ? "Boa" : query + " Album " + i }],
        },
        navigationEndpoint: {
          browseEndpoint: {
            browseId: (kind === "artist" ? "UCboa" : "MPREalbum") + String(i).padStart(8, "0"),
            browseEndpointContextSupportedConfigs: {
              browseEndpointContextMusicConfig: {
                pageType: kind === "artist" ? "MUSIC_PAGE_TYPE_ARTIST" : "MUSIC_PAGE_TYPE_ALBUM",
              },
            },
          },
        },
      },
    };
  }
  const youtubeMusic = createYouTubeMusicClient({
    fetcher: async (url, options) => {
      if (!options.method)
        return {
          ok: true,
          text: async () =>
            'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});',
        };
      assert.ok(url.includes("/search?"), "pagination must never browse/get details");
      const body = JSON.parse(options.body);
      calls.push(body);
      const [cursorQuery, cursorKind, number] = (body.continuation || "").split("|");
      const query = body.query || cursorQuery;
      const kind = cursorKind || Object.keys(FILTERS).find((kind) => FILTERS[kind] === body.params);
      const page = Number(number || 1);
      if (query === "Retry" && page === 2 && fail) {
        fail = false;
        throw Error("page outage");
      }
      if (query.startsWith("Slow") && page === 2) {
        entered?.();
        await new Promise((resolve) => {
          release = resolve;
        });
      }
      const indices =
        query === "ItemLimit"
          ? Array.from({ length: 40 }, (_, i) => page * 40 + i)
          : kind === "artist"
            ? page === 1
              ? [1]
              : [1, 2]
            : page === 1
              ? [1, 2, 3]
              : [2, 4, 5];
      const next =
        query === "End" || (!["Limit", "ItemLimit", "Repeat", "Cycle"].includes(query) && page >= 3)
          ? null
          : query +
            "|" +
            kind +
            "|" +
            ((query === "Repeat" && page === 2) || (query === "Cycle" && page === 3)
              ? 2
              : page + 1);
      const shelf = {
        contents: indices.map((i) => row(kind, i + (page > 3 ? page * 10 : 0), query)),
        ...(next
          ? {
              continuations: [{ nextContinuationData: { continuation: next } }],
            }
          : {}),
      };
      return {
        ok: true,
        json: async () =>
          page === 1
            ? { contents: { musicShelfRenderer: shelf } }
            : { continuationContents: { musicShelfContinuation: shelf } },
      };
    },
  });
  const music = createMusicCatalog({
    youtubeMusic,
    artistArtwork: { lookup: async () => "" },
    lastfm: { summary: async () => ({}) },
  });
  const server = createServer({ music });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1000, height: 700 },
    });
    await context.route(/^https?:\/\//, (route) =>
      ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort(),
    );
    await context.route("**/api/music/artwork?*", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + server.address().port + "/#perfil");
    await page.mouse.move(0, 0);
    const more = page
      .locator("#discoverPage")
      .getByRole("button", { name: "carregar mais", exact: true });
    const cards = page.locator("#discoverPage .discover-card");
    async function search(kind, query) {
      await page.evaluate(
        ({ kind, query }) => {
          location.hash = "#buscar/" + kind + "/" + encodeURIComponent(query);
        },
        { kind, query },
      );
      try {
        await page.waitForFunction(
          (query) =>
            document.querySelector('#discoverPage [aria-label="Buscar título"]').value === query &&
            document.querySelector("#discoverPage .discover-status").dataset.state === "ready" &&
            document.querySelector("#discoverPage .discover-results").getAttribute("aria-busy") ===
              "false",
          query,
          { timeout: 5000 },
        );
      } catch (error) {
        console.error({
          errors,
          calls: calls.map((body) => ({
            query: body.query,
            continuation: body.continuation,
          })),
          status: await page.locator("#discoverPage").textContent(),
        });
        throw error;
      }
    }
    const ready = () =>
      page.waitForFunction(
        () =>
          ![...document.querySelectorAll("#discoverPage button")].find(
            (button) => button.textContent === "carregar mais",
          ).disabled,
      );
    for (const kind of ["music", "album"]) {
      const before = calls.length;
      await search(kind, "Paged " + kind);
      assert.equal(calls.length, before + 1);
      assert.equal(await cards.count(), 3);
      assert.equal(await more.isVisible(), true);
      await page.evaluate(() => {
        window.originalCards = [...document.querySelectorAll("#discoverPage .discover-card")];
      });
      await page.evaluate(async () => {
        window.originalImage = originalCards[0].querySelector("img");
        if (originalImage) await originalImage.decode();
      });
      const snapshot = await page.evaluate(() => ({ top: scrollY }));
      // Keep button focused without scrolling so append can preserve a concrete focus/viewport.
      await more.evaluate((button) => {
        button.focus({ preventScroll: true });
        button.click();
      });
      await ready();
      assert.equal(calls.length, before + 2);
      assert.equal(await cards.count(), 5);
      assert.equal(
        await page.evaluate(() =>
          originalCards.every(
            (card, i) => card === document.querySelectorAll("#discoverPage .discover-card")[i],
          ),
        ),
        true,
      );
      assert.equal(
        await page.evaluate(
          () =>
            originalImage === originalCards[0].querySelector("img") &&
            (!originalImage || originalImage.complete),
        ),
        true,
      );
      assert.equal(await more.evaluate((button) => button === document.activeElement), true);
      assert.equal(await page.evaluate(() => scrollY), snapshot.top);
      assert.match(
        await page.locator("#discoverPage .discover-status").first().textContent(),
        /^5 resultados/,
      );
      await more.evaluate((button) => button.click());
      await ready();
      assert.equal(await more.isVisible(), false);
      assert.equal(calls.length, before + 3);
    }
    await search("artist", "Namesakes");
    await more.evaluate((button) => button.click());
    await ready();
    assert.equal(await cards.count(), 2);
    assert.equal(await page.locator("#discoverPage .artist-result-group").count(), 1);
    assert.match(await page.locator("#discoverPage summary").textContent(), /2 artistas/);
    const labels = await page.locator("#discoverPage .discover-card small").allTextContents();
    assert.notEqual(labels[0], labels[1]);
    await search("music", "Retry");
    const beforeFailure = calls.length;
    await more.evaluate((button) => button.click());
    await ready();
    assert.equal(await cards.count(), 3);
    assert.ok(
      (await page.locator("#discoverPage").textContent()).includes("Os resultados foram mantidos"),
    );
    await more.evaluate((button) => button.click());
    await ready();
    assert.equal(await cards.count(), 5);
    assert.equal(calls.length, beforeFailure + 2);
    for (const query of ["SlowSearch", "SlowRoute"]) {
      await search("music", query);
      const started = new Promise((resolve) => {
        entered = resolve;
      });
      await more.evaluate((button) => button.click());
      await started;
      if (query === "SlowSearch") await search("music", "Replacement");
      else {
        await page.evaluate(() => {
          location.hash = "#perfil";
        });
        await page.waitForFunction(() => document.body.dataset.page === "perfil");
      }
      release();
      await page.waitForTimeout(80);
      if (query === "SlowSearch")
        assert.ok((await cards.first().textContent()).includes("Replacement"));
      else assert.equal(await more.isVisible(), false);
    }
    await search("album", "End");
    assert.equal(await more.isVisible(), false);
    await search("album", "Repeat");
    await more.evaluate((button) => button.click());
    await ready();
    assert.equal(await more.isVisible(), false);
    await search("album", "Cycle");
    for (let i = 0; i < 2; i++) {
      await more.evaluate((button) => button.click());
      await ready();
    }
    assert.equal(await more.isVisible(), false);
    const limitStart = calls.length;
    await search("album", "Limit");
    for (let i = 0; i < 9; i++) {
      await more.evaluate((button) => button.click());
      await ready();
    }
    assert.equal(await more.isVisible(), false);
    assert.equal(calls.length, limitStart + 10);
    await search("album", "ItemLimit");
    for (let i = 0; i < 9; i++) {
      await more.evaluate((button) => button.click());
      await ready();
    }
    assert.equal(await cards.count(), 400);
    assert.equal(await more.isVisible(), false);
    // Existing editor picker continues first-page Array search, without pagination controls.
    await page.evaluate(() => CollectionActions.editItem());
    await page
      .locator('#resourceEditor .catalog-picker [aria-label="Tipo de mídia"]')
      .selectOption("music");
    await page.locator('#resourceEditor [aria-label="Buscar título no catálogo"]').fill("Picker");
    const pickerBefore = calls.length;
    await page
      .locator("#resourceEditor .catalog-picker")
      .getByRole("button", { name: "buscar", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("#resourceEditor .catalog-results button").length > 0,
    );
    assert.equal(calls.length, pickerBefore + 1);
    assert.equal(
      await page
        .locator("#resourceEditor")
        .getByRole("button", { name: "carregar mais", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.evaluate(async () => Array.isArray(await Catalog.search("music", "Picker"))),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: one request/page, append/dedupe/count/end, retry, stale search/route, card/focus/scroll retention, cross-page namesakes, 10-page cap and first-page editor; no details or external network.",
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
