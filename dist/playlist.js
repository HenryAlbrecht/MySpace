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
    selection = 0, previewing = false;
  const mediaUrls = new Map(), mediaReads = new Map();
  let mediaRevision = 0;
  let requestedTrack = null, metadataTimer = 0, metadataAbort = null;
  function cancelMetadata() { clearTimeout(metadataTimer); metadataAbort?.abort(); metadataAbort = null; }
  function enrichTrack(track, token) {
    const catalogId = track.metadataSources?.catalogId;
    if (track.isrc || !/^itunes:[1-9]\d{0,15}$/.test(catalogId || "")) return;
    metadataTimer = setTimeout(async () => {
      const controller = metadataAbort = new AbortController();
      try {
        const detail = await Catalog.details({kind:"music", catalogId, title:track.title, artist:track.artist}, {signal:controller.signal});
        if (token !== selection || controller.signal.aborted) return;
        const identifier = MusicModel.library(detail).isrc;
        if (!identifier) return;
        track.isrc = identifier;
        const stored = window.CollectionActions?.getItems().find(item => item.id === track.collectionId && item.kind === "music" && item.catalogId === catalogId);
        if (stored && !stored.isrc) window.CollectionActions.updateItem(stored.id, {isrc:identifier, isrcSource:detail.isrcSource, isrcRecordingId:detail.isrcRecordingId});
        state.isrc = identifier;
        if (ytTrack) ytTrack = {...ytTrack, isrc:identifier};
        updateAmp();
      } catch { /* Optional metadata must not delay or interrupt playback. */ }
      finally { if (metadataAbort === controller) metadataAbort = null; }
    }, 150);
  }
  let draggedTrack=null,detachedIndex=null;
  function reorderTrack(id,targetId){
    const tracks=getData().tracks.slice(),from=tracks.findIndex(t=>t.id===id),to=tracks.findIndex(t=>t.id===targetId);
    if(from<0||to<0||from===to)return;
    tracks.splice(to,0,tracks.splice(from,1)[0]);if(save({...getData(),tracks}))renderPlaylist();
  }
  function removeFromQueue(id){
    const data=getData(),index=data.tracks.findIndex(t=>t.id===id);if(index<0)return;
    const active=id===data.activeTrack;if(active)detachedIndex=index;
    if(!save({...data,tracks:data.tracks.filter(t=>t.id!==id),startTrack:data.startTrack===id?'':data.startTrack}))return;
    // The current playback remains alive even after its row leaves the queue.
    if(!active)deleteMedia(id);renderPlaylist();toast('Removida da playlist. A coleção foi mantida.');
  }
  const mediaOperation = (mode, id, value) =>
    mode === "readonly"
      ? MediaStorage.get(id)
      : value === undefined
        ? MediaStorage.remove(id)
        : MediaStorage.put(id, value);
  const deleteMedia = (id) => {
    if(window.CollectionActions?.getItems().some(item=>item.playbackSource?.fileRef===id))return;
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
    const selected=getData().tracks.find(t=>t.id===getData().activeTrack);
    const id = selected?.fileRef || selected?.id;
    try {
      await mediaOperation("readwrite", id, file);
      const row = selected;
      if (row) {
        row.local = true;
        row.fileName = file.name;
        save();
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
    track={...track,id:track.fileRef||track.id};
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
    })().finally(() => { if (mediaReads.get(track.id) === read) mediaReads.delete(track.id); });
    mediaReads.set(track.id, read);
    return read;
  }

  async function selectTrack(id, play = false, transient = null) {
    const token = ++selection,
      track = transient || getData().tracks.find((t) => t.id === id);
    if (!track) return;
    requestedTrack = track.id; cancelMetadata();
    if (MediaEmbeds.parse(track.url) && (!track.title || ['Sem título', 'Nenhuma música'].includes(track.title))) {
      const info = await MediaEmbeds.metadata(track.url);
      if (token !== selection) return;
      if (info) { track.title = info.title || track.title; track.artist = track.artist || info.artist; track.album = track.album || info.thumbnail; }
    }
    const source = await sourceFor(track);
    if (token !== selection) return;
    requestedTrack = null;
    previewing=!!transient;
    window.SPACEAMP.progress({preview:previewing});
    if(!transient){detachedIndex=null;getData().activeTrack = id;save();}
    state = {
      ...state,
      song: track.title,
      artist: track.artist || "",
      album: track.album || "",
      albumTitle: track.albumTitle || "",
      isrc: track.isrc || "",
      musicUrl: track.url || "",
    };
    localAudio = source.startsWith("blob:") ? source : "";
    render();
    renderPlaylist();
    enrichTrack(track, token);
    if (MediaEmbeds.parse(track.url)) {if(play)window.SPACEAMP.play();return;}
    if (!source) {
      window.SPACEAMP.progress({transitioning:false});
      $("playerNote").textContent =
        "Arquivo não disponível. Clique em “vincular arquivo” nesta faixa.";
      const linkFile=button('vincular arquivo',()=>{getData().activeTrack=track.id;relink.click();},'text-action');
      linkFile.setAttribute('aria-label','Vincular arquivo da faixa atual');$('playerNote').append(' ',linkFile);
      return;
    }
    if (play) {
      try {
        await audio.play();
      } catch {
        if (token === selection) toast("Não consegui tocar essa faixa. Verifique o arquivo ou link.");
      }
    }
  }
  function clearTrack() {
    selection++; requestedTrack = null; cancelMetadata();
    audio.pause();
    state = {
      ...state,
      song: defaults.song,
      artist: "",
      album: "",
      albumTitle: "",
      isrc: "",
      musicUrl: "",
    };
    localAudio = "";
    loadedSource = "";
    render();
  }
  async function stepTrack(direction) {
    if (!getData().tracks.length) return;
    const index = getData().tracks.findIndex(
        (t) => t.id === (requestedTrack || getData().activeTrack),
      ),
      next =
        ((index<0&&detachedIndex!=null?(direction>0?detachedIndex-1:detachedIndex):Math.max(0,index)) + direction + getData().tracks.length) %
        getData().tracks.length;
    window.SPACEAMP.progress({transitioning:true});
    try { await selectTrack(getData().tracks[next].id, true); } catch(error) { window.SPACEAMP.progress({transitioning:false}); throw error; }
  }
  function finishTrack(){if(previewing){window.SPACEAMP.stop();return;}if(audio.loop&&detachedIndex==null)return stepTrack(0);if(getData().tracks.length>1||detachedIndex!=null&&getData().tracks.length)return stepTrack(1);}
  window.SPACEAMP.setNavigation({previous:()=>stepTrack(-1),next:()=>stepTrack(1),ended:finishTrack});
  function enqueue(value){
    const tracks=getData().tracks;let row=tracks.find(t=>value.collectionId&&t.collectionId===value.collectionId);
    if(!row)row=tracks.find(t=>value.fileRef&&t.id===value.fileRef);
    if(row)Object.assign(row,value);else{row={...value,id:value.fileRef||uid()};tracks.push(row);}
    save();renderPlaylist();return row.id;
  }
  window.SPACEAMP.configure({enqueue,preview:value=>{if(!safeUrl(value.url)||MediaEmbeds.parse(value.url))throw Error('URL de prévia inválida.');return selectTrack(null,true,{...value,local:false});},select:value=>selectTrack(typeof value==='string'?value:enqueue(value),true)});
  const basePlay = ()=>window.SPACEAMP.getState().playing?window.SPACEAMP.pause():window.SPACEAMP.play();
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
    if(previewing){window.SPACEAMP.stop();playing();return;}
    if (!audio.loop) finishTrack();
    playing();
  };
  function renderPlaylist() {
    window.SPACEAMP.setQueue(getData().tracks);
    queueFold.hidden = !getData().tracks.length;
    queueTitle.textContent = "playlist (" + getData().tracks.length + ")";
    queue.replaceChildren();
    queueSettings.hidden = !getData().tracks.length;
    for (const [index, t] of getData().tracks.entries()) {
      const row = el("li", "playlist-row");
      row.dataset.trackId=t.id;row.draggable=true;
      row.ondragstart=e=>{draggedTrack=t.id;e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move';row.classList.add('playlist-dragging');};
      row.ondragover=e=>{if(draggedTrack&&draggedTrack!==t.id){e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('playlist-drop-target');}};
      row.ondragleave=()=>row.classList.remove('playlist-drop-target');
      row.ondrop=e=>{e.preventDefault();reorderTrack(draggedTrack,t.id);draggedTrack=null;};
      row.ondragend=()=>{draggedTrack=null;for(const entry of queue.children)entry.classList.remove('playlist-dragging','playlist-drop-target');};
      row.classList.toggle("active", !previewing && t.id === getData().activeTrack);
      if(!previewing&&t.id===getData().activeTrack){row.setAttribute('aria-current','true');row.append(el('small','playlist-current','faixa atual'));}
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
        button("↑", () => reorderTrack(t.id,getData().tracks[index-1]?.id), ""),
        button("↓", () => reorderTrack(t.id,getData().tracks[index+1]?.id), ""),
        button("×", () => removeFromQueue(t.id), ""),
      );
      tools.children[tools.children.length-3].setAttribute('aria-label','Mover para cima: '+t.title);tools.children[tools.children.length-3].disabled=index===0;
      tools.children[tools.children.length-2].setAttribute('aria-label','Mover para baixo: '+t.title);tools.children[tools.children.length-2].disabled=index===getData().tracks.length-1;
      tools.lastChild.setAttribute("aria-label", "Remover da playlist: " + t.title);
      row.append(tools);
      queue.append(row);
    }
    startSelect.replaceChildren();
    for (const t of getData().tracks)
      startSelect.append(new Option(t.title, t.id));
    startSelect.value = getData().startTrack || getData().tracks[0]?.id || "";
  }
  // Importa a música já configurada, sem alterar o perfil existente.
  if (!getData().tracks.length && !getData().activeTrack && state.song !== defaults.song) {
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
      active = getData().tracks.find((t) => !previewing && t.id === getData().activeTrack);
    if (!file && !url && !active) return;
    const create = newTrack || !active || url !== active.url;
    const track = {
      ...(!create?active:{}),
      id: create ? uid() : active.id,
      title: state.song || file?.name || "Sem título",
      artist: state.artist,
      album: state.album,
      albumTitle: file ? "" : state.albumTitle || "",
      isrc: file ? "" : state.isrc || "",
      url: file ? "" : url,
      local: !!file || (!url && active?.local),
      fileName: file?.name || active?.fileName || "",
    };
    if(track.local){track.fileRef=file?track.id:track.fileRef||track.id;track.playbackSource={type:'local',fileRef:track.fileRef};}
    else if(MediaEmbeds.parse(track.url)?.provider==='youtube')track.playbackSource=MusicModel.source({type:'youtube',url:track.url});
    else if(!MediaEmbeds.parse(track.url)&&track.url)track.playbackSource=MusicModel.source({type:'audio',url:track.url});
    else delete track.playbackSource;
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
      selection++; requestedTrack = null; cancelMetadata();
      audio.pause();
      mediaRevision++; mediaReads.clear();
      for (const url of mediaUrls.values()) URL.revokeObjectURL(url);
      mediaUrls.clear();
    },
  };
}
