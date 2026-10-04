/* Playback suggestions and manual source linking; catalog identity stays in Collection. */
(function (root) {
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
  const saved = (item) =>
    root.CollectionActions?.getItems().find((row) => MusicModel.sameItem(row, item)) || item;
  const sourceResults = new Map(),
    sourceTasks = new Map();
  async function searchSource(item) {
    const response = await fetch(
      "/api/music/playback-source?" + new URLSearchParams({ title: item.title, artist: item.artist || "" }),
      { signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok) throw Error("Busca indisponível; você pode colar o link manualmente.");
    return response.json();
  }
  function autoLink(item) {
    if (item.playbackSource || !item.artist || !item.id) return Promise.resolve();
    if (sourceTasks.has(item.id)) return sourceTasks.get(item.id);
    const identity = JSON.stringify([item.title, item.artist]);
    const current = () =>
      root.CollectionActions.getItems().find(
        (value) =>
          value.id === item.id &&
          !value.playbackSource &&
          JSON.stringify([value.title, value.artist]) === identity,
      );
    const task = (async () => {
      try {
        root.CollectionActions.updateItem(item.id, { playbackLookup: "searching" });
        const result = await searchSource(item);
        sourceResults.set(item.id, result);
        if (!current()) return;
        root.CollectionActions.updateItem(item.id, {
          playbackLookup: result.items?.length ? "choose" : "not-found",
        });
      } catch {
        if (current()) root.CollectionActions.updateItem(item.id, { playbackLookup: "failed" });
      }
    })().finally(() => sourceTasks.delete(item.id));
    sourceTasks.set(item.id, task);
    return task;
  }
  function link(item) {
    const dialog = node("dialog");
    dialog.className = "music-link-dialog";
    const form = node("form");
    const title = node("h3", item.title),
      url = node("input"),
      file = node("input"),
      notice = node(
        "p",
        "Cole um link direto de áudio, YouTube/YouTube Music ou escolha um arquivo local. A prévia do catálogo não é a faixa completa.",
      );
    url.type = "url";
    url.placeholder = "https://…/musica.mp3 ou link YouTube";
    url.setAttribute("aria-label", "Link de reprodução");
    url.value = item.playbackSource?.url || "";
    file.type = "file";
    file.accept = "audio/*";
    file.setAttribute("aria-label", "Arquivo de áudio");
    const submit = node("button", "salvar");
    submit.type = "submit";
    const candidates = node("div");
    candidates.className = "music-source-candidates";
    function display(result) {
      candidates.replaceChildren();
      notice.textContent =
        result.status === "unconfigured"
          ? "Busca automática indisponível. Cole um link ou escolha um arquivo."
          : result.items?.length
            ? "Sugestões de reprodução · confira título, artista e versão antes de escolher e salvar."
            : "Nenhum link compatível encontrado no MusicBrainz para esta versão. Cole um link ou escolha um arquivo.";
      for (const row of result.items || [])
        candidates.append(
          button(row.title + " · " + row.channel, () => {
            url.value = row.url;
            notice.textContent = "Resultado escolhido. Confira o link e salve.";
          }),
        );
    }
    const search = button("buscar reprodução", async () => {
      search.disabled = true;
      search.textContent = "buscando…";
      notice.dataset.state = "loading";
      notice.textContent = "Buscando sugestões de reprodução…";
      try {
        display(await searchSource(saved(item)));
        notice.dataset.state = candidates.children.length ? "ready" : "empty";
        search.textContent = "buscar novamente";
      } catch (error) {
        notice.dataset.state = "error";
        notice.textContent =
          "Não foi possível buscar sugestões agora. Você pode tentar novamente, colar um link ou escolher um arquivo.";
        search.textContent = "tentar novamente";
      } finally {
        search.disabled = false;
      }
    });
    const header = node("div");
    header.className = "titlebar";
    header.append(
      node("span", "♫ vincular reprodução"),
      button("×", () => dialog.close()),
    );
    header.lastChild.setAttribute("aria-label", "Fechar vínculo de reprodução");
    const body = node("div");
    body.className = "music-link-body";
    const subtitle = node("p", item.artist || "");
    subtitle.className = "music-link-artist";
    const urlLabel = node("label", "Link de áudio ou YouTube / YouTube Music");
    urlLabel.append(url);
    const fileLabel = node("label", "ou arquivo de áudio local");
    fileLabel.append(file);
    notice.className = "music-link-notice";
    notice.setAttribute("role", "status");
    body.append(title, subtitle, urlLabel, search, candidates, fileLabel, notice);
    const footer = node("div");
    footer.className = "music-link-footer";
    footer.append(
      button("cancelar", () => dialog.close()),
      submit,
    );
    form.append(header, body, footer);
    if (sourceResults.has(item.id)) display(sourceResults.get(item.id));
    dialog.append(form);
    document.body.append(dialog);
    dialog.onclose = () => dialog.remove();
    form.onsubmit = async (e) => {
      e.preventDefault();
      submit.disabled = true;
      try {
        let source;
        if (file.files[0]) {
          const fileRef = crypto.randomUUID();
          await MediaStorage.put(fileRef, file.files[0]);
          source = { type: "local", fileRef };
        } else
          source = MusicModel.source({
            type: /\.(?:mp3|m4a|aac|ogg|oga|wav|flac|opus)(?:[?#]|$)/i.test(url.value.trim())
              ? "audio"
              : "youtube",
            url: url.value.trim(),
          });
        root.CollectionActions.saveMusic({ ...saved(item), playbackSource: source });
        dialog.close();
      } catch (error) {
        notice.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    };
    dialog.showModal();
  }
  root.MusicSourceLink = { link, autoLink };
})(window);
