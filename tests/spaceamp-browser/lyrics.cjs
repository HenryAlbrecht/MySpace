"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({
  frames,
  page,
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
  before
}) {
  // The quick bar remains usable by mouse; disabled lyrics does not break mesh.
  await page.locator("#spaceampNowPlaying [aria-label=\"Lyrics\"]").click();
  await action("up");
  await action("left");
  await action("left");
  await action("right");
  await action("right");
  await action("right");
  assert.equal(await focusedLabel(), "Pr\xF3xima");
  await action("down");
  await action("left");
  await action("right");
  await action("right");
  assert.equal(await playerNode(), "volume");
  await page.locator("#spaceampNowPlaying [aria-label=\"Lyrics\"]").click();
  await action("down");
  await action("right");
  await action("left");
  const playerFocus = await page.evaluate(() => document.activeElement.className);
  await action("right");
  assert.equal(await lyricIndex(), 1);
  await action("down");
  await action("down");
  await action("up");
  assert.equal(await lyricIndex(), 2);
  assert.equal(await page.evaluate(() => __clock.position), clockBefore);
  const seeksBefore = await page.evaluate(() => __seeks.length);
  await action("primary");
  assert.equal(await page.evaluate(() => __clock.position), 60);
  assert.equal(await page.evaluate(() => __seeks.length), seeksBefore + 1);
  await action("back");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  assert.equal(await page.evaluate(() => document.activeElement.className), playerFocus);
  await action("right");
  await action("down");
  assert.equal(await markerIndex(), 2);
  await pad(4, 500);
  await pad(5, 500);
  assert.equal(await markerIndex(), 2);
  // Native options belong to the lyrics origin and preserve fresh timestamp anchors.
  await action("menu");
  await page.evaluate(() => {
    const lyrics = document.querySelector("am-lyrics");
    lyrics.redrawOptions = true;
    const root = lyrics.shadowRoot;
    const pane = root.querySelector(".lyrics-container");
    const row = root.querySelector(".spaceamp-controller-selected");
    window.__anchorTime = row.dataset.startTime;
    window.__anchorOffset = row.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  });
  for (const id of ["romanization", "translation"]) {
    assert.equal(await qmRow(id).isVisible(), true);
    assert.match(await qmRow(id).textContent(), id === "romanization" ? /Transliteração/ : /Traduzir para inglês/);
    await qmRow(id).focus();
    await action("primary");
    // Observe native redraw/anchor reconciliation or reject a deferred auto-open.
    await page.waitForTimeout(100);
    assert.match(await qmRow(id).textContent(), /ON/);
    assert.ok(await page.evaluate(() => {
      const root = document.querySelector("am-lyrics").shadowRoot;
      const pane = root.querySelector(".lyrics-container");
      const row = [...root.querySelectorAll(".lyrics-line")].find(n => n.dataset.startTime === __anchorTime);
      return Math.abs(row.getBoundingClientRect().top - pane.getBoundingClientRect().top - __anchorOffset) < 3;
    }));
    await action("primary");
    // Observe native redraw/anchor reconciliation or reject a deferred auto-open.
    await page.waitForTimeout(100);
  }
  await qmRow("volume").focus();
  const stableMenu = await page.evaluate(() => ({
    focus: document.activeElement.dataset.command,
    scroll: document.querySelector("#xmbQuickMenu").scrollTop
  }));
  await page.evaluate(() => document.querySelector("am-lyrics").shadowRoot.querySelector("button[aria-label=\"Toggle translation\"]").hidden = true);
  assert.equal(await qmRow("translation").isVisible(), true);
  await page.evaluate(() => document.querySelector("am-lyrics").shadowRoot.querySelector("button[aria-label=\"Toggle translation\"]").hidden = false);
  await frames();
  assert.deepEqual(await page.evaluate(() => ({
    focus: document.activeElement.dataset.command,
    scroll: document.querySelector("#xmbQuickMenu").scrollTop
  })), stableMenu);
  await qmRow("translation").focus();
  await page.evaluate(() => document.querySelector("am-lyrics").shadowRoot.querySelector("button[aria-label=\"Toggle translation\"]").hidden = true);
  await frames();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "translation");
  await page.evaluate(() => {
    const lyrics = document.querySelector("am-lyrics");
    lyrics.redrawOptions = false;
    lyrics.shadowRoot.querySelector("button[aria-label=\"Toggle translation\"]").hidden = false;
  });
  await action("back");
  assert.equal(await markerIndex(), 2);
  await action("menu");
  const menuRowBefore = await page.evaluate(() => document.activeElement.dataset.command);
  await pad(4, 500);
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), menuRowBefore);
  await qmRow("play").focus();
  await action("left");
  await action("down");
  await action("primary");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "fullscreen");
  await page.evaluate(() => {
    window.__menuLifecycle = {
      close: 0,
      open: 0
    };
    const menu = document.querySelector("#xmbQuickMenu");
    for (const method of ["close", "showModal"]) {
      const original = menu[method].bind(menu);
      menu[method] = (...args) => {
        __menuLifecycle[method === "close" ? "close" : "open"]++;
        return original(...args);
      };
    }
    window.__skipChanges = true;
  });
  await pad(5, 500);
  await page.evaluate(() => {
    window.__skipChanges = false;
  });
  await page.evaluate(() => {
    __skipChanges = true;
  });
  for (let i = 0; i < 3; i++) await pad(5);
  await page.evaluate(() => {
    __skipChanges = false;
  });
  assert.match(await page.locator("#xmbQuickMenu h3").textContent(), /Shoulder/);
  assert.deepEqual(await page.evaluate(() => __menuLifecycle), {
    close: 0,
    open: 0
  });
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "fullscreen");
  assert.equal(await page.locator("#xmbQuickMenu .xqm-system").isVisible(), true);
  await action("back");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  assert.equal(await markerIndex(), 1);
  await action("menu");
  await action("menu");
  assert.equal(await markerIndex(), 1);
  await action("back");
  assert.equal(await markerIndex(), -1);
  assert.equal(await playerNode(), "volume");
  await action("right");
  await action("menu");
  await qmClick("lyricsEnabled");
  assert.equal(await qmRow("romanization").isVisible(), false);
  assert.equal(await qmRow("translation").isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.command), "lyricsEnabled");
  await action("back");
  assert.equal(await markerIndex(), -1);
  assert.equal(await playerNode(), "volume");
  await page.locator("#spaceampNowPlaying [aria-label=\"Lyrics\"]").click();
  await action("right");
  await page.evaluate(() => {
    window.__oldLyrics = document.querySelector("am-lyrics");
    SPACEAMP.update({
      ...SPACEAMP.getPlaybackState(),
      title: "Replacement lyrics"
    }, true);
  });
  await page.waitForFunction(() => document.querySelector("am-lyrics") !== __oldLyrics && document.querySelector("am-lyrics").shadowRoot?.activeElement);
  assert.equal(await page.evaluate(() => __oldLyrics.isConnected), false);
  assert.equal(await page.evaluate(() => __oldLyrics.shadowRoot.querySelector(".spaceamp-controller-selected")), null);
  assert.equal(await markerIndex(), 1);
  assert.equal(await lyricIndex(), 1);
  await action("down");
  assert.equal(await lyricIndex(), 2);
  await action("left");
  assert.equal(await page.evaluate(() => document.activeElement.className), playerFocus);
  for (const mode of ["loading", "empty", "error"]) {
    await page.evaluate(mode => document.querySelector("am-lyrics").render(mode), mode);
    await action("right");
    assert.equal(await lyricIndex(), -1);
    await action("menu");
    assert.equal(await qmRow("romanization").isVisible(), true);
    assert.equal(await qmRow("translation").isVisible(), true);
    await action("back");
  }
  await page.evaluate(() => document.querySelector("am-lyrics").render("unsynced"));
  await action("right");
  const unsyncedBefore = await page.evaluate(() => __clock.position);
  await action("down");
  await action("primary");
  assert.ok((await page.evaluate(() => document.querySelector("am-lyrics").shadowRoot.querySelector(".lyrics-container").scrollTop)) > 0);
  assert.equal(await page.evaluate(() => __clock.position), unsyncedBefore);
  await action("back");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  // Mouse and native keyboard line activation remain intact.
  await page.evaluate(() => document.querySelector("am-lyrics").render("synced"));
  await page.locator("am-lyrics button[aria-label=\"Toggle romanization\"]").click();
  await page.locator("am-lyrics button[aria-label=\"Toggle translation\"]").focus();
  await page.keyboard.press("Enter");
  await action("menu");
  assert.match(await qmRow("romanization").textContent(), /ON/);
  assert.match(await qmRow("translation").textContent(), /ON/);
  await action("back");
  await page.locator("am-lyrics .lyrics-line").nth(0).click();
  assert.equal(await page.evaluate(() => __clock.position), 20);
  await page.locator("am-lyrics .lyrics-line").nth(1).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => __clock.position), 40);
  await pad(1);
  await page.waitForFunction(() => !SpaceAmpNowPlaying.isOpen());
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  // A late focus restore cannot highlight a second logical item.
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#xmb-fixture .xmb-item")];
    rows.find(n => n.getAttribute("aria-pressed") !== "true").focus({
      preventScroll: true
    });
  });
  assert.equal(await page.locator("#xmb-fixture .xmb-item[aria-pressed=true]").count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.matches("#xmb-fixture .xmb-item[aria-pressed=\"true\"]")), true);
  assert.equal(await selected().getAttribute("data-index"), before.index);
  assert.equal(await page.locator("#xmb-fixture .xmb-items").evaluate(n => n.scrollTop), before.scroll);
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), true);
  await action("menu");
  for (const id of ["lyricsEnabled", "romanization", "translation", "video", "visualizerMode", "backgroundMode", "uiMode"]) assert.equal(await qmRow(id).isVisible(), false);
  await action("back");
  await page.evaluate(() => {
    window.__menuNode = document.activeElement;
    SPACEAMP.update({
      ...SPACEAMP.getPlaybackState(),
      title: "Automatic next track"
    }, true);
    window.dispatchEvent(new Event("spaceamp:trackchange"));
  });
  // Observe native redraw/anchor reconciliation or reject a deferred auto-open.
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), false);
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), false);
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().playing), true);
  assert.equal(await page.evaluate(() => document.activeElement === __menuNode), true);
  await page.evaluate(() => SPACEAMP.update(__originalPlayback, true));
  assert.equal(await selected().getAttribute("data-index"), before.index);
  assert.equal(await page.locator("#xmb-fixture .xmb-items").evaluate(n => n.scrollTop), before.scroll);
};
