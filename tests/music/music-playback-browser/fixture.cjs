const fs = require("node:fs");
const path = require("node:path");

const localSong = {
  id: "song",
  kind: "music",
  title: "Catalog song",
  artist: "Artist",
  status: "planned",
  catalogId: "deezer:123",
  url: "https://www.deezer.com/track/123",
  playbackSource: { type: "local", fileRef: "audio-test" },
};
const legacySong = {
  id: "legacy-song",
  kind: "music",
  title: "Old music",
  artist: "Artist",
  status: "planned",
  catalogId: "lastfm:old",
  url: "https://www.last.fm/music/Artist/Old",
};
const sourceItems = [
  {
    id: "auto",
    kind: "music",
    title: "Auto Song",
    artist: "Artist",
    status: "planned",
    catalogId: "deezer:999",
    url: "https://www.deezer.com/track/999",
  },
  {
    id: "missing",
    kind: "music",
    title: "Unknown Song",
    artist: "Artist",
    status: "planned",
  },
  {
    id: "ambiguous",
    kind: "music",
    title: "Ambiguous Song",
    artist: "Artist",
    status: "planned",
  },
];

async function createFixture(runtime, items = [localSong]) {
  const context = await runtime.browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript((items) => {
    // Legacy identity is imported, never created through the current catalog API.
    if (!localStorage.getItem("myspace-extras-v1")) {
      localStorage.setItem("myspace-extras-v1", JSON.stringify({ version: 1, items }));
    }
    window.__handlers = {};
    if (navigator.mediaSession) {
      const original = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (key, handler) => {
        __handlers[key] = handler;
        original(key, handler);
      };
    }
  }, items);
  await context.route("https://**/*", (route) => route.abort());
  await context.route("https://www.youtube.com/iframe_api", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: fs.readFileSync(path.join(__dirname, "fixtures/youtube.js"), "utf8"),
    }),
  );
  await context.route("https://www.youtube.com/embed/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>YT fixture</title>",
    }),
  );
  await context.route("https://i.ytimg.com/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: fs.readFileSync(path.join(__dirname, "../../../dist/profile-art.png")),
    }),
  );
  await context.route("**/api/media/metadata?**", (route) =>
    route.fulfill({
      json: { title: "Linked video", artist: "Video artist", thumbnail: "" },
    }),
  );
  await context.route("**/api/music/playback-source?**", (route) => {
    const title = new URL(route.request().url()).searchParams.get("title");
    const source = {
      type: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoId: "dQw4w9WgXcQ",
    };
    const result =
      title === "Auto Song"
        ? { status: "matched", source, items: [] }
        : title === "Ambiguous Song"
          ? {
              status: "choose",
              source: null,
              items: [
                { title: "Version A", channel: "Artist", url: source.url },
                {
                  title: "Version B",
                  channel: "Artist",
                  url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
                },
              ],
            }
          : { status: "not-found", source: null, items: [] };
    return route.fulfill({ json: result });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${runtime.web.address().port}/#perfil`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => window.CollectionActions && document.getElementById("globalSpaceAmp"),
  );
  await page.evaluate(async () => {
    const rate = 8000;
    const size = rate * 30 * 2;
    const bytes = new Uint8Array(44 + size);
    const view = new DataView(bytes.buffer);
    function string(at, value) {
      for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
    }
    string(0, "RIFF");
    view.setUint32(4, 36 + size, true);
    string(8, "WAVE");
    string(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    string(36, "data");
    view.setUint32(40, size, true);
    await MediaStorage.put("audio-test", new Blob([bytes], { type: "audio/wav" }));
  });
  const playing = (value) =>
    page.waitForFunction((value) => SPACEAMP.getState().playing === value, value);
  const item = (title) =>
    page.evaluate(
      (title) => CollectionActions.getItems().find((item) => item.title === title),
      title,
    );
  async function settle() {
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  }
  async function route(hash) {
    await page.evaluate((hash) => {
      location.hash = hash;
    }, hash);
    await page.waitForFunction(
      (onProfile) =>
        document.querySelector("#globalSpaceAmp").classList.contains("in-profile") === onProfile,
      hash === "perfil",
    );
    await settle();
  }
  async function playLocal() {
    await page.evaluate(() => {
      const actions = MusicBridge.actions(
        CollectionActions.getItems().find((item) => item.id === "song"),
      );
      actions.id = "testMusicActions";
      document.body.append(actions);
    });
    await page
      .locator("#testMusicActions")
      .getByRole("button", { name: "▶ tocar agora", exact: true })
      .click();
    await playing(true);
  }
  async function linkLegacy() {
    await page.evaluate(() => {
      const actions = MusicBridge.actions(
        CollectionActions.getItems().find((item) => item.id === "legacy-song"),
      );
      actions.id = "legacyMusicActions";
      document.body.append(actions);
    });
    await page
      .locator("#legacyMusicActions")
      .getByRole("button", { name: "vincular reprodução", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Link de reprodução" })
      .fill("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
    await page
      .locator(".music-link-dialog")
      .getByRole("button", { name: "salvar", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        CollectionActions.getItems().find((item) => item.id === "legacy-song")?.playbackSource
          ?.type === "youtube",
    );
    await page.evaluate(() =>
      SPACEAMP.play(
        MusicModel.queueTrack(
          CollectionActions.getItems().find((item) => item.id === "legacy-song"),
        ),
      ),
    );
    await page.waitForFunction(() => window.__ytTest);
  }
  async function confirmYouTube() {
    await page.evaluate(() => __ytTest.emit(1));
    await playing(true);
  }
  return {
    context,
    page,
    errors,
    playing,
    item,
    settle,
    route,
    playLocal,
    linkLegacy,
    confirmYouTube,
  };
}

module.exports = { createFixture, localSong, legacySong, sourceItems };
