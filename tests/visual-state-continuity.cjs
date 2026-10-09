const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../server.cjs");
const output = path.resolve("artifacts/visual-state");
fs.mkdirSync(output, { recursive: true });
const web = createServer({
  music: {
    search: async () => ({ items: [] }),
    details: async () => ({}),
    summary: async () => ({}),
    recommendations: async () => ({ items: [] }),
    artistPhoto: async () => ({}),
  },
});
let browser;
(async () => {
  try {
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.route("https://**/*", (route) => route.abort());
    await context.route("**/party/spacevoice.js", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          `
        const originalLocalSignaling = createLocalVoiceSignaling;
        createLocalVoiceSignaling = options => {
          if (window.failSignaling) throw Error('Fixture connection failure');
          return originalLocalSignaling(options);
        };
        const originalSpaceVoice = createSpaceVoice;
        createSpaceVoice = options => {
          const ui = originalSpaceVoice(options);
          const enter = ui.room.enter.bind(ui.room);
          ui.room.enter = id => new Promise(resolve => {
            window.finishRoom = async () => { await enter(id); resolve(); };
          });
          window.fixtureParty = ui;
          return ui;
        };`,
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${web.address().port}/?voiceTransport=local#perfil`);
    await page.waitForSelector(".motion-nav-indicator");
    const party = await page.evaluate(async () => {
      location.hash = "#spacevoice";
      await new Promise((resolve) => addEventListener("hashchange", resolve, { once: true }));
      const root = fixtureParty.root;
      const sample = () => ({
        state: root.dataset.roomPresentation,
        text: root.innerText,
        boxes: [".spacevoice-avatar", ".spacevoice-stage", ".spacevoice-body"].map((selector) => {
          const box = root.querySelector(selector).getBoundingClientRect();
          const origin = root.getBoundingClientRect();
          return {
            x: Math.round(box.x - origin.x),
            y: Math.round(box.y - origin.y),
            width: box.width,
            height: box.height,
          };
        }),
      });
      const pending = sample();
      const frames = [];
      for (let index = 0; index < 8; index++) {
        await new Promise(requestAnimationFrame);
        frames.push(sample());
      }
      await finishRoom();
      await new Promise(requestAnimationFrame);
      return { pending, frames, ready: sample() };
    });
    assert.equal(party.pending.state, "preparing");
    assert.ok(!party.pending.text.includes("fora da sala"));
    assert.ok(
      party.frames.every(
        (frame) => frame.state === "preparing" && !frame.text.includes("fora da sala"),
      ),
    );
    assert.equal(party.ready.state, "ready");
    assert.deepEqual(party.pending.boxes, party.ready.boxes);
    await page.screenshot({ path: path.join(output, "party-ready.png") });
    const failure = await page.evaluate(async () => {
      const root = fixtureParty.root;
      fixtureParty.hide();
      window.failSignaling = true;
      fixtureParty.show();
      await finishRoom();
      for (let index = 0; index < 12; index++) await Promise.resolve();
      const state = root.dataset.roomPresentation;
      const avatar = root.querySelector(".spacevoice-avatar").getBoundingClientRect();
      const retry = [...root.querySelectorAll("button")].find(
        (button) => button.textContent === "[ tentar novamente ]" && !button.hidden,
      );
      const message = root.innerText.includes("Fixture connection failure");
      window.failSignaling = false;
      retry.click();
      await finishRoom();
      for (let index = 0; index < 12; index++) await Promise.resolve();
      const final = root.querySelector(".spacevoice-avatar").getBoundingClientRect();
      return {
        state,
        message,
        ready: root.dataset.roomPresentation,
        stable: avatar.x === final.x && avatar.y === final.y && avatar.width === final.width,
      };
    });
    assert.deepEqual(failure, {
      state: "error",
      message: true,
      ready: "ready",
      stable: true,
    });
    await page.evaluate(() => {
      fixtureParty.hide();
      location.hash = "#perfil";
    });
    await page.waitForTimeout(220);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const initialCover = await page.evaluate(() => {
      document.body.dataset.xmbBackground = "artwork";
      document.body.dataset.xmbGhostArtwork = "true";
      const element = (tag, className = "", text = "") => {
        const node = document.createElement(tag);
        node.className = className;
        node.textContent = text;
        return node;
      };
      const button = (text, action, className) => {
        const node = element("button", className, text);
        node.onclick = action;
        return node;
      };
      const imageNode = (source, alt) => {
        const image = element("img");
        image.alt = alt;
        Artwork.set(image, source);
        return image;
      };
      const verticalCover =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#93b9a9"/><stop offset="1" stop-color="#252d3b"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><circle cx="300" cy="330" r="170" fill="#d7c5a0" opacity=".7"/><path d="M0 690 220 430l110 150 110-125 160 235v210H0Z" fill="#18252d"/><text x="48" y="820" fill="white" font-family="sans-serif" font-size="42">XMB COVER FIXTURE</text></svg>',
        );
      const data = {
        appearance: {
          xmb: { gamePresentation: "vertical", artworkBorder: true, roundedArtwork: false },
        },
        items: [0, 1, 2]
          .map((index) => ({
            id: "fixture-" + index,
            kind: "game",
            title: "Artwork " + index,
            status: "planned",
            image: index === 0 ? verticalCover : "/profile-art.png?asset=" + index,
          }))
          .concat({
            id: "fixture-no-art",
            kind: "game",
            title: "No artwork fixture",
            status: "planned",
          })
          .concat({
            id: "music-fixture",
            kind: "music",
            title: "Different category",
            status: "planned",
            image: "/profile-art.png?asset=music",
          }),
      };
      window.fixtureXmbData = data;
      window.fixtureXmb = createXmb({
        getData: () => data,
        getProfile: () => ({}),
        getFilters: () => ({}),
        openItem() {},
        navigate() {},
        openPhoto() {},
        el: element,
        button,
        imageNode,
      });
      fixtureXmb.enter(document.querySelector(".nav a"));
      const box = document.querySelector(".xmb-detail > img").getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    await page.waitForSelector('.xmb-detail > img[data-artwork-state="ready"]', {
      state: "attached",
    });
    await page.waitForFunction(
      () =>
        document.querySelector('.xmb:not([hidden]) .xmb-item[aria-pressed="true"] > img')?.dataset
          .artworkState === "ready",
    );
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return (
        image &&
        Math.abs(parseFloat(getComputedStyle(image).width) - 128) < 1 &&
        Math.abs(parseFloat(getComputedStyle(image).height) - 176) < 1
      );
    });
    const verticalPresentation = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      const box = row.getBoundingClientRect();
      return {
        mode: root.dataset.gamePresentation,
        rounded: root.dataset.roundedArtwork,
        itemId: row.dataset.itemId,
        rowHeight: box.height,
        rowRect: box.toJSON(),
        objectFit: getComputedStyle(image).objectFit,
        borderRadius: getComputedStyle(image).borderRadius,
        imageWidth: image.getBoundingClientRect().width,
        imageHeight: image.getBoundingClientRect().height,
        imageRect: image.getBoundingClientRect().toJSON(),
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      };
    });
    assert.equal(verticalPresentation.mode, "vertical");
    assert.equal(verticalPresentation.rounded, "false");
    assert.equal(verticalPresentation.objectFit, "contain");
    assert.equal(verticalPresentation.borderRadius, "4px");
    assert.ok(verticalPresentation.imageHeight > verticalPresentation.imageWidth);
    assert.ok(verticalPresentation.naturalWidth > 0 && verticalPresentation.naturalHeight > 0);
    await page.screenshot({ path: path.join(output, "xmb-game-vertical-1920.png") });
    await page.screenshot({ path: path.join(output, "xmb-game-rounded-off-1920.png") });
    await page.evaluate(() => {
      fixtureXmbData.appearance.xmb.roundedArtwork = true;
      fixtureXmb.close();
      fixtureXmb.enter(document.querySelector(".nav a"));
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return root?.dataset.roundedArtwork === "true" && image?.dataset.artworkState === "ready";
    });
    const gameRoundedOn = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      const style = getComputedStyle(image);
      return {
        itemId: row.dataset.itemId,
        rowRect: row.getBoundingClientRect().toJSON(),
        imageRect: image.getBoundingClientRect().toJSON(),
        borderRadius: style.borderRadius,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      };
    });
    assert.equal(gameRoundedOn.itemId, verticalPresentation.itemId);
    assert.deepEqual(gameRoundedOn.rowRect, verticalPresentation.rowRect);
    assert.deepEqual(gameRoundedOn.imageRect, verticalPresentation.imageRect);
    assert.equal(gameRoundedOn.borderRadius, "12px");
    assert.equal(gameRoundedOn.borderWidth, "1px");
    assert.notEqual(gameRoundedOn.boxShadow, "none");
    await page.screenshot({ path: path.join(output, "xmb-game-rounded-on-1920.png") });
    await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      fixtureXmbData.appearance.xmb.gamePresentation = "pill";
      fixtureXmbData.appearance.xmb.roundedArtwork = false;
      fixtureXmb.close();
      fixtureXmb.enter(document.querySelector(".nav a"));
      return root.querySelector('.xmb-item[aria-pressed="true"]').dataset.itemId;
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return root?.dataset.gamePresentation === "pill" && image?.dataset.artworkState === "ready";
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return (
        image &&
        Math.abs(parseFloat(getComputedStyle(image).width) - 268) < 1 &&
        Math.abs(parseFloat(getComputedStyle(image).height) - 134) < 1
      );
    });
    const pillPresentation = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      const box = row.getBoundingClientRect();
      return {
        mode: root.dataset.gamePresentation,
        itemId: row.dataset.itemId,
        rowHeight: box.height,
        objectFit: getComputedStyle(image).objectFit,
        borderRadius: getComputedStyle(image).borderRadius,
        imageWidth: image.getBoundingClientRect().width,
        imageHeight: image.getBoundingClientRect().height,
      };
    });
    assert.equal(pillPresentation.mode, "pill");
    assert.equal(pillPresentation.itemId, verticalPresentation.itemId);
    assert.equal(pillPresentation.objectFit, "cover");
    assert.notEqual(pillPresentation.borderRadius, "0px");
    assert.ok(pillPresentation.imageWidth > pillPresentation.imageHeight);
    assert.equal(pillPresentation.rowHeight, verticalPresentation.rowHeight);
    await page.screenshot({ path: path.join(output, "xmb-game-pill-1920.png") });
    const gameBorderOn = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      const box = row.getBoundingClientRect();
      const imageBox = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return {
        itemId: row.dataset.itemId,
        rowHeight: box.height,
        imageWidth: imageBox.width,
        imageHeight: imageBox.height,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
      };
    });
    assert.equal(gameBorderOn.borderWidth, "1px");
    assert.notEqual(gameBorderOn.boxShadow, "none");
    await page.screenshot({ path: path.join(output, "xmb-game-border-on-1920.png") });
    await page.evaluate(() => {
      fixtureXmbData.appearance.xmb.artworkBorder = false;
      fixtureXmb.close();
      fixtureXmb.enter(document.querySelector(".nav a"));
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return root?.dataset.artworkBorder === "false" && image?.dataset.artworkState === "ready";
    });
    const gameBorderOff = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      const box = row.getBoundingClientRect();
      const imageBox = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return {
        itemId: row.dataset.itemId,
        rowHeight: box.height,
        imageWidth: imageBox.width,
        imageHeight: imageBox.height,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
      };
    });
    assert.equal(gameBorderOff.itemId, gameBorderOn.itemId);
    assert.equal(gameBorderOff.rowHeight, gameBorderOn.rowHeight);
    assert.equal(gameBorderOff.imageWidth, gameBorderOn.imageWidth);
    assert.equal(gameBorderOff.imageHeight, gameBorderOn.imageHeight);
    assert.equal(gameBorderOff.borderWidth, "0px");
    assert.equal(gameBorderOff.boxShadow, "none");
    assert.equal(gameBorderOff.borderRadius, "18px");
    await page.screenshot({ path: path.join(output, "xmb-game-border-off-1920.png") });
    await page.evaluate(() => {
      fixtureXmbData.appearance.xmb.artworkBorder = true;
      fixtureXmb.close();
      fixtureXmb.enter(document.querySelector(".nav a"));
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return root?.dataset.artworkBorder === "true" && image?.dataset.artworkState === "ready";
    });
    const missingArtwork = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = [...root.querySelectorAll(".xmb-item")].find(
        (item) => item.dataset.itemId === "fixture-no-art",
      );
      const fallback = getComputedStyle(row, "::before");
      return {
        hasImage: !!row.querySelector("img"),
        fallbackContent: fallback.content,
        fallbackWidth: parseFloat(fallback.width),
        fallbackHeight: parseFloat(fallback.height),
      };
    });
    assert.equal(missingArtwork.hasImage, false);
    assert.notEqual(missingArtwork.fallbackContent, "none");
    assert.ok(missingArtwork.fallbackWidth > 0 && missingArtwork.fallbackHeight > 0);
    const readyCover = await page.evaluate(() => {
      const box = document.querySelector(".xmb-detail > img").getBoundingClientRect();
      const root = document.querySelector(".xmb:not([hidden])");
      const backdrop = root.querySelector(".xmb-backdrop img");
      return {
        width: box.width,
        height: box.height,
        detailVisibility: getComputedStyle(root.querySelector(".xmb-detail")).visibility,
        backdropReady: backdrop.dataset.artworkState === "ready",
        backdropVisible: !root.querySelector(".xmb-backdrop").hidden,
      };
    });
    assert.deepEqual(
      { width: initialCover.width, height: initialCover.height },
      { width: readyCover.width, height: readyCover.height },
    );
    assert.equal(readyCover.detailVisibility, "hidden");
    assert.ok(readyCover.backdropReady && readyCover.backdropVisible);
    const boundary = await page.evaluate(async () => {
      const root = document.querySelector(".xmb:not([hidden])");
      const cover = root.querySelector(".xmb-detail > img");
      const backdrop = root.querySelector(".xmb-backdrop img");
      let mutations = 0;
      const observer = new MutationObserver((records) => {
        mutations += records.length;
      });
      observer.observe(root.querySelector(".xmb-detail"), {
        subtree: true,
        childList: true,
        attributes: true,
      });
      observer.observe(root.querySelector(".xmb-backdrop"), {
        subtree: true,
        childList: true,
        attributes: true,
      });
      for (let index = 0; index < 8; index++)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      await new Promise(requestAnimationFrame);
      observer.disconnect();
      return {
        mutations,
        same:
          cover === root.querySelector(".xmb-detail > img") &&
          backdrop === root.querySelector(".xmb-backdrop img"),
      };
    });
    assert.deepEqual(boundary, { mutations: 0, same: true });
    const emptyCategory = await page.evaluate(async () => {
      const root = document.querySelector(".xmb:not([hidden])");
      const cover = root.querySelector(".xmb-detail > img");
      const backdrop = root.querySelector(".xmb-backdrop img");
      const thumbnail = root.querySelector(".xmb-item > img");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const hidden = root.querySelector(".xmb-backdrop").hidden;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      const frames = [];
      const sample = () => ({
        same:
          cover === root.querySelector(".xmb-detail > img") &&
          backdrop === root.querySelector(".xmb-backdrop img") &&
          thumbnail === root.querySelector(".xmb-item > img"),
        state: cover.dataset.artworkState,
        detailVisibility: getComputedStyle(root.querySelector(".xmb-detail")).visibility,
        backdropVisible: !root.querySelector(".xmb-backdrop").hidden,
      });
      frames.push(sample());
      for (let index = 0; index < 8; index++) {
        await new Promise(requestAnimationFrame);
        frames.push(sample());
      }
      return { hidden, frames };
    });
    assert.ok(emptyCategory.hidden);
    assert.ok(
      emptyCategory.frames.every(
        (frame) =>
          frame.same &&
          frame.state === "ready" &&
          frame.detailVisibility === "hidden" &&
          frame.backdropVisible,
      ),
    );
    const rapid = await page.evaluate(async () => {
      const root = document.querySelector(".xmb:not([hidden])");
      const image = root.querySelector(".xmb-detail > img");
      const oldSource = image.src;
      const originalDecode = HTMLImageElement.prototype.decode;
      const releases = [];
      HTMLImageElement.prototype.decode = function () {
        return originalDecode
          .call(this)
          .then(() => new Promise((resolve) => releases.push({ source: this.src, resolve })));
      };
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      const retained = image.src === oldSource;
      while (releases.length < 6) await new Promise((resolve) => setTimeout(resolve, 10));
      for (const release of releases.filter((item) => item.source.endsWith("asset=2")))
        release.resolve();
      await new Promise(requestAnimationFrame);
      for (const release of releases.filter((item) => item.source.endsWith("asset=1")))
        release.resolve();
      await new Promise(requestAnimationFrame);
      HTMLImageElement.prototype.decode = originalDecode;
      const finalSource = image.src;
      const html = root.querySelector(".xmb-detail").innerHTML;
      const backdropHtml = root.querySelector(".xmb-backdrop").innerHTML;
      for (let index = 0; index < 8; index++)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      return {
        retained,
        finalSource,
        same: image === root.querySelector(".xmb-detail > img"),
        unchanged:
          html === root.querySelector(".xmb-detail").innerHTML &&
          backdropHtml === root.querySelector(".xmb-backdrop").innerHTML,
      };
    });
    assert.ok(rapid.retained && rapid.same && rapid.unchanged);
    assert.ok(rapid.finalSource.endsWith("asset=2"));
    const differentCategory = await page.evaluate(async () => {
      const root = document.querySelector(".xmb:not([hidden])");
      const originalDecode = HTMLImageElement.prototype.decode;
      const releases = [];
      HTMLImageElement.prototype.decode = function () {
        return originalDecode
          .call(this)
          .then(() => new Promise((resolve) => releases.push(resolve)));
      };
      root.querySelector('[data-category="video"]').click();
      root.querySelector('[data-category="music"]').click();
      root.querySelector('[data-folder="music"]').ondblclick();
      const frames = [];
      const sample = () =>
        [...root.querySelectorAll(".xmb-detail > img, .xmb-backdrop img")].map((image) => ({
          source: image.src,
          visible: getComputedStyle(image).visibility,
          state: image.dataset.artworkState,
          detail: Boolean(image.closest(".xmb-detail")),
        }));
      frames.push(sample());
      while (releases.length < 4) {
        await new Promise(requestAnimationFrame);
        frames.push(sample());
      }
      for (const release of releases) release();
      await new Promise(requestAnimationFrame);
      HTMLImageElement.prototype.decode = originalDecode;
      return { frames, ready: sample() };
    });
    assert.ok(differentCategory.frames.flat().every((image) => image.visible === "hidden"));
    assert.ok(
      differentCategory.ready.every(
        (image) => image.source.endsWith("asset=music") && image.state === "ready",
      ),
    );
    assert.ok(differentCategory.ready.some((image) => image.detail && image.visible === "hidden"));
    assert.ok(
      differentCategory.ready.some((image) => !image.detail && image.visible === "visible"),
    );
    const musicBorderOn = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      return {
        itemId: row.dataset.itemId,
        rect: image.getBoundingClientRect().toJSON(),
        borderWidth: getComputedStyle(image).borderTopWidth,
        boxShadow: getComputedStyle(image).boxShadow,
        borderRadius: getComputedStyle(image).borderRadius,
      };
    });
    assert.equal(musicBorderOn.borderWidth, "1px");
    assert.notEqual(musicBorderOn.boxShadow, "none");
    await page.screenshot({ path: path.join(output, "xmb-music-border-on-1920.png") });
    await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      fixtureXmbData.appearance.xmb.artworkBorder = false;
      root.querySelector('[data-category="music"]').click();
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return root?.dataset.artworkBorder === "false" && image?.dataset.artworkState === "ready";
    });
    const musicBorderOff = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      return {
        itemId: row.dataset.itemId,
        rect: image.getBoundingClientRect().toJSON(),
        borderWidth: getComputedStyle(image).borderTopWidth,
        boxShadow: getComputedStyle(image).boxShadow,
        borderRadius: getComputedStyle(image).borderRadius,
      };
    });
    assert.equal(musicBorderOff.itemId, musicBorderOn.itemId);
    assert.deepEqual(musicBorderOff.rect, musicBorderOn.rect);
    assert.equal(musicBorderOff.borderWidth, "0px");
    assert.equal(musicBorderOff.boxShadow, "none");
    assert.equal(musicBorderOff.borderRadius, "0px");
    await page.screenshot({ path: path.join(output, "xmb-music-border-off-1920.png") });
    await page.screenshot({ path: path.join(output, "xmb-music-rounded-off-1920.png") });
    await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      fixtureXmbData.appearance.xmb.roundedArtwork = true;
      root.querySelector('[data-category="music"]').click();
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return root?.dataset.roundedArtwork === "true" && image?.dataset.artworkState === "ready";
    });
    const musicRoundedOn = await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      const row = root.querySelector('.xmb-item[aria-pressed="true"]');
      const image = row.querySelector("img");
      const style = getComputedStyle(image);
      return {
        itemId: row.dataset.itemId,
        rect: image.getBoundingClientRect().toJSON(),
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
      };
    });
    assert.equal(musicRoundedOn.itemId, musicBorderOff.itemId);
    assert.deepEqual(musicRoundedOn.rect, musicBorderOff.rect);
    assert.equal(musicRoundedOn.borderWidth, "0px");
    assert.equal(musicRoundedOn.boxShadow, "none");
    assert.equal(musicRoundedOn.borderRadius, "12px");
    await page.screenshot({ path: path.join(output, "xmb-music-rounded-on-1920.png") });
    await page.evaluate(() => {
      const root = document.querySelector(".xmb:not([hidden])");
      fixtureXmbData.appearance.xmb.roundedArtwork = false;
      root.querySelector('[data-category="music"]').click();
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('.xmb:not([hidden])');
      const image = root?.querySelector('.xmb-item[aria-pressed="true"] > img');
      return root?.dataset.roundedArtwork === "false" && image?.dataset.artworkState === "ready";
    });
    await page.screenshot({ path: path.join(output, "xmb-final.png") });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(
        {
          party,
          failure,
          initialCover,
          readyCover,
          boundary,
          emptyCategory,
          rapid,
          differentCategory,
          errors,
        },
        null,
        2,
      ),
    );
    console.log("Visual state continuity: PARTY geometry, XMB boundaries and stale decode passed.");
  } finally {
    await browser?.close();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
