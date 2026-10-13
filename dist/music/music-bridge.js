/* Collection and global controls are views of the existing SPACEAMP singleton. */
(function (root) {
  const amp = root.SPACEAMP;
  let playlist;
  let getDownloadInterval = () => 60;
  function configurePlaylist(api) {
    playlist = api;
  }
  function playlistItem(item) {
    const rows = (playlist?.getPlaylists?.() || []).flatMap((list) => list.tracks || []).map((track) => ({
      ...track,
      kind: "music",
      catalogId: track.catalogId || track.metadataSources?.catalogId,
    }));
    return (
      rows.find((row) => MusicModel.sameItem(row, { ...item, kind: "music" })) ||
      MusicModel.findRecording(rows, { ...item, kind: "music" }) ||
      rows.find((row) => MusicModel.recordingMatch(row, { ...item, kind: "music" }) === 3)
    );
  }
  function inPlaylist(item) {
    return !!playlistItem(item);
  }
  function addToPlaylist(item) {
    if (!playlist) throw Error("Playlist indisponível.");
    return playlist.choosePlaylist?.(resolve(item)) || playlist.addToPlaylist(MusicModel.queueTrack(resolve(item)));
  }
  function playlistButton(item) {
    const b = button(inPlaylist(item) ? "✓ playlists" : "+ playlist", async () => {
      b.disabled = true;
      try {
        const track = await prepareTrack(item);
        if (!canPlay(track)) {
          link(track);
          return;
        }
        if (playlist?.choosePlaylist) await playlist.choosePlaylist(track);
        else addToPlaylist(track);
      } finally {
        b.disabled = false;
      }
      b.textContent = inPlaylist(item) ? "✓ playlists" : "+ playlist";
    });
    b.classList.add("music-track-playlist");
    b.setAttribute("aria-label", "Adicionar a uma playlist: " + item.title);
    return b;
  }
  const node = (tag, text = "") => {
    const n = document.createElement(tag);
    n.textContent = text;
    return n;
  };
  function button(text, action) {
    const b = node("button", text);
    b.type = "button";
    b.onclick = (e) => {
      e.stopPropagation();
      Promise.resolve()
        .then(action)
        .catch((error) => toast(error.message));
    };
    return b;
  }
  function saved(item) {
    const items = root.CollectionActions?.getItems() || [];
    return items.find((i) => MusicModel.sameItem(i, item)) || MusicModel.findRecording(items, item) || item;
  }
  function resolve(item) {
    const detailed = item;
    item = saved(item);
    if (
      item !== detailed &&
      detailed.mediaType === "video" &&
      detailed.playbackSource?.type === "youtube" &&
      item.playbackSourceOrigin !== "manual" &&
      (!item.playbackSource ||
        (item.playbackSource.type === "youtube" &&
          item.playbackSource.videoId === item.catalogId?.split(":")[2])) &&
      detailed.playbackSource.videoId !== item.catalogId?.split(":")[2]
    )
      item = root.CollectionActions.updateItem(item.id, {
        playbackSource: detailed.playbackSource,
        playbackSourceOrigin: "catalog",
        mediaType: detailed.mediaType,
        playbackLookup: undefined,
      });
    if (
      item !== detailed &&
      detailed.isrc &&
      MusicModel.sameItem(item, detailed) &&
      (!item.isrc ||
        (item.isrcSource === "MusicBrainz" &&
          detailed.isrcSource === "lrc.red" &&
          item.isrc !== detailed.isrc))
    ) {
      item = root.CollectionActions.saveMusic({
        ...item,
        isrc: detailed.isrc,
        isrcSource: detailed.isrcSource,
        isrcRecordingId: detailed.isrcRecordingId,
        isrcLookupVersion: detailed.isrcLookupVersion,
      });
    }
    if (!item.playbackSource && detailed.playbackSource)
      item = { ...item, playbackSource: detailed.playbackSource };
    if (!item.playbackSource) {
      const key = "myspace.trackVideo:" + item.artist + ":" + item.title;
      try {
        const url = localStorage.getItem(key);
        if (url) item = { ...item, playbackSource: MusicModel.source({ type: "youtube", url }) };
      } catch {}
    }
    return item;
  }
  function actions(item) {
    const box = node("div");
    box.className = "music-library-actions";
    item = resolve(item);
    if (item.kind === "music") {
      box.append(
        button("▶ tocar agora", () => play(item)),
        button("+ fila", () => enqueue(item)),
        button("▶| a seguir", () => enqueue(item, { next: true })),
      );
    }
    const initialLabel =
      item.playbackSource?.type === "local" ? "↓ exportar arquivo" : "↓ baixar offline";
    const download = button(initialLabel, async () => {
      if (download.disabled) return;
      download.disabled = true;
      download.textContent = "baixando…";
      try {
        const result = await root.MusicSourceLink.download(item, { getDownloadInterval });
        if (result === "saved") download.textContent = "↓ exportar arquivo";
        else if (result === "configure") download.textContent = initialLabel;
      } catch (error) {
        download.textContent = initialLabel;
        throw error;
      } finally {
        download.disabled = false;
      }
    });
    box.append(download);
    if (!item.playbackSource && item.playbackLookup) {
      const status = node(
        "small",
        {
          searching: "buscando reprodução…",
          choose: "escolha um resultado",
          unconfigured: "vincule a reprodução",
          failed: "busca indisponível · vínculo manual disponível",
          "not-found": "nenhum resultado seguro encontrado",
        }[item.playbackLookup] || "",
      );
      status.className = "music-source-status";
      box.append(status);
    }
    box.append(
      button(item.playbackSource ? "trocar reprodução" : "vincular reprodução", () => link(item)),
    );
    return box;
  }
  function canPlay(item) {
    try {
      return !!usableSource(item);
    } catch {
      return false;
    }
  }
  function usableSource(item) {
    const current = saved(item);
    const source = MusicModel.source(current.playbackSource || item.playbackSource);
    if (
      source?.type === "youtube" &&
      (current.mediaType === "video" || item.mediaType === "video") &&
      current.playbackSourceOrigin !== "manual" &&
      source.videoId === item.catalogId?.split(":")[2]
    )
      return null;
    return source;
  }
  async function play(item, options = {}) {
    const track = await prepareTrack(item);
    if (!canPlay(track)) return link(track);
    if (playlist?.startContext) {
      const context = options.context;
      const tracks = Array.isArray(context?.tracks)
        ? context.tracks.map((entry, index) => index === context.startIndex ? track : entry)
        : [track];
      return playlist.startContext({
        type: context?.type || "single",
        sourceId: context?.sourceId || track.catalogId || track.id || "",
        title: context?.title || track.albumTitle || track.title,
        tracks,
        startIndex: context?.startIndex || 0,
        getNext: context?.getNext,
      });
    }
    return amp.play(MusicModel.queueTrack(track));
  }
  async function enqueue(item, options = {}) {
    const track = await prepareTrack(item);
    if (!canPlay(track)) return link(track);
    if (playlist?.enqueue) return playlist.enqueue(track, options);
    return amp.enqueue(MusicModel.queueTrack(track));
  }
  async function prepareTrack(item) {
    item = resolve(item);
    if (canPlay(item)) return resolve(item);
    const queued = playlistItem(item);
    if (queued?.playbackSource) {
      const candidate = { ...item, playbackSource: queued.playbackSource };
      try {
        const source = MusicModel.source(queued.playbackSource);
        if (
          source &&
          !(item.mediaType === "video" && source.type === "youtube" && source.videoId === item.catalogId?.split(":")[2])
        )
          return resolve(candidate);
      } catch {}
    }
    const cached = root.Catalog?.peekCore?.(item);
    if (cached) {
      const track = resolve({ ...item, ...cached });
      if (canPlay(track)) return track;
    }
    const previous = saved(item);
    const detailed = await Catalog.enrich(await Catalog.prefetchCore(item));
    if (previous.id && !root.CollectionActions.getItems().some((row) => row.id === previous.id))
      throw Error("Esta música foi removida da coleção.");
    return resolve(detailed);
  }
  function link(item) {
    return root.MusicSourceLink.link(item, { getDownloadInterval });
  }
  function autoLink(item, options) {
    return root.MusicSourceLink.autoLink(item, options);
  }
  function initialize({ getQueue, getActive, persist, getMediaDownloadInterval }) {
    if (typeof getMediaDownloadInterval === "function")
      getDownloadInterval = getMediaDownloadInterval;
    root.SpaceAmpGlobalUI.initialize({
      openLibrary: () => playlist?.openLibrary?.(),
      openQueue: () => playlist?.openQueue?.(),
      saveCurrent: () => {
        if (amp.getState().preview)
          throw Error(
            "A prévia não é uma faixa da fila. Vincule a reprodução completa na Collection.",
          );
        const track = getQueue().find((t) => t.id === getActive());
        if (!track) throw Error("Selecione uma faixa primeiro.");
        const playbackSource =
          track.playbackSource ||
          (track.url
            ? MediaEmbeds.parse(track.url)?.provider === "youtube"
              ? MusicModel.source({ type: "youtube", url: track.url })
              : MusicModel.source({ type: "audio", url: track.url })
            : track.local
              ? { type: "local", fileRef: track.fileRef || track.id }
              : null);
        if (!playbackSource) throw Error("Vincule a reprodução primeiro.");
        const item = root.CollectionActions.saveMusic({
          title: track.title,
          artist: track.artist,
          image: track.album,
          albumTitle: track.albumTitle,
          isrc: track.isrc,
          metadataSources: track.metadataSources,
          playbackSource,
          id: track.collectionId,
        });
        track.collectionId = item.id;
        persist();
        toast("Música salva na Collection.");
      },
    });
  }
  root.MusicBridge = {
    actions,
    play,
    prepareTrack,
    canPlay,
    link,
    initialize,
    autoLink,
    configurePlaylist,
    inPlaylist,
    addToPlaylist,
    getPlaylists: () => playlist?.getPlaylists?.() || [],
    playPlaylist: (id, startIndex) => playlist?.playPlaylist?.(id, startIndex),
    playlistButton,
    playAlbum: async (items, context = {}) => {
      if (!playlist?.playAlbum) throw Error("Playlist indisponível.");
      if (!items.length) throw Error("O álbum não tem faixas disponíveis para reprodução.");
      const startIndex = Math.max(0, Math.min(items.length - 1, Number(context.startIndex) || 0));
      const first = context.firstTrack || (await prepareTrack(items[startIndex]));
      if (!canPlay(first)) return link(first);
      return playlist.playAlbum(items, { ...context, startIndex, firstTrack: first });
    },
    getDownloadInterval: () => getDownloadInterval(),
  };
})(window);
