"use strict";

const fs = require("node:fs");
const path = require("node:path");
async function createFixture(browser, web) {
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
  });
  await context.addInitScript(() => {
    window.__quickTimers = new Set();
    window.__quickTicks = 0;
    const interval = window.setInterval.bind(window),
      clear = window.clearInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => {
      if (callback.name !== "refreshPlaybackStatus") return interval(callback, delay, ...args);
      const id = interval(() => {
        __quickTicks++;
        callback(...args);
      }, delay);
      __quickTimers.add(id);
      return id;
    };
    window.clearInterval = (id) => {
      __quickTimers.delete(id);
      clear(id);
    };
    window.__sampled = [];
    window.addEventListener("xmb:action", (event) => __sampled.push(event.detail), true);
    window.__pad = null;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [__pad],
    });
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        document.documentElement.requestFullscreen = () =>
          Promise.reject(Error("fixture viewport"));
      },
      {
        once: true,
      },
    );
  });
  await context.route("https://**/*", (r) => r.abort());
  await context.route("**/vendor/am-lyrics-1.7.4.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `
${fs.readFileSync(path.join(__dirname, "fixtures/lyrics.js"), "utf8")}`,
    }),
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:" + web.address().port + "/?voiceTransport=local#perfil");
  await page.waitForSelector("#globalSpaceAmp");
  await page.evaluate(() => {
    const el = (tag, cls, text = "") => {
      const n = document.createElement(tag);
      n.className = cls;
      n.textContent = text;
      return n;
    };
    const button = (text, action, cls) => {
      const n = el("button", cls, text);
      n.onclick = action;
      return n;
    };
    window.__rows = Array.from(
      {
        length: 35,
      },
      (_, i) => ({
        id: "track-" + i,
        kind: "music",
        title: "Track " + i,
        artist: "Fixture Artist",
        status: "completed",
        image: "profile-art.png",
        playbackSource: {
          type: "local",
          fileRef: "fixture-" + i,
        },
      }),
    );
    __rows.push({
      id: "game-0",
      kind: "game",
      title: "Game",
      status: "completed",
    });
    window.__plays = [];
    window.__pages = [];
    window.__seeks = [];
    window.__skips = [];
    window.__clock = {
      position: 42,
      duration: 180,
    };
    SPACEAMP.configure({
      select: (t) => {
        __plays.push(t.collectionId);
        SPACEAMP.update(
          {
            title: t.title,
            artist: t.artist,
            artwork: t.album,
            source: "local",
            sourceUrl: t.fileRef,
          },
          true,
          {
            available: true,
          },
        );
      },
      getPlaybackTime: () => __clock,
      play: () => SPACEAMP.update(SPACEAMP.getPlaybackState(), true),
      pause: () => SPACEAMP.update(SPACEAMP.getPlaybackState(), false),
      seek: (t) => {
        __seeks.push(t);
        __clock.position = t;
      },
      setVolume: (value) =>
        SPACEAMP.progress({
          volume: value,
        }),
    });
    SPACEAMP.setNavigation(
      Object.fromEntries(
        ["previous", "next"].map((action) => [
          action,
          () => {
            __skips.push(action);
            if (window.__skipChanges)
              SPACEAMP.update(
                {
                  ...SPACEAMP.getPlaybackState(),
                  title: "Shoulder " + __skips.length,
                  sourceUrl: "shoulder-" + __skips.length,
                },
                true,
              );
          },
        ]),
      ),
    );
    window.__xmb = createXmb({
      getData: () => ({
        items: __rows,
        photos: [],
      }),
      getProfile: () => ({
        name: "Fixture",
      }),
      getFilters: () => ({
        kind: "music",
      }),
      openItem: (item) => __pages.push(item.id),
      navigate: () => {},
      openPhoto: () => {},
      el,
      button,
      imageNode: (src, alt) => {
        const n = document.createElement("img");
        n.src = src;
        n.alt = alt;
        return n;
      },
    });
    // The Collection entry and fixture share one XMB owner, as in production.
    window.createXmb = () => window.__xmb;
  });
  const action = async (name) =>
    page.evaluate(
      (action) =>
        window.dispatchEvent(
          new CustomEvent("xmb:action", {
            detail: action,
          }),
        ),
      name,
    );
  const lyricIndex = () =>
    page.evaluate(() => {
      const root = document.querySelector("am-lyrics").shadowRoot;
      return [...root.querySelectorAll(".lyrics-line")].indexOf(root.activeElement);
    });
  const markerIndex = () =>
    page.evaluate(() => {
      const root = document.querySelector("am-lyrics").shadowRoot;
      return [...root.querySelectorAll(".lyrics-line")].indexOf(
        root.querySelector(".spaceamp-controller-selected"),
      );
    });
  const focusedLabel = () =>
    page.evaluate(
      () => document.activeElement.getAttribute("aria-label") || document.activeElement.textContent,
    );
  const playerNode = () =>
    page.evaluate(() =>
      document.activeElement.matches(".np-progress")
        ? "progress"
        : document.activeElement.matches('#spaceampNowPlaying input[aria-label="Volume"]')
          ? "volume"
          : document.activeElement.textContent,
    );
  async function pad(button, hold = 70) {
    const pressedAt = Date.now();
    const sampled = await page.evaluate((i) => {
      __pad ||= {
        index: 0,
        mapping: "standard",
        buttons: Array.from(
          {
            length: 16,
          },
          () => ({
            pressed: false,
            value: 0,
          }),
        ),
        axes: [0, 0],
      };
      const count = __sampled.length;
      __pad.buttons[i].pressed = true;
      return count;
    }, button);
    await page.waitForFunction((count) => __sampled.length > count, sampled, {
      polling: "raf",
    });
    // Hold the gamepad button long enough to certify edge-trigger/repeat behavior.
    await page.waitForTimeout(Math.max(0, hold - (Date.now() - pressedAt)));
    await page.evaluate((i) => {
      __pad.buttons[i].pressed = false;
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, button);
  }
  const selected = () => page.locator("#xmb-fixture .xmb-item[aria-pressed=true]");
  const qmRow = (id) => page.locator('#xmbQuickMenu [data-command="' + id + '"]');
  const frames = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  const qmClick = async (id) => {
    await qmRow(id).click();
    await frames();
  };
  const clockBefore = 42;
  const snapshot = () =>
    page.evaluate(() => ({
      index: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true]").dataset.index,
      scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop,
      players: document.querySelectorAll("audio,iframe").length,
    }));
  async function preparePlayer() {
    await page.evaluate(() => {
      __xmb.enter();
      [...document.querySelectorAll(".xmb")].at(-1).id = "xmb-fixture";
      document.querySelectorAll("#xmb-fixture .xmb-item")[15].click();
    });
    await page.waitForFunction(
      () => document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true] img")?.complete,
    );
    const before = await snapshot();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#spaceampNowPlaying[open]");
    await page.waitForFunction(
      () =>
        document.querySelector("am-lyrics")?.shadowRoot?.querySelector(".lyrics-line") &&
        !document.querySelector(".xmb-handoff-artwork"),
    );
    await page.evaluate(() => {
      window.__originalPlayback = {
        ...SPACEAMP.getPlaybackState(),
      };
    });
    return before;
  }
  async function focusVolume() {
    await action("up");
    await action("up");
    await action("left");
    await action("left");
    await action("right");
    await action("right");
    await action("down");
    await action("left");
    await action("right");
  }
  async function settleStage() {
    await page
      .locator(".np-artwork")
      .evaluate((node) =>
        Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {}))),
      );
  }
  return {
    context,
    page,
    errors,
    pad,
    selected,
    action,
    lyricIndex,
    markerIndex,
    focusedLabel,
    playerNode,
    qmRow,
    qmClick,
    clockBefore,
    snapshot,
    preparePlayer,
    focusVolume,
    settleStage,
    frames,
  };
}
module.exports = {
  createFixture,
};
