const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
(async () => {
  const server = createServer();
  let browser;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage(),
      origin = "http://127.0.0.1:" + server.address().port;
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("BROWSER", e.message);
    });
    const art = origin + "/fixture.svg",
      banner = origin + "/banner.svg",
      artistId = "ytmusic:artist:UCfixtureartist123",
      albumId = "ytmusic:album:MPREfixturealbum123";
    await context.route("**/fixture.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#28413e"/><circle cx="180" cy="190" r="130" fill="#728572"/><path d="M0 430L320 180 600 500V600H0" fill="#13282c"/></svg>',
      }),
    );
    await context.route("**/banner.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="500"><rect width="1400" height="500" fill="#334046"/><path d="M0 500L600 100 1400 450V500" fill="#17252e"/></svg>',
      }),
    );
    const song = {
      kind: "music",
      catalogId: "ytmusic:video:abcdefghijk",
      title: "Thanatos",
      artist: "Kinokoteikoku",
      artistCatalogId: artistId,
      albumTitle: "Time Lapse",
      albumCatalogId: albumId,
      image: art,
      source: "YouTube Music",
      releaseDate: "2018",
      trackDuration: 279,
      genres: ["shoegaze", "dream pop"],
      playbackSource: { type: "youtube", videoId: "abcdefghijk" },
      isrc: "JPB451202866",
    };
    const tracks = Array.from({ length: 13 }, (_, i) => ({
      ...song,
      catalogId: "ytmusic:video:track" + String(i).padStart(6, "0"),
      isrc: i === 3 ? song.isrc : "",
      title: i === 3 ? "Thanatos" : "Track " + (i + 1),
      trackDuration: i === 1 ? undefined : 210 + i,
      playbackSource: {
        type: "youtube",
        videoId: "track" + String(i).padStart(6, "0"),
      },
    }));
    const album = {
      kind: "album",
      catalogId: albumId,
      title: "Time Lapse",
      artist: song.artist,
      artistCatalogId: artistId,
      image: art,
      source: "YouTube Music",
      releaseDate: "2018",
      total: 13,
      unit: "faixas",
      albumTracks: tracks,
      trackNames: tracks.map((t) => t.title),
      genres: ["shoegaze"],
    };
    const zAlbum = {
      ...album,
      catalogId: "ytmusic:album:MPREfixturezalbum123",
      albumType: "album",
      releaseDate: "2021",
      title: "Z album",
    };
    const artist = {
      kind: "artist",
      catalogId: artistId,
      title: song.artist,
      image: art,
      bannerImage: banner,
      source: "YouTube Music",
      genres: ["shoegaze", "japan", "dream pop"],
      summary: "Biografia longa. ".repeat(90),
      topTracks: tracks.slice(0, 5),
      topAlbums: [zAlbum],
      relatedArtists: [],
    };
    await context.route("**/api/music/ytmusic/**", (r) => {
      const parts = new URL(r.request().url()).pathname.split("/"),
        kind = parts[4],
        id = parts[5];
      let result = kind === "artist" ? artist : kind === "album" ? album : song;
      if (kind === "album" && id === zAlbum.catalogId.slice("ytmusic:album:".length))
        result = zAlbum;
      if (id.includes("missing"))
        result =
          kind === "artist"
            ? {
                ...artist,
                catalogId: "ytmusic:artist:" + id,
                bannerImage: "",
                summary: "",
                genres: [],
              }
            : kind === "album"
              ? {
                  ...album,
                  catalogId: "ytmusic:album:" + id,
                  summary: "Album description",
                  albumTracks: tracks.slice(0, 2),
                  trackNames: tracks.slice(0, 2).map((t) => t.title),
                  total: 2,
                }
              : {
                  ...song,
                  catalogId: "ytmusic:video:" + id,
                  genres: [],
                  summary: "Track description",
                  playbackSource: null,
                };
      return r.fulfill({ json: result });
    });
    await context.route("**/api/music/tag?*", async (r) => {
      const params = new URL(r.request().url()).searchParams,
        section = params.get("section");
      if (params.get("tag") === "quiet-unlisted")
        return r.fulfill({
          json:
            section === "info"
              ? { summary: "" }
              : section === "related"
                ? { tags: [] }
                : { items: [], next: null },
        });
      if (section === "album")
        return r.fulfill({
          status: 503,
          json: { error: "Álbuns temporariamente indisponíveis." },
        });
      return r.fulfill({
        json:
          section === "info"
            ? { name: "shoegaze", summary: "História da tag. ".repeat(65) }
            : section === "related"
              ? { tags: ["dream pop", "noise pop"] }
              : {
                  items: [section === "music" ? song : artist],
                  next: null,
                  partial: true,
                },
      });
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.TitlePages && window.MusicBridge);
    const open = async (item) => {
      await page.evaluate((item) => TitlePages.open(item), item);
      await page.waitForFunction(
        (title) => document.querySelector("#titlePage h1")?.textContent === title,
        item.title,
      );
      await page.waitForFunction(
        () =>
          !document.querySelector('#titlePage [role="status"]')?.textContent.includes("Carregando"),
      );
    };
    let recommendationRequests = 0,
      albumRequests = 0;
    await context.route("**/api/music/recommendations?*", (r) => {
      recommendationRequests++;
      return r.fulfill({ json: { items: [song], reserveAvailable: false } });
    });
    await context.route("**/api/music/ytmusic/album/**", async (r) => {
      albumRequests++;
      await new Promise((resolve) => setTimeout(resolve, 80));
      const id = new URL(r.request().url()).pathname.split("/").at(-1);
      return r.fulfill({
        json: id === zAlbum.catalogId.slice("ytmusic:album:".length) ? zAlbum : album,
      });
    });
    const releases = [
      zAlbum,
      {
        ...album,
        catalogId: "ytmusic:album:MPREfixtureep123",
        albumType: "ep",
        releaseDate: "2018",
        title: "B EP",
      },
      {
        ...album,
        catalogId: "ytmusic:album:MPREfixtureep234",
        albumType: "ep",
        releaseDate: "2014",
        title: "A EP",
      },
      {
        ...album,
        catalogId: "ytmusic:album:MPREfixturesingle",
        albumType: "single",
        releaseDate: "",
        title: "Single",
      },
    ];
    await context.route("**/api/music/ytmusic/artist/**", (r) =>
      r.fulfill({
        json: {
          ...artist,
          listeners: "1234",
          playcount: "5678",
          summarySource: "Last.fm",
          topAlbums: releases,
        },
      }),
    );
    fs.mkdirSync("artifacts/music-ux", { recursive: true });
    await open(artist);
    await page.waitForSelector(".artist-editorial-columns");
    assert.equal(await page.locator(".title-banner").evaluate((n) => n.style.height), "390px");
    assert.equal(await page.locator(".discovery-heading > button").count(), 1);
    assert.equal(
      await page.locator(".title-cover-column img").evaluate((n) => getComputedStyle(n).objectFit),
      "contain",
    );
    assert.equal(await page.locator("#titlePage.has-title-banner").count(), 1);
    assert.equal(await page.locator(".artist-editorial-columns").count(), 1);
    assert.ok((await page.locator(".artist-editorial-columns").textContent()).includes("1234"));
    const filter = page.locator(".discography-filter");
    await filter.getByRole("button", { name: "EPs", exact: true }).click();
    await page.locator(".discography-sort").selectOption("old");
    assert.deepEqual(
      await page.locator(".artist-discography .media-related-grid strong").allTextContents(),
      ["A EP", "B EP"],
    );
    await page.locator(".discography-sort").selectOption("recent");
    assert.deepEqual(
      await page.locator(".artist-discography .media-related-grid strong").allTextContents(),
      ["B EP", "A EP"],
    );
    await filter.getByRole("button", { name: "singles", exact: true }).click();
    assert.deepEqual(
      await page.locator(".artist-discography .media-related-grid strong").allTextContents(),
      ["Single"],
    );
    await filter.getByRole("button", { name: "todos", exact: true }).click();
    await page.locator(".discography-sort").selectOption("title");
    assert.deepEqual(
      await page.locator(".artist-discography .media-related-grid strong").allTextContents(),
      ["A EP", "B EP", "Single", "Z album"],
    );
    await page.screenshot({
      path: "artifacts/music-ux/artist-desktop.png",
      fullPage: true,
    });
    await page.evaluate(() => {
      window.inlinePlays = [];
      SPACEAMP.play = (track) => {
        inlinePlays.push(track);
      };
    });
    await page.evaluate(() =>
      SPACEAMP.update(
        {
          title: "Track 1",
          artist: "Kinokoteikoku",
          source: "YouTube",
          sourceUrl: "https://www.youtube.com/watch?v=track000000",
          artwork: "",
        },
        true,
        { available: true },
      ),
    );
    assert.ok((await page.locator(".music-track-row.is-playing-track").count()) > 0);
    assert.equal(
      await page
        .locator(".music-track-row.is-playing-track")
        .first()
        .evaluate((n) => getComputedStyle(n).backgroundColor),
      "rgba(0, 0, 0, 0)",
    );
    const count = await page.evaluate(() => CollectionActions.getItems().length);
    await page.getByRole("button", { name: "Tocar Track 1", exact: true }).click();
    assert.equal(await page.evaluate(() => inlinePlays.length), 1);
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), count);
    assert.equal(await page.locator("#titlePage h1").textContent(), artist.title);
    await page.locator("[data-title-discovery]").scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.querySelector("[data-title-discovery]").dataset.started === "true",
    );
    await page.waitForFunction(
      () => document.querySelector("[data-title-discovery]").getAttribute("aria-busy") === "false",
    );
    const calls = recommendationRequests;
    await page.evaluate(() => TitlePages.refresh());
    assert.equal(recommendationRequests, calls);
    await page.locator(".artist-discography").scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const originScroll = await page.evaluate(() => scrollY);
    await page.evaluate((album) => TitlePages.open(album), album);
    await page.waitForFunction(
      () => document.querySelector("#titlePage h1")?.textContent === "Time Lapse",
    );
    await page.waitForTimeout(20);
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.equal(await page.locator("[data-title-discovery]").count(), 0); // Cold navigation draws seed immediately, before core.
    await page.waitForFunction(
      () =>
        !document.querySelector('#titlePage [role="status"]')?.textContent.includes("Carregando"),
    );
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.screenshot({
      path: "artifacts/music-ux/navigation-album-top.png",
      fullPage: true,
    });
    await page.locator("#titlePage button").filter({ hasText: "← voltar" }).click();
    await page.waitForFunction(
      () => document.querySelector("#titlePage h1")?.textContent === "Kinokoteikoku",
    );
    await page.waitForTimeout(150);
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - originScroll) < 3);
    await page.screenshot({
      path: "artifacts/music-ux/navigation-back-artist.png",
      fullPage: true,
    });
    await open(album);
    assert.ok(
      !(await page.locator("#titlePage .title-about").textContent()).includes("Dados do catálogo:"),
    );
    assert.equal(await page.locator("#titlePage.has-title-banner").count(), 0);
    await page.getByRole("button", { name: "Tocar Track 1", exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => inlinePlays.length), 2);
    await page.screenshot({
      path: "artifacts/music-ux/album-desktop.png",
      fullPage: true,
    });
    await open(song);
    await page.waitForSelector(".album-context:not([hidden])");
    assert.equal(await page.locator(".album-context .music-track-row").count(), 5);
    assert.ok(
      (await page.locator(".album-context .is-current-track").textContent()).includes("Thanatos"),
    );
    const before = albumRequests;
    await page.evaluate(() => TitlePages.refresh());
    await page.waitForSelector(".album-context:not([hidden])");
    assert.equal(albumRequests, before);
    await page.getByRole("button", { name: "Tocar Track 2", exact: true }).click();
    assert.equal(await page.evaluate(() => inlinePlays.length), 3);
    await page.screenshot({
      path: "artifacts/music-ux/song-desktop.png",
      fullPage: true,
    });
    await context.route("https://fixture.test/**", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="500"><rect width="1400" height="500" fill="#334046"/></svg>',
      }),
    );
    for (const [source, id] of [
      ["IGDB", "igdb:99"],
      ["Steam", "steam:99"],
    ]) {
      await context.route("**/api/" + source.toLowerCase() + "/games/99", (r) =>
        r.fulfill({
          json:
            source === "Steam"
              ? {
                  steam_appid: 99,
                  name: "Steam game",
                  cover_image: "https://fixture.test/art.svg",
                  banner_image: "https://fixture.test/banner.svg",
                }
              : {
                  kind: "game",
                  catalogId: id,
                  title: source + " game",
                  source,
                  image: art,
                  bannerImage: banner,
                },
        }),
      );
      await open({
        kind: "game",
        catalogId: id,
        title: source + " game",
        source,
        image: art,
        bannerImage: banner,
      });
      await page.waitForSelector("#titlePage.has-title-banner");
      await page.screenshot({
        path: "artifacts/music-ux/" + source + "-desktop.png",
        fullPage: true,
      });
    }
    await context.route("https://graphql.anilist.co", (r) =>
      r.fulfill({
        json: {
          data: {
            Media: {
              id: 99,
              title: { romaji: "Anime fixture" },
              coverImage: { large: "https://fixture.test/art.svg" },
              bannerImage: "https://fixture.test/banner.svg",
              description: "Real fixture description",
              genres: [],
            },
          },
        },
      }),
    );
    await open({
      kind: "anime",
      catalogId: "anilist:99",
      title: "Anime fixture",
      source: "AniList",
      image: art,
      bannerImage: banner,
    });
    await page.waitForSelector("#titlePage.has-title-banner");
    await page.screenshot({
      path: "artifacts/music-ux/anime-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const item of [artist, album, song]) {
      await open(item);
      await page.screenshot({
        path: "artifacts/music-ux/" + item.kind + "-mobile.png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () =>
            document.querySelector("#titlePage").scrollWidth <=
            document.querySelector("#titlePage").clientWidth,
        ),
        true,
      );
    }
    await context.route("**/portrait.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect width="300" height="600" fill="#466060"/><circle cx="150" cy="90" r="60" fill="#acb6a7"/></svg>',
      }),
    );
    await context.route("**/landscape.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#466060"/><circle cx="50" cy="100" r="45" fill="#acb6a7"/><circle cx="550" cy="100" r="45" fill="#acb6a7"/></svg>',
      }),
    );
    const people = [
      {
        ...artist,
        catalogId: "ytmusic:artist:UClampfixture123",
        title: "Lamp",
        image: origin + "/landscape.svg",
      },
      {
        ...artist,
        catalogId: "ytmusic:artist:UCuchufixture123",
        title: "Uchu Nekoko",
        image: origin + "/portrait.svg",
        bannerImage: "",
      },
    ];
    await context.route("**/api/music/ytmusic/artist/**", (r) => {
      const id = new URL(r.request().url()).pathname.split("/").pop();
      return r.fulfill({
        json: people.find((item) => item.catalogId.endsWith(id)) || artist,
      });
    });
    for (const person of people) {
      await open(person);
      const result = await page.evaluate((person) => {
        const card = document.createElement("button");
        card.className = "discover-card";
        card.dataset.kind = "artist";
        const cover = document.createElement("div");
        cover.className = "title-cover";
        cover.dataset.kind = "artist";
        const img = document.createElement("img");
        img.src = person.image;
        cover.append(img);
        card.append(cover);
        document.querySelector("#titlePage .title-about").prepend(card);
        return {
          ratio: getComputedStyle(cover).aspectRatio,
          fit: getComputedStyle(img).objectFit,
        };
      }, person);
      assert.equal(result.ratio, "1 / 1");
      assert.equal(result.fit, "contain");
      await page.screenshot({
        path: "artifacts/music-ux/" + person.title.replaceAll(" ", "-") + "-square-mobile.png",
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate((song) => {
      const mixed = [
        { ...song, title: "Short" },
        {
          ...song,
          title: "A very long title ".repeat(18),
          trackDuration: undefined,
        },
        { ...song, title: "No context", artist: "", albumTitle: "" },
        { ...song, title: "No playback", playbackSource: null },
      ];
      const list = MusicPageUI.tracklist(mixed);
      list.id = "alignment-fixture";
      document.querySelector("#titlePage").replaceChildren(list);
      list.children[0].querySelector(".music-track-playlist").textContent = "✓ na playlist";
      list.children[2].querySelector("img")?.remove();
    }, song);
    const alignment = await page.locator("#alignment-fixture").evaluate((list) => {
      const rows = [...list.children];
      return [".music-track-context", ".music-track-duration", ".music-track-playlist"].map(
        (selector) =>
          rows
            .map((row) => row.querySelector(selector)?.getBoundingClientRect().left)
            .filter((value) => value !== undefined),
      );
    });
    for (const positions of alignment)
      assert.ok(
        Math.max(...positions) - Math.min(...positions) < 1,
        "optional slots and action labels keep column starts",
      );
    await page.screenshot({
      path: "artifacts/music-ux/tracklist-aligned-desktop.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({
      path: "artifacts/music-ux/tracklist-aligned-mobile.png",
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const flow of ["artist", "album"]) {
      let release;
      const gate = new Promise((resolve) => (release = resolve));
      const seed = {
        ...song,
        catalogId: "ytmusic:video:" + (flow === "artist" ? "datedartist" : "datedalbum1"),
        title: flow + " dated track",
        releaseDate: flow === "artist" ? "2021" : "2005",
      };
      await context.route("**/api/music/ytmusic/music/**", async (r) => {
        await gate;
        return r.fulfill({ json: { ...seed, summary: "Hydrated " + flow } });
      });
      await page.evaluate(
        (seed) =>
          document.querySelector("#titlePage").replaceChildren(MusicPageUI.tracklist([seed])),
        seed,
      );
      await page.locator("#titlePage .music-track-main").click();
      await page.waitForFunction(
        (title) => document.querySelector("#titlePage h1")?.textContent === title,
        seed.title,
      );
      const initial = await page.locator(".title-timing").textContent();
      assert.equal(initial, seed.releaseDate + " · 4:39");
      await page.screenshot({
        path: "artifacts/music-ux/" + flow + "-track-first.png",
      });
      release();
      await page.waitForFunction(
        (summary) => document.querySelector(".title-summary")?.textContent === summary,
        "Hydrated " + flow,
      );
      assert.equal(await page.locator(".title-timing").textContent(), initial);
      await page.screenshot({
        path: "artifacts/music-ux/" + flow + "-track-final.png",
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: overlap across providers, real stats columns, filter/sort combinations, lazy discovery reuse, keyboard inline play independent of collection, album cache/window, mobile width.",
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
