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
  const queue = el("ol", "playlist-rows"),
    queueSettings = el("div", "playlist-settings"),
    queueFold = el("details", "playlist-fold"),
    queueTitle = el("summary", "", "playlist");
  queueFold.append(queueTitle, queue, queueSettings);
  $("music").append(queueFold);
  const savedFold = el("details", "saved-playlists-fold"),
    savedTitle = el("summary", "", "playlists salvas"),
    savedList = el("div", "saved-playlists-list"),
    newPlaylistName = el("input"),
    newPlaylistButton = button("＋ criar playlist", () => {
      try {
        createPlaylist(newPlaylistName.value);
        newPlaylistName.value = "";
      } catch (error) {
        toast(error.message);
      }
    });
  newPlaylistName.placeholder = "nome da playlist";
  newPlaylistName.setAttribute("aria-label", "Nome da nova playlist");
  savedFold.append(savedTitle, newPlaylistName, newPlaylistButton, savedList);
  $("music").append(savedFold);
  const shuffleButton = button("embaralhar", () => {
    const current = queueManager.snapshot();
    queueManager.setModes({ shuffle: !current.shuffle });
  });
  const repeatButton = button("repetir: não", () => {
    const current = queueManager.snapshot();
    const repeat = { off: "all", all: "one", one: "off" }[current.repeat];
    queueManager.setModes({ repeat });
  });
  queueSettings.append(shuffleButton, repeatButton);
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
    if (!track) return;
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
        if (token !== selection) return;
        if (!window.MusicBridge.canPlay(prepared)) {
          requestedTrack = null;
          window.SPACEAMP.progress({ transitioning: false });
          $("playerNote").textContent = "Esta faixa ainda não tem uma fonte de áudio válida.";
          return false;
        }
        track = { ...track, ...prepared };
        queueIndex = queueTracks().findIndex((entry) => entry.id === track.id);
      } catch (error) {
        if (token === selection) toast(error.message || "Não foi possível preparar esta faixa.");
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
      if (token !== selection) return;
      if (info) {
        track.title = info.title || track.title;
        track.artist = track.artist || info.artist;
        track.album = track.album || info.thumbnail;
      }
    }
    const source = await sourceFor(track);
    if (token !== selection) return;
    requestedTrack = null;
    previewing = !!transient;
    window.SPACEAMP.progress({ preview: previewing });
    window.SpaceAmpHost.setTrack(track, source);
    renderPlaylist();
    enrichTrack(track, token);
    if (MediaEmbeds.parse(track.url)) {
      if (play) window.SPACEAMP.play();
      return;
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
    window.SPACEAMP.progress({ transitioning: true });
    try {
      let next = direction < 0 ? queueManager.previous() : queueManager.next();
      if (!next && direction > 0) next = await loadNextContextTracks();
      for (let attempts = 0; next && attempts < queueTracks().length; attempts++) {
        const available = await selectTrack(next.track.id, true);
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
    savedFold.hidden = false;
    savedTitle.textContent = "playlists salvas (" + playlists.length + ")";
    savedList.replaceChildren();
    for (const playlist of playlists) {
      const group = el("details", "saved-playlist"),
        summary = el("summary", "", playlist.name + " · " + (playlist.tracks || []).length + " faixas"),
        actions = el("div", "mini-actions"),
        tracks = el("ol", "saved-playlist-tracks");
      const play = button("▶ tocar", () => playPlaylist(playlist.id));
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
      for (const [index, track] of (playlist.tracks || []).entries()) {
        const row = el("li", "saved-playlist-track"),
          select = button(String(index + 1).padStart(2, "0") + " · " + track.title, () => playPlaylist(playlist.id, index), "playlist-track"),
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
        tools.firstChild.disabled = index === 0;
        tools.children[1].disabled = index === playlist.tracks.length - 1;
        row.append(select, tools);
        tracks.append(row);
      }
      group.append(summary, actions, tracks);
      savedList.append(group);
    }
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
  function renderPlaylist() {
    const snapshot = queueManager.snapshot(), tracks = snapshot.queue;
    window.SPACEAMP.setQueue(tracks, {
      context: snapshot.context && {
        type: snapshot.context.type,
        sourceId: snapshot.context.sourceId,
        title: snapshot.context.title,
      },
      shuffle: snapshot.shuffle,
      repeat: snapshot.repeat,
    });
    queueFold.hidden = !tracks.length;
    queueTitle.textContent = "fila atual (" + tracks.length + ")";
    queue.replaceChildren();
    queueSettings.hidden = !tracks.length;
    shuffleButton.setAttribute("aria-pressed", String(snapshot.shuffle));
    shuffleButton.textContent = snapshot.shuffle ? "embaralhar: sim" : "embaralhar: não";
    repeatButton.textContent = "repetir: " + { off: "não", all: "fila", one: "faixa" }[snapshot.repeat];
    for (const [index, t] of tracks.entries()) {
      const row = el("li", "playlist-row");
      row.dataset.trackId = t.id;
      row.draggable = true;
      row.ondragstart = (e) => {
        draggedTrack = t.id;
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        row.classList.add("playlist-dragging");
      };
      row.ondragover = (e) => {
        if (draggedTrack && draggedTrack !== t.id) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          row.classList.add("playlist-drop-target");
        }
      };
      row.ondragleave = () => row.classList.remove("playlist-drop-target");
      row.ondrop = (e) => {
        e.preventDefault();
        reorderTrack(draggedTrack, t.id);
        draggedTrack = null;
      };
      row.ondragend = () => {
        draggedTrack = null;
        for (const entry of queue.children)
          entry.classList.remove("playlist-dragging", "playlist-drop-target");
      };
      row.classList.toggle("active", !previewing && index === snapshot.index);
      if (!previewing && index === snapshot.index) {
        row.setAttribute("aria-current", "true");
        row.append(el("small", "playlist-current", "faixa atual"));
      }
      row.append(el("span", "counter", String(index + 1).padStart(2, "0")));
      const title = button(t.title, () => selectTrack(t.id, true), "playlist-track");
      if (t.artist) title.append(el("small", "", t.artist));
      title.append(
        el("small", "playlist-source", SpaceAmp.track(t, MediaEmbeds.parse(t.url)).source),
      );
      row.append(title);
      const tools = el("div", "mini-actions");
      if (!t.url)
        tools.append(
          button(
            "vincular arquivo",
            () => {
              queueManager.select(index);
              relink.click();
            },
            "",
          ),
        );
      tools.append(
        button("↑", () => reorderTrack(t.id, tracks[index - 1]?.id), ""),
        button("↓", () => reorderTrack(t.id, tracks[index + 1]?.id), ""),
        button("×", () => removeFromQueue(t.id), ""),
      );
      tools.children[tools.children.length - 2].setAttribute(
        "aria-label",
        "Mover para cima: " + t.title,
      );
      tools.children[tools.children.length - 2].disabled = index === 0;
      tools.children[tools.children.length - 1].setAttribute(
        "aria-label",
        "Mover para baixo: " + t.title,
      );
      tools.children[tools.children.length - 1].disabled = index === tracks.length - 1;
      tools.lastChild.setAttribute("aria-label", "Remover da fila: " + t.title);
      row.append(tools);
      queue.append(row);
    }
    renderSavedPlaylists();
  }
  $("addMusic").onclick = () => {
    savedFold.open = true;
    newPlaylistName.focus();
  };

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
