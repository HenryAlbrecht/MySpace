"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("C:/Users/Halourt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
(async () => {
  assert.ok(["success", "unavailable"].includes(process.env.MYSPACE_STEAM_TEST_RESULT), "use the isolated runner with game-launch-test feature");
  let browser;
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:" + process.env.MYSPACE_SMOKE_PORT);
        break;
      } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    assert.ok(browser);
    const context = browser.contexts()[0];
    await context.route("https://**/*", (route) => route.abort());
    const page = context.pages().find((page) => page.url().includes("tauri.localhost"));
    await page.waitForFunction(() => window.DesktopGameLibrary?.merge([]).length === 1);
    const before = await page.evaluate(() => localStorage.getItem("myspace-extras-v1"));
    await page.evaluate(() => {
      const launch = DesktopGameLibrary.launch;
      window.__launchResults = [];
      window.__launchErrors = [];
      DesktopGameLibrary.launch = async (item) => {
        try {
          const result = await launch(item);
          __launchResults.push(result);
          return result;
        } catch (error) {
          __launchErrors.push(String(error));
          throw error;
        }
      };
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
    const gameRow = root.getByRole("button", { name: "Fixture Steam", exact: true });
    await gameRow.locator("img").evaluate((image) => image.decode());
    assert.equal(await gameRow.locator("img").evaluate((image) => image.naturalWidth), 1);
    const artUrl = await gameRow.locator("img").getAttribute("src");
    await page.waitForFunction(() => [...document.querySelectorAll(".xmb-backdrop-wallpaper")].some((image) => image.getAttribute("src")?.endsWith("-background") && image.naturalWidth > 0));
    const backgroundUrl = await page.evaluate(() => DesktopGameLibrary.merge([])[0].desktopLocal.background);
    await page.evaluate(async () => {
      const folders = await __TAURI__.core.invoke("list_folders");
      await __TAURI__.core.invoke("revoke_folder", { id: folders.find((folder) => folder.category === "steam-artwork").id });
      DesktopGameLibrary.artworkGrants([]);
    });
    assert.equal(await page.evaluate(async (url) => (await fetch(url)).status, artUrl), 404);
    assert.equal(await page.evaluate(async (url) => (await fetch(url)).status, backgroundUrl), 404);
    await page.waitForFunction(() => !document.querySelector('[data-item-id="desktop:steam:42"] > img'));
    console.log("Steam cache outside games: separately authorized artwork decoded; cached URL denied after revocation, placeholder restored");
    await gameRow.dblclick();
    const launch = root.locator(".xmb-launch");
    await launch.click();
    await page.waitForFunction(() => __launchResults.length || __launchErrors.length);
    if (process.env.MYSPACE_STEAM_TEST_RESULT === "success") {
      assert.deepEqual(await page.evaluate(() => __launchErrors), []);
      assert.deepEqual(await page.evaluate(() => __launchResults[0]), { state: "delegated", simulated: true });
      console.log("XMB → Tauri → authorized manifest/install guards → simulated OS delegation passed; no game executed");
    } else {
      await page.waitForFunction(() => __launchErrors.some((text) => text.includes("Steam indisponível")));
      console.log("Native simulated Steam unavailable surfaced through the XMB");
    }
    const install = path.join(process.env.MYSPACE_PLAYBACK_FIXTURE, "games", "steamapps", "common", "Game");
    await fs.rename(install, install + ".missing");
    try {
      await launch.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => __launchErrors.some((text) => text.includes("Jogo removido")));
    } finally { await fs.rename(install + ".missing", install); }
    const errorCount = await page.evaluate(() => __launchErrors.length);
    await page.evaluate(async () => {
      const folders = await __TAURI__.core.invoke("list_folders");
      await __TAURI__.core.invoke("revoke_folder", { id: folders[0].id });
      window.dispatchEvent(new CustomEvent("xmb:action", { detail: "primary" }));
    });
    await page.waitForFunction((count) => __launchErrors.length > count, errorCount);
    const denied = await page.evaluate(async () => {
      for (const args of [{ appid: "steam://rungameid/42" }, { appid: "42 --args" }, { url: "steam://rungameid/42" }, { executable: "game.exe" }]) {
        try { await __TAURI__.core.invoke("launch_steam", args); return false; }
        catch {}
      }
      return true;
    });
    assert.equal(denied, true);
    assert.equal(await root.getAttribute("data-level"), "details");
    assert.equal(await page.evaluate(() => localStorage.getItem("myspace-extras-v1")), before);
    console.log("Native missing/revoked/invalid inputs rejected; XMB navigation and personal data preserved");
  } finally {
    if (browser) await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
