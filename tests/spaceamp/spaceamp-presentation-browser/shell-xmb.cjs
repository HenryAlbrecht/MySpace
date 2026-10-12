"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, np, toggle, mode }) {
  await mode(0, "auto");
  await toggle.click();
  await mode(1, "visible");
  await page.keyboard.press("Escape");
  // XMB remains mounted with selection/scroll/fullscreen state untouched.
  await page.evaluate(() => {
    location.hash = "colecao";
  });
  await page
    .getByRole("button", {
      name: "[ modo XMB ]",
      exact: true,
    })
    .click();
  await page.evaluate(() => {
    CollectionActions.saveMusic({
      title: "XMB fixture song",
      artist: "Fixture Artist",
      playbackSource: {
        type: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    SPACEAMP.configure({
      select: (value) => {
        __calls.push(["select", value.title]);
        SPACEAMP.update(
          {
            title: value.title,
            artist: value.artist,
            source: "YouTube",
            sourceUrl: value.url,
            artwork: "profile-art.png",
          },
          true,
          {
            available: true,
          },
        );
      },
    });
  });
  await page.locator('.xmb-category[data-category="music"]').click();
  await page.locator('[data-folder="music"]').dblclick();
  await page.locator('.xmb-item[aria-pressed="true"]').focus();
  await page.evaluate(() => {
    window.__xmbOpeningItem = document.activeElement;
  });
  const xmb = await page.evaluate(() => {
    const root = document.querySelector(".xmb");
    const list = root.querySelector(".xmb-items");
    const nav = root.querySelector(".xmb-categories");
    const detail = root.querySelector(".xmb-detail");
    window.__xmbMounted = {
      root,
      list,
      nav,
      detail,
      item: document.activeElement,
    };
    return {
      listScroll: list.scrollTop,
      navScroll: nav.scrollLeft,
      detailScroll: detail.scrollTop,
      category: nav.querySelector('[aria-pressed="true"]').dataset.category,
      itemId: document.activeElement.dataset.itemId,
    };
  });
  async function assertXmbContinuity() {
    const current = await page.evaluate(() => {
      const { root, list, nav, detail, item } = __xmbMounted;
      return {
        mounted:
          root === document.querySelector(".xmb") &&
          list === root.querySelector(".xmb-items") &&
          nav === root.querySelector(".xmb-categories") &&
          detail === root.querySelector(".xmb-detail") &&
          item === list.querySelector('[aria-pressed="true"]'),
        listScroll: list.scrollTop,
        navScroll: nav.scrollLeft,
        detailScroll: detail.scrollTop,
        category: nav.querySelector('[aria-pressed="true"]').dataset.category,
        itemId: item.dataset.itemId,
      };
    });
    assert.deepEqual(
      current,
      {
        mounted: true,
        ...xmb,
      },
      "XMB nodes, selection, category and scroll survive; clock/Now Playing label may update",
    );
  }
  await page.keyboard.press("Enter");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  assert.equal(await np.getAttribute("data-ui-mode"), "visible");
  assert.equal(await np.getAttribute("data-visualizer-mode"), "auto");
  await page.keyboard.press("Backspace");
  assert.equal(await page.evaluate(() => document.body.classList.contains("xmb-active")), true);
  await assertXmbContinuity();
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
  assert.equal(
    await page.evaluate(() => document.activeElement === __xmbOpeningItem),
    true,
    "Backspace restores the exact XMB control that opened Now Playing",
  );
  await page.locator(".xmb-now-playing").focus();
  await page.evaluate(() => {
    window.__xmbOpeningEntry = document.activeElement;
  });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement === __xmbOpeningEntry),
    true,
    "Escape restores the Now Playing entry when it was the opener",
  );
  await assertXmbContinuity();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
};
