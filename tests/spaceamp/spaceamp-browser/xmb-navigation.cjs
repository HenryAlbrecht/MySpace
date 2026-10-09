"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function ({ page, action, testArtifacts }) {
  await page.evaluate(() => {
    const artwork =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 90"><rect width="60" height="90" fill="#42656a"/><path d="M8 8h44v74H8z" fill="none" stroke="#d6dddd" stroke-width="2"/></svg>',
      );
    for (const item of __rows) {
      if (item.kind === "music") item.image = artwork;
    }
    const firstGame = __rows.findIndex((item) => item.kind === "game");
    __rows.splice(
      firstGame,
      1,
      ...["Persona 3 Reload", "Sol Trigger", "Burnout 3"].map((title, index) => ({
        id: "short-game-" + index,
        kind: "game",
        title,
        image: artwork,
      })),
    );
  });
  await page.evaluate(() => {
    __xmb.enter();
    document.querySelector(".xmb").id = "xmb-fixture";
  });
  const root = page.locator("#xmb-fixture");
  async function waitForFolderTransition() {
    await page.waitForFunction(
      () => document.querySelector("#xmb-fixture")?.dataset.folderTransition !== "true",
    );
  }
  async function capture(name) {
    await waitForFolderTransition();
    await Promise.all([
      ...[".xmb-detail", ".xmb-upper-preview"].map(selector =>
        root.locator(selector).evaluate(node =>
          Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))),
        ),
      ),
      root.locator(".xmb-category").evaluateAll(nodes =>
        Promise.all(
          nodes.flatMap(node =>
            node.getAnimations().map(animation => animation.finished.catch(() => {})),
          ),
        ),
      ),
    ]);
    const requestedCapture = {
      "xmb-1280-music-root.png": process.env.MYSPACE_XMB_DEPTH_ROOT_CAPTURE,
      "xmb-1280-music-tracks.png": process.env.MYSPACE_XMB_DEPTH_FOLDER_CAPTURE,
      "xmb-1280-music-depth-long.png": process.env.MYSPACE_XMB_DEPTH_LONG_CAPTURE,
      "xmb-1280-music-depth-return.png": process.env.MYSPACE_XMB_DEPTH_RETURN_CAPTURE,
      "xmb-long-music-context.png": process.env.MYSPACE_XMB_PREVIEW_CAPTURE,
      "xmb-long-music-no-context.png": process.env.MYSPACE_XMB_PREVIEW_HIDDEN_CAPTURE,
    }[name];
    const capturePath =
      requestedCapture || path.join(testArtifacts, name);
    fs.mkdirSync(path.dirname(capturePath), { recursive: true });
    await page.screenshot({ path: capturePath });
  }
  async function navigationLayout() {
    return page.evaluate(() => {
      const root = document.querySelector("#xmb-fixture");
      const nav = root.querySelector(".xmb-categories").getBoundingClientRect();
      const list = root.querySelector(".xmb-items").getBoundingClientRect();
      const selected = root.querySelector('.xmb-item[aria-pressed="true"]').getBoundingClientRect();
      return {
        categoryY: nav.y,
        categoryHeight: nav.height,
        listY: list.y,
        selectionY: selected.y,
        selectionHeight: selected.height,
      };
    });
  }
  assert.deepEqual(await root.locator(".xmb-category").allTextContents(),
    ["Perfil", "Jogos", "Música", "Vídeo", "Leitura", "Fotos", "Outros"]);
  assert.equal(await root.getAttribute("data-kind"), "music", "Collection filter opens its folder");
  fs.mkdirSync(testArtifacts, { recursive: true });
  for (const width of [1280, 1920, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 900 : width === 1280 ? 720 : 1080 });
    await page.keyboard.press("Escape");
    await waitForFolderTransition();
    assert.equal(await root.getAttribute("data-level"), "folders");
    const folderRows = root.locator("[data-folder]");
    const folderNames = ["Músicas", "Álbuns", "Artistas"];
    assert.deepEqual(await folderRows.locator(".xmb-item-title").allTextContents(), folderNames);
    assert.deepEqual(
      await folderRows.evaluateAll(rows => rows.map(row => row.getAttribute("aria-label"))),
      folderNames,
    );
    assert.deepEqual(await folderRows.locator(".xmb-folder-icon").allTextContents(), ["▱", "▱", "▱"]);
    await capture(`xmb-${width}-music-root.png`);
    const rootListHeight = await root.locator(".xmb-items").evaluate(node => node.clientHeight);
    const rootListTop = await root.locator(".xmb-items").evaluate(node => node.getBoundingClientRect().top);
    await page.waitForFunction(() => {
      const root = document.querySelector("#xmb-fixture");
      const category = root?.querySelector('.xmb-category[aria-pressed="true"]');
      const list = root?.querySelector(".xmb-items");
      if (!root || !category || !list) return false;
      const anchor = Number.parseFloat(getComputedStyle(list).getPropertyValue("--xmb-list-anchor"));
      const categoryCenter = category.getBoundingClientRect().left + category.getBoundingClientRect().width / 2;
      return Number.isFinite(anchor) && Math.abs(root.getBoundingClientRect().left + anchor - categoryCenter) < 2;
    });
    const rootCategoryCenter = await root
      .locator('.xmb-category[aria-pressed="true"]')
      .evaluate(node => {
        const bounds = node.getBoundingClientRect();
        return bounds.left + bounds.width / 2;
      });
    assert.equal(await root.getAttribute("data-folder-depth"), "false");
    assert.equal(await root.locator(".xmb-categories").evaluate(node => node.inert), false);
    await action("primary");
    await waitForFolderTransition();
    assert.equal(await root.getAttribute("data-kind"), "music");
    await root.locator(".xmb-item").first().click();
    await page.waitForTimeout(240);
    await capture(`xmb-${width}-music-tracks.png`);
    const folderListHeight = await root.locator(".xmb-items").evaluate(node => node.clientHeight);
    const folderListTop = await root.locator(".xmb-items").evaluate(node => node.getBoundingClientRect().top);
    assert.equal(await root.getAttribute("data-folder-depth"), "true", "opening a folder enters depth");
    assert.ok(folderListHeight > rootListHeight + 16, "folder list gains the compact category row height");
    assert.ok(folderListTop < rootListTop - 24, "folder list moves into the space released above it");
    assert.equal(await root.locator(".xmb-categories").evaluate(node => node.inert), true);
    assert.equal(await root.getAttribute("data-upper-preview"), "false", "main navigation preview hides in folder depth");
    const firstEdge = await root.evaluate(node => {
      const list = node.querySelector(".xmb-items");
      const selected = list.querySelector('.xmb-item[aria-pressed="true"]');
      const image = selected.querySelector("img").getBoundingClientRect();
      const bounds = list.getBoundingClientRect();
      return {
        index: Number(selected.dataset.index),
        imageTop: image.top,
        imageBottom: image.bottom,
        listTop: bounds.top,
        listBottom: bounds.bottom,
        mask: getComputedStyle(list).maskImage,
      };
    });
    assert.equal(firstEdge.index, 0, "focused first music item is selected");
    assert.notEqual(firstEdge.mask, "none", "the far edge keeps its soft fade while the selected edge stays clear");
    assert.ok(firstEdge.imageTop >= firstEdge.listTop, "first artwork frame is fully inside the list");
    assert.ok(firstEdge.imageBottom <= firstEdge.listBottom, "first artwork frame is not clipped at the top");
    const folderPresentation = await root.evaluate(node => {
      const selected = node.querySelector('.xmb-item[aria-pressed="true"]');
      const categories = [...node.querySelectorAll(".xmb-category")];
      return {
        focusRestored: document.activeElement === selected,
        backArrow: getComputedStyle(selected, "::after").opacity,
        categoryOpacities: categories.map(button => getComputedStyle(button).opacity),
        categoryWidths: categories.map(button => getComputedStyle(button).width),
      };
    });
    assert.equal(folderPresentation.focusRestored, true);
    assert.ok(Number(folderPresentation.backArrow) > 0, "selected row shows a decorative back arrow");
    assert.ok(folderPresentation.categoryOpacities.every(opacity => Number(opacity) === 0));
    assert.ok(folderPresentation.categoryWidths.every(width => width === "0px"));
    if (width === 1280) {
      await root.locator(".xmb-item").last().click();
      await page.waitForTimeout(240);
      const lastEdge = await root.evaluate(node => {
        const list = node.querySelector(".xmb-items");
        const selected = list.querySelector('.xmb-item[aria-pressed="true"]');
        const image = selected.querySelector("img").getBoundingClientRect();
        const bounds = list.getBoundingClientRect();
        return {
          index: Number(selected.dataset.index),
          count: list.querySelectorAll(".xmb-item").length,
          imageTop: image.top,
          imageBottom: image.bottom,
          listTop: bounds.top,
          listBottom: bounds.bottom,
          mask: getComputedStyle(list).maskImage,
        };
      });
      assert.equal(lastEdge.index, lastEdge.count - 1, "focused last music item is selected");
      assert.notEqual(lastEdge.mask, "none", "the far edge keeps its soft fade while the selected edge stays clear");
      assert.ok(lastEdge.imageTop >= lastEdge.listTop, "last artwork frame is not clipped at the bottom");
      assert.ok(lastEdge.imageBottom <= lastEdge.listBottom, "last artwork frame is fully inside the list");
      await root.locator(".xmb-item").first().click();
      await page.waitForTimeout(240);
      for (let index = 0; index < 8; index += 1) await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(240);
      const visibleNeighbors = await root.evaluate(node => {
        const list = node.querySelector(".xmb-items");
        const bounds = list.getBoundingClientRect();
        const selected = list.querySelector('.xmb-item[aria-pressed="true"]');
        const rows = [...list.querySelectorAll(".xmb-item")];
        const index = Number(selected.dataset.index);
        const visible = row => {
          const rect = row.getBoundingClientRect();
          return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
        };
        return {
          index,
          previous: visible(rows[index - 1]),
          next: visible(rows[index + 1]),
          focusRatio:
            (selected.getBoundingClientRect().top + selected.getBoundingClientRect().height / 2 - bounds.top) /
            bounds.height,
          artworkScaleRatio:
            selected.querySelector("img").getBoundingClientRect().width /
            rows[index - 1].querySelector("img").getBoundingClientRect().width,
        };
      });
      assert.ok(visibleNeighbors.index > 0, "long music list selection has a previous item");
      assert.equal(visibleNeighbors.previous, true, "previous music item stays visible above selection");
      assert.equal(visibleNeighbors.next, true, "next music item stays visible below selection");
      assert.notEqual(
        await root.locator(".xmb-items").evaluate(node => getComputedStyle(node).maskImage),
        "none",
        "interior rows retain the soft edge fades",
      );
      assert.ok(visibleNeighbors.focusRatio > 0.34 && visibleNeighbors.focusRatio < 0.58, "folder selection stays near the vertical focus axis");
      assert.ok(visibleNeighbors.artworkScaleRatio > 1.3, "selected artwork stands out from neighboring covers");
      await capture("xmb-1280-music-depth-long.png");
    }
    const row = root.locator('.xmb-item[aria-pressed="true"]');
    await page.keyboard.press("D");
    assert.equal(await root.getAttribute("data-level"), "details");
    await page.keyboard.press("Escape");
    assert.equal(await row.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Escape");
    await waitForFolderTransition();
    assert.equal(await root.getAttribute("data-folder-depth"), "false", "back exits folder depth");
    assert.equal(await root.locator(".xmb-categories").evaluate(node => node.inert), false);
    assert.equal(await root.locator('[data-folder="music"]').evaluate(node => node === document.activeElement), true);
    if (width === 1280) {
      await capture("xmb-1280-music-depth-return.png");
      const returnedCategoryCenter = await root
        .locator('.xmb-category[aria-pressed="true"]')
        .evaluate(node => {
          const bounds = node.getBoundingClientRect();
          return bounds.left + bounds.width / 2;
        });
      assert.ok(Math.abs(returnedCategoryCenter - rootCategoryCenter) < 1, "category axis restores immediately on folder back");
    }
    if (width === 1280) {
      await action("primary");
      await page.waitForFunction(
        () => document.querySelector("#xmb-fixture")?.dataset.folderTransition === "true",
      );
      await page.keyboard.press("Escape");
      await waitForFolderTransition();
      assert.equal(await root.getAttribute("data-level"), "folders", "Escape cancels a rapid folder entry");
      assert.equal(await root.locator('[data-folder="music"]').evaluate(node => node === document.activeElement), true);
      await action("primary");
      await waitForFolderTransition();
      await page.keyboard.press("Escape");
      await waitForFolderTransition();
      assert.equal(await root.getAttribute("data-folder-depth"), "false", "folder entry and exit can repeat cleanly");
    }
    await action("down");
    await action("primary");
    await waitForFolderTransition();
    assert.equal(await root.getAttribute("data-kind"), "album");
    assert.equal(await root.locator(".xmb-item").count(), 0, "empty folder is navigable");
    await action("back");
    await waitForFolderTransition();
    assert.equal(await root.locator('[data-folder="album"]').getAttribute("aria-pressed"), "true");
    assert.equal(await root.getAttribute("data-folder-depth"), "false");
    assert.equal(await root.locator('[data-folder="album"]').evaluate(node => node === document.activeElement), true);
    await root.locator('[data-category="game"]').click();
    assert.equal(await root.getAttribute("data-kind"), "game");
    assert.equal(await root.locator("[data-folder]").count(), 0, "single-kind area has no folder level");
    const shortGameTitles = await root.locator(".xmb-item-title").allTextContents();
    for (const title of ["Persona 3 Reload", "Sol Trigger", "Burnout 3"]) {
      assert.ok(shortGameTitles.includes(title), `short game list contains ${title}`);
    }
    assert.equal(shortGameTitles.length, 3);
    await root.locator(".xmb-item").first().click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    assert.equal(await root.getAttribute("data-upper-preview"), "false", "short list has no forced preview");
    await capture(`xmb-${width}-games.png`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await root.locator('[data-category="music"]').click();
    await root.locator('[data-folder="music"]').dblclick();
    await waitForFolderTransition();
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press("Escape");
  await waitForFolderTransition();
  for (const [area, folder] of [["video", "film"], ["reading", "book"]]) {
    await root.locator(`[data-category="${area}"]`).click();
    assert.equal(await root.getAttribute("data-folder-depth"), "false", "horizontal category changes stay at the parent level");
    assert.equal(await root.locator(".xmb-categories").evaluate(node => node.inert), false);
    await action("primary");
    await waitForFolderTransition();
    assert.equal(await root.getAttribute("data-folder-depth"), "true", `${area} folder entry enters depth`);
    assert.equal(await root.locator(".xmb-categories").evaluate(node => node.inert), true);
    await page.keyboard.press("Escape");
    await waitForFolderTransition();
    assert.equal(await root.getAttribute("data-folder-depth"), "false", `${area} back exits depth`);
    assert.equal(await root.locator(`[data-folder="${folder}"]`).evaluate(node => node === document.activeElement), true);
  }
  await root.locator('[data-category="music"]').click();
  await root.locator('[data-folder="music"]').dblclick();
  await waitForFolderTransition();
  await root.locator(".xmb-item").first().click();
  for (let index = 0; index < 10; index += 1) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(240);
  const preview = await page.evaluate(() => {
    const root = document.querySelector("#xmb-fixture");
    const nav = root.querySelector(".xmb-categories");
    const host = root.querySelector(".xmb-upper-preview");
    const image = host.querySelector("img");
    const list = root.querySelector(".xmb-items");
    const selected = list.querySelector('[aria-pressed="true"]');
    const previous = list.children[Number(selected.dataset.index) - 1];
    const rect = (node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    const previousBox = previous.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    const previousVisibleHeight = Math.max(
      0,
      Math.min(listBox.bottom, previousBox.bottom) - Math.max(listBox.top, previousBox.top),
    );
    return {
      state: root.dataset.upperPreview,
      itemId: host.dataset.itemId,
      previousId: previous.dataset.itemId,
      previousVisibleRatio: previousVisibleHeight / previousBox.height,
      selectedId: selected.dataset.itemId,
      focused: document.activeElement === selected,
      inert: host.inert,
      ariaHidden: host.getAttribute("aria-hidden"),
      hasLabel: host.children.length !== 1,
      objectFit: getComputedStyle(image).objectFit,
      imageReady: image.complete && image.naturalWidth > 0,
      imageHidden: image.hidden,
      nav: rect(nav),
      host: rect(host),
      image: rect(image),
      previousArtwork: rect(previous.querySelector("img")),
      list: rect(list),
    };
  });
  assert.equal(preview.state, "true", "long music list shows its clipped previous item");
  assert.equal(preview.itemId, preview.previousId);
  assert.equal(preview.previousVisibleRatio, 0, "previous item leaves the main list before previewing");
  assert.notEqual(preview.selectedId, preview.itemId);
  assert.equal(preview.focused, true, "selection keeps focus in the main list");
  assert.equal(preview.inert, true, "preview is excluded from focus navigation");
  assert.equal(preview.ariaHidden, "true");
  assert.equal(preview.hasLabel, false, "preview has no artificial text label");
  assert.equal(preview.objectFit, "contain", "preview artwork keeps its full aspect ratio");
  assert.equal(preview.imageReady, true);
  assert.equal(preview.imageHidden, false);
  assert.ok(preview.host.y + preview.host.height <= preview.nav.y, "preview sits above the category bar");
  assert.ok(preview.list.y >= preview.nav.y + preview.nav.height, "main list stays below the category bar");
  assert.ok(
    Math.abs(
      preview.image.x + preview.image.width / 2 -
        preview.previousArtwork.x -
        preview.previousArtwork.width / 2,
    ) < 1,
    `preview aligns with the active category axis: ${JSON.stringify({ image: preview.image, previous: preview.previousArtwork })}`,
  );
  assert.ok(preview.image.x >= preview.host.x && preview.image.x + preview.image.width <= preview.host.x + preview.host.width);
  assert.ok(preview.image.y >= preview.host.y && preview.image.y + preview.image.height <= preview.host.y + preview.host.height);
  await capture("xmb-long-music-context.png");
  const layoutWithPreview = await navigationLayout();
  await root.evaluate(node => {
    node.dataset.upperPreview = "false";
  });
  assert.equal(await root.getAttribute("data-upper-preview"), "false");
  await capture("xmb-long-music-no-context.png");
  const layoutWithoutPreview = await navigationLayout();
  assert.deepEqual(layoutWithoutPreview, layoutWithPreview, "hiding preview does not reflow navigation or selection");
  await root.evaluate(node => {
    node.dataset.upperPreview = "true";
  });
  await root.locator(".xmb-upper-preview").evaluate(node =>
    Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))),
  );
  await page.setViewportSize({ width: 390, height: 390 });
  await page.waitForFunction(() => document.querySelector("#xmb-fixture").dataset.upperPreview === "false");
  const compactViewport = await page.evaluate(() => {
    const root = document.querySelector("#xmb-fixture");
    const header = root.querySelector(".xmb-header");
    const nav = root.querySelector(".xmb-categories").getBoundingClientRect();
    return {
      reservedHeight: parseFloat(getComputedStyle(header).minHeight),
      categoryBottom: nav.bottom,
    };
  });
  assert.ok(compactViewport.reservedHeight <= 40, "landscape mobile reserves a compact upper region");
  assert.ok(compactViewport.categoryBottom < 390, "category bar remains visible in a short viewport");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction(() => document.querySelector("#xmb-fixture").dataset.upperPreview === "true");
  const itemCount = await root.locator(".xmb-item").count();
  await root.locator(".xmb-item").first().click();
  assert.equal(await root.getAttribute("data-upper-preview"), "leaving");
  await page.waitForFunction(
    () => document.querySelector("#xmb-fixture").dataset.upperPreview === "false",
  );
  for (let index = 1; index < itemCount; index += 1) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  const duplicate = await page.evaluate(() => {
    const root = document.querySelector("#xmb-fixture");
    const list = root.querySelector(".xmb-items");
    const selected = list.querySelector('[aria-pressed="true"]');
    const previous = list.children[Number(selected.dataset.index) - 1];
    const box = previous.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    const visible = Math.max(0, Math.min(viewport.bottom, box.bottom) - Math.max(viewport.top, box.top));
    return {
      state: root.dataset.upperPreview,
      visibleRatio: visible / box.height,
    };
  });
  assert.ok(duplicate.visibleRatio >= 0.6, "previous row is clearly visible at the list end");
  assert.equal(duplicate.state, "false", "visible previous row is not duplicated above the list");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Escape");
  assert.equal(await root.locator(".xmb-detail").evaluate(node => getComputedStyle(node).animationName), "none");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => __xmb.isActive()), false);
};
