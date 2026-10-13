/* Playlist e integração com o player; o perfil fornece seus dados por callbacks. */
function createPlaylistController({ getData, save, move, confirmDelete, el, button, uid }) {
  let selection = 0,
    previewing = false;
  const queueManager = window.QueueManager.create({
    onChange: renderPlaylist,
  });
  const queueTracks = () => queueManager.snapshot().queue;
  const mediaUrls = new Map(),
    mediaReads = new Map();
  let mediaRevision = 0;
  let requestedTrack = null,
    metadataTimer = 0,
    metadataAbort = null;
  let contextAbort = null,
    nextRequest = null;
  function cancelMetadata() {
    clearTimeout(metadataTimer);
    metadataAbort?.abort();
    metadataAbort = null;
  }
  function enrichTrack(track, token) {
    const catalogId = track.metadataSources?.catalogId;
    const storedTrack = window.CollectionActions?.getItems().find(
      (item) => item.id === track.collectionId,
    );
    const provenance = track.isrcSource || storedTrack?.isrcSource;
    const version = track.isrcLookupVersion || storedTrack?.isrcLookupVersion;
    if (
      (track.isrc && !(provenance === "MusicBrainz" && version !== 11)) ||
      !MusicModel.validCatalogId("music", catalogId || "")
    )
      return;
    metadataTimer = setTimeout(async () => {
      const controller = (metadataAbort = new AbortController());
      try {
        const detail = await Catalog.details(
          {
            kind: "music",
            catalogId,
            title: track.title,
            artist: track.artist,
            albumTitle: track.albumTitle,
          },
          { signal: controller.signal },
        );
        if (token !== selection || controller.signal.aborted) return;
        const identifier = MusicModel.library(detail).isrc;
        if (!identifier) return;
        track.isrc = identifier;
        track.isrcSource = detail.isrcSource;
        track.isrcLookupVersion = detail.isrcLookupVersion;
        const stored = window.CollectionActions?.getItems().find(
          (item) =>
            item.id === track.collectionId && item.kind === "music" && item.catalogId === catalogId,
        );
        if (
          stored &&
          (!stored.isrc || (stored.isrcSource === "MusicBrainz" && detail.isrcSource === "lrc.red"))
        )
          window.CollectionActions.updateItem(stored.id, {
            isrc: identifier,
            isrcSource: detail.isrcSource,
            isrcRecordingId: detail.isrcRecordingId,
            isrcLookupVersion: detail.isrcLookupVersion,
          });
        if (ytTrack) ytTrack = { ...ytTrack, isrc: identifier };
        window.SpaceAmpHost.updateMetadata({ isrc: identifier });
      } catch {
        /* Optional metadata must not delay or interrupt playback. */
      } finally {
        if (metadataAbort === controller) metadataAbort = null;
      }
    }, 150);
  }
  let draggedTrack = null;
  function reorderTrack(id, targetId) {
    const tracks = queueTracks(),
      from = tracks.findIndex((t) => t.id === id),
      to = tracks.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    queueManager.reorder(from, to);
  }
  function removeFromQueue(id) {
    const tracks = queueTracks(),
      index = tracks.findIndex((t) => t.id === id);
    if (index < 0) return;
    queueManager.remove(index);
    toast("Removida da fila. A coleção e as playlists foram mantidas.");
  }
  const mediaOperation = (mode, id, value) =>
    mode === "readonly"
      ? MediaStorage.get(id)
      : value === undefined
        ? MediaStorage.remove(id)
        : MediaStorage.put(id, value);
  const deleteMedia = (id) => {
    if (window.CollectionActions?.getItems().some((item) => item.playbackSource?.fileRef === id))
      return;
    if (mediaUrls.has(id)) {
      URL.revokeObjectURL(mediaUrls.get(id));
      mediaUrls.delete(id);
    }
    mediaOperation("readwrite", id).catch(() => {});
  };
  let selectedPlaylistId = "",
    librarySearchTimer = 0,
    librarySearchController = null,
    librarySearchRevision = 0,
    librarySearchMode = "youtube",
    librarySearchCursor = "",
    librarySearchPages = 0,
    librarySearchResults = [],
    librarySearchCursors = new Set(),
    libraryCollectionOffset = 0,
    libraryCollectionTotal = 0,
    playlistNameAction = null,
    playlistNameRestore = null,
    coverPreviewUrl = "",
    coverDialogRestore = null,
    pendingCoverFile = null;
  const playlistNameDialog = el("dialog", "music-link-dialog spaceamp-playlist-name-dialog"),
    playlistNameForm = el("form"),
    playlistNameTitle = el("h2"),
    playlistNameInput = el("input"),
    playlistNameStatus = el("p", "title-notice"),
    playlistNameActions = el("div", "form-actions"),
    playlistNameCancel = button("cancelar", () => playlistNameDialog.close()),
    playlistNameSubmit = button("salvar", () => playlistNameForm.requestSubmit());
  playlistNameInput.maxLength = 120;
  playlistNameInput.setAttribute("aria-label", "Nome da playlist");
  playlistNameInput.placeholder = "Nome da playlist";
  playlistNameStatus.setAttribute("role", "status");
  playlistNameForm.onsubmit = (event) => {
    event.preventDefault();
    const value = playlistNameInput.value.trim().slice(0, 120);
    if (!value) {
      playlistNameStatus.textContent = "Digite um nome para a playlist.";
      playlistNameInput.focus();
      return;
    }
    try {
      playlistNameAction?.(value);
      playlistNameDialog.close();
    } catch (error) {
      playlistNameStatus.textContent = error.message;
    }
  };
  playlistNameActions.append(playlistNameCancel, playlistNameSubmit);
  playlistNameForm.append(playlistNameTitle, playlistNameInput, playlistNameStatus, playlistNameActions);
  playlistNameDialog.append(playlistNameForm);
  document.body.append(playlistNameDialog);
  playlistNameDialog.addEventListener("close", () => {
    playlistNameAction = null;
    if (playlistNameRestore?.isConnected)
      playlistNameRestore.focus({ preventScroll: true });
    else libraryNavList.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    playlistNameRestore = null;
  });
  function openPlaylistNameDialog({ title, value = "", action, restore }) {
    playlistNameTitle.textContent = title;
    playlistNameInput.value = value;
    playlistNameStatus.textContent = "";
    playlistNameAction = action;
    playlistNameRestore = restore || document.activeElement;
    playlistNameDialog.showModal();
    playlistNameInput.focus({ preventScroll: true });
    playlistNameInput.select();
  }
  function openNewPlaylistDialog() {
    openPlaylistNameDialog({
      title: "Nova playlist",
      action: (name) => {
        const playlist = createPlaylist(name);
        selectedPlaylistId = playlist.id;
        renderSavedPlaylists();
      },
      restore: newPlaylistButton,
    });
  }
  const coverDialog = el("dialog", "music-link-dialog spaceamp-cover-dialog"),
    coverForm = el("form"),
    coverTitle = el("h2"),
    coverPreview = el("div", "spaceamp-cover-dialog-preview"),
    coverStatus = el("p", "title-notice"),
    coverTrackSelect = el("select"),
    coverFileInput = el("input"),
    coverActions = el("div", "form-actions"),
    coverClose = button("fechar", () => coverDialog.close());
  coverFileInput.type = "file";
  coverFileInput.accept = "image/jpeg,image/png,image/webp";
  coverFileInput.hidden = true;
  coverTrackSelect.setAttribute("aria-label", "Artwork de uma música da playlist");
  coverForm.onsubmit = (event) => event.preventDefault();
  coverActions.append(coverClose);
  coverForm.append(coverTitle, coverPreview, coverStatus, coverTrackSelect, coverFileInput, coverActions);
  coverDialog.append(coverForm);
  document.body.append(coverDialog);
  coverDialog.addEventListener("close", () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    coverPreviewUrl = "";
    coverFileInput.value = "";
    pendingCoverFile = null;
    if (coverDialogRestore?.isConnected)
      coverDialogRestore.focus({ preventScroll: true });
    else libraryContent.querySelector(".spaceamp-library-edit-cover")?.focus({ preventScroll: true });
    coverDialogRestore = null;
  });
  const librarySearch = el("section", "spaceamp-library-search"),
    librarySearchHeading = el("h3", "", "Adicionar músicas"),
    librarySearchToolbar = el("div", "spaceamp-library-search-toolbar"),
    librarySearchModeSelect = el("select"),
    librarySearchInput = el("input"),
    librarySearchStatus = el("p", "spaceamp-library-search-status"),
    librarySearchResultsList = el("ul", "spaceamp-library-search-results"),
    librarySearchMore = button("mostrar mais", () => loadLibrarySearchPage(true));
  librarySearchModeSelect.setAttribute("aria-label", "Origem da busca musical");
  librarySearchModeSelect.append(
    new Option("YouTube Music", "youtube"),
    new Option("Minha Collection", "collection"),
  );
  librarySearchInput.type = "search";
  librarySearchInput.placeholder = "buscar músicas";
  librarySearchInput.setAttribute("aria-label", "Buscar músicas para a playlist");
  librarySearchInput.autocomplete = "off";
  librarySearchStatus.setAttribute("role", "status");
  librarySearchStatus.setAttribute("aria-live", "polite");
  librarySearchMore.hidden = true;
  librarySearchToolbar.append(librarySearchModeSelect, librarySearchInput);
  librarySearch.append(
    librarySearchHeading,
    librarySearchToolbar,
    librarySearchStatus,
    librarySearchResultsList,
    librarySearchMore,
  );
  librarySearchModeSelect.onchange = () => {
    librarySearchMode = librarySearchModeSelect.value;
    scheduleLibrarySearch(true);
  };
  librarySearchInput.oninput = () => scheduleLibrarySearch(true);
  const libraryDialog = el("dialog", "spaceamp-window spaceamp-library-window");
  libraryDialog.id = "spaceAmpLibrary";
  libraryDialog.setAttribute("aria-label", "Biblioteca musical");
  libraryDialog.addEventListener("close", cancelLibrarySearch);
  const libraryHeader = el("header", "spaceamp-window-titlebar"),
    libraryHeading = el("strong", "", "♫ Biblioteca musical"),
    libraryClose = button("×", () => libraryDialog.close(), "spaceamp-window-close");
  libraryClose.setAttribute("aria-label", "Fechar biblioteca musical");
  libraryHeader.append(libraryHeading, libraryClose);
  const libraryLayout = el("div", "spaceamp-library-layout"),
    libraryNav = el("nav", "spaceamp-library-nav"),
    libraryNavHeading = el("div", "spaceamp-library-nav-heading"),
    libraryNavTitle = el("strong", "", "Playlists salvas"),
    newPlaylistButton = button("＋ Nova playlist", openNewPlaylistDialog),
    libraryNavList = el("div", "spaceamp-library-nav-list"),
    libraryContent = el("section", "spaceamp-library-content");
  libraryNav.setAttribute("aria-label", "Playlists salvas");
  libraryNavHeading.append(libraryNavTitle, newPlaylistButton);
  libraryNav.append(libraryNavHeading, libraryNavList);
  libraryLayout.append(libraryNav, libraryContent);
  libraryDialog.append(libraryHeader, libraryLayout);
  const queueDialog = el("dialog", "spaceamp-window spaceamp-queue-window");
  queueDialog.id = "spaceAmpQueue";
  queueDialog.setAttribute("aria-label", "Fila de reprodução");
  const queueHeader = el("header", "spaceamp-window-titlebar"),
    queueHeading = el("div", "spaceamp-queue-heading"),
    queueTitle = el("strong", "", "♫ Fila de reprodução"),
    queueCount = el("small", "spaceamp-queue-count", "0 faixas"),
    queueClose = button("×", () => queueDialog.close(), "spaceamp-window-close");
  queueClose.setAttribute("aria-label", "Fechar fila de reprodução");
  queueHeading.append(queueTitle, queueCount);
  queueHeader.append(queueHeading, queueClose);
  const queueContext = el("p", "spaceamp-queue-context", "Nenhum contexto ativo."),
    queueCurrent = el("div", "spaceamp-queue-current"),
    queueControls = el("nav", "spaceamp-queue-controls"),
    queueHistory = el("details", "spaceamp-queue-history"),
    queueHistorySummary = el("summary", "spaceamp-queue-section-heading"),
    queueHistoryTitle = el("span", "", "ANTERIORES"),
    queueHistoryCount = el("small", "", "0 faixas"),
    queueHistoryRows = el("ol", "playlist-rows spaceamp-queue-history-rows"),
    queueUpcoming = el("section", "spaceamp-queue-upcoming"),
    queueUpcomingHeading = el("div", "spaceamp-queue-section-heading"),
    queueUpcomingTitle = el("h2", "spaceamp-queue-upcoming-title", "A SEGUIR"),
    queueUpcomingCount = el("small", "", "0 faixas"),
    queueUpcomingNote = el("small", "spaceamp-queue-order-note"),
    queue = el("ol", "playlist-rows spaceamp-queue-rows");
  queueHistorySummary.append(queueHistoryTitle, queueHistoryCount);
  queueHistory.append(queueHistorySummary, queueHistoryRows);
  queueUpcomingHeading.append(queueUpcomingTitle, queueUpcomingCount);
  queueUpcoming.append(queueUpcomingHeading, queueUpcomingNote, queue);
  queueDialog.append(
    queueHeader,
    queueContext,
    queueCurrent,
    queueControls,
    queueHistory,
    queueUpcoming,
  );
  document.body.append(libraryDialog, queueDialog);
  const shuffleButton = button("⤨", () => {
    const current = queueManager.snapshot();
    queueManager.setModes({ shuffle: !current.shuffle });
  }, "spaceamp-queue-control");
  const previousButton = button("|◀", () => window.SPACEAMP.previous(), "spaceamp-queue-control");
  const playPauseButton = button("▶", () => {
    if (window.SPACEAMP.getPlaybackState().playing) window.SPACEAMP.pause();
    else window.SPACEAMP.play();
  }, "spaceamp-queue-control");
  const nextButton = button("▶|", () => window.SPACEAMP.next(), "spaceamp-queue-control");
  const repeatButton = button("↻", () => {
    const current = queueManager.snapshot();
    const repeat = { off: "all", all: "one", one: "off" }[current.repeat];
    queueManager.setModes({ repeat });
  }, "spaceamp-queue-control");
  queueControls.setAttribute("aria-label", "Controles de reprodução");
  queueHistory.setAttribute("aria-label", "Músicas anteriores");
  previousButton.setAttribute("aria-label", "Faixa anterior");
  nextButton.setAttribute("aria-label", "Próxima faixa");
  shuffleButton.title = "Embaralhar";
  previousButton.title = "Faixa anterior";
  nextButton.title = "Próxima faixa";
  repeatButton.title = "Repetir: desativado";
  queueControls.append(shuffleButton, previousButton, playPauseButton, nextButton, repeatButton);
  const buttons = $("play").parentElement;
  buttons.prepend(button("◀", () => window.SPACEAMP.previous(), ""));
  buttons.insertBefore(
    button("▶|", () => window.SPACEAMP.next(), ""),
    $("stop"),
  );
  buttons.firstChild.setAttribute("aria-label", "Faixa anterior");
  buttons.children[2].setAttribute("aria-label", "Próxima faixa");
  const relink = el("input");
  relink.type = "file";
  relink.accept = "audio/*";
  relink.hidden = true;
  document.body.append(relink);
  relink.onchange = async () => {
    const file = relink.files[0];
    if (!file) return;
    const selected = queueManager.current();
    const id = selected?.fileRef || selected?.id;
    try {
      await mediaOperation("readwrite", id, file);
      const row = selected;
      if (row) {
        row.local = true;
        row.fileName = file.name;
        row.fileRef = id;
        row.url = "";
        row.playbackSource = { type: "local", fileRef: id };
        const index = queueTracks().findIndex((entry) => entry.id === row.id);
        if (index >= 0) queueManager.update(index, row);
        if (row.collectionId)
          window.CollectionActions?.updateItem(row.collectionId, {
            playbackSource: row.playbackSource,
            fileName: row.fileName,
          });
        const context = queueManager.snapshot().context;
        if (context?.type === "playlist") {
          const playlist = getPlaylists().find((entry) => entry.id === context.sourceId);
          if (playlist)
            save({
              ...getData(),
              playlists: getPlaylists().map((entry) => entry.id === playlist.id
                ? { ...entry, tracks: entry.tracks.map((track) => track.id === row.id ? { ...track, ...row } : track) }
                : entry),
            });
        }
      }
      if (mediaUrls.has(id)) URL.revokeObjectURL(mediaUrls.get(id));
      mediaUrls.set(id, URL.createObjectURL(file));
      await selectTrack(selected.id, true);
      toast("Arquivo de áudio salvo.");
    } catch {
      toast("Não foi possível guardar o arquivo neste navegador.");
    }
    relink.value = "";
  };
  async function sourceFor(track) {
    if (track.url) return safeUrl(track.url);
    track = { ...track, id: track.fileRef || track.id };
    if (mediaUrls.has(track.id)) return mediaUrls.get(track.id);
    if (mediaReads.has(track.id)) return mediaReads.get(track.id);
    const revision = mediaRevision;
    const read = (async () => {
      try {
        const blob = await mediaOperation("readonly", track.id);
        if (revision !== mediaRevision) return "";
        if (mediaUrls.has(track.id)) return mediaUrls.get(track.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          mediaUrls.set(track.id, url);
          return url;
        }
      } catch {}
      return "";
    })().finally(() => {
      if (mediaReads.get(track.id) === read) mediaReads.delete(track.id);
    });
    mediaReads.set(track.id, read);
    return read;
  }

  async function selectTrack(id, play = false, transient = null) {
    const tracks = queueTracks();
    let track = transient || tracks.find((t) => t.id === id);
    if (!track) return null;
    const playbackSource = MusicModel.source(track.playbackSource);
    if (playbackSource) {
      track = {
        ...track,
        playbackSource,
        url: playbackSource.type === "local" ? "" : playbackSource.url,
        local: playbackSource.type === "local",
        fileRef: playbackSource.fileRef || track.fileRef || "",
      };
    } else if (track.url) {
      const embed = MediaEmbeds.parse(track.url);
      if (embed?.provider === "youtube")
        track = { ...track, playbackSource: MusicModel.source({ type: "youtube", url: track.url }) };
      else if (!embed)
        track = { ...track, playbackSource: MusicModel.source({ type: "audio", url: track.url }) };
    }
    let queueIndex = tracks.findIndex((entry) => entry.id === track.id);
    if (!transient && queueIndex >= 0 && queueIndex !== queueManager.snapshot().index) {
      queueManager.select(queueIndex);
      track = queueManager.current();
    }
    const token = ++selection;
    requestedTrack = track.id;
    cancelMetadata();
    if (!window.MusicBridge.canPlay(track) && track.catalogId) {
      try {
        const prepared = await window.MusicBridge.prepareTrack(track);
        if (token !== selection) return null;
        if (!window.MusicBridge.canPlay(prepared)) {
          requestedTrack = null;
          window.SPACEAMP.progress({ transitioning: false });
          $("playerNote").textContent = "Esta faixa ainda não tem uma fonte de áudio válida.";
          return false;
        }
        track = { ...track, ...prepared };
        queueIndex = queueTracks().findIndex((entry) => entry.id === track.id);
      } catch (error) {
        if (token !== selection) return null;
        toast(error.message || "Não foi possível preparar esta faixa.");
        requestedTrack = null;
        return false;
      }
    }
    if (queueIndex >= 0) queueManager.update(queueIndex, track);
    if (
      MediaEmbeds.parse(track.url) &&
      (!track.title || ["Sem título", "Nenhuma música"].includes(track.title))
    ) {
      const info = await MediaEmbeds.metadata(track.url);
      if (token !== selection) return null;
      if (info) {
        track.title = info.title || track.title;
        track.artist = track.artist || info.artist;
        track.album = track.album || info.thumbnail;
      }
    }
    const source = await sourceFor(track);
    if (token !== selection) return null;
    requestedTrack = null;
    previewing = !!transient;
    window.SPACEAMP.progress({ preview: previewing });
    window.SpaceAmpHost.setTrack(track, source);
    renderPlaylist();
    enrichTrack(track, token);
    if (MediaEmbeds.parse(track.url)) {
      if (play) window.SPACEAMP.play();
      return true;
    }
    if (!source) {
      window.SPACEAMP.progress({ transitioning: false });
      $("playerNote").textContent =
        "Arquivo não disponível. Clique em “vincular arquivo” nesta faixa.";
      const linkFile = button(
        "vincular arquivo",
        () => {
          relink.click();
        },
        "text-action",
      );
      linkFile.setAttribute("aria-label", "Vincular arquivo da faixa atual");
      $("playerNote").append(" ", linkFile);
      return false;
    }
    if (play) {
      try {
        await audio.play();
      } catch {
        if (token === selection)
          toast("Não consegui tocar essa faixa. Verifique o arquivo ou link.");
      }
    }
    return !!source || !!MediaEmbeds.parse(track.url);
  }
  function clearTrack() {
    selection++;
    requestedTrack = null;
    cancelMetadata();
    audio.pause();
    window.SpaceAmpHost.clear();
    loadedSource = "";
  }
  async function stepTrack(direction) {
    if (!queueTracks().length) return;
    if (direction < 0 && window.SPACEAMP.getPlaybackTime().position > 3) {
      window.SPACEAMP.seek(0);
      return;
    }
    window.SPACEAMP.progress({ transitioning: true });
    try {
      let next = direction < 0 ? queueManager.previous() : queueManager.next();
      if (!next && direction > 0) next = await loadNextContextTracks();
      for (let attempts = 0; next && attempts < queueTracks().length; attempts++) {
        const available = await selectTrack(next.track.id, true);
        if (available === null) return;
        if (available) return;
        next = direction < 0 ? queueManager.previous() : queueManager.next();
        if (!next && direction > 0) next = await loadNextContextTracks();
      }
      window.SPACEAMP.progress({ transitioning: false });
    } catch (error) {
      window.SPACEAMP.progress({ transitioning: false });
      throw error;
    }
  }
  async function loadNextContextTracks() {
    const snapshot = queueManager.snapshot(), getNext = snapshot.context?.getNext;
    if (!getNext || contextAbort?.signal.aborted) return null;
    if (nextRequest) return nextRequest;
    const token = snapshot.revision,
      controller = contextAbort || (contextAbort = new AbortController());
    let request;
    request = (async () => {
      const entries = await getNext({
        signal: controller.signal,
        current: queueManager.current(),
        queue: snapshot.queue,
      });
      if (controller.signal.aborted || !queueManager.isCurrent(token) || !Array.isArray(entries))
        return null;
      let count = 0;
      for (const entry of entries.slice(0, 24)) {
        if (controller.signal.aborted) return null;
        const candidates = queueTracks();
        const duplicate = candidates.some((track) => MusicModel.sameItem(track, entry)) ||
          MusicModel.findRecording(candidates, entry) ||
          candidates.some((track) => MusicModel.recordingMatch(track, entry) === 3);
        if (duplicate) continue;
        queueManager.append({ ...entry, id: entry.id || uid(), kind: "music" });
        count++;
      }
      return count ? queueManager.next() : null;
    })().finally(() => {
      if (nextRequest === request) nextRequest = null;
    });
    nextRequest = request;
    return nextRequest;
  }
  function finishTrack() {
    if (previewing) {
      window.SPACEAMP.stop();
      return;
    }
    if (queueManager.snapshot().repeat === "one" && queueManager.current())
      return selectTrack(queueManager.current().id, true);
    return stepTrack(1);
  }
  window.SPACEAMP.setNavigation({
    previous: () => stepTrack(-1),
    next: () => stepTrack(1),
    ended: finishTrack,
  });
  const getPlaylists = () => getData().playlists || [];
  const artworkForTrack = (track) =>
    [track?.image, track?.album, track?.artwork, track?.catalogImage].find(
      (value) => typeof value === "string" && value.trim(),
    ) || "";
  function autoCoverSources(playlist) {
    const sources = [];
    const seen = new Set();
    for (const track of playlist?.tracks || []) {
      const source = artworkForTrack(track);
      if (!source || seen.has(source)) continue;
      seen.add(source);
      sources.push(source);
      if (sources.length === 4) break;
    }
    return sources;
  }
  function selectedCoverSource(playlist) {
    const cover = playlist?.cover;
    if (cover?.mode === "custom" && window.XmbArtworkStorage?.isReference(cover.reference))
      return cover.reference;
    if (cover?.mode === "track") {
      const track = (playlist.tracks || []).find((entry) => entry.id === cover.trackId);
      return cover.image || artworkForTrack(track);
    }
    return autoCoverSources(playlist)[0] || "";
  }
  function playlistCoverForXmb(playlistId) {
    const playlist = typeof playlistId === "object"
      ? playlistId
      : getPlaylists().find((entry) => String(entry.id) === String(playlistId));
    return selectedCoverSource(playlist);
  }
  function appendCoverImage(container, source, alt = "", variant = "thumb", onError = () => {}) {
    const image = el("img", "spaceamp-playlist-cover-image");
    image.alt = alt;
    image.loading = "lazy";
    image.decoding = "async";
    container.append(image);
    if (window.Artwork?.set)
      window.Artwork.set(image, source, { variant, error: () => onError(image) });
    else image.src = source;
    return image;
  }
  function renderAutoCover(container, playlist) {
    container.replaceChildren();
    const sources = autoCoverSources(playlist);
    container.dataset.coverMode = "auto";
    container.dataset.coverCount = String(sources.length);
    if (!sources.length) {
      container.classList.add("is-empty");
      container.append(el("span", "spaceamp-playlist-cover-note", "♫"));
      return;
    }
    container.classList.remove("is-empty");
    sources.forEach((source, index) => {
      appendCoverImage(container, source, "", "thumb", (image) => {
        image.remove();
        container.dataset.coverCount = String(container.querySelectorAll("img").length);
        if (!container.querySelector("img")) {
          container.classList.add("is-empty");
          container.append(el("span", "spaceamp-playlist-cover-note", "♫"));
        }
      }).dataset.coverIndex = String(index);
    });
  }
  function renderPlaylistCover(container, playlist) {
    container.replaceChildren();
    container.classList.add("spaceamp-playlist-cover");
    const cover = playlist?.cover,
      source = selectedCoverSource(playlist);
    if (!cover || cover.mode === "auto") return renderAutoCover(container, playlist);
    if (!source) return renderAutoCover(container, playlist);
    container.dataset.coverMode = cover?.mode === "custom" || cover?.mode === "track"
      ? cover.mode
      : "auto";
    container.dataset.coverCount = "1";
    container.classList.remove("is-empty");
    appendCoverImage(container, source, "", "display", () => renderAutoCover(container, playlist));
  }
  function setPlaylistCover(playlistId, cover) {
    const playlists = getPlaylists();
    if (!playlists.some((entry) => entry.id === playlistId))
      throw Error("A playlist foi removida.");
    persistPlaylists(playlists.map((entry) => entry.id === playlistId ? { ...entry, cover } : entry));
  }
  async function validateImageFile(file) {
    const type = file?.type || "";
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(type))
      throw Error("Escolha uma imagem JPEG, PNG ou WebP.");
    if (!file.size || file.size > 12 * 1024 * 1024)
      throw Error("A imagem deve ter até 12 MB.");
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const validSignature = type === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : type === "image/png"
        ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
          bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
        : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!validSignature) throw Error("O conteúdo do arquivo não corresponde ao formato declarado.");
    let width = 0, height = 0, bitmap;
    try {
      if (window.createImageBitmap) {
        bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
      } else {
        const url = URL.createObjectURL(file), image = new Image();
        try {
          image.src = url;
          await image.decode();
          width = image.naturalWidth;
          height = image.naturalHeight;
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      throw Error("Não foi possível abrir esta imagem.");
    } finally {
      bitmap?.close();
    }
    if (!width || !height || width > 8192 || height > 8192 || width * height > 40000000)
      throw Error("A imagem deve ter até 8.192 px por lado e 40 megapixels.");
    return { width, height };
  }
  async function applyCustomCover() {
    const file = pendingCoverFile,
      playlistId = coverDialog.dataset.playlistId;
    if (!file) return;
    let reference = "";
    try {
      await validateImageFile(file);
      reference = window.XmbArtworkStorage.createReference("appearance");
      const prepared = await window.XmbArtworkStorage.prepare(file, reference);
      await MediaStorage.putMany(prepared.entries);
      setPlaylistCover(playlistId, { mode: "custom", reference });
      coverDialog.close();
    } catch (error) {
      if (reference && !JSON.stringify(getData()).includes(reference))
        await window.XmbArtworkStorage.remove(reference).catch(() => {});
      coverStatus.textContent = error.message || "Não foi possível salvar a capa.";
    }
  }
  function openCoverDialog(playlist) {
    const current = getPlaylists().find((entry) => entry.id === playlist.id);
    if (!current) return;
    coverDialogRestore = document.activeElement;
    coverDialog.dataset.playlistId = current.id;
    coverTitle.textContent = "Capa de “" + current.name + "”";
    coverStatus.textContent = "Capa automática acompanha as artworks da playlist.";
    renderPlaylistCover(coverPreview, current);
    coverTrackSelect.replaceChildren(new Option("Escolha uma música da playlist…", ""));
    for (const track of current.tracks || [])
      coverTrackSelect.append(new Option(track.title || "Sem título", track.id));
    const automatic = button("Usar capa automática", () => {
      try {
        setPlaylistCover(current.id, { mode: "auto" });
        coverDialog.close();
      } catch (error) {
        coverStatus.textContent = error.message;
      }
    });
    const chooseFile = button("Escolher imagem…", () => coverFileInput.click());
    const applyImage = button("Aplicar imagem", applyCustomCover);
    applyImage.disabled = true;
    const useTrack = button("Usar artwork da música", () => {
      const track = current.tracks?.find((entry) => entry.id === coverTrackSelect.value);
      if (!track) {
        coverStatus.textContent = "Escolha uma música da playlist.";
        return;
      }
      try {
        setPlaylistCover(current.id, {
          mode: "track",
          trackId: track.id,
          catalogId: track.catalogId || "",
          image: artworkForTrack(track),
        });
        coverDialog.close();
      } catch (error) {
        coverStatus.textContent = error.message;
      }
    });
    useTrack.disabled = !current.tracks?.length;
    coverActions.replaceChildren(automatic, chooseFile, applyImage, coverClose);
    coverDialog.prepend(coverForm);
    coverForm.replaceChildren(coverTitle, coverPreview, coverStatus, coverTrackSelect, coverFileInput, useTrack, coverActions);
    coverFileInput.onchange = async () => {
      const file = coverFileInput.files?.[0];
      if (!file) return;
      try {
        const dimensions = await validateImageFile(file);
        if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
        pendingCoverFile = file;
        coverPreviewUrl = URL.createObjectURL(file);
        coverPreview.replaceChildren();
        const preview = el("img", "spaceamp-playlist-cover-image");
        preview.alt = "Prévia da imagem personalizada";
        preview.src = coverPreviewUrl;
        coverPreview.append(preview);
        applyImage.disabled = false;
        coverStatus.textContent = `${file.name || "Imagem"} · ${dimensions.width} × ${dimensions.height}`;
      } catch (error) {
        pendingCoverFile = null;
        applyImage.disabled = true;
        coverStatus.textContent = error.message;
      }
    };
    coverDialog.showModal();
    automatic.focus({ preventScroll: true });
  }
  const coverReference = (cover) =>
    cover?.mode === "custom" && window.XmbArtworkStorage?.isReference(cover.reference)
      ? cover.reference
      : "";
  async function cleanupCoverReference(reference) {
    if (!reference || JSON.stringify(getData()).includes(reference)) return;
    await window.MediaPackage?.waitForIdle?.(reference);
    if (JSON.stringify(getData()).includes(reference)) return;
    await window.XmbArtworkStorage?.remove?.(reference);
  }
  function persistPlaylists(playlists) {
    const previous = getPlaylists();
    if (!save({ ...getData(), playlists })) throw Error("Não foi possível salvar as playlists.");
    renderSavedPlaylists();
    const liveCovers = new Set(
      playlists.map((playlist) => coverReference(playlist.cover)).filter(Boolean),
    );
    for (const playlist of previous) {
      const reference = coverReference(playlist.cover);
      if (reference && !liveCovers.has(reference))
        void cleanupCoverReference(reference).catch(() => {});
    }
  }
  function createPlaylist(name) {
    name = String(name || "").trim().slice(0, 120);
    if (!name) throw Error("Digite um nome para a playlist.");
    const playlist = { id: uid(), name, tracks: [], cover: { mode: "auto" }, createdAt: Date.now() };
    persistPlaylists([...getPlaylists(), playlist]);
    selectedPlaylistId = playlist.id;
    return playlist;
  }
  function addToPlaylist(value, playlistId) {
    let playlists = getPlaylists();
    let target = playlists.find((item) => item.id === playlistId);
    if (!target && playlists.length === 1) target = playlists[0];
    if (!target && !playlists.length) {
      target = createPlaylist("Minha playlist");
      playlists = getPlaylists();
    }
    if (!target) return choosePlaylist(value);
    const rows = target.tracks || [];
    const candidate = {
      ...value,
      kind: "music",
      catalogId: value.catalogId || value.metadataSources?.catalogId || "",
    };
    const existing = rows.find((track) => MusicModel.sameItem(track, candidate)) ||
      MusicModel.findRecording(rows, candidate) ||
      rows.find((track) => MusicModel.recordingMatch(track, candidate) === 3);
    if (existing) return existing;
    const collectionItems = window.CollectionActions?.getItems() || [];
    const collectionItem = value.collectionId
      ? collectionItems.find((item) => item.id === value.collectionId)
      : collectionItems.find((item) => item.id === value.id && item.kind === "music");
    const catalogId = candidate.catalogId;
    const row = {
      ...value,
      id: uid(),
      collectionId: value.collectionId || collectionItem?.id || "",
      kind: "music",
      catalogId,
      ...(catalogId
        ? { metadataSources: { ...value.metadataSources, catalogId } }
        : {}),
    };
    persistPlaylists(playlists.map((item) => item.id === target.id
      ? { ...item, tracks: [...rows, row] }
      : item));
    toast("Adicionada a “" + target.name + "”.");
    return row;
  }
  function choosePlaylist(value) {
    const dialog = el("dialog", "music-link-dialog playlist-picker"),
      form = el("form"),
      select = el("select"),
      name = el("input"),
      saveButton = button("adicionar", (event) => {
        event?.preventDefault?.();
        try {
          const id = select.value === "__new__" ? createPlaylist(name.value).id : select.value;
          addToPlaylist(value, id);
          dialog.close();
        } catch (error) {
          status.textContent = error.message;
        }
      }),
      status = el("p", "title-notice", value.title);
    form.onsubmit = (event) => {
      event.preventDefault();
      saveButton.click();
    };
    select.setAttribute("aria-label", "Escolher playlist");
    for (const playlist of getPlaylists()) select.append(new Option(playlist.name, playlist.id));
    select.append(new Option("Criar playlist nova…", "__new__"));
    select.onchange = () => { name.hidden = select.value !== "__new__"; };
    name.placeholder = "Nome da playlist";
    name.hidden = select.value !== "__new__";
    form.append(el("h2", "", "Adicionar à playlist"), status, select, name, saveButton, button("cancelar", () => dialog.close()));
    dialog.append(form);
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
    return new Promise((resolve) => dialog.addEventListener("close", resolve, { once: true }));
  }
  function playPlaylist(id, startIndex = 0, { shuffle = false } = {}) {
    const playlist = getPlaylists().find((item) => item.id === id);
    if (!playlist?.tracks?.length) throw Error("Esta playlist não tem faixas.");
    queueManager.setModes({ shuffle });
    if (shuffle && playlist.tracks.length > 1)
      startIndex = Math.floor(Math.random() * playlist.tracks.length);
    return startContext({
      type: "playlist",
      sourceId: playlist.id,
      title: playlist.name,
      tracks: playlist.tracks,
      startIndex,
    });
  }
  function renderLibrarySearch(playlist) {
    librarySearch.hidden = !playlist;
    librarySearchModeSelect.value = librarySearchMode;
    if (!playlist) {
      librarySearchResultsList.replaceChildren();
      librarySearchStatus.textContent = "";
      librarySearchMore.hidden = true;
      return;
    }
    librarySearchResultsList.replaceChildren();
    for (const track of librarySearchResults) {
      const row = el("li", "spaceamp-library-search-result"),
        art = el("div", "spaceamp-library-track-art"),
        info = el("div", "spaceamp-library-search-info"),
        title = el("strong", "", track.title || "Sem título"),
        details = el("small", "", [track.artist, track.albumTitle].filter(Boolean).join(" · ")),
        duplicate = (playlist.tracks || []).some((entry) => MusicModel.sameItem(entry, track)) ||
          !!MusicModel.findRecording(playlist.tracks || [], track) ||
          (playlist.tracks || []).some((entry) => MusicModel.recordingMatch(entry, track) === 3),
        add = button(duplicate ? "✓ na playlist" : "＋", () => {
          try {
            const current = getPlaylists().find((entry) => entry.id === selectedPlaylistId);
            if (!current) return;
            const before = current.tracks?.length || 0;
            addToPlaylist(track, current.id);
            const after = getPlaylists().find((entry) => entry.id === current.id)?.tracks?.length || 0;
            if (before === after)
              librarySearchStatus.textContent = "Esta música já está na playlist.";
            librarySearchInput.focus({ preventScroll: true });
          } catch (error) {
            librarySearchStatus.textContent = error.message;
          }
        }, "spaceamp-library-search-add");
      row.dataset.catalogId = track.catalogId || "";
      add.disabled = duplicate;
      add.setAttribute("aria-label", (duplicate ? "Já adicionada: " : "Adicionar à playlist: ") + (track.title || "Sem título"));
      const source = artworkForTrack(track);
      if (source) appendCoverImage(art, source, "", "thumb", () => art.classList.add("is-empty"));
      else {
        art.classList.add("is-empty");
        art.append(el("span", "spaceamp-playlist-cover-note", "♫"));
      }
      info.append(title);
      if (details.textContent) info.append(details);
      row.append(art, info, add);
      librarySearchResultsList.append(row);
    }
    librarySearchMore.hidden = librarySearchMode === "youtube"
      ? !librarySearchCursor || librarySearchPages >= 10
      : libraryCollectionOffset >= libraryCollectionTotal;
    librarySearchMore.textContent = librarySearchMode === "youtube" ? "mostrar mais" : "mais da Collection";
  }
  function cancelLibrarySearch() {
    clearTimeout(librarySearchTimer);
    librarySearchController?.abort();
    librarySearchController = null;
    librarySearchRevision++;
  }
  function scheduleLibrarySearch(reset = false) {
    clearTimeout(librarySearchTimer);
    librarySearchController?.abort();
    librarySearchController = null;
    librarySearchRevision++;
    if (reset) {
      librarySearchResults = [];
      librarySearchCursor = "";
      librarySearchPages = 0;
      librarySearchCursors = new Set();
      libraryCollectionOffset = 0;
      libraryCollectionTotal = 0;
    }
    if (!librarySearchInput.value.trim()) {
      librarySearchStatus.textContent = "Pesquise no YouTube Music ou em músicas da sua Collection.";
      renderLibrarySearch(getPlaylists().find((entry) => entry.id === selectedPlaylistId));
      return;
    }
    if (librarySearchInput.value.trim().length < 2) {
      librarySearchStatus.textContent = "Digite pelo menos 2 caracteres.";
      renderLibrarySearch(getPlaylists().find((entry) => entry.id === selectedPlaylistId));
      return;
    }
    librarySearchStatus.textContent = "Aguardando busca…";
    librarySearchTimer = setTimeout(() => void loadLibrarySearchPage(false), 320);
  }
  async function loadLibrarySearchPage(more) {
    const query = librarySearchInput.value.trim(),
      playlistId = selectedPlaylistId,
      mode = librarySearchMode,
      cursor = more ? librarySearchCursor : "";
    if (!query || query.length < 2 || !playlistId) return;
    const revision = ++librarySearchRevision;
    librarySearchController?.abort();
    const controller = (librarySearchController = new AbortController());
    const isCurrent = () =>
      revision === librarySearchRevision &&
      !controller.signal.aborted &&
      libraryDialog.open &&
      selectedPlaylistId === playlistId &&
      librarySearchInput.value.trim() === query &&
      librarySearchMode === mode;
    librarySearchStatus.textContent = mode === "youtube" ? "Buscando no YouTube Music…" : "Buscando na Collection…";
    try {
      if (mode === "collection") {
        const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase();
        const needle = normalize(query);
        const all = (window.CollectionActions?.getItems() || []).filter((item) =>
          item.kind === "music" &&
          normalize([item.title, item.artist, item.albumTitle].join(" ")).includes(needle),
        );
        libraryCollectionTotal = all.length;
        librarySearchResults = all.slice(0, libraryCollectionOffset + 40);
        libraryCollectionOffset = librarySearchResults.length;
        librarySearchStatus.textContent = all.length
          ? all.length + (all.length === 1 ? " música encontrada." : " músicas encontradas.")
          : "Nenhuma música encontrada na Collection.";
        if (isCurrent()) renderLibrarySearch(getPlaylists().find((entry) => entry.id === playlistId));
        return;
      }
      if (!window.Catalog?.searchPage) throw Error("A busca musical está indisponível.");
      if (cursor) librarySearchCursors.add(cursor);
      const page = await Catalog.searchPage("music", query, {
        signal: controller.signal,
        ...(cursor ? { cursor } : {}),
      });
      if (!isCurrent()) return;
      const seen = new Set(librarySearchResults.map((track) => track.catalogId).filter(Boolean));
      const incoming = page.items.filter((track) => {
        if (!track.catalogId || seen.has(track.catalogId)) return false;
        seen.add(track.catalogId);
        return true;
      });
      librarySearchResults = more ? [...librarySearchResults, ...incoming] : incoming;
      librarySearchPages++;
      librarySearchCursor = typeof page.next === "string" &&
        page.next.length &&
        !librarySearchCursors.has(page.next) &&
        librarySearchPages < 10 &&
        librarySearchResults.length < 400
        ? page.next
        : "";
      librarySearchStatus.textContent = librarySearchResults.length
        ? librarySearchResults.length + " resultados do YouTube Music."
        : "Nenhuma música encontrada.";
      renderLibrarySearch(getPlaylists().find((entry) => entry.id === playlistId));
    } catch (error) {
      if (!isCurrent()) return;
      librarySearchStatus.textContent = error.name === "AbortError"
        ? "Busca cancelada."
        : error.message || "Não foi possível buscar músicas.";
      if (!more) librarySearchResults = [];
      renderLibrarySearch(getPlaylists().find((entry) => entry.id === playlistId));
    } finally {
      if (librarySearchController === controller) librarySearchController = null;
    }
  }
  function renderSavedPlaylists() {
    const playlists = getPlaylists();
    if (!playlists.some((entry) => entry.id === selectedPlaylistId))
      selectedPlaylistId = playlists[0]?.id || "";
    const navScrollTop = libraryNavList.scrollTop,
      navScrollLeft = libraryNavList.scrollLeft,
      searchFocus = librarySearch.contains(document.activeElement)
        ? document.activeElement
        : null;
    libraryNavList.replaceChildren();
    for (const playlist of playlists) {
      const choice = button("", () => {
        if (selectedPlaylistId !== playlist.id) {
          cancelLibrarySearch();
          selectedPlaylistId = playlist.id;
          librarySearchResults = [];
          librarySearchCursor = "";
          librarySearchStatus.textContent = "";
        }
        renderSavedPlaylists();
        libraryNavList.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
        if (librarySearchInput.value.trim().length >= 2) scheduleLibrarySearch(true);
      }, "spaceamp-playlist-choice");
      const art = el("div", "spaceamp-playlist-choice-art"),
        label = el("span", "spaceamp-playlist-choice-label", playlist.name),
        count = el("small", "", String((playlist.tracks || []).length) + " faixas");
      renderPlaylistCover(art, playlist);
      choice.setAttribute("aria-pressed", String(playlist.id === selectedPlaylistId));
      choice.setAttribute("aria-label", playlist.name + ", " + count.textContent);
      choice.append(art, label, count);
      libraryNavList.append(choice);
    }
    libraryNavList.scrollTop = navScrollTop;
    libraryNavList.scrollLeft = navScrollLeft;
    libraryContent.replaceChildren();
    const playlist = playlists.find((entry) => entry.id === selectedPlaylistId);
    if (!playlist) {
      libraryContent.append(
        el("p", "spaceamp-library-empty", "Crie uma playlist para começar a organizar suas músicas."),
      );
      return;
    }
    const hero = el("header", "spaceamp-library-hero"),
      coverButton = button("", () => openCoverDialog(playlist), "spaceamp-library-cover-button"),
      cover = el("div"),
      info = el("div", "spaceamp-library-heading"),
      title = el("h2", "", playlist.name),
      count = el("small", "", String((playlist.tracks || []).length) + " faixas"),
      actions = el("div", "spaceamp-library-actions"),
      play = button("▶ Reproduzir", () => playPlaylist(playlist.id));
    coverButton.setAttribute("aria-label", "Editar capa da playlist " + playlist.name);
    renderPlaylistCover(cover, playlist);
    coverButton.append(cover);
    info.append(title, count);
    play.disabled = !playlist.tracks?.length;
    const shufflePlay = button("⤨ Embaralhar", () => {
      try {
        const startIndex = playlist.tracks.length > 1
          ? Math.floor(Math.random() * playlist.tracks.length)
          : 0;
        void playPlaylist(playlist.id, startIndex, { shuffle: true });
      } catch (error) {
        toast(error.message);
      }
    });
    shufflePlay.disabled = !playlist.tracks?.length;
    const editCover = button("Editar capa", () => openCoverDialog(playlist), "spaceamp-library-edit-cover");
    editCover.setAttribute("aria-label", "Editar capa da playlist " + playlist.name);
    const menu = el("details", "spaceamp-library-menu"),
      menuSummary = el("summary", "", "⋯"),
      menuItems = el("div", "spaceamp-library-menu-items"),
      rename = button("Renomear", () => {
        menu.open = false;
        openPlaylistNameDialog({
          title: "Renomear playlist",
          value: playlist.name,
          action: (name) => persistPlaylists(getPlaylists().map((row) =>
            row.id === playlist.id ? { ...row, name } : row,
          )),
          restore: libraryContent.querySelector(".spaceamp-library-menu summary"),
        });
      }),
      remove = button("Excluir", () => {
        menu.open = false;
        if (!window.confirm("Excluir a playlist “" + playlist.name + "”? As músicas da Collection e os arquivos locais serão mantidos.")) return;
        persistPlaylists(getPlaylists().filter((row) => row.id !== playlist.id));
      });
    menuSummary.setAttribute("aria-label", "Ações da playlist");
    menuItems.append(rename, remove);
    menu.append(menuSummary, menuItems);
    actions.append(play, shufflePlay, editCover, menu);
    hero.append(coverButton, info, actions);
    const tracks = el("ol", "playlist-rows spaceamp-library-tracks");
    for (const [index, track] of (playlist.tracks || []).entries()) {
      const row = el("li", "playlist-row spaceamp-library-row"),
        art = el("div", "spaceamp-library-track-art"),
        select = button(
          track.title || "Sem título",
          () => playPlaylist(playlist.id, index),
          "playlist-track spaceamp-library-track",
        ),
        artist = el("small", "", track.artist || ""),
        durationValue = Number(track.trackDuration ?? track.duration),
        duration = el("small", "spaceamp-library-duration", Number.isFinite(durationValue) && durationValue > 0
          ? Math.floor(durationValue / 60) + ":" + String(Math.floor(durationValue % 60)).padStart(2, "0")
          : ""),
        tools = el("div", "spaceamp-library-row-tools");
      const trackImage = artworkForTrack(track);
      if (trackImage) appendCoverImage(art, trackImage, "", "thumb", () => art.classList.add("is-empty"));
      else {
        art.classList.add("is-empty");
        art.append(el("span", "spaceamp-playlist-cover-note", "♫"));
      }
      select.title = track.title || "Sem título";
      if (track.artist) select.append(artist);
      const moveTrack = (delta) => {
        const current = getPlaylists().find((entry) => entry.id === playlist.id),
          rows = current?.tracks?.slice() || [],
          target = index + delta;
        if (target < 0 || target >= rows.length) return;
        [rows[index], rows[target]] = [rows[target], rows[index]];
        persistPlaylists(getPlaylists().map((entry) => entry.id === playlist.id
          ? { ...entry, tracks: rows }
          : entry,
        ));
      };
      const menu = el("details", "spaceamp-library-track-menu"),
        summary = el("summary", "", "⋯"),
        menuItems = el("div", "spaceamp-library-track-menu-items"),
        playNow = button("Reproduzir agora", () => playPlaylist(playlist.id, index)),
        playNext = button("Reproduzir a seguir", async () => {
          try {
            await window.MusicBridge.enqueue(track, { next: true });
            toast("Adicionada a seguir.");
          } catch (error) {
            toast(error.message);
          }
        }),
        addToQueue = button("Adicionar ao final da fila", async () => {
          try {
            await window.MusicBridge.enqueue(track);
            toast("Adicionada ao final da fila.");
          } catch (error) {
            toast(error.message);
          }
        }),
        removeTrack = button("Remover da playlist", () => {
          persistPlaylists(getPlaylists().map((entry) => entry.id === playlist.id
            ? { ...entry, tracks: entry.tracks.filter((_, position) => position !== index) }
            : entry,
          ));
        });
      summary.setAttribute("aria-label", "Ações para " + (track.title || "Sem título"));
      menuItems.append(playNow, playNext, addToQueue, removeTrack);
      menu.append(summary, menuItems);
      tools.append(
        button("↑", () => moveTrack(-1)),
        button("↓", () => moveTrack(1)),
        menu,
      );
      tools.firstChild.setAttribute("aria-label", "Mover para cima: " + track.title);
      tools.firstChild.disabled = index === 0;
      tools.children[1].setAttribute("aria-label", "Mover para baixo: " + track.title);
      tools.children[1].disabled = index === playlist.tracks.length - 1;
      row.append(el("span", "counter", String(index + 1).padStart(2, "0")), art, select, duration, tools);
      tracks.append(row);
    }
    if (!playlist.tracks?.length)
      tracks.append(el("li", "spaceamp-library-empty", "Esta playlist está vazia. Busque uma música acima para adicioná-la."));
    renderLibrarySearch(playlist);
    libraryContent.append(hero, librarySearch, tracks);
    if (searchFocus?.isConnected) searchFocus.focus({ preventScroll: true });
  }
  function openLibrary() {
    renderSavedPlaylists();
    if (!libraryDialog.open) libraryDialog.showModal();
    if (librarySearchInput.value.trim().length >= 2) scheduleLibrarySearch(true);
  }
  function openQueue() {
    renderPlaylist();
    if (!queueDialog.open) queueDialog.showModal();
  }
  function startContext(value) {
    if (!Array.isArray(value.tracks) || !value.tracks.length)
      throw Error("Não há faixas para reproduzir.");
    const usedIds = new Set(),
      tracks = value.tracks.map((track) => {
        const baseId = String(
          track.id || track.catalogId || track.collectionId || track.fileRef || "",
        );
        let id = baseId || uid();
        if (usedIds.has(id)) id = uid();
        usedIds.add(id);
        return { ...track, id };
      });
    contextAbort?.abort();
    contextAbort = new AbortController();
    nextRequest = null;
    const started = queueManager.start({ ...value, tracks });
    if (!started.track) throw Error("Não há faixas para reproduzir.");
    return selectTrack(started.track.id, true);
  }
  function enqueue(value, options = {}) {
    const tracks = queueTracks();
    const target = { ...value, kind: "music", catalogId: value.catalogId || value.metadataSources?.catalogId };
    const existing = tracks.find((track) => MusicModel.sameItem(track, target)) ||
      MusicModel.findRecording(tracks, target) ||
      tracks.find((track) => MusicModel.recordingMatch(track, target) === 3);
    if (existing) return existing.id;
    const row = { ...value, id: value.id || value.fileRef || uid(), kind: "music" };
    if (!tracks.length) queueManager.start({ type: "single", tracks: [] });
    queueManager.append(row, options);
    return row.id;
  }
  function playAlbum(values, context = {}) {
    if (context.firstTrack && Number.isInteger(context.startIndex))
      values = values.map((track, index) => index === context.startIndex ? context.firstTrack : track);
    return startContext({
      type: "album",
      sourceId: context.sourceId || values[0]?.albumCatalogId || values[0]?.albumId || "",
      title: context.title || values[0]?.albumTitle || "Álbum",
      tracks: values,
      startIndex: context.startIndex || 0,
      getNext: context.getNext,
    });
  }
  window.MusicBridge.configurePlaylist({
    getTracks: queueTracks,
    getPlaylists,
    getPlaylistCover: playlistCoverForXmb,
    openLibrary,
    openQueue,
    add: enqueue,
    enqueue,
    addToPlaylist,
    choosePlaylist,
    startContext,
    playPlaylist,
    playAlbum,
  });
  window.SPACEAMP.configure({
    enqueue,
    preview: (value) => {
      if (!safeUrl(value.url) || MediaEmbeds.parse(value.url))
        throw Error("URL de prévia inválida.");
      return selectTrack(null, true, { ...value, local: false });
    },
    select: (value) => typeof value === "string"
      ? selectTrack(value, true)
      : startContext({ type: "single", tracks: [value] }),
  });
  $("repeat").onclick = () => {
    const current = queueManager.snapshot();
    queueManager.setModes({ repeat: { off: "all", all: "one", one: "off" }[current.repeat] });
  };
  const basePlay = () =>
    window.SPACEAMP.getState().playing ? window.SPACEAMP.pause() : window.SPACEAMP.play();
  $("play").onclick = async () => {
    if (queueTracks().length && !loadedSource) {
      const entry = queueManager.current() || queueTracks()[0];
      if (entry) await selectTrack(entry.id, false);
      if (!loadedSource && !MediaEmbeds.parse(queueManager.current()?.url)) {
        toast("Vincule o arquivo de áudio desta faixa.");
        return;
      }
    }
    await basePlay();
  };
  audio.onended = () => {
    if (previewing) {
      window.SPACEAMP.stop();
      playing();
      return;
    }
    finishTrack();
    playing();
  };
  function queueArtwork(track, className) {
    const source = track?.album || track?.artwork || track?.image || "";
    if (!source) return el("span", className + " is-empty", "♫");
    const artwork = el("img", className);
    artwork.alt = "";
    artwork.loading = "lazy";
    artwork.decoding = "async";
    artwork.onerror = () => artwork.replaceWith(el("span", className + " is-empty", "♫"));
    artwork.src = source;
    return artwork;
  }
  function renderQueuePlaybackControls() {
    const playing = !!window.SPACEAMP.getPlaybackState().playing;
    playPauseButton.textContent = playing ? "Ⅱ" : "▶";
  playPauseButton.setAttribute(
    "aria-label",
    playing ? "Pausar reprodução" : "Continuar reprodução",
  );
    queueCurrent.dataset.playing = String(playing);
    const indicator = queueCurrent.querySelector(".spaceamp-queue-live");
    indicator?.setAttribute("data-playing", String(playing));
  }
  function renderPlaylist() {
    const snapshot = queueManager.snapshot(),
      tracks = snapshot.queue,
      player = window.SPACEAMP.getPlaybackState(),
      current = snapshot.index >= 0 ? tracks[snapshot.index] : null,
      activeTrack = previewing && player.available
        ? {
            id: player.trackId || "",
            title: player.title,
            artist: player.artist,
            album: player.artwork,
          }
        : current || (player.available && !player.stopped
            ? {
                id: player.trackId || "",
                title: player.title,
                artist: player.artist,
                album: player.artwork,
              }
            : null);
    window.SPACEAMP.setQueue(tracks, {
      context: snapshot.context && {
        type: snapshot.context.type,
        sourceId: snapshot.context.sourceId,
        title: snapshot.context.title,
      },
      shuffle: snapshot.shuffle,
      repeat: snapshot.repeat,
    });
    queueCount.textContent = tracks.length + (tracks.length === 1 ? " faixa" : " faixas");
    const contextTitle = snapshot.context?.title || "";
    queueContext.textContent = snapshot.context
      ? "CONTEXTO · " + ({
          album: "ÁLBUM",
          playlist: "PLAYLIST",
          collection: "COLEÇÃO",
          discovery: "DESCOBRIR",
          search: "BUSCA",
          single: "FAIXA",
        }[snapshot.context.type] || "SESSÃO") + (contextTitle ? " · " + contextTitle : "")
      : "SEM CONTEXTO ATIVO";
    queueCurrent.replaceChildren();
    queueCurrent.hidden = !activeTrack;
    if (activeTrack) {
      const info = el("div", "spaceamp-queue-current-info"),
        indicator = el("span", "spaceamp-queue-live", "▂▅▃▆");
      info.append(
        el("small", "spaceamp-queue-current-label", "TOCANDO AGORA"),
        el("strong", "", activeTrack.title || "Sem título"),
        el("span", "", activeTrack.artist || ""),
      );
      indicator.setAttribute("aria-label", "Indicador de reprodução");
      queueCurrent.append(
        queueArtwork(activeTrack, "spaceamp-queue-art spaceamp-queue-current-art"),
        info,
        indicator,
      );
    }
    const previousEntries = queueManager.previousEntries();
    queueHistoryCount.textContent = previousEntries.length +
      (previousEntries.length === 1 ? " faixa" : " faixas");
    queueHistoryRows.replaceChildren();
    if (!previousEntries.length) {
      queueHistoryRows.append(el("li", "spaceamp-queue-empty", "Nenhuma música anterior."));
    }
    for (const [displayIndex, entry] of previousEntries.entries()) {
      const track = entry.entry;
      if (!track) continue;
      const row = el("li", "playlist-row spaceamp-queue-history-row"),
        title = button(track.title || "Sem título", () => {
          const selected = snapshot.shuffle
            ? queueManager.replayFromHistory(entry.historyIndex)
            : queueManager.select(entry.position);
          if (selected) void selectTrack(selected.track.id, true);
        }, "playlist-track spaceamp-queue-track");
      row.append(
        el("span", "counter", String(displayIndex + 1).padStart(2, "0")),
        queueArtwork(track, "spaceamp-queue-art spaceamp-queue-history-art"),
      );
      if (track.artist) title.append(el("small", "", track.artist));
      row.append(title);
      const replay = button("↶", () => title.click(), "spaceamp-queue-row-action");
      replay.setAttribute("aria-label", "Reproduzir novamente: " + (track.title || "Sem título"));
      row.append(replay);
      queueHistoryRows.append(row);
    }
    const upcoming = queueManager.upcoming(),
      upcomingEntries = upcoming.entries;
    queueUpcomingCount.textContent = upcoming.determined
      ? upcomingEntries.length + (upcomingEntries.length === 1 ? " faixa" : " faixas")
      : upcomingEntries.length + (upcomingEntries.length === 1 ? " opção" : " opções");
    queueUpcomingNote.hidden = upcoming.determined || !upcomingEntries.length;
    queueUpcomingNote.textContent = snapshot.priorityNext >= 0
      ? "ORDEM EMBARALHADA · faixa priorizada primeiro; as demais podem variar."
      : "ORDEM EMBARALHADA · a próxima faixa será sorteada.";
    queue.replaceChildren();
    if (!upcomingEntries.length) {
      queue.append(el("li", "spaceamp-queue-empty", "Nenhuma música a seguir."));
    }
    for (const [displayIndex, entry] of upcomingEntries.entries()) {
      const { position, track } = entry,
        row = el("li", "playlist-row spaceamp-queue-row");
      row.dataset.trackId = track.id;
      row.draggable = true;
      row.ondragstart = (event) => {
        draggedTrack = track.id;
        event.dataTransfer.setData("text/plain", track.id);
        event.dataTransfer.effectAllowed = "move";
        row.classList.add("playlist-dragging");
      };
      row.ondragover = (event) => {
        if (draggedTrack && draggedTrack !== track.id) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          row.classList.add("playlist-drop-target");
        }
      };
      row.ondragleave = () => row.classList.remove("playlist-drop-target");
      row.ondrop = (event) => {
        event.preventDefault();
        reorderTrack(draggedTrack, track.id);
        draggedTrack = null;
      };
      row.ondragend = () => {
        draggedTrack = null;
        for (const item of queue.children)
          item.classList.remove("playlist-dragging", "playlist-drop-target");
      };
      row.append(
        el(
          "span",
          "counter",
          upcoming.determined ? String(displayIndex + 1).padStart(2, "0") : "·",
        ),
        queueArtwork(track, "spaceamp-queue-art spaceamp-queue-row-art"),
      );
      const title = button(
        track.title || "Sem título",
        () => selectTrack(track.id, true),
        "playlist-track spaceamp-queue-track",
      );
      if (track.artist) title.append(el("small", "", track.artist));
      row.append(title);
      const tools = el("div", "mini-actions");
      if (!track.url)
        tools.append(
          button(
            "vincular arquivo",
            () => {
              queueManager.select(position);
              relink.click();
            },
            "",
          ),
        );
      const previousEntry = upcomingEntries[displayIndex - 1],
        nextEntry = upcomingEntries[displayIndex + 1],
        moveUp = button(
          "↑",
          () => reorderTrack(track.id, previousEntry?.track.id),
          "spaceamp-queue-row-action",
        ),
        moveDown = button(
          "↓",
          () => reorderTrack(track.id, nextEntry?.track.id),
          "spaceamp-queue-row-action",
        ),
        remove = button("×", () => removeFromQueue(track.id), "spaceamp-queue-row-action");
      moveUp.setAttribute("aria-label", "Mover para cima: " + (track.title || "Sem título"));
      moveUp.disabled = !previousEntry;
      moveDown.setAttribute("aria-label", "Mover para baixo: " + (track.title || "Sem título"));
      moveDown.disabled = !nextEntry;
      remove.setAttribute("aria-label", "Remover da fila: " + (track.title || "Sem título"));
      tools.append(moveUp, moveDown, remove);
      row.append(tools);
      queue.append(row);
    }
    shuffleButton.setAttribute("aria-pressed", String(snapshot.shuffle));
    shuffleButton.setAttribute(
      "aria-label",
      snapshot.shuffle ? "Desativar embaralhamento" : "Ativar embaralhamento",
    );
    shuffleButton.title = snapshot.shuffle ? "Embaralhamento ativo" : "Embaralhar";
    repeatButton.setAttribute("aria-pressed", String(snapshot.repeat !== "off"));
    const repeatMode = {
      off: ["desativada", "desativado"],
      all: ["fila inteira", "fila"],
      one: ["faixa atual", "faixa"],
    }[snapshot.repeat];
    repeatButton.setAttribute(
      "aria-label",
      "Repetição: " + repeatMode[0],
    );
    repeatButton.title = "Repetir: " + repeatMode[1];
    repeatButton.textContent = snapshot.repeat === "one" ? "↻¹" : "↻";
    renderQueuePlaybackControls();
  }
  window.addEventListener("spaceamp:playstate", renderQueuePlaybackControls);

  return {
    render: renderPlaylist,
    selectTrack,
    clearTrack,
    removeMedia: deleteMedia,
    getTracks: queueTracks,
    getActive: () => queueManager.current()?.id || "",
    getPlaylists,
    addToPlaylist,
    choosePlaylist,
    playPlaylist,
    openLibrary,
    openQueue,
    cancel() {
      selection++;
      requestedTrack = null;
      cancelMetadata();
      contextAbort?.abort();
      contextAbort = null;
      nextRequest = null;
      audio.pause();
      queueManager.clear();
      window.SpaceAmpHost.clear();
      mediaRevision++;
      mediaReads.clear();
      for (const url of mediaUrls.values()) URL.revokeObjectURL(url);
      mediaUrls.clear();
    },
  };
}
