"use strict";
const assert = require("node:assert/strict");

module.exports = async function ({ page, action }) {
  async function pressPad(index, name) {
    const before = await page.evaluate(() => __sampled.length);
    await page.evaluate((index) => {
      window.__pad = {
        index: 0,
        mapping: "standard",
        axes: [0, 0],
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === index, value: i === index ? 1 : 0 })),
      };
    }, index);
    await page.waitForFunction(({ before, name }) => __sampled.slice(before).includes(name), { before, name });
    await page.evaluate(async () => {
      __pad.buttons.forEach((button) => { button.pressed = false; button.value = 0; });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  }
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
  await pressPad(3, "tertiary");
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
  assert.equal(await tray.locator(".xmb-vita-wallpaper").count(), 1);
  assert.equal(await tray.locator(".xmb-vita-sheet img").count(), 1, "sheet contains only the cover");
  assert.equal(await tray.locator(".xmb-vita-fold .xmb-vita-peel-tip").count(), 1);
  const sheet = await tray.locator(".xmb-vita-sheet").boundingBox();
  const tipBefore = await tray.locator(".xmb-vita-peel-tip").boundingBox();
  await page.mouse.move(sheet.x + sheet.width - 30, sheet.y + 30);
  await page.mouse.down();
  await page.mouse.move(sheet.x + sheet.width - 150, sheet.y + 150);
  const tipDuring = await tray.locator(".xmb-vita-peel-tip").boundingBox();
  assert.ok(tipDuring.width > tipBefore.width + 200, "folded face grows with the gesture");
  assert.ok(Math.abs(tipDuring.width - tipDuring.height) < 1, "fold face stays square on widescreen displays");
  assert.equal(await page.evaluate(() => String(getSelection())), "");
  if (process.env.MYSPACE_VITA_PEEL_CAPTURE)
    await page.screenshot({ path: process.env.MYSPACE_VITA_PEEL_CAPTURE });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => __pages.length), 0, "short peel cancels without launching");
  const header = await tray.locator(".xmb-vita-controls").evaluate((node) => ({
    top: node.getBoundingClientRect().top,
    background: getComputedStyle(node).backgroundColor,
    clock: !!node.querySelector(".xmb-clock"),
    back: node.querySelector("button").textContent,
  }));
  assert.equal(header.top, 0);
  assert.equal(header.background, "rgb(64, 64, 64)");
  assert.equal(header.clock, true);
  assert.match(header.back, /Voltar aos atalhos/);
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const rest = await tray.locator(".xmb-vita-live").getAttribute("data-peel-depth");
  await action("primary");
  await page.waitForFunction((rest) => {
    const live = document.querySelector('.xmb-vita:not([hidden]) .xmb-vita-live');
    return Number(live?.dataset.peelDepth) > Number(rest) + 80;
  }, rest);
  assert.equal(await page.evaluate(() => __pages.length), 0, "launch waits for the fold to finish");
  await page.waitForFunction(() => __pages.includes("vita-10"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.evaluate(() => __pages.filter((id) => id === "vita-10").length), 1);
  await page.evaluate(() => {
    __rows.push({ id: "vita-new", title: "Adicionar com controle", kind: "game", status: "planned", platform: "PS2", image: __rows.find((item) => item.id === "vita-0").image });
    __xmb.enter();
  });
  await pressPad(3, "tertiary");
  await pressPad(8, "select");
  await tray.locator('[aria-label="Adicionar atalho"]').click();
  const picker = tray.locator(".xmb-vita-picker");
  await picker.locator("select").focus();
  await pressPad(13, "down");
  const selected = picker.locator('.xmb-vita-choice[aria-pressed="true"]');
  assert.match(await selected.textContent(), /Adicionar com controle/);
  await pressPad(0, "primary");
  assert.equal(await page.evaluate(() => __vitaSaves.at(-1).at(-1)), "vita-new");
  await pressPad(3, "tertiary");
  await tray.waitFor({ state: "hidden" });
};
