/* Playlist e integração com o player; o perfil fornece seus dados por callbacks. */
function createPlaylistController({
  getData,
  save,
  move,
  confirmDelete,
  el,
  button,
  uid,
}) {
  let addingTrack = false,
    selection = 0;
  const mediaUrls = new Map();
  const mediaOperation = (mode, id, value) =>
    mode === "readonly"
      ? MediaStorage.get(id)
      : value === undefined
        ? MediaStorage.remove(id)
        : MediaStorage.put(id, value);
  const deleteMedia = (id) => {
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
  const startSelect = el("select");
  startSelect.setAttribute("aria-label", "Música inicial do perfil");
  startSelect.style.maxWidth = "65%";
  queueSettings.append(el("span", "", "música inicial"), startSelect);
  startSelect.onchange = () =>
    save({ ...getData(), startTrack: startSelect.value });
  const buttons = $("play").parentElement;
  buttons.prepend(button("◀", () => stepTrack(-1), ""));
  buttons.insertBefore(
    button("▶|", () => stepTrack(1), ""),
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
    const id = getData().activeTrack;
    try {
      await mediaOperation("readwrite", id, file);
      const row = getData().tracks.find((t) => t.id === id);
      if (row) {
        row.local = true;
        row.fileName = file.name;
        save();
      }
      if (mediaUrls.has(id)) URL.revokeObjectURL(mediaUrls.get(id));
      mediaUrls.set(id, URL.createObjectURL(file));
      await selectTrack(id, true);
      toast("Arquivo de áudio salvo.");
    } catch {
      toast("Não foi possível guardar o arquivo neste navegador.");
    }
    relink.value = "";
  };
  async function sourceFor(track) {
    if (track.url) return safeUrl(track.url);
    if (mediaUrls.has(track.id)) return mediaUrls.get(track.id);
    try {
      const blob = await mediaOperation("readonly", track.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        mediaUrls.set(track.id, url);
        return url;
      }
    } catch {}
    return "";
  }
  async function selectTrack(id, play = false) {
    const token = ++selection,
      track = getData().tracks.find((t) => t.id === id);
    if (!track) return;
    if (MediaEmbeds.parse(track.url) && (!track.title || ['Sem título', 'Nenhuma música'].includes(track.title))) {
      const info = await MediaEmbeds.metadata(track.url);
      if (token !== selection) return;
      if (info) { track.title = info.title || track.title; track.artist = track.artist || info.artist; track.album = track.album || info.thumbnail; }
    }
    const source = await sourceFor(track);
    if (token !== selection) return;
    getData().activeTrack = id;
    save();
    state = {
      ...state,
      song: track.title,
      artist: track.artist || "",
      album: track.album || "",
      musicUrl: track.url || "",
    };
    localAudio = source.startsWith("blob:") ? source : "";
    render();
    renderPlaylist();
    if (MediaEmbeds.parse(track.url)) return;
    if (!source) {
      $("playerNote").textContent =
        "Arquivo não disponível. Clique em “vincular arquivo” nesta faixa.";
      return;
    }
    if (play) {
      try {
        await audio.play();
      } catch {
        toast("Não consegui tocar essa faixa. Verifique o arquivo ou link.");
      }
    }
  }
  function clearTrack() {
    selection++;
    audio.pause();
    state = {
      ...state,
      song: defaults.song,
      artist: "",
      album: "",
      musicUrl: "",
    };
    localAudio = "";
    loadedSource = "";
    render();
  }
  async function stepTrack(direction) {
    if (!getData().tracks.length) return;
    const index = getData().tracks.findIndex(
        (t) => t.id === getData().activeTrack,
      ),
      next =
        (Math.max(0, index) + direction + getData().tracks.length) %
        getData().tracks.length;
    await selectTrack(getData().tracks[next].id, true);
  }
  window.SPACEAMP.setNavigation({previous:()=>stepTrack(-1),next:()=>stepTrack(1)});
  const basePlay = $("play").onclick;
  $("play").onclick = async () => {
    if (getData().tracks.length && !loadedSource) {
      if (!getData().activeTrack) await selectTrack(getData().tracks[0].id);
      if (!loadedSource) {
        toast("Vincule o arquivo de áudio desta faixa.");
        return;
      }
    }
    await basePlay();
  };
  audio.onended = () => {
    playing();
    if (!audio.loop && getData().tracks.length > 1) stepTrack(1);
  };
  function renderPlaylist() {
    queueFold.hidden = !getData().tracks.length;
    queueTitle.textContent = "playlist (" + getData().tracks.length + ")";
    queue.replaceChildren();
    queueSettings.hidden = !getData().tracks.length;
    for (const [index, t] of getData().tracks.entries()) {
      const row = el("li", "playlist-row");
      row.classList.toggle("active", t.id === getData().activeTrack);
      row.append(el("span", "counter", String(index + 1).padStart(2, "0")));
      const title = button(
        t.title,
        () => selectTrack(t.id, true),
        "playlist-track",
      );
      if (t.artist) title.append(el("small", "", t.artist));
      title.append(el('small','playlist-source',SpaceAmp.track(t,MediaEmbeds.parse(t.url)).source));
      row.append(title);
      const tools = el("div", "mini-actions");
      if (!t.url)
        tools.append(
          button(
            "vincular arquivo",
            () => {
              getData().activeTrack = t.id;
              save();
              relink.click();
            },
            "",
          ),
        );
      tools.append(
        button(
          "editar",
          async () => {
            addingTrack = false;
            await selectTrack(t.id);
            openEditor("music");
          },
          "",
        ),
        button("↑", () => move("tracks", t.id, -1), ""),
        button("↓", () => move("tracks", t.id, 1), ""),
        button("×", () => confirmDelete("tracks", t.id), ""),
      );
      tools.lastChild.setAttribute("aria-label", "Excluir faixa " + t.title);
      row.append(tools);
      queue.append(row);
    }
    startSelect.replaceChildren();
    for (const t of getData().tracks)
      startSelect.append(new Option(t.title, t.id));
    startSelect.value = getData().startTrack || getData().tracks[0]?.id || "";
  }
  // Importa a música já configurada, sem alterar o perfil existente.
  if (!getData().tracks.length && state.song !== defaults.song) {
    const t = {
      id: uid(),
      title: state.song,
      artist: state.artist,
      album: state.album,
      url: state.musicUrl,
      local: !state.musicUrl,
    };
    getData().tracks.push(t);
    getData().activeTrack = t.id;
    getData().startTrack = t.id;
    save();
  }
  const baseSubmit = form.onsubmit;
  $("addMusic").onclick = () => {
    addingTrack = true;
    openEditor("music");
    for (const key of ["song", "artist", "musicUrl"])
      form.elements.namedItem(key).value = "";
    pending.album = "";
  };
  for (const id of ["editTop", "editProfile", "editBanner"])
    $(id).onclick = () => {
      addingTrack = false;
      openEditor();
    };
  form.onsubmit = async (event) => {
    const before = state,
      file = $("musicFile").files[0],
      newTrack = addingTrack || !!file;
    await baseSubmit(event);
    if ($("editor").open || before === state) return;
    const url = state.musicUrl,
      active = getData().tracks.find((t) => t.id === getData().activeTrack);
    if (!file && !url && !active) return;
    const create = newTrack || !active || url !== active.url;
    const track = {
      id: create ? uid() : active.id,
      title: state.song || file?.name || "Sem título",
      artist: state.artist,
      album: state.album,
      url: file ? "" : url,
      local: !!file || (!url && active?.local),
      fileName: file?.name || active?.fileName || "",
    };
    if (file) {
      if (mediaUrls.has(track.id)) URL.revokeObjectURL(mediaUrls.get(track.id));
      mediaUrls.set(track.id, URL.createObjectURL(file));
      try {
        await mediaOperation("readwrite", track.id, file);
      } catch {
        toast(
          "A música toca agora, mas será preciso vincular o arquivo ao reabrir.",
        );
      }
    }
    const tracks = create
      ? [...getData().tracks, track]
      : getData().tracks.map((t) => (t.id === track.id ? track : t));
    if (
      save({
        ...getData(),
        tracks,
        activeTrack: track.id,
        startTrack: getData().startTrack || track.id,
      })
    ) {
      if (create) await selectTrack(track.id);
      renderPlaylist();
    }
    addingTrack = false;
  };

  return {
    render: renderPlaylist,
    selectTrack,
    clearTrack,
    removeMedia: deleteMedia,
    cancel() {
      selection++;
      audio.pause();
      for (const url of mediaUrls.values()) URL.revokeObjectURL(url);
      mediaUrls.clear();
    },
  };
}
