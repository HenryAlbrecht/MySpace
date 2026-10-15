const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
(async () => {
  let browser, backupPath;
  const web = createServer();
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const base = "http://127.0.0.1:" + web.address().port,
      source = await browser.newContext(),
      target = await browser.newContext(),
      a = await source.newPage(),
      b = await target.newPage(),
      errors = [];
    for (const page of [a, b]) page.on("pageerror", (e) => errors.push(e.message));
    await a.goto(base, { waitUntil: "domcontentloaded" });
    await a.evaluate(async () => {
      await MediaStorage.put(
        "backup-audio",
        new Blob([new Uint8Array([1, 3, 5, 7])], { type: "audio/mpeg" }),
      );
      const profile = JSON.parse(localStorage.getItem("myspace-profile-v1") || "{}");
      profile.name = "Backup fixture";
      localStorage.setItem("myspace-profile-v1", JSON.stringify(profile));
      const coverReference = "appearance-art:backup-playlist-cover",
        coverBlob = await (await fetch("/profile-art.png")).blob(),
        preparedCover = await XmbArtworkStorage.prepare(coverBlob, coverReference);
      await MediaStorage.putMany(preparedCover.entries);
      CollectionActions.saveMusic({
        kind: "music",
        catalogId: "ytmusic:video:dQw4w9WgXcQ",
        title: "Saved song",
        artist: "Artist",
        image: "profile-art.png",
        featured: true,
        notes: "Personal note",
        playbackSource: { type: "local", fileRef: "backup-audio" },
      });
      const extras = JSON.parse(localStorage.getItem("myspace-extras-v1"));
      extras.items.push({
        ...extras.items[0],
        id: "youtube-fixture",
        catalogId: "ytmusic:video:oHg5SJYRHA0",
        title: "YouTube Music song",
        playbackSource: {
          type: "youtube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      });
      const playlistTracks = [
        {
          id: "linked-track",
          title: "Linked track",
          catalogId: "ytmusic:video:dQw4w9WgXcQ",
          albumTitle: "Album title",
          trackDuration: 210,
          album: "profile-art.png",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          artist: "Artist",
        },
        {
          id: "local-track",
          title: "Local track",
          fileRef: "backup-audio",
          local: true,
          fileName: "song.mp3",
          artist: "Artist",
        },
      ];
      extras.featuredMusic = {
        id: "featured-track",
        kind: "music",
        catalogId: "ytmusic:video:dQw4w9WgXcQ",
        title: "Featured song",
        artist: "Artist",
        image: "profile-art.png",
        playbackSource: { type: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      };
      extras.appearance = { opacity: 65, accent: "#2288ff" };
      extras.playlists = [
        {
          id: "road-trip",
          name: "Road trip",
          tracks: playlistTracks,
        },
        {
          id: "cover-playlist",
          name: "Cover Playlist",
          tracks: [],
          cover: { mode: "custom", reference: coverReference },
          createdAt: 1,
        },
      ];
      localStorage.setItem("myspace-extras-v1", JSON.stringify(extras));
      localStorage.setItem("spaceamp-party-music-v1", "false");
      localStorage.setItem("spaceamp-global-controls-v1", "false");
      localStorage.setItem("spaceamp-youtube-cover-v1", "true");
      localStorage.setItem("myspace-collection-view", "list");
    });
    await a.reload();
    const downloadWait = a.waitForEvent("download");
    await a.getByRole("button", { name: "backup com arquivos", exact: true }).click();
    const download = await downloadWait;
    fs.mkdirSync("artifacts/backup-review", { recursive: true });
    backupPath = path.resolve("artifacts/backup-review/roundtrip.myspace");
    await download.saveAs(backupPath);
    await b.goto(base, { waitUntil: "domcontentloaded" });
    assert.equal(await b.evaluate(() => CollectionActions.getItems().length), 0);
    await b
      .locator('input[accept="application/json,.json,.myspace"]')
      .setInputFiles(backupPath);
    await b.locator("dialog[open]").getByRole("button", { name: "salvar", exact: true }).click();
    await b.waitForFunction(() => CollectionActions.getItems().length === 2);
    const restored = await b.evaluate(async () => ({
      profile: JSON.parse(localStorage.getItem("myspace-profile-v1")),
      extras: JSON.parse(localStorage.getItem("myspace-extras-v1")),
      preferences: TitlePreferences.collect(),
      bytes: Array.from(
        new Uint8Array(await (await MediaStorage.get("backup-audio")).arrayBuffer()),
      ),
      coverBytes: await MediaStorage.get("appearance-art:backup-playlist-cover")?.then((file) => file.size) || 0,
      shared: SPACEAMP.getState().shared,
      checkbox: document.querySelector("#showGlobalSpaceAmp").checked,
    }));
    assert.equal(restored.profile.name, "Backup fixture");
    const playlist = restored.extras.playlists.find((playlist) => playlist.name === "Road trip");
    assert.deepEqual(playlist.tracks.map((track) => track.id), ["linked-track", "local-track"]);
    assert.equal(playlist.tracks[0].catalogId, "ytmusic:video:dQw4w9WgXcQ");
    assert.equal(playlist.tracks[0].albumTitle, "Album title");
    assert.equal(playlist.tracks[0].trackDuration, 210);
    assert.equal(playlist.tracks[0].album, "profile-art.png");
    assert.equal(playlist.tracks[1].fileRef, "backup-audio");
    assert.equal(playlist.cover.mode, "auto", "A current playlist without a cover uses automatic artwork");
    const coverPlaylist = restored.extras.playlists.find((playlist) => playlist.name === "Cover Playlist");
    assert.deepEqual(coverPlaylist.cover, {
      mode: "custom",
      reference: "appearance-art:backup-playlist-cover",
    });
    assert.ok(restored.coverBytes > 0, "The .myspace package restores custom cover bytes");
    assert.equal(Object.hasOwn(restored.extras, "tracks"), false);
    assert.equal(Object.hasOwn(restored.extras, "activeTrack"), false);
    assert.equal(Object.hasOwn(restored.extras, "startTrack"), false);
    assert.equal(Object.hasOwn(restored.extras, "musicMigrationVersion"), false);
    assert.equal(restored.extras.featuredMusic.title, "Featured song");
    assert.equal(restored.extras.items[0].notes, "Personal note");
    assert.equal(restored.extras.items[0].featured, true);
    assert.equal(restored.extras.items[1].catalogId, "ytmusic:video:oHg5SJYRHA0");
    assert.equal(restored.extras.appearance.opacity, 65);
    assert.deepEqual(restored.bytes, [1, 3, 5, 7]);
    assert.equal(restored.preferences["spaceamp-youtube-cover-v1"], "true");
    assert.equal(restored.preferences["myspace-collection-view"], "list");
    assert.equal(restored.shared, false);
    assert.equal(restored.checkbox, false);
    assert.equal(await b.evaluate(() => SPACEAMP.getState().queue.length), 0);
    await b.reload();
    assert.equal(await b.evaluate(() => SPACEAMP.getState().shared), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real package export/import into empty independent context; current playlist/artwork, collection, featured music, local media bytes, profile, appearance and SPACEAMP settings; zero page errors.",
    );
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
    if (backupPath) fs.rmSync(backupPath, { force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
