"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, action }) {
  // Reverse handoff keeps its revision through return render, then new navigation invalidates it.
  await page.evaluate(() => {
    window.__handoffDecode = HTMLImageElement.prototype.decode;
    window.__holdReturn = false;
    window.__returnDecodes = [];
    HTMLImageElement.prototype.decode = function () {
      if (__holdReturn && this.closest("#xmb-fixture"))
        return new Promise((resolve) => __returnDecodes.push(resolve));
      return __handoffDecode.call(this);
    };
  });
  for (const change of ["item", "category", "details", "root", "exit"]) {
    await page.evaluate(() => {
      if (!__xmb.isActive()) __xmb.enter();
      document.querySelector("#xmb-fixture .xmb-category[data-category=music]").click();
    document.querySelector('#xmb-fixture [data-folder="music"]')?.ondblclick();
      document.querySelectorAll("#xmb-fixture .xmb-item")[0].click();
      SPACEAMP.update(
        {
          ...SPACEAMP.getPlaybackState(),
          title: __rows[0].title,
          artist: __rows[0].artist,
          artwork: __rows[0].image,
          sourceUrl: "fixture-0",
        },
        true,
      );
    });
    await page.waitForFunction(
      () => document.querySelector("#xmb-fixture .xmb-item[aria-pressed=true] img")?.complete,
    );
    if (change === "root") await action("secondary");
    await action("primary");
    await page.waitForSelector("#spaceampNowPlaying[open]");
    await page.waitForFunction(
      () =>
        document.querySelector(".np-cover")?.dataset.artworkState === "ready" &&
        !document.querySelector(".xmb-handoff-artwork"),
    );
    await page.evaluate(() => {
      document.querySelector(".np-cover").src = "profile-art.png?reverse-different";
    });
    await page.waitForFunction(() => document.querySelector(".np-cover").complete);
    await page.evaluate(() => {
      __holdReturn = true;
      SpaceAmpNowPlaying.close();
    });
    assert.equal(
      await page.locator(".xmb-handoff-artwork").count(),
      1,
      "return render preserves current reverse",
    );
    // Exercise invalidation after settle, or allow late decode callbacks to drain.
    if (change === "category" || change === "root") await page.waitForTimeout(300);
    assert.equal(
      await page.locator(".xmb-handoff-artwork").count(),
      1,
      "pending decode survives settle",
    );
    if (change === "item") await action("down");
    else if (change === "category")
      await page.evaluate(() =>
        document.querySelector("#xmb-fixture .xmb-category[data-category=video]").click(),
      );
    else if (change === "details") await action("secondary");
    else await action("back");
    assert.equal(
      await page.locator(".xmb-handoff-artwork").count(),
      0,
      change + " invalidates pending reverse",
    );
    assert.equal(await page.locator(".xmb-handoff-hidden").count(), 0);
    await page.evaluate(() => {
      __holdReturn = false;
      for (const resolve of __returnDecodes.splice(0)) resolve();
    });
    // Exercise invalidation after settle, or allow late decode callbacks to drain.
    await page.waitForTimeout(40);
    assert.equal(
      await page.locator(".xmb-handoff-artwork").count(),
      0,
      "late decode cannot restore clone",
    );
    if (change === "details") await action("back");
  }
  await page.evaluate(() => {
    __xmb.enter();
    document.querySelector("#xmb-fixture .xmb-category[data-category=music]").click();
    document.querySelector('#xmb-fixture [data-folder="music"]')?.ondblclick();
  });
  await action("primary");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  await page.evaluate(() => {
    document.querySelector(".np-cover").src = "profile-art.png?reverse-ready";
  });
  await page.waitForFunction(() => document.querySelector(".np-cover").complete);
  await page.evaluate(() => SpaceAmpNowPlaying.close());
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  await action("down");
  assert.equal(
    await page.locator(".xmb-handoff-artwork").count(),
    0,
    "item navigation after settle",
  );
  await page.evaluate(() =>
    document.querySelector("#xmb-fixture .xmb-category[data-category=video]").click(),
  );
  assert.equal(
    await page.locator(".xmb-handoff-artwork").count(),
    0,
    "category navigation after settle",
  );
  await page.evaluate(() => {
    document.querySelector("#xmb-fixture .xmb-category[data-category=music]").click();
    document.querySelector('#xmb-fixture [data-folder="music"]')?.ondblclick();
    document.querySelectorAll("#xmb-fixture .xmb-item")[0].click();
  });
  // A decode that never settles is bounded without navigation.
  await action("primary");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  await page.evaluate(() => {
    __holdReturn = true;
    SpaceAmpNowPlaying.close();
  });
  assert.equal(await page.locator(".xmb-handoff-artwork").count(), 1);
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"), null, {
    timeout: 3500,
  });
  await page.evaluate(() => {
    __holdReturn = false;
    for (const resolve of __returnDecodes.splice(0)) resolve();
    HTMLImageElement.prototype.decode = __handoffDecode;
  });
  // Queued callbacks from a cancelled revision cannot delete the next clone.
  await page.waitForFunction(() =>
    [...document.querySelectorAll("#xmb-fixture .xmb-item img")]
      .slice(0, 2)
      .every((image) => image.complete && image.naturalWidth),
  );
  await page.evaluate(() => {
    const images = [...document.querySelectorAll("#xmb-fixture .xmb-item img")];
    XmbHandoff.run(images[0], images[1]);
    const old = document.querySelector(".xmb-handoff-artwork").getAnimations()[0];
    window.__staleCancel = old.oncancel;
    window.__staleFinish = old.onfinish;
  });
  await action("down");
  assert.equal(await page.locator(".xmb-handoff-artwork").count(), 0);
  await page.evaluate(() => {
    const images = [...document.querySelectorAll("#xmb-fixture .xmb-item img")];
    XmbHandoff.run(images[0], images[1]);
    __staleCancel();
    __staleFinish();
  });
  assert.equal(
    await page.locator(".xmb-handoff-artwork").count(),
    1,
    "stale callbacks preserve the current revision",
  );
  await page.waitForFunction(() => !document.querySelector(".xmb-handoff-artwork"));
  // Sweep an already-orphaned clone whose owner reference was lost.
  await page.evaluate(() => document.querySelectorAll("#xmb-fixture .xmb-item")[0].click());
  await page.evaluate(() => {
    const orphan = document.createElement("img");
    orphan.className = "xmb-handoff-artwork";
    document.body.append(orphan);
  });
  await action("down");
  assert.equal(await page.locator(".xmb-handoff-artwork").count(), 0);
  await page.evaluate(() => document.querySelectorAll("#xmb-fixture .xmb-item")[0].click());
};
