/* Collection and global controls are views of the existing SPACEAMP singleton. */
(function (root) {
  const amp = root.SPACEAMP;
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
    return root.CollectionActions?.getItems().find((i) => MusicModel.sameItem(i, item)) || item;
  }
  function resolve(item) {
    const detailed = item;
    item = saved(item);
    if (item !== detailed && detailed.isrc && MusicModel.sameItem(item, detailed) && (!item.isrc || item.isrcSource === 'MusicBrainz' && detailed.isrcSource === 'lrc.red' && item.isrc !== detailed.isrc)) {
      item = root.CollectionActions.saveMusic({...item, isrc:detailed.isrc, isrcSource:detailed.isrcSource, isrcRecordingId:detailed.isrcRecordingId,isrcLookupVersion:detailed.isrcLookupVersion});
    }
    if (!item.playbackSource) {
      const key = "myspace.trackVideo:" + item.artist + ":" + item.title;
      try {
        const url = localStorage.getItem(key);
        if (url)
          item = root.CollectionActions.saveMusic({
            ...item,
            playbackSource: MusicModel.source({ type: "youtube", url }),
          });
      } catch {}
    }
    return item;
  }
  function actions(item) {
    const box = node("div");
    box.className = "music-library-actions";
    item = resolve(item);
    if (item.playbackSource) {
      box.append(
        button("▶ tocar agora", () => amp.play(MusicModel.queueTrack(resolve(item)))),
        button("+ fila", () => amp.enqueue(MusicModel.queueTrack(resolve(item)))),
      );
    }
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
    box.append(button(item.playbackSource ? "trocar reprodução" : "vincular reprodução", () => link(item)));
    return box;
  }
  function link(item) {
    return root.MusicSourceLink.link(item);
  }
  function autoLink(item, options) {
    return root.MusicSourceLink.autoLink(item, options);
  }
  function initialize({ getQueue, getActive, persist }) {
    root.SpaceAmpGlobalUI.initialize({
      saveCurrent: () => {
        if (amp.getState().preview)
          throw Error("A prévia não é uma faixa da fila. Vincule a reprodução completa na Collection.");
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
  root.MusicBridge = { actions, link, initialize, autoLink };
})(window);
