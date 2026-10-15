"use strict";
const assert = require("node:assert/strict");

module.exports = async function ({ page, action }) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const saved = await page.evaluate(() => {
    const item = CollectionActions.quickAdd({ kind: "game", title: "Vita persistence", status: "planned" });
    CollectionActions.setVitaShortcuts([item.id]);
    const order = CollectionActions.getItems().find((row) => row.id === item.id).xmbVitaOrder;
    CollectionActions.setVitaShortcuts([]);
    const removed = CollectionActions.getItems().find((row) => row.id === item.id).xmbVitaOrder;
    return { order, removed };
  });
  assert.equal(saved.order, 0);
  assert.equal(saved.removed, undefined);
  await page.evaluate(() => {
    const image = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="462" height="248"><rect width="462" height="248" fill="steelblue"/></svg>');
    __rows.push(...Array.from({ length: 13 }, (_, i) => ({
      id: "vita-" + i, kind: "game", title: "Vita game " + i,
      status: "planned", image, xmbVitaOrder: i,
    })));
    window.__vitaSaves = [];
    window.CollectionActions = {
      getItems: () => __rows,
      setVitaShortcuts(ids) {
        __vitaSaves.push([...ids]);
        for (const item of __rows) {
          delete item.xmbVitaOrder;
          if (ids.includes(item.id)) item.xmbVitaOrder = ids.indexOf(item.id);
        }
        return true;
      },
      updateItem(id, patch) { Object.assign(__rows.find((item) => item.id === id), patch); return true; },
    };
    __xmb.enter();
  });
  const before = await page.locator(".xmb").last().evaluate((node) => ({
    area: node.dataset.area,
    selected: node.querySelector('.xmb-item[aria-pressed="true"]')?.textContent,
    scroll: node.querySelector(".xmb-items").scrollTop,
  }));
  await page.keyboard.press("v");
  const tray = page.locator(".xmb-vita").last();
  await tray.waitFor({ state: "visible" });
  assert.equal(await tray.locator(".xmb-vita-bubble").count(), 10);
  const geometry = await tray.locator(".xmb-vita-bubble").first().boundingBox();
  assert.ok(geometry.width > 100 && geometry.width < 300);
  assert.equal(await tray.locator(".xmb-vita-bubble").first().evaluate((node) => getComputedStyle(node).borderRadius), "50%");
  if (process.env.MYSPACE_VITA_CAPTURE)
    await page.screenshot({ path: process.env.MYSPACE_VITA_CAPTURE });
  await action("down");
  await action("down");
  await action("down");
  assert.equal(await tray.locator('.xmb-vita-bubble[aria-pressed="true"]').getAttribute("data-slot"), "10");
  assert.equal(await tray.locator(".xmb-vita-bubble").count(), 3);
  await action("select");
  await action("select");
  await tray.locator('input[type="file"]').waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(await tray.getAttribute("data-mode"), "edit");
  await action("primary");
  await action("right");
  await action("back");
  assert.equal(await page.evaluate(() => __vitaSaves.length), 0, "cancel moving must not persist");
  await action("primary");
  await action("right");
  await action("primary");
  assert.equal(await page.evaluate(() => __vitaSaves[0][11]), "vita-10");
  await action("back");
  await action("primary");
  await tray.locator(".xmb-vita-plate").waitFor({ state: "visible" });
  if (process.env.MYSPACE_VITA_LIVE_CAPTURE)
    await page.screenshot({ path: process.env.MYSPACE_VITA_LIVE_CAPTURE });
  assert.equal(await page.evaluate(() => __pages.length), 0, "LiveArea does not launch on entry");
  await action("back");
  await action("back");
  await tray.waitFor({ state: "hidden" });
  const after = await page.locator(".xmb").last().evaluate((node) => ({
    area: node.dataset.area,
    selected: node.querySelector('.xmb-item[aria-pressed="true"]')?.textContent,
    scroll: node.querySelector(".xmb-items").scrollTop,
  }));
  assert.deepEqual(after, before, "closing the tray preserves XMB state");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await action("vita");
  await action("primary");
  await action("back");
  assert.equal(await tray.getAttribute("data-mode"), "browse");
  assert.equal(await tray.locator(".xmb-vita-live").isVisible(), false);
  await action("vita");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await action("vita");
  await action("primary");
  await tray.locator(".xmb-vita-plate").waitFor({ state: "visible" });
  await action("primary");
  await page.waitForFunction(() => __pages.includes("vita-10"));
  assert.equal(await page.evaluate(() => __pages.filter((id) => id === "vita-10").length), 1);
};
