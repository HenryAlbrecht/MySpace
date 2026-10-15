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
      {
        id: "single-id",
        name: "Single Track",
        tracks: [{ id: "only-track", title: "Only Track" }],
      },
    ];
    MusicBridge.getPlaylists = () => __xmbPlaylists;
    MusicBridge.getPlaylistCover = (id) =>
      id === "mix-id" ? "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" : "";
    MusicBridge.playPlaylist = async (id, startIndex) => {
      __xmbPlayedPlaylists.push([id, startIndex]);
      const track = __xmbPlaylists.find((playlist) => playlist.id === id).tracks[startIndex];
      SPACEAMP.update(
        { title: track.title, artist: track.artist, source: "local" },
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
  assert.deepEqual(await root.locator(".xmb-item-title").allTextContents(), [
    "Road Mix",
    "Single Track",
  ]);
  const playlistArtwork = await root.locator('.xmb-item[data-item-id="mix-id"] img').evaluate((image) => ({
    source: image.dataset.artworkSource,
    src: image.getAttribute("src"),
    itemSource: MusicBridge.getPlaylistCover("mix-id"),
  }));
  assert.equal(
    playlistArtwork.src,
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    "The XMB playlist item uses the playlist cover from MusicBridge: " + JSON.stringify(playlistArtwork),
  );
  assert.equal(await root.locator(".xmb-detail h2").textContent(), "Road Mix");
  assert.match(await root.locator(".xmb-detail").textContent(), /Track One/);

  await action("primary");
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#xmb-fixture");
      return root?.dataset.playlistTrackDepth === "true" && root.dataset.folderTransition !== "true";
    },
    null,
    { polling: "raf" },
  );
  assert.deepEqual(await root.locator(".xmb-item-title").allTextContents(), [
    "Track One",
    "Track Two",
  ]);
  assert.deepEqual(await page.evaluate(() => __xmbPlayedPlaylists), []);

  await action("back");
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#xmb-fixture");
      return root?.dataset.playlistTrackDepth === "false" && root.dataset.folderTransition !== "true";
    },
    null,
    { polling: "raf" },
  );
  assert.deepEqual(await root.locator(".xmb-item-title").allTextContents(), [
    "Road Mix",
    "Single Track",
  ]);

  await action("primary");
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#xmb-fixture");
      return root?.dataset.playlistTrackDepth === "true" && root.dataset.folderTransition !== "true";
    },
    null,
    { polling: "raf" },
  );
  await action("down");
  assert.equal(await root.locator('.xmb-item[aria-pressed="true"] .xmb-item-title').textContent(), "Track Two");
  await action("primary");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  assert.deepEqual(await page.evaluate(() => __xmbPlayedPlaylists), [["mix-id", 1]]);
  assert.equal(await page.evaluate(() => SPACEAMP.getPlaybackState().title), "Track Two");

  await page.evaluate(() => SpaceAmpNowPlaying.close());
  await page.waitForFunction(
    () =>
      !SpaceAmpNowPlaying.isOpen() &&
      document.querySelector("#xmb-fixture")?.dataset.playlistTrackDepth === "true",
  );
  assert.equal(
    await root.locator('.xmb-item[aria-pressed="true"] .xmb-item-title').textContent(),
    "Track Two",
  );

  await action("back");
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#xmb-fixture");
      return root?.dataset.playlistTrackDepth === "false" && root.dataset.folderTransition !== "true";
    },
    null,
    { polling: "raf" },
  );
  await action("down");
  assert.equal(
    await root.locator('.xmb-item[aria-pressed="true"] .xmb-item-title').textContent(),
    "Single Track",
  );
  await action("primary");
  await page.waitForSelector("#spaceampNowPlaying[open]");
  assert.deepEqual(await page.evaluate(() => __xmbPlayedPlaylists), [
    ["mix-id", 1],
    ["single-id", 0],
  ]);
};
