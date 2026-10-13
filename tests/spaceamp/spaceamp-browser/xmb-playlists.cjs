"use strict";

const assert = require("node:assert/strict");

module.exports = async function ({ page, action }) {
  await page.evaluate(() => {
    window.__xmbPlayedPlaylists = [];
    window.__xmbPlaylists = [
      {
        id: "mix-id",
        name: "Road Mix",
        tracks: [
          { id: "mix-track-1", title: "Track One", artist: "Fixture Artist" },
          { id: "mix-track-2", title: "Track Two", artist: "Fixture Artist" },
        ],
      },
    ];
    MusicBridge.getPlaylists = () => __xmbPlaylists;
    MusicBridge.playPlaylist = async (id, startIndex) => {
      __xmbPlayedPlaylists.push([id, startIndex]);
      SPACEAMP.update(
        { title: "Track One", artist: "Fixture Artist", source: "local" },
        true,
        { available: true },
      );
    };
    __xmb.enter();
    const xmbViews = document.querySelectorAll(".xmb");
    xmbViews[xmbViews.length - 1].id = "xmb-fixture";
  });
  const root = page.locator("#xmb-fixture");
  await root.locator('.xmb-category[data-category="profile"]').click();
  await root.locator('.xmb-category[data-category="music"]').click();
  assert.equal(await root.getAttribute("data-level"), "folders");
  assert.deepEqual(await root.locator("[data-folder] .xmb-item-title").allTextContents(), [
    "Músicas",
    "Álbuns",
    "Artistas",
    "Playlists",
  ]);

  await root.locator('.xmb-item[data-folder="playlists"]').click();
  await action("primary");
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#xmb-fixture");
      return root?.dataset.folderDepth === "true" && root.dataset.folderTransition !== "true";
    },
    null,
    { polling: "raf" },
  );
  assert.deepEqual(await root.locator(".xmb-item-title").allTextContents(), ["Road Mix"]);
  assert.equal(await root.locator(".xmb-detail h2").textContent(), "Road Mix");
  assert.match(await root.locator(".xmb-detail").textContent(), /Track One/);

  await action("primary");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  assert.deepEqual(await page.evaluate(() => __xmbPlayedPlaylists), [["mix-id", 0]]);
};
