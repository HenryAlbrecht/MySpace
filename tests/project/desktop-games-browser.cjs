const assert = require("node:assert/strict");
const { startRuntime } = require("../spaceamp/spaceamp-browser/runtime.cjs");
(async () => {
  const runtime = await startRuntime();
  let context;
  let page;
  try {
    context = await runtime.browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route("https://**/*", (route) => route.abort());
    await context.route("http://myspace-music.localhost/**", async (route) => {
      const allowed = await route.request().frame().evaluate(() => window.__cacheAllowed);
      const found = allowed && route.request().url().includes("steam-art-43-");
      await route.fulfill({ status: found ? 200 : 404, contentType: "image/png", body: found ? Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63304a99f61f000424022c5485b26b0000000049454e44ae426082", "hex") : Buffer.alloc(0) });
    });
    await context.addInitScript(() => {
      window.__nativeRows = [
        { appid: "42", name: "Native duplicate", state: "present" },
        { appid: "43", name: "Native only", state: "present" },
      ];
      window.__available = true;
      window.__cacheAllowed = false;
      window.__revoked = false;
      window.__launches = [];
      window.__launchFailure = "";
      window.__TAURI__ = { core: { convertFileSrc: (path, scheme) => "http://" + scheme + ".localhost/" + path, invoke: async (command, args) => {
        if (command === "plugin:app|version") return "0.1.0";
        if (command === "list_folders") return window.__revoked ? [] : [
          { id: "grant", category: "games", path: "C:\\SteamLibrary", state: window.__available ? "available" : "unavailable" },
          ...(window.__cacheAllowed ? [{ id: "cache", category: "steam-artwork", path: "C:\\SteamCache", state: "available" }] : []),
        ];
        if (command === "authorize_folders" && args.category === "steam-artwork") { window.__cacheAllowed = true; return 1; }
        if (command === "revoke_folder") { if (args.id === "cache") window.__cacheAllowed = false; else window.__revoked = true; return; }
        if (command === "discover_steam") return { source: "Steam", root: "C:\\SteamLibrary", state: window.__available ? "complete" : "invalid-folder", games: window.__nativeRows, errors: [] };
        if (command === "launch_steam") {
          window.__launches.push(args);
          if (window.__launchFailure) throw Error(window.__launchFailure);
          return { state: "delegated", simulated: true };
        }
        throw new Error("Unexpected command: " + command);
      } } };
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + runtime.web.address().port + "/?voiceTransport=local#perfil");
    await page.waitForFunction(() => window.DesktopGameLibrary?.merge([]).length === 2 && window.CollectionActions);
    await page.evaluate(() => {
      CollectionActions.quickAdd({ kind: "game", catalogId: "steam:42", title: "User title", platform: "PC", notes: "Preserve" });
      document.querySelector(".desktop-poc").close();
      document.documentElement.requestFullscreen = () => Promise.reject(new Error("Fixture fullscreen"));
      window.dispatchEvent(new CustomEvent("xmb:action", { detail: "menu" }));
    });
    const root = page.locator(".xmb");
    await root.waitFor({ state: "visible" });
    await root.locator('[data-folder="game-all"]').dblclick();
    await page.waitForFunction(() => document.querySelector(".xmb")?.dataset.folderTransition !== "true");
    await root.locator('[data-folder="game-platform"]').filter({ hasText: "Steam" }).dblclick();
    await page.waitForFunction(() => document.querySelector(".xmb")?.dataset.folderTransition !== "true");
    assert.equal(await root.locator(".xmb-item").count(), 2);
    await root.getByRole("button", { name: "Native only", exact: true }).click();
    const selected = await root.locator('.xmb-item[aria-pressed="true"]').getAttribute("data-item-id");
    assert.equal(selected, "desktop:steam:43");
    assert.equal(await root.getByRole("button", { name: "User title", exact: true }).count(), 1);
    await root.getByRole("button", { name: "Native only", exact: true }).dblclick();
    const launch = root.locator(".xmb-launch");
    await launch.click();
    await page.waitForFunction(() => __launches.length === 1);
    await launch.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => __launches.length === 2);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xmb:action", { detail: "primary" })));
    await page.waitForFunction(() => __launches.length === 3);
    assert.deepEqual(await page.evaluate(() => __launches), [{ appid: "43" }, { appid: "43" }, { appid: "43" }]);
    await page.evaluate(() => {
      __launchFailure = "Steam indisponível";
      window.__messages = [];
      const original = window.toast;
      window.toast = (text) => { __messages.push(text); original(text); };
    });
    await launch.click();
    await page.waitForFunction(() => __messages.includes("Steam indisponível"));
    assert.equal(await launch.isEnabled(), true);
    await page.keyboard.press("Escape");
    assert.equal(await root.locator('.xmb-item[aria-pressed="true"]').getAttribute("data-item-id"), selected);
    async function diagnostic() {
      await page.keyboard.press("Control+Shift+D");
      await page.locator(".desktop-poc[open]").waitFor();
    }
    await page.evaluate(() => {
      __nativeRows = [{ appid: "42", name: "Renamed native", state: "present" }, { appid: "43", name: "Updated native", state: "present" }, { appid: "44", name: "New native", state: "missing" }];
    });
    await diagnostic();
    await page.keyboard.press("ArrowDown");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xmb:action", { detail: "down" })));
    assert.equal(await root.locator('.xmb-item[aria-pressed="true"]').getAttribute("data-item-id"), selected);
    await page.getByRole("button", { name: "Descobrir jogos Steam", exact: true }).click();
    await root.getByRole("button", { name: "Updated native", exact: true }).waitFor({ state: "attached" });
    assert.equal(await root.locator(".xmb-item").count(), 3);
    assert.equal(await root.locator('.xmb-item[aria-pressed="true"]').getAttribute("data-item-id"), selected);
    await page.getByRole("button", { name: "Continuar para o MySpace", exact: true }).click();
    await page.evaluate(() => { __available = false; });
    await diagnostic();
    await page.getByRole("button", { name: "Verificar pastas de jogos", exact: true }).click();
    await page.waitForFunction(() => DesktopGameLibrary.merge([]).every((item) => item.desktopLocal.state === "unavailable"));
    assert.equal(await root.locator(".xmb-item").count(), 3);
    await page.getByRole("button", { name: "Continuar para o MySpace", exact: true }).click();
    await root.getByRole("button", { name: "Updated native", exact: true }).dblclick();
    assert.match(await root.locator(".xmb-detail").textContent(), /Biblioteca indisponível/);
    assert.equal(await root.locator(".xmb-launch").isDisabled(), true);
    await diagnostic();
    await page.getByRole("button", { name: /^Remover referência:/ }).click();
    await page.waitForFunction(() => DesktopGameLibrary.merge([]).length === 0);
    assert.equal(await root.locator(".xmb-item").count(), 1);
    assert.equal(await root.getAttribute("data-level"), "root");
    assert.equal(await page.evaluate(() => CollectionActions.getItems()[0].title), "User title");
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
    assert.deepEqual(errors, []);
    console.log("Desktop Steam → existing XMB: dedupe, selection, refresh, unavailability, revoke, Collection preservation passed");
    // The discovered game can use the same editor without importing on open/close.
    await page.reload();
    await page.waitForFunction(() => window.DesktopGameLibrary?.merge([]).length === 2 && window.CollectionActions);
    await page.evaluate(() => {
      document.querySelector(".desktop-poc").close();
      document.documentElement.requestFullscreen = () => Promise.reject(new Error("Fixture fullscreen"));
      window.dispatchEvent(new CustomEvent("xmb:action", { detail: "menu" }));
    });
    await root.locator('[data-folder="game-all"]').dblclick();
    await root.locator('[data-folder="game-platform"]').filter({ hasText: "Steam" }).dblclick();
    await page.waitForFunction(() => document.querySelector(".xmb")?.dataset.folderTransition !== "true");
    const native = root.getByRole("button", { name: "Native only", exact: true });
    await native.click();
    await page.waitForFunction(() => !document.querySelector('[data-item-id="desktop:steam:43"] > img'));
    await diagnostic();
    await page.getByRole("button", { name: "Adicionar pastas de artes steam", exact: true }).click();
    await page.getByRole("button", { name: "Continuar para o MySpace", exact: true }).click();
    await native.locator("img").evaluate((image) => image.decode());
    await page.waitForFunction(() => [...document.querySelectorAll(".xmb-backdrop-wallpaper")].some((image) => image.getAttribute("src")?.endsWith("-background") && image.naturalWidth > 0));
    await diagnostic();
    await page.getByRole("button", { name: "Remover referência: C:\\SteamCache", exact: true }).click();
    await page.getByRole("button", { name: "Continuar para o MySpace", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-item-id="desktop:steam:43"] > img'));
    await page.waitForFunction(() => document.querySelector(".xmb-backdrop").hidden);
    await diagnostic();
    await page.getByRole("button", { name: "Adicionar pastas de artes steam", exact: true }).click();
    await page.getByRole("button", { name: "Continuar para o MySpace", exact: true }).click();
    await page.keyboard.press("s");
    const editor = page.locator(".xmb-art-options[open]");
    await editor.waitFor();
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
    await page.keyboard.press("Escape");
    await page.locator(".xmb-art-options").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xmb:action", { detail: "select" })));
    await editor.waitFor();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xmb:action", { detail: "back" })));
    await page.locator(".xmb-art-options").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
    // Mouse opens the same editor and chooses a cover through existing MediaStorage.
    await native.click({ button: "right" });
    await editor.waitFor();
    await editor.getByRole("button", { name: "Editar título", exact: true }).click();
    await editor.getByLabel("Título do jogo", { exact: true }).fill("My Steam title");
    await editor.getByLabel("Título do jogo", { exact: true }).press("Enter");
    await editor.getByLabel("Capa — arquivo", { exact: true }).setInputFiles({
      name: "cover.png", mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63304a99f61f000424022c5485b26b0000000049454e44ae426082", "hex"),
    });
    await page.waitForFunction(() => document.querySelector(".xmb-art-options-preview")?.src?.startsWith("blob:") || [...document.querySelectorAll(".xmb-art-options img")].some((image) => image.src.startsWith("blob:")));
    await editor.getByLabel("Wallpaper deste jogo — arquivo", { exact: true }).setInputFiles({
      name: "wallpaper.png", mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63304a99f61f000424022c5485b26b0000000049454e44ae426082", "hex"),
    });
    await page.waitForFunction(() => document.querySelector('input[aria-label="Wallpaper deste jogo — arquivo"]').closest("fieldset").querySelector(".xmb-art-options-media-role-file").disabled === false);
    await page.keyboard.press("Escape");
    await editor.waitFor({ state: "hidden" });
    const saved = await page.evaluate(() => CollectionActions.getItems().find((item) => item.catalogId === "steam:43"));
    assert.ok(saved);
    assert.equal(saved.title, "My Steam title");
    assert.match(saved.xmbArt.image, /^xmb-art:/);
    assert.match(saved.xmbArt.background, /^xmb-art:/);
    assert.equal(saved.desktopLocal, undefined);
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 2);
    assert.equal(await root.locator('.xmb-item[aria-pressed="true"]').getAttribute("data-item-id"), saved.id);
    await root.getByRole("button", { name: "My Steam title", exact: true }).locator("img").evaluate((image) => image.decode());
    await page.evaluate(() => {
      DesktopGameLibrary.complete("grant", DesktopGameLibrary.begin("grant"), { state: "complete", games: [{ appid: "43", name: "Discovery rename", state: "present" }, { appid: "44", name: "Do not import", state: "present" }] });
    });
    assert.equal(await root.getByRole("button", { name: "My Steam title", exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => DesktopGameLibrary.canLaunch(CollectionActions.getItems().find((item) => item.catalogId === "steam:43"))), true);
    await page.waitForFunction(() => [...document.querySelectorAll(".xmb-backdrop-wallpaper")].some((image) => image.dataset.artworkSource?.startsWith("xmb-art:") && image.naturalWidth > 0));
    await page.evaluate(() => DesktopGameLibrary.grants([]));
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 2);
    assert.equal(await page.evaluate(() => DesktopGameLibrary.canLaunch(CollectionActions.getItems().find((item) => item.catalogId === "steam:43"))), false);
    assert.equal(await root.getByRole("button", { name: "My Steam title", exact: true }).count(), 1);
    await page.reload();
    await page.waitForFunction(() => CollectionActions?.getItems().some((item) => item.catalogId === "steam:43"));
    assert.equal(await page.evaluate(() => CollectionActions.getItems().find((item) => item.catalogId === "steam:43").xmbArt.image), saved.xmbArt.image);
    console.log("Steam editor: S, Select/back, mouse, explicit single-item save, local cover, refresh priority, revoke and reload passed");
    await context.close();
    context = await runtime.browser.newContext();
    const webPage = await context.newPage();
    await context.route("https://**/*", (route) => route.abort());
    await webPage.goto("http://127.0.0.1:" + runtime.web.address().port + "/?voiceTransport=local#perfil");
    await webPage.waitForFunction(() => window.CollectionActions);
    assert.equal(await webPage.locator(".desktop-poc").count(), 0);
    assert.equal(await webPage.evaluate(() => !!window.DesktopGameLibrary), false);
    console.log("Web without Tauri: existing boot preserved");
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: "artifacts/desktop-tauri/game-library-failure.png" }).catch(() => {});
    throw error;
  } finally {
    await context?.close();
    await runtime.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
