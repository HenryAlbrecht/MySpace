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
  let selectedPlaylistId = "";
  const libraryDialog = el("dialog", "spaceamp-window spaceamp-library-window");
  libraryDialog.id = "spaceAmpLibrary";
  libraryDialog.setAttribute("aria-label", "Biblioteca musical");
  const libraryHeader = el("header", "spaceamp-window-titlebar"),
    libraryHeading = el("strong", "", "♫ Biblioteca musical"),
    libraryClose = button("×", () => libraryDialog.close(), "spaceamp-window-close");
  libraryClose.setAttribute("aria-label", "Fechar biblioteca musical");
  libraryHeader.append(libraryHeading, libraryClose);
  const libraryToolbar = el("div", "spaceamp-library-toolbar"),
    newPlaylistName = el("input"),
    newPlaylistButton = button("＋ criar playlist", () => {
      try {
        selectedPlaylistId = createPlaylist(newPlaylistName.value).id;
        newPlaylistName.value = "";
        renderSavedPlaylists();
        libraryNav.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      } catch (error) {
        toast(error.message);
      }
    });
  newPlaylistName.placeholder = "nome da playlist";
  newPlaylistName.setAttribute("aria-label", "Nome da nova playlist");
  newPlaylistName.maxLength = 120;
  newPlaylistName.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      newPlaylistButton.click();
    }
  };
  libraryToolbar.append(newPlaylistName, newPlaylistButton);
  const libraryLayout = el("div", "spaceamp-library-layout"),
    libraryNav = el("nav", "spaceamp-library-nav"),
    libraryContent = el("section", "spaceamp-library-content");
  libraryNav.setAttribute("aria-label", "Playlists salvas");
  libraryLayout.append(libraryNav, libraryContent);
  libraryDialog.append(libraryHeader, libraryToolbar, libraryLayout);
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
  function persistPlaylists(playlists) {
    if (!save({ ...getData(), playlists })) throw Error("Não foi possível salvar as playlists.");
    renderSavedPlaylists();
  }
  function createPlaylist(name) {
    name = String(name || "").trim().slice(0, 120);
    if (!name) throw Error("Digite um nome para a playlist.");
    const playlist = { id: uid(), name, tracks: [], createdAt: Date.now() };
    persistPlaylists([...getPlaylists(), playlist]);
    return playlist;
  }
  function addToPlaylist(value, playlistId) {
    const playlists = getPlaylists();
    let target = playlists.find((item) => item.id === playlistId);
    if (!target && playlists.length === 1) target = playlists[0];
    if (!target && !playlists.length) target = createPlaylist("Minha playlist");
    if (!target) return choosePlaylist(value);
    const rows = target.tracks || [];
    const candidate = { ...value, kind: "music", catalogId: value.catalogId || value.metadataSources?.catalogId };
    const existing = rows.find((track) => MusicModel.sameItem(track, candidate)) ||
      MusicModel.findRecording(rows, candidate) ||
      rows.find((track) => MusicModel.recordingMatch(track, candidate) === 3);
    if (existing) return existing;
    const row = {
      ...value,
      id: uid(),
      collectionId: value.collectionId || value.id || "",
      kind: "music",
      catalogId: value.catalogId || value.metadataSources?.catalogId || "",
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
  function playPlaylist(id, startIndex = 0) {
    const playlist = getPlaylists().find((item) => item.id === id);
    if (!playlist?.tracks?.length) throw Error("Esta playlist não tem faixas.");
    return startContext({
      type: "playlist",
      sourceId: playlist.id,
      title: playlist.name,
      tracks: playlist.tracks,
      startIndex,
    });
  }
  function renderSavedPlaylists() {
    const playlists = getPlaylists();
    if (!playlists.some((entry) => entry.id === selectedPlaylistId))
      selectedPlaylistId = playlists[0]?.id || "";
    libraryNav.replaceChildren();
    for (const playlist of playlists) {
      const choice = button(playlist.name, () => {
        selectedPlaylistId = playlist.id;
        renderSavedPlaylists();
        libraryNav.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      }, "spaceamp-playlist-choice");
      choice.setAttribute("aria-pressed", String(playlist.id === selectedPlaylistId));
      choice.append(el("small", "", String((playlist.tracks || []).length) + " faixas"));
      libraryNav.append(choice);
    }
    libraryContent.replaceChildren();
    const playlist = playlists.find((entry) => entry.id === selectedPlaylistId);
    if (!playlist) {
      libraryContent.append(
        el("p", "spaceamp-library-empty", "Crie uma playlist ou adicione faixas usando + playlist nas páginas de música."),
      );
      return;
    }
    const heading = el("div", "spaceamp-library-heading"),
      title = el("h2", "", playlist.name),
      count = el("small", "", String((playlist.tracks || []).length) + " faixas");
    heading.append(title, count);
    const actions = el("div", "spaceamp-library-actions"),
      play = button("▶ tocar playlist", () => playPlaylist(playlist.id));
    play.disabled = !playlist.tracks?.length;
    const rename = button("renomear", () => {
      const name = window.prompt("Nome da playlist", playlist.name);
      if (name == null) return;
      const value = String(name).trim().slice(0, 120);
      if (!value) return toast("Digite um nome para a playlist.");
      persistPlaylists(getPlaylists().map((row) => row.id === playlist.id ? { ...row, name: value } : row));
    });
    const remove = button("excluir", () => {
      if (!window.confirm("Excluir a playlist “" + playlist.name + "”? As músicas da Collection e os arquivos locais serão mantidos.")) return;
      persistPlaylists(getPlaylists().filter((row) => row.id !== playlist.id));
    });
    actions.append(play, rename, remove);
    const addRow = el("div", "spaceamp-library-add"),
      addTrackSelect = el("select"),
      addTrackButton = button("＋ adicionar da Collection", () => {
        const item = (window.CollectionActions?.getItems() || []).find(
          (entry) => entry.id === addTrackSelect.value && entry.kind === "music",
        );
        if (!item) return toast("Escolha uma música da Collection.");
        const before = (getPlaylists().find((entry) => entry.id === playlist.id)?.tracks || []).length;
        addToPlaylist(item, playlist.id);
        const after = (getPlaylists().find((entry) => entry.id === playlist.id)?.tracks || []).length;
        if (before === after) toast("Esta faixa já está na playlist.");
      });
    addTrackSelect.setAttribute("aria-label", "Música da Collection para adicionar");
    const collectionTracks = (window.CollectionActions?.getItems() || []).filter(
      (item) => item.kind === "music",
    );
    addTrackSelect.append(new Option("Escolha uma música da Collection…", ""));
    for (const item of collectionTracks)
      addTrackSelect.append(
        new Option(item.title + (item.artist ? " · " + item.artist : ""), item.id),
      );
    addTrackButton.disabled = !collectionTracks.length;
    addRow.append(addTrackSelect, addTrackButton);
    const tracks = el("ol", "playlist-rows spaceamp-library-tracks");
    for (const [index, track] of (playlist.tracks || []).entries()) {
      const row = el("li", "playlist-row spaceamp-library-row"),
        select = button(
          String(index + 1).padStart(2, "0") + " · " + track.title,
          () => playPlaylist(playlist.id, index),
          "playlist-track spaceamp-library-track",
        ),
        tools = el("div", "mini-actions");
      if (track.artist) select.append(el("small", "", track.artist));
      const moveTrack = (delta) => {
        const current = getPlaylists().find((entry) => entry.id === playlist.id);
        const rows = current?.tracks?.slice() || [], target = index + delta;
        if (target < 0 || target >= rows.length) return;
        [rows[index], rows[target]] = [rows[target], rows[index]];
        persistPlaylists(getPlaylists().map((entry) => entry.id === playlist.id ? { ...entry, tracks: rows } : entry));
      };
      tools.append(
        button("↑", () => moveTrack(-1)),
        button("↓", () => moveTrack(1)),
        button("×", () => persistPlaylists(getPlaylists().map((entry) => entry.id === playlist.id
          ? { ...entry, tracks: entry.tracks.filter((_, position) => position !== index) }
          : entry))),
      );
      tools.firstChild.setAttribute("aria-label", "Mover para cima: " + track.title);
      tools.firstChild.disabled = index === 0;
      tools.children[1].setAttribute("aria-label", "Mover para baixo: " + track.title);
      tools.children[1].disabled = index === playlist.tracks.length - 1;
      tools.lastChild.setAttribute("aria-label", "Remover da playlist: " + track.title);
      row.append(select, tools);
      tracks.append(row);
    }
    libraryContent.append(heading, actions, addRow, tracks);
  }
  function openLibrary() {
    renderSavedPlaylists();
    if (!libraryDialog.open) libraryDialog.showModal();
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
    const history = snapshot.history,
      visibleHistory = history
        .map((entry, historyIndex) => ({ ...entry, historyIndex }))
        .filter((entry) => entry.id !== activeTrack?.id);
    queueHistoryCount.textContent = visibleHistory.length +
      (visibleHistory.length === 1 ? " faixa" : " faixas");
    queueHistoryRows.replaceChildren();
    if (!visibleHistory.length) {
      queueHistoryRows.append(el("li", "spaceamp-queue-empty", "Nenhuma música anterior."));
    }
    for (const [displayIndex, entry] of visibleHistory.entries()) {
      const track = entry.entry;
      if (!track) continue;
      const row = el("li", "playlist-row spaceamp-queue-history-row"),
        title = button(track.title || "Sem título", () => {
          const replayed = queueManager.replayFromHistory(entry.historyIndex);
          if (replayed) void selectTrack(replayed.track.id, true);
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
