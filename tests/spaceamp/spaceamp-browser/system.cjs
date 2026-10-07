"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, action, qmRow, qmClick }) {
  // System commands use the XMB owner's existing fullscreen and close paths.
  await action("menu");
  await qmRow("play").focus();
  await action("left");
  await action("down");
  await action("primary");
  await page.evaluate(() => {
    window.__full = null;
    window.__fullCalls = [];
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => __full,
    });
    document.documentElement.requestFullscreen = async () => {
      __fullCalls.push("enter");
      __full = document.documentElement;
      document.dispatchEvent(new Event("fullscreenchange"));
    };
    document.exitFullscreen = async () => {
      __fullCalls.push("exit");
      __full = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    };
  });
  await qmClick("fullscreen");
  assert.match(await qmRow("fullscreen").textContent(), /ON/);
  await qmClick("fullscreen");
  assert.match(await qmRow("fullscreen").textContent(), /OFF/);
  assert.equal(await page.evaluate(() => __xmb.isActive()), true);
  assert.deepEqual(await page.evaluate(() => __fullCalls), ["enter", "exit"]);
  await qmClick("fullscreen");
  await page.evaluate(() => document.exitFullscreen());
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), false);
  assert.equal(await page.evaluate(() => __xmb.isActive()), true);
  await action("menu");
  await qmRow("play").focus();
  await action("left");
  await action("down");
  await action("primary");
  await page.evaluate(() => {
    window.__exitOrder = [];
    const menu = document.querySelector("#xmbQuickMenu");
    const original = menu.close.bind(menu);
    menu.close = () => {
      __exitOrder.push("menu");
      original();
    };
    const root = document.querySelector("#xmb-fixture");
    new MutationObserver(() => {
      if (root.hidden) __exitOrder.push("xmb");
    }).observe(root, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  });
  await qmClick("exit-xmb");
  assert.equal(await page.evaluate(() => __xmb.isActive()), false);
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), false);
  assert.deepEqual(await page.evaluate(() => __exitOrder), ["menu", "xmb"]);
};
