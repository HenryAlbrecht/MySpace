const assert = require("node:assert/strict");
const { startRuntime } = require("../spaceamp/spaceamp-browser/runtime.cjs");
(async () => {
  const runtime = await startRuntime();
  let context;
  try {
    context = await runtime.browser.newContext();
    await context.route("https://**/*", (route) => route.abort());
    await context.addInitScript(() => {
      window.__tracks = [{ file_id: "1:2:3", file_name: "song.flac", format: "FLAC", title: "Native song", artist: "Native artist", album: "Native album", duration_seconds: 125, state: "ready" }];
      window.__available = true;
      window.__revoked = false;
      window.__TAURI__ = { core: { convertFileSrc: () => window.__badArt ? "data:image/png;base64,invalid" : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMwSpn2HwAEJAIsVIWyawAAAABJRU5ErkJggg==", invoke: async (command, args) => {
        if (command === "plugin:app|version") return "0.1.0";
        if (command === "list_folders") return window.__revoked ? [] : ["a", "b"].map((id) => ({ id, category: "music", path: "C:\\Fixture", state: window.__available ? "available" : "unavailable" }));
        if (command === "discover_music") {
          if (!args.id || args.path) throw new Error("Expected authorized ID only");
          return { state: window.__available ? "complete" : "unavailable", tracks: window.__tracks, warnings: [] };
        }
        if (command === "revoke_folder") { window.__revoked = true; return; }
        throw new Error("Unexpected command " + command);
      } } };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = "http://127.0.0.1:" + runtime.web.address().port + "/?voiceTransport=local#perfil";
    await page.goto(url);
    await page.waitForFunction(() => window.DesktopMusicLibrary?.tracks().length === 1 && document.querySelector('[aria-controls="spaceAmpLibrary"]'));
    await page.evaluate(() => {
      document.querySelector(".desktop-poc").close();
      document.querySelector('[aria-controls="spaceAmpLibrary"]').click();
    });
    const library = page.locator("#spaceAmpLibrary");
    await library.getByRole("button", { name: "＋ Nova playlist" }).click();
    await page.locator(".spaceamp-playlist-name-dialog").getByLabel("Nome da playlist").fill("User playlist");
    await page.locator(".spaceamp-playlist-name-dialog").getByLabel("Nome da playlist").press("Enter");
    await library.getByRole("button", { name: "♫ Músicas locais", exact: true }).click();
    await page.evaluate(() => {
      CollectionActions.quickAdd({ kind: "music", title: "User music", artist: "User artist", playbackSource: { type: "local", fileRef: "user-blob" } });
      window.__before = localStorage.getItem("myspace-extras-v1");
      window.__queue = JSON.stringify(SPACEAMP.getState().queue);
    });
    const rows = library.locator("[data-local-music-id]");
    assert.equal(await rows.count(), 1);
    await rows.locator("img").evaluate((image) => image.decode());
    assert.equal(await rows.locator("img").evaluate((image) => image.naturalWidth), 1);
    assert.match(await page.evaluate(() => DesktopMusicLibrary.queueTrack(DesktopMusicLibrary.tracks()[0]).album), /^data:image\/png/);
    assert.match(await rows.innerText(), /Native song[\s\S]*Native artist · Native album[\s\S]*Local · FLAC · Disponível[\s\S]*2:05/);
    assert.equal(await rows.getByRole("button", { name: "Reproduzir Native song" }).count(), 1);
    async function discover(change) {
      await library.getByRole("button", { name: "Fechar biblioteca musical" }).click();
      await page.evaluate(change);
      await page.keyboard.press("Control+Shift+D");
      await page.locator(".desktop-poc").getByRole("button", { name: "Descobrir / atualizar músicas", exact: true }).first().click();
      await page.evaluate(() => { document.querySelector(".desktop-poc").close(); document.querySelector('[aria-controls="spaceAmpLibrary"]').click(); });
    }
    await discover(() => { window.__tracks[0].title = "Updated song"; });
    assert.match(await rows.innerText(), /Updated song/);
    await discover(() => { window.__badArt = true; });
    await page.waitForFunction(() => !!document.querySelector("[data-local-music-id] .is-empty"));
    assert.equal(await rows.locator("img").count(), 0);
    assert.match(await rows.innerText(), /♫/);
    // Both overlapping grants must be refreshed before the missing state wins.
    await discover(() => { window.__tracks = []; });
    await library.getByRole("button", { name: "Fechar biblioteca musical" }).click();
    await page.keyboard.press("Control+Shift+D");
    await page.locator(".desktop-poc").getByRole("button", { name: "Descobrir / atualizar músicas", exact: true }).nth(1).click();
    await page.evaluate(() => { document.querySelector(".desktop-poc").close(); document.querySelector('[aria-controls="spaceAmpLibrary"]').click(); });
    assert.match(await rows.innerText(), /Arquivo ausente/);
    const saved = await page.evaluate(() => ({ before: JSON.parse(window.__before), after: JSON.parse(localStorage.getItem("myspace-extras-v1")) }));
    assert.deepEqual(saved.after.items, saved.before.items);
    assert.deepEqual(saved.after.playlists, saved.before.playlists);
    assert.equal(await page.evaluate(() => JSON.stringify(SPACEAMP.getState().queue) === window.__queue), true);
    assert.deepEqual(errors, []);
    await context.close();
    context = await runtime.browser.newContext();
    await context.route("https://**/*", (route) => route.abort());
    const web = await context.newPage();
    await web.goto(url);
    await web.waitForFunction(() => document.querySelector('[aria-controls="spaceAmpLibrary"]'));
    await web.evaluate(() => document.querySelector('[aria-controls="spaceAmpLibrary"]').click());
    assert.equal(await web.getByRole("button", { name: "♫ Músicas locais", exact: true }).count(), 0);
    assert.equal(await web.evaluate(() => !!window.DesktopMusicLibrary), false);
    console.log("Desktop music → existing SPACEAMP library: metadata, overlap dedupe, refresh, missing, storage/queue preserved; web passed");
  } finally {
    await context?.close();
    await runtime.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
