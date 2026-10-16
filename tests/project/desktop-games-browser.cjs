const assert = require("node:assert/strict");
const { startRuntime } = require("../spaceamp/spaceamp-browser/runtime.cjs");
(async () => {
  const runtime = await startRuntime();
  let context;
  let page;
  try {
    context = await runtime.browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route("https://**/*", (route) => route.abort());
    await context.addInitScript(() => {
      window.__nativeRows = [
        { appid: "42", name: "Native duplicate", state: "present" },
        { appid: "43", name: "Native only", state: "present" },
      ];
      window.__available = true;
      window.__revoked = false;
      window.__launches = [];
      window.__launchFailure = "";
      window.__TAURI__ = { core: { invoke: async (command, args) => {
        if (command === "plugin:app|version") return "0.1.0";
        if (command === "list_folders") return window.__revoked ? [] : [{ id: "grant", category: "games", path: "C:\\SteamLibrary", state: window.__available ? "available" : "unavailable" }];
        if (command === "revoke_folder") { window.__revoked = true; return; }
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
