"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, toggle, lyricsTtml }) {
  assert.equal(await page.locator("audio").count(), 1);
  // Playing lyrics interpolate between provider samples; the dedicated clock
  // harness covers correction and seek. Keep this shell check inside one sample.
  const firstLyricsTime = await page.evaluate(
    () => document.querySelector("am-lyrics").currentTime,
  );
  assert.ok(
    firstLyricsTime >= 12500 && firstLyricsTime < 13100,
    "lyrics remain within the provider interpolation window",
  );
  // Pause the coarse fixture clock so upstream scroll does not oscillate at a line boundary.
  await page
    .getByRole("button", {
      name: "Pausar",
      exact: true,
    })
    .click();
  // Focus outside XMB never implies a controller cursor.
  assert.equal(await page.evaluate(() => document.body.classList.contains("xmb-active")), false);
  await page.waitForFunction(() =>
    document.querySelector("am-lyrics").shadowRoot.querySelector('.lyrics-line[tabindex="0"]'),
  );
  const nativeRows = page.locator('am-lyrics .lyrics-line[tabindex="0"][role="button"]');
  await nativeRows.nth(13).click();
  assert.equal(await page.evaluate(() => __time.position), 13);
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 0);
  await nativeRows.nth(13).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.querySelector("am-lyrics").shadowRoot.activeElement.matches(":focus-visible"),
    ),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => __time.position), 14);
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 0);
  const controllerAction = async (action) =>
    page.evaluate(
      (action) =>
        window.dispatchEvent(
          new CustomEvent("xmb:action", {
            detail: action,
          }),
        ),
      action,
    );
  await controllerAction("right");
  await controllerAction("right");
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 1);
  const cursorBefore = await page
    .locator("am-lyrics .spaceamp-controller-selected")
    .getAttribute("data-start-time");
  await controllerAction("down");
  assert.notEqual(
    await page.locator("am-lyrics .spaceamp-controller-selected").getAttribute("data-start-time"),
    cursorBefore,
  );
  assert.equal(await page.evaluate(() => __time.position), 14);
  const menuCursor = await page
    .locator("am-lyrics .spaceamp-controller-selected")
    .getAttribute("data-start-time");
  await controllerAction("menu");
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), true);
  assert.equal(await page.evaluate(() => document.body.classList.contains("xmb-active")), false);
  await controllerAction("back");
  assert.equal(await page.evaluate(() => SpaceAmpNowPlaying.isOpen()), true);
  assert.equal(
    await page.locator("am-lyrics .spaceamp-controller-selected").getAttribute("data-start-time"),
    menuCursor,
  );
  await controllerAction("menu");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("xmb:inputmode", {
        detail: "keyboard",
      }),
    ),
  );
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => XmbQuickMenu.isOpen()), false);
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 0);
  await controllerAction("down");
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 1);
  await controllerAction("back");
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 0);
  for (const mode of ["keyboard", "pointer"]) {
    await controllerAction("right");
    assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 1);
    await page.evaluate(
      (mode) =>
        window.dispatchEvent(
          new CustomEvent("xmb:inputmode", {
            detail: mode,
          }),
        ),
      mode,
    );
    assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 0);
  }
  await controllerAction("right");
  await nativeRows.nth(12).click();
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 0);
  await controllerAction("right");
  assert.equal(await page.locator("am-lyrics .spaceamp-controller-selected").count(), 1);
  await page.evaluate(() => {
    window.__closedCursorComponent = document.querySelector("am-lyrics");
    SpaceAmpNowPlaying.close();
  });
  assert.equal(
    await page.evaluate(() =>
      __closedCursorComponent.shadowRoot.querySelector(".spaceamp-controller-selected"),
    ),
    null,
  );
  await page.evaluate(() => {
    SPACEAMP.seek(12.5);
    SPACEAMP.play();
    SpaceAmpNowPlaying.open(document.querySelector("#album"));
  });
  await page.evaluate(
    (ttml) => document.querySelector("am-lyrics").setAttribute("ttml", ttml),
    lyricsTtml,
  );
  const lyricComponent = page.locator("am-lyrics");
  assert.equal(await lyricComponent.getAttribute("line-motion"), null);
  assert.equal(await lyricComponent.getAttribute("no-blur"), null);
  assert.equal(await lyricComponent.getAttribute("autoscroll"), "");
  assert.equal(await lyricComponent.getAttribute("interpolate"), "");
  await page.waitForFunction(() =>
    document
      .querySelector("am-lyrics")
      ?.shadowRoot?.getElementById("spaceamp-lyrics-motion-profile"),
  );
  // Exercise controller selection/activation against the unmodified vendor too.
  const vendorLyricsEnabled = await toggle.getAttribute("aria-pressed");
  if (vendorLyricsEnabled !== "true") await toggle.click();
  await page.evaluate(
    (ttml) => document.querySelector("am-lyrics").setAttribute("ttml", ttml),
    lyricsTtml,
  );
  const vendorClock = await page.evaluate(() => {
    const position = __time.position;
    SPACEAMP.seek(12);
    return position;
  });
  await page.waitForFunction(() =>
    document
      .querySelector("am-lyrics")
      .shadowRoot.querySelector('.lyrics-line[aria-current="true"][tabindex="0"]'),
  );
  const vendorSelectionClock = await page.evaluate(() => __time.position);
  await page.evaluate(() => {
    for (const action of ["right", "right"])
      window.dispatchEvent(
        new CustomEvent("xmb:action", {
          detail: action,
        }),
      );
  });
  assert.equal(
    await page.evaluate(() =>
      document.querySelector("am-lyrics").shadowRoot.activeElement?.getAttribute("aria-current"),
    ),
    "true",
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("xmb:action", {
        detail: "down",
      }),
    ),
  );
  assert.equal(await page.evaluate(() => __time.position), vendorSelectionClock);
  const nativeTimestamp = await page.evaluate(
    () =>
      Number(document.querySelector("am-lyrics").shadowRoot.activeElement.dataset.startTime) / 1000,
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("xmb:action", {
        detail: "primary",
      }),
    ),
  );
  assert.equal(await page.evaluate(() => __time.position), nativeTimestamp);
  await page.evaluate((position) => {
    window.dispatchEvent(
      new CustomEvent("xmb:action", {
        detail: "back",
      }),
    );
    window.dispatchEvent(
      new CustomEvent("xmb:inputmode", {
        detail: "keyboard",
      }),
    );
    SPACEAMP.seek(position);
  }, vendorClock);
  if (vendorLyricsEnabled !== "true") await toggle.click();
};
