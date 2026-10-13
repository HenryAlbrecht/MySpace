"use strict";

const assert = require("node:assert/strict"),
  path = require("node:path");

async function windows({ page, playLocal }) {
  const snapshot = () =>
    page.evaluate(() => ({
      title: SPACEAMP.getPlaybackState().title,
      playing: SPACEAMP.getPlaybackState().playing,
      players: document.querySelectorAll("audio, iframe").length,
      queue: SPACEAMP.getState().queue.map((track) => track.id),
      context: SPACEAMP.getState().playbackContext?.sourceId || "",
    }));
  await playLocal();
  const before = await snapshot();

  await page.locator("#spaceAmpOpenLibrary").click();
  const library = page.locator("#spaceAmpLibrary");
  await library.waitFor({ state: "visible" });
  assert.deepEqual(await snapshot(), before, "Opening the Library preserves playback");
  assert.equal(await page.locator("#music .saved-playlists-fold").count(), 0);
  await library.getByRole("button", { name: "＋ Nova playlist" }).click();
  const nameDialog = page.locator(".spaceamp-playlist-name-dialog");
  await nameDialog.getByLabel("Nome da playlist").fill("Cancelled Mix");
  await nameDialog.getByLabel("Nome da playlist").press("Escape");
  await nameDialog.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("myspace-extras-v1")).playlists.length), 0);
  await library.getByRole("button", { name: "＋ Nova playlist" }).click();
  await nameDialog.getByLabel("Nome da playlist").fill("Fixture Mix");
  await nameDialog.getByLabel("Nome da playlist").press("Enter");
  await nameDialog.waitFor({ state: "hidden" });
  assert.equal(await library.locator(".spaceamp-library-heading h2").textContent(), "Fixture Mix");
  const cover = library.locator(".spaceamp-library-hero .spaceamp-playlist-cover");
  assert.equal(await cover.getAttribute("data-cover-count"), "0");

  await page.evaluate(() => {
    window.__oldSearchResult = {
      id: "stale-result",
      kind: "music",
      title: "Stale result",
      artist: "Fixture Artist",
      catalogId: "ytmusic:video:AAAAAAAAAAA",
    };
    window.__freshSearchResult = {
      id: "fresh-result",
      kind: "music",
      title: "Fresh result",
      artist: "Fixture Artist",
      catalogId: "ytmusic:video:BBBBBBBBBBB",
    };
    Catalog.searchPage = async (_kind, query, options = {}) => {
      if (query === "old query")
        return new Promise((resolve) => {
          window.__resolveOldSearch = resolve;
        });
      if (query === "fresh query") return { items: [window.__freshSearchResult], next: null };
      const tracks = [
        {
          id: "search-1",
          kind: "music",
          title: "Fixture Track 1",
          artist: "Fixture Artist",
          albumTitle: "Fixture Album",
          trackDuration: 201,
          catalogId: "ytmusic:video:dQw4w9WgXcQ",
          image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        },
        {
          id: "search-2",
          kind: "music",
          title: "Fixture Track 2",
          artist: "Fixture Artist",
          albumTitle: "Fixture Album",
          trackDuration: 202,
          catalogId: "ytmusic:video:M7lc1UVf-VE",
          image: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
        },
        {
          id: "search-3",
          kind: "music",
          title: "Fixture Track 3",
          artist: "Fixture Artist",
          albumTitle: "Fixture Album",
          trackDuration: 203,
          catalogId: "ytmusic:video:9bZkp7q19f0",
          image: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
        },
        {
          id: "search-4",
          kind: "music",
          title: "Fixture Track 4",
          artist: "Fixture Artist",
          albumTitle: "Fixture Album",
          trackDuration: 204,
          catalogId: "ytmusic:video:3JZ_D3ELwOQ",
          image: "https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg",
        },
        {
          id: "search-5",
          kind: "music",
          title: "Fixture Track 5",
          artist: "Fixture Artist",
          albumTitle: "Fixture Album",
          trackDuration: 205,
          catalogId: "ytmusic:video:JGwWNGJdvx8",
          image: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
        },
      ];
      return options.cursor
        ? { items: tracks.slice(3), next: null }
        : { items: tracks.slice(0, 3), next: "fixture-page-2" };
    };
  });
  const search = library.getByLabel("Buscar músicas para a playlist");
  await search.fill("old query");
  await page.waitForFunction(() => typeof window.__resolveOldSearch === "function");
  await search.fill("fresh query");
  await library.getByText("Fresh result", { exact: true }).waitFor();
  await page.evaluate(() => window.__resolveOldSearch({ items: [window.__oldSearchResult], next: null }));
  await page.waitForTimeout(40);
  assert.equal(await library.getByText("Stale result", { exact: true }).count(), 0);
  assert.equal(await library.getByText("Fresh result", { exact: true }).count(), 1);

  await search.fill("fixture");
  await library.getByText("Fixture Track 3", { exact: true }).waitFor();
  assert.equal(await library.locator(".spaceamp-library-search-result").count(), 3);
  await library.getByRole("button", { name: "mostrar mais" }).click();
  await library.getByText("Fixture Track 5", { exact: true }).waitFor();
  assert.equal(await library.locator(".spaceamp-library-search-result").count(), 5);
  assert.equal(await snapshot().then((state) => state.title), before.title);
  assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
  for (let index = 1; index <= 5; index++) {
    await library.getByRole("button", { name: "Adicionar à playlist: Fixture Track " + index }).click();
    assert.equal(await cover.getAttribute("data-cover-count"), String(Math.min(index, 4)));
  }
  assert.deepEqual(await snapshot(), before, "Adding search results does not start playback or edit its queue");
  assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
  assert.equal(
    await library.getByRole("button", { name: "Já adicionada: Fixture Track 1" }).isDisabled(),
    true,
    "A result already in the playlist cannot be added again",
  );
  const storedPlaylist = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("myspace-extras-v1")).playlists[0]);
  assert.equal((await storedPlaylist()).tracks.length, 5);
  assert.equal((await storedPlaylist()).tracks[0].collectionId, "");

  await library.locator(".spaceamp-library-menu > summary").click();
  await library.getByRole("button", { name: "Renomear" }).click();
  await nameDialog.getByLabel("Nome da playlist").fill("Renamed Mix");
  await nameDialog.getByLabel("Nome da playlist").press("Enter");
  await nameDialog.waitFor({ state: "hidden" });
  assert.equal(await library.locator(".spaceamp-library-heading h2").textContent(), "Renamed Mix");

  await page.evaluate(() => {
    for (let index = 1; index <= 41; index++)
      CollectionActions.quickAdd({
        id: "collection-fixture-" + index,
        kind: "music",
        title: "Local Fixture " + index,
        artist: "Local Artist",
      });
  });
  await library.getByLabel("Origem da busca musical").selectOption("collection");
  await search.fill("Local Fixture");
  await library.getByText("Local Fixture 40", { exact: true }).waitFor();
  assert.equal(await library.locator(".spaceamp-library-search-result").count(), 40);
  await library.getByRole("button", { name: "mais da Collection" }).click();
  await library.getByText("Local Fixture 41", { exact: true }).waitFor();
  assert.equal(await library.locator(".spaceamp-library-search-result").count(), 41);
  await library.getByRole("button", { name: "Adicionar à playlist: Local Fixture 1", exact: true }).click();
  assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 42);
  const savedCollectionId = await page.evaluate(
    () => CollectionActions.getItems().find((item) => item.title === "Local Fixture 1").id,
  );
  assert.equal((await storedPlaylist()).tracks.find((track) => track.title === "Local Fixture 1").collectionId, savedCollectionId);
  await search.fill("");
  await library.getByLabel("Origem da busca musical").selectOption("youtube");

  await library.locator(".spaceamp-library-edit-cover").click();
  const coverDialog = page.locator(".spaceamp-cover-dialog"),
    trackChoice = coverDialog.getByLabel("Artwork de uma música da playlist");
  await trackChoice.selectOption({ index: 1 });
  await coverDialog.getByRole("button", { name: "Usar artwork da música" }).click();
  await coverDialog.waitFor({ state: "hidden" });
  let playlist = await storedPlaylist();
  assert.equal(playlist.cover.mode, "track");
  const chosenArtwork = playlist.cover.image;
  const firstRow = library.locator(".spaceamp-library-row").filter({ hasText: "Fixture Track 1" });
  await firstRow.locator(".spaceamp-library-track-menu > summary").click();
  await firstRow.getByRole("button", { name: "Remover da playlist" }).click();
  playlist = await storedPlaylist();
  assert.equal(playlist.tracks.length, 5);
  assert.equal(playlist.cover.mode, "track");
  assert.equal(playlist.cover.image, chosenArtwork, "Removing its track preserves the selected artwork");
  assert.equal(
    await page.evaluate((id) => MusicBridge.getPlaylistCover(id), playlist.id),
    chosenArtwork,
    "The XMB bridge keeps the selected artwork when its source track is removed",
  );

  await library.locator(".spaceamp-library-edit-cover").click();
  const coverFile = coverDialog.locator('input[type="file"]');
  await coverFile.setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await coverDialog.getByText(/conteúdo do arquivo/i).waitFor();
  await coverFile.setInputFiles(path.resolve(__dirname, "../../../dist/profile-art.png"));
  const apply = coverDialog.getByRole("button", { name: "Aplicar imagem" });
  await page.waitForFunction(() => {
    const dialog = document.querySelector(".spaceamp-cover-dialog");
    return [...dialog.querySelectorAll("button")].some((button) => button.textContent === "Aplicar imagem" && !button.disabled);
  });
  await apply.click();
  await coverDialog.waitFor({ state: "hidden" });
  playlist = await storedPlaylist();
  assert.equal(playlist.cover.mode, "custom");
  const firstCoverReference = playlist.cover.reference;
  assert.equal(
    await page.evaluate(async (reference) => !!(await MediaStorage.get(reference)), firstCoverReference),
    true,
  );

  await library.locator(".spaceamp-library-edit-cover").click();
  await coverFile.setInputFiles(path.resolve(__dirname, "../../../dist/profile-art.png"));
  await page.waitForFunction(() => {
    const dialog = document.querySelector(".spaceamp-cover-dialog");
    return [...dialog.querySelectorAll("button")].some((button) => button.textContent === "Aplicar imagem" && !button.disabled);
  });
  await apply.click();
  await coverDialog.waitFor({ state: "hidden" });
  playlist = await storedPlaylist();
  assert.equal(playlist.cover.mode, "custom");
  assert.notEqual(playlist.cover.reference, firstCoverReference);
  await page.waitForFunction(
    async (reference) => !(await MediaStorage.get(reference)),
    firstCoverReference,
  );
  assert.equal(await cover.locator("img").count(), 1);

  await library.getByRole("button", { name: "Fechar biblioteca musical" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.CollectionActions && document.getElementById("spaceAmpOpenLibrary"));
  await page.locator("#spaceAmpOpenLibrary").click();
  await library.waitFor({ state: "visible" });
  playlist = await storedPlaylist();
  assert.equal(playlist.cover.mode, "custom", "Custom cover metadata survives reload");
  assert.equal(
    await page.evaluate(async (reference) => !!(await MediaStorage.get(reference)), playlist.cover.reference),
    true,
    "Custom cover bytes survive reload in IndexedDB",
  );
  const persistedCoverReference = playlist.cover.reference;
  await library.locator(".spaceamp-library-edit-cover").click();
  await page.locator(".spaceamp-cover-dialog").getByRole("button", { name: "Usar capa automática" }).click();
  await page.locator(".spaceamp-cover-dialog").waitFor({ state: "hidden" });
  assert.equal((await storedPlaylist()).cover.mode, "auto");
  await page.waitForFunction(async (reference) => !(await MediaStorage.get(reference)), persistedCoverReference);

  const desktopViewport = page.viewportSize();
  await page.setViewportSize({ width: 560, height: 880 });
  const responsiveLayout = await library.locator(".spaceamp-library-layout").evaluate((layout) => ({
    display: getComputedStyle(layout).display,
    overflow: layout.scrollWidth - layout.clientWidth,
  }));
  assert.equal(responsiveLayout.display, "flex", "The library stacks its navigation on narrow screens");
  assert.ok(responsiveLayout.overflow <= 1, "The library does not overflow horizontally on narrow screens");
  await page.setViewportSize(desktopViewport);

  await page.evaluate(() => {
    window.Catalog = {
      ...window.Catalog,
      peekCore: () => null,
      prefetchCore: async (item) => ({
        ...item,
        playbackSource: {
          type: "youtube",
          url: "https://music.youtube.com/watch?v=9bZkp7q19f0",
        },
      }),
      enrich: async (item) => item,
      details: async (item) => item,
    };
  });
  const preparedTrack = await page.evaluate(async () => {
    const track = MusicBridge.getPlaylists()[0].tracks.find((item) => item.title === "Fixture Track 3"),
      prepared = await MusicBridge.prepareTrack(track);
    return {
      title: prepared.title,
      source: prepared.playbackSource,
      playable: MusicBridge.canPlay(prepared),
    };
  });
  assert.equal(
    preparedTrack.title,
    "Fixture Track 3",
    "Playlist playback preparation preserves the selected playlist track",
  );
  assert.deepEqual(preparedTrack.source, {
    type: "youtube",
    url: "https://music.youtube.com/watch?v=9bZkp7q19f0",
  });
  assert.equal(preparedTrack.playable, true);
  const selectedRow = library.locator('button.spaceamp-library-track[title="Fixture Track 3"]');
  await selectedRow.click();
  await page.waitForFunction(() => SPACEAMP.getPlaybackState().title === "Fixture Track 3");
  await page.waitForFunction(() => SPACEAMP.getPlaybackState().available);
  const playingPlaylist = await snapshot();
  assert.equal(await page.evaluate(() => SPACEAMP.getState().playbackContext?.title), "Renamed Mix");
  assert.equal(await page.evaluate(() => SPACEAMP.getState().queue.length), 5);
  const activeQueueIds = await page.evaluate(() => SPACEAMP.getState().queue.map((track) => track.id));
  const fifthRow = library.locator(".spaceamp-library-row").filter({ hasText: "Fixture Track 5" });
  await fifthRow.getByRole("button", { name: "Mover para cima: Fixture Track 5" }).click();
  assert.deepEqual(
    await page.evaluate(() => SPACEAMP.getState().queue.map((track) => track.id)),
    activeQueueIds,
    "Reordering the saved playlist does not mutate its active queue snapshot",
  );
  assert.deepEqual(await snapshot(), playingPlaylist);

  await library.getByRole("button", { name: "Fechar biblioteca musical" }).click();
  await page.locator("#spaceAmpOpenQueue").click();
  const queue = page.locator("#spaceAmpQueue");
  await queue.waitFor({ state: "visible" });
  assert.deepEqual(await snapshot(), playingPlaylist, "Opening the Queue preserves playback");
  assert.equal(await queue.locator(".spaceamp-queue-row").count(), 3);
  assert.match(await queue.locator(".spaceamp-queue-context").innerText(), /Renamed Mix/);
  assert.match(await queue.locator(".spaceamp-queue-current").innerText(), /Fixture Track 3/);
  assert.equal(await queue.getByRole("button", { name: "Faixa anterior" }).count(), 1);
  assert.equal(await queue.getByRole("button", { name: "Próxima faixa" }).count(), 1);
  await queue.getByRole("button", { name: "Fechar fila de reprodução" }).click();
  assert.deepEqual(await snapshot(), playingPlaylist, "Closing both windows preserves playback");

  await page.locator("#spaceAmpOpenLibrary").click();
  await library.waitFor({ state: "visible" });
  page.once("dialog", (dialog) => dialog.accept());
  await library.locator(".spaceamp-library-menu > summary").click();
  await library.getByRole("button", { name: "Excluir" }).click();
  assert.equal(await library.locator(".spaceamp-library-empty").count(), 1);
  assert.equal(await page.evaluate(async (reference) => !!(await MediaStorage.get(reference)), persistedCoverReference), false);
  assert.deepEqual(await snapshot(), playingPlaylist, "Deleting the saved playlist does not stop its active session");
}

module.exports = { windows };
