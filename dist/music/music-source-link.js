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
  const identity = (item) =>
    JSON.stringify([item.catalogId, item.title, item.artist, item.albumTitle, item.trackDuration]);
  async function searchSource(item) {
    const query = new URLSearchParams({ title: item.title, artist: item.artist || "" });
    if (item.albumTitle) query.set("album", item.albumTitle);
    if (Number.isFinite(item.trackDuration) && item.trackDuration > 0)
      query.set("duration", item.trackDuration);
    const response = await fetch("/api/music/playback-source?" + query, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error("Busca indisponível; você pode colar o link manualmente.");
    return response.json();
  }
  function autoLink(item, { openChoose = false } = {}) {
    if (item.playbackSource || !item.artist || !item.id) return Promise.resolve();
    if (sourceTasks.has(item.id)) return sourceTasks.get(item.id);
    const signature = identity(item);
    let expected;
    const current = () =>
      root.CollectionActions.getItems().find(
        (value) =>
          value.id === item.id &&
          !value.playbackSource &&
          identity(value) === signature &&
          (!expected || value === expected),
      );
    if (!current()) return Promise.resolve();
    function discardLookup() {
      sourceResults.delete(item.id);
      const latest = root.CollectionActions.getItems().find((value) => value.id === item.id);
      // Clear only this obsolete transient status; keep the user's new data.
      if (latest && !latest.playbackSource && latest.playbackLookup === "searching")
        root.CollectionActions.updateItem(item.id, { playbackLookup: undefined });
    }
    const task = (async () => {
      try {
        root.CollectionActions.updateItem(item.id, { playbackLookup: "searching" });
        expected = current();
        if (!expected) return;
        const result = await searchSource(item);
        if (!current()) {
          discardLookup();
          return;
        }
        if (sourceResults.size >= 80) sourceResults.delete(sourceResults.keys().next().value);
        sourceResults.set(item.id, { signature, result });
        if (result.status === "matched" && result.source) {
          const source = MusicModel.source(result.source);
          if (
            source.type !== "youtube" ||
            (result.source.videoId && result.source.videoId !== source.videoId)
          )
            throw Error("Resultado de reprodução inválido.");
          if (!current()) return;
          root.CollectionActions.updateItem(item.id, {
            playbackSource: source,
            playbackLookup: undefined,
          });
          sourceResults.delete(item.id);
          root.toast?.("reprodução vinculada");
          return;
        }
        root.CollectionActions.updateItem(item.id, {
          playbackLookup: result.items?.length
            ? "choose"
            : result.unavailable
              ? "failed"
              : "not-found",
        });
        if (
          openChoose &&
          result.status === "choose" &&
          result.items?.length &&
          !document.querySelector(".music-link-dialog")
        )
          link(saved(item));
      } catch {
        if (current()) root.CollectionActions.updateItem(item.id, { playbackLookup: "failed" });
        else discardLookup();
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
            : "Nenhum link compatível encontrado para esta versão. Cole um link ou escolha um arquivo.";
      for (const row of result.items || []) {
        const choice = button("", () => {
          url.value = row.url;
          for (const candidate of candidates.children)
            candidate.setAttribute("aria-pressed", String(candidate === choice));
          notice.textContent = "Resultado escolhido. Confira o link e salve.";
        });
        choice.setAttribute("aria-pressed", "false");
        if (row.image && /^https:\/\//.test(row.image)) {
          const image = node("img");
          image.src = Artwork.url(row.image);
          image.alt = "";
          image.loading = "lazy";
          choice.append(image);
        }
        const description = node("span");
        description.append(
          node("strong", row.title),
          node("span", row.artist || row.channel || ""),
        );
        const seconds = Math.round(row.duration);
        const duration = Number.isFinite(seconds)
          ? Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0")
          : "";
        description.append(node("small", [row.album, duration].filter(Boolean).join(" · ")));
        choice.append(description);
        candidates.append(choice);
      }
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
    const external = node("a", "abrir busca no YouTube");
    external.href =
      "https://www.youtube.com/results?" +
      new URLSearchParams({ search_query: item.title + " " + (item.artist || "") });
    external.target = "_blank";
    external.rel = "noopener noreferrer";
    body.append(title, subtitle, urlLabel, search, external, candidates, fileLabel, notice);
    const footer = node("div");
    footer.className = "music-link-footer";
    footer.append(
      button("cancelar", () => dialog.close()),
      submit,
    );
    form.append(header, body, footer);
    const cached = sourceResults.get(item.id);
    if (cached?.signature === identity(item)) display(cached.result);
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
        if (item.id && !root.CollectionActions.getItems().some((row) => row.id === item.id))
          throw Error("Esta música foi removida da coleção.");
        root.CollectionActions.saveMusic({
          ...saved(item),
          playbackSource: source,
          playbackLookup: undefined,
        });
        sourceResults.delete(item.id);
        dialog.close();
      } catch (error) {
        notice.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    };
    dialog.showModal();
  }
  root.MusicSourceLink = { link, autoLink, searchSource };
})(window);
