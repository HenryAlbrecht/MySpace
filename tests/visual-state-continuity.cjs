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
      const data = {
        items: [0, 1, 2]
          .map((index) => ({
            id: "fixture-" + index,
            kind: "game",
            title: "Artwork " + index,
            status: "planned",
            image: "/profile-art.png?asset=" + index,
          }))
          .concat({
            id: "music-fixture",
            kind: "music",
            title: "Different category",
            status: "planned",
            image: "/profile-art.png?asset=music",
          }),
      };
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
    await page.waitForSelector('.xmb-detail > img[data-artwork-state="ready"]');
    const readyCover = await page.evaluate(() => {
      const box = document.querySelector(".xmb-detail > img").getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    assert.deepEqual(initialCover, readyCover);
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
        visible: getComputedStyle(cover).visibility,
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
          frame.visible === "visible" &&
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
        (image) =>
          image.source.endsWith("asset=music") &&
          image.state === "ready" &&
          image.visible === "visible",
      ),
    );
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
