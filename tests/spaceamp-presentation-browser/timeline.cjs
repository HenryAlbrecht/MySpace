"use strict";

const assert = require("node:assert/strict");
module.exports = async function ({ page, artwork }) {
  await page.evaluate(() => {
    document.querySelector("am-lyrics").dispatchEvent(
      new CustomEvent("line-click", {
        detail: {
          timestamp: 42000,
        },
      }),
    );
  });
  assert.equal(await page.evaluate(() => __time.position), 42);
  await page
    .getByRole("button", {
      name: "Pausar",
      exact: true,
    })
    .click();
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), false);
  assert.equal(await page.evaluate(() => document.querySelector("am-lyrics").duration), 180000);
  await page
    .getByRole("button", {
      name: "Reproduzir",
      exact: true,
    })
    .click();
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
  await page.evaluate(() => {
    window.__previousLyrics = document.querySelector("am-lyrics");
    SPACEAMP.update(
      {
        title: "Next",
        artist: "Next Artist",
        source: "YouTube",
        sourceUrl: "next",
        artwork: "profile-art.png",
      },
      true,
      {
        available: true,
      },
    );
  });
  assert.equal(await page.locator("am-lyrics").getAttribute("song-title"), "Next");
  assert.equal(await page.evaluate(() => __previousLyrics.isConnected), false);
  await page.waitForFunction(
    () => document.querySelector(".np-cover").dataset.artworkReady === "true",
  );
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getState(),
        title: "Third",
        artwork: "profile-art.png?next",
      },
      true,
    ),
  );
  assert.equal(
    await page.evaluate(() => document.querySelector(".np-cover").dataset.artworkReady),
    "true",
  );
  assert.equal(
    await page.locator("#spaceampNowPlaying").getAttribute("data-visualizer"),
    "presentation",
  );
  await artwork();
  // Buffering during either seek retains the action, without publishing false PLAYING.
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getState(),
        source: "YouTube",
      },
      true,
      {
        playbackStatus: "",
        stopped: false,
        available: true,
      },
    ),
  );
  const playingWidth = await page
    .getByRole("button", {
      name: "Pausar",
      exact: true,
    })
    .evaluate((n) => n.getBoundingClientRect().width);
  for (const action of ["slider", "lyrics"]) {
    await page.evaluate((action) => {
      if (action === "lyrics")
        document.querySelector("am-lyrics").dispatchEvent(
          new CustomEvent("line-click", {
            detail: {
              timestamp: 42000,
            },
          }),
        );
      else document.querySelector(".np-progress").dispatchEvent(new Event("input"));
      SPACEAMP.update(SPACEAMP.getState(), false, {
        playbackStatus: "loading",
      });
    }, action);
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), false);
    assert.equal(
      await page
        .getByRole("button", {
          name: "Pausar",
          exact: true,
        })
        .count(),
      1,
    );
    const loadingDraws = await page.evaluate(() => __dynamicDraws);
    await page.waitForFunction((before) => __dynamicDraws > before, loadingDraws);
    assert.ok(
      (await page.evaluate(() => __dynamicDraws)) > loadingDraws,
      "YouTube buffering must not freeze atmosphere",
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Pausar",
          exact: true,
        })
        .evaluate((n) => n.getBoundingClientRect().width),
      playingWidth,
    );
    await page.evaluate(() =>
      SPACEAMP.update(SPACEAMP.getState(), true, {
        playbackStatus: "",
      }),
    );
  }
  await page.evaluate(() =>
    SPACEAMP.update(SPACEAMP.getState(), false, {
      playbackStatus: "loading",
    }),
  );
  await page
    .getByRole("button", {
      name: "Pausar",
      exact: true,
    })
    .click();
  const pausedBufferDraws = await page.evaluate(() => __dynamicDraws);
  // Negative observation: explicit pause must keep the GPU frozen during buffering.
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(() => __dynamicDraws),
    pausedBufferDraws,
    "Explicit pause during buffering freezes atmosphere",
  );
  assert.equal(
    await page
      .getByRole("button", {
        name: "Reproduzir",
        exact: true,
      })
      .evaluate((n) => n.getBoundingClientRect().width),
    playingWidth,
  );
  await page
    .getByRole("button", {
      name: "Reproduzir",
      exact: true,
    })
    .click();
  // Both navigation actions load a new track without flashing Reproduzir.
  await page.evaluate(() => {
    window.__navigationIndex = 0;
    SPACEAMP.setNavigation(
      Object.fromEntries(
        ["next", "previous"].map((action) => [
          action,
          async () => {
            SPACEAMP.update(
              {
                ...SPACEAMP.getState(),
                title: "Navigation " + ++__navigationIndex,
                sourceUrl: "navigation-" + __navigationIndex,
                source: "YouTube",
              },
              false,
              {
                playbackStatus: "",
                stopped: false,
              },
            );
            await new Promise((r) => setTimeout(r, 150));
            SPACEAMP.update(SPACEAMP.getState(), false, {
              playbackStatus: "loading",
            });
          },
        ]),
      ),
    );
    window.__transportLabels = [];
    new MutationObserver(() =>
      __transportLabels.push(document.querySelector(".np-play-toggle").textContent),
    ).observe(document.querySelector(".np-play-toggle"), {
      childList: true,
      subtree: true,
    });
  });
  for (const label of ["Próxima", "Anterior"]) {
    await page.evaluate(() => {
      __transportLabels.length = 0;
    });
    await page
      .getByRole("button", {
        name: label,
        exact: true,
      })
      .click();
    await page.waitForFunction(() => SPACEAMP.getPlaybackState().playbackStatus === "loading");
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), false);
    assert.equal(
      await page
        .getByRole("button", {
          name: "Pausar",
          exact: true,
        })
        .count(),
      1,
    );
    assert.equal(await page.evaluate(() => __transportLabels.includes("Reproduzir")), false);
    await page.evaluate(() =>
      SPACEAMP.update(SPACEAMP.getState(), true, {
        playbackStatus: "",
      }),
    );
  }
  // Explicit pause and provider failure cancel navigation presentation immediately.
  await page
    .getByRole("button", {
      name: "Próxima",
      exact: true,
    })
    .click();
  await page.waitForFunction(() => SPACEAMP.getPlaybackState().playbackStatus === "loading");
  await page
    .getByRole("button", {
      name: "Pausar",
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .getByRole("button", {
        name: "Reproduzir",
        exact: true,
      })
      .count(),
    1,
  );
  await page
    .getByRole("button", {
      name: "Anterior",
      exact: true,
    })
    .click();
  await page.waitForFunction(() => SPACEAMP.getPlaybackState().playbackStatus === "loading");
  await page.evaluate(() =>
    SPACEAMP.update(SPACEAMP.getState(), false, {
      playbackStatus: "blocked",
    }),
  );
  assert.equal(
    await page
      .getByRole("button", {
        name: "Reproduzir",
        exact: true,
      })
      .count(),
    1,
  );
  await page.evaluate(() =>
    SPACEAMP.update(SPACEAMP.getState(), true, {
      playbackStatus: "",
    }),
  );
};
