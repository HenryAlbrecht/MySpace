/* Album operations use the existing playlist, source linker and CollectionActions. */
(function (root) {
  let activeDownload = false;
  const node = (tag, text = "") => {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  };
  const saved = (track) => root.CollectionActions.getItems().find(
    (item) => MusicModel.sameItem(item, track),
  ) || track;
  const interval = () => Math.max(60, Math.min(3600, Number(MusicBridge.getDownloadInterval()) || 60));
  function downloadAlbum(album) {
    if (activeDownload) return root.toast("Já existe um álbum sendo baixado.");
    const dialog = node("dialog");
    dialog.className = "music-link-dialog music-album-download";
    const form = node("form");
    const status = node("p", "Informe uma URL autorizada para cada faixa que deseja baixar. Faixas offline serão mantidas.");
    status.setAttribute("aria-live", "polite");
    const entries = album.albumTracks.map((track, index) => {
      const label = node("label", String(index + 1).padStart(2, "0") + " · " + track.title);
      const input = node("input");
      input.type = "url";
      input.placeholder = "https://fonte-autorizada/arquivo";
      input.setAttribute("aria-label", "Fonte autorizada: " + track.title);
      const source = saved(track).playbackSource;
      if (source?.type === "audio") input.value = source.url || "";
      if (source?.type === "local") {
        input.disabled = true;
        input.placeholder = "Disponível offline";
      }
      label.append(input);
      return { track, input, label };
    });
    const start = node("button", "↓ baixar faixas do álbum");
    start.type = "submit";
    const close = node("button", "fechar");
    close.type = "button";
    let cancelled = false;
    let wake;
    let timer;
    let controller;
    function cancel() {
      cancelled = true;
      controller?.abort();
      clearTimeout(timer);
      wake?.();
    }
    function wait(seconds) {
      return new Promise((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, seconds * 1000);
      });
    }
    close.onclick = () => {
      cancel();
      dialog.close();
    };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("close", () => {
      cancel();
      dialog.remove();
    });
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (activeDownload) return;
      const selected = entries.filter(({ track, input }) =>
        saved(track).playbackSource?.type !== "local" && input.value.trim(),
      ).map(({ track, input }) => ({ track, url: input.value.trim() }));
      if (!selected.length) {
        status.textContent = "Nenhuma faixa com fonte informada para baixar.";
        return;
      }
      activeDownload = true;
      cancelled = false;
      controller = new AbortController();
      start.disabled = true;
      close.textContent = "cancelar downloads";
      for (const entry of entries) entry.input.disabled = true;
      let completed = 0;
      let failed = 0;
      try {
        for (let index = 0; index < selected.length && !cancelled; index++) {
          const { track, url } = selected[index];
          let retry;
          do {
            retry = false;
            status.textContent = "Baixando " + (index + 1) + "/" + selected.length + " · " + track.title;
            try {
              await MusicSourceLink.download(track, { sourceUrl: url, getDownloadInterval: interval, signal: controller.signal });
              completed++;
            } catch (error) {
              if (error.name === "AbortError") {
                cancel();
                break;
              }
              if (error.retryAfterSeconds > 0 && !cancelled) {
                status.textContent = "Aguardando " + error.retryAfterSeconds + " segundos para continuar…";
                await wait(error.retryAfterSeconds);
                retry = !cancelled;
              } else {
                failed++;
                root.toast(track.title + ": " + error.message);
              }
            }
          } while (retry);
          if (index < selected.length - 1 && !cancelled) {
            const seconds = interval();
            status.textContent = completed + " baixada(s). Aguardando " + seconds + " segundos antes da próxima faixa…";
            await wait(seconds);
          }
        }
        status.textContent = (cancelled ? "Interrompido. " : "Concluído. ") + completed + " baixada(s), " + failed + " falha(s).";
      } finally {
        activeDownload = false;
        start.disabled = false;
        close.textContent = "fechar";
        for (const { track, input } of entries)
          input.disabled = saved(track).playbackSource?.type === "local";
      }
    };
    form.append(node("h2", "Baixar álbum · " + album.title), status, ...entries.map((entry) => entry.label), start, close);
    dialog.append(form);
    document.body.append(dialog);
    dialog.showModal();
  }
  function actions(album) {
    const box = node("div");
    box.className = "music-library-actions";
    const play = node("button", "▶ ouvir álbum");
    play.type = "button";
    const status = node("small");
    status.setAttribute("aria-live", "polite");
    let revision = 0;
    const cancel = node("button", "cancelar preparação");
    cancel.type = "button";
    cancel.hidden = true;
    cancel.onclick = () => {
      revision++;
      play.disabled = false;
      cancel.hidden = true;
      status.textContent = "Preparação cancelada.";
    };
    play.onclick = async () => {
      if (play.disabled) return;
      const token = ++revision;
      play.disabled = true;
      cancel.hidden = false;
      try {
        if (token !== revision || !box.isConnected) return;
        status.textContent = "Preparando a primeira faixa…";
        const first = await MusicBridge.prepareTrack(saved(album.albumTracks[0]));
        if (!MusicBridge.canPlay(first))
          throw Error("Vincule a reprodução de “" + first.title + "” antes de iniciar o álbum.");
        if (token !== revision || !box.isConnected) return;
        await MusicBridge.playAlbum(album.albumTracks, {
          sourceId: album.catalogId,
          title: album.title,
          firstTrack: first,
          startIndex: 0,
        });
        status.textContent = "Álbum tocando em ordem.";
      } catch (error) {
        if (token === revision && box.isConnected) status.textContent = error.message;
      } finally {
        if (token === revision) {
          play.disabled = false;
          cancel.hidden = true;
        }
      }
    };
    const download = node("button", "↓ baixar álbum offline");
    download.type = "button";
    download.onclick = () => downloadAlbum(album);
    box.append(play, download, cancel, status);
    return box;
  }
  root.MusicAlbumActions = { actions };
})(window);
