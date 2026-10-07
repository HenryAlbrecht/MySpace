"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.exports = async function ({
  page,
  pad,
  action,
  qmClick,
  testArtifacts
}) {
  await page.evaluate(() => {
    __rows[0].image = "profile-art.png?selected=wrong-0";
    __rows[1].image = "profile-art.png?selected=wrong-1";
    __rows.find(row => row.kind === "game").image = "profile-art.png?selected=game";
    __rows.push({
      id: "handoff-artist",
      kind: "artist",
      title: "Artist artwork",
      image: "profile-art.png?selected=artist"
    }, {
      id: "handoff-album",
      kind: "album",
      title: "Album artwork",
      image: "profile-art.png?selected=album"
    });
  });
  const noRestart = await page.evaluate(() => __plays.length);
  for (const [kind, index, allowed] of [["music", 15, true], ["music", 0, false], ["music", 1, false], ["artist", 0, false], ["album", 0, false], ["game", 0, false]]) {
    await page.evaluate(({
      kind,
      index
    }) => {
      document.querySelector("#xmb-fixture .xmb-category[data-category=" + kind + "]").click();
      document.querySelectorAll("#xmb-fixture .xmb-item")[index].click();
    }, {
      kind,
      index
    });
    await page.waitForFunction(() => {
      const image = document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true] img");
      return image?.complete && image.naturalWidth;
    });
    // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.__artworkReturnFocus = document.activeElement;
    });
    const returnContext = await page.evaluate(() => ({
      item: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true]").dataset.itemId,
      scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop,
      category: document.querySelector("#xmb-fixture .xmb-category[aria-pressed=true]").dataset.category
    }));
    if (!allowed) await page.evaluate(() => {
      const image = document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true] img");
      XmbHandoff.prepare(image, image.getAttribute("src"));
    });
    await action("menu");
    await qmClick("now-playing");
    await page.waitForSelector("#spaceampNowPlaying[open]");
    assert.equal(await page.locator(".xmb-handoff-artwork").count(), allowed ? 1 : 0, kind + " selected " + index + " only animates the current track");
    assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().title), await page.evaluate(() => __originalPlayback.title));
    assert.equal(await page.evaluate(() => __plays.length), noRestart);
    await page.waitForFunction(() => document.querySelector(".np-cover").dataset.artworkState === "ready");
    assert.equal(await page.locator(".np-cover").getAttribute("src"), "profile-art.png");
    await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
    await action("back");
    await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
    assert.deepEqual(await page.evaluate(() => ({
      item: document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true]").dataset.itemId,
      scroll: document.querySelector("#xmb-fixture .xmb-items").scrollTop,
      category: document.querySelector("#xmb-fixture .xmb-category[aria-pressed=true]").dataset.category
    })), returnContext);
    assert.equal(await page.evaluate(() => document.activeElement === __artworkReturnFocus), true);
  }
  await page.evaluate(() => {
    __rows.splice(__rows.findIndex(row => row.id === "handoff-artist"), 2);
    __rows[0].image = __rows[1].image = "profile-art.png";
    delete __rows.find(row => row.kind === "game").image;
    document.querySelector("#xmb-fixture .xmb-category[data-category=music]").click();
    document.querySelectorAll("#xmb-fixture .xmb-item")[15].click();
  });
  // Observe settled XMB scroll/focus after its existing motion; no public scroll-settled signal.
  await page.waitForTimeout(250);
  await page.waitForFunction(() => {
    const image = document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true] img");
    return image?.complete && image.naturalWidth && image.getBoundingClientRect().top < innerHeight;
  });
  await page.evaluate(() => {
    __clock.position = 90;
    window.__artFrames = [];
    window.__sampleArtwork = true;
    const sample = () => {
      if (!__sampleArtwork) return;
      const cover = document.querySelector(".np-cover");
      if (SpaceAmpNowPlaying.isOpen()) __artFrames.push({
        src: cover.getAttribute("src"),
        hidden: cover.hidden,
        state: cover.dataset.artworkState,
        source: cover.dataset.artworkSource,
        key: cover.dataset.artworkKey,
        ghosts: document.querySelectorAll(".np-cover-previous").length,
        clones: document.querySelectorAll(".xmb-handoff-artwork").length,
        visible: getComputedStyle(cover).visibility,
        rect: {
          x: cover.getBoundingClientRect().x,
          y: cover.getBoundingClientRect().y,
          width: cover.getBoundingClientRect().width
        },
        cloneRect: document.querySelector(".xmb-handoff-artwork")?.getBoundingClientRect().toJSON()
      });
      requestAnimationFrame(sample);
    };
    sample();
  });
  await pad(0, 550);
  assert.equal(await page.evaluate(() => __plays.length), 1);
  await page.waitForSelector("#spaceampNowPlaying[open]");
  const sameFrames = await page.evaluate(() => {
    __sampleArtwork = false;
    return __artFrames;
  });
  assert.ok(sameFrames.length > 10);
  assert.ok(sameFrames.every(f => f.src === "profile-art.png" && f.source === "profile-art.png" && f.state === "ready" && f.key === f.source && !f.hidden && (f.visible === "visible" || f.clones > 0) && f.ghosts === 0), "same artwork remains ready with no internal fade");
  const finalClone = sameFrames.filter(f => f.cloneRect).at(-1),
    revealed = sameFrames.find((f, i) => i > 0 && sameFrames[i - 1].clones && !f.clones);
  assert.ok(finalClone && revealed);
  for (const axis of ["x", "y", "width"]) assert.ok(Math.abs(finalClone.cloneRect[axis] - revealed.rect[axis]) < .5, "clone and revealed artwork share final " + axis);
  assert.ok(sameFrames.every(f => Math.abs(f.rect.x - revealed.rect.x) < .5 && Math.abs(f.rect.width - revealed.rect.width) < .5), "shell does not scale beneath shared artwork");
  assert.equal(await page.evaluate(() => __clock.position), 90);
  fs.mkdirSync(testArtifacts, {
    recursive: true
  });
  fs.writeFileSync(path.join(testArtifacts, "same-track-frames.json"), JSON.stringify(sameFrames, null, 2));
};
