/* Optional desktop diagnostic. Existing browser boot and data owners stay unchanged. */
(() => {
  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) return;
  function musicRequest(command, args) {
    const task = tauri.core.invoke(command, args);
    if (typeof window.setTimeout !== "function") return task;
    let timer;
    return Promise.race([
      task,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(Error("Tempo limite do YouTube Music. Tente novamente.")), 18000);
      }),
    ]).finally(() => window.clearTimeout(timer));
  }
  const musicResponses = new Map();
  function musicPayload(command, args, force = false) {
    const key = command + ":" + JSON.stringify(args);
    const cached = musicResponses.get(key);
    if (cached && !force && Date.now() - cached.at < 300000) return cached.task;
    if (musicResponses.size >= 60) musicResponses.delete(musicResponses.keys().next().value);
    const task = musicRequest(command, args).catch((error) => {
      if (musicResponses.get(key)?.task === task) musicResponses.delete(key);
      throw error;
    });
    musicResponses.set(key, { at: Date.now(), task });
    return task;
  }
  if (window.YouTubeMusicParser?.parseSearchPage) {
    window.DesktopMusicSearch = {
      async search(kind, query, cursor, { signal } = {}) {
        if (signal?.aborted) {
          const error = Error("Busca musical cancelada.");
          error.name = "AbortError";
          throw error;
        }
        const payload = await musicRequest("search_youtube_music", {
          kind,
          query,
          cursor: cursor ?? null,
        });
        if (signal?.aborted) {
          const error = Error("Busca musical cancelada.");
          error.name = "AbortError";
          throw error;
        }
        const page = window.YouTubeMusicParser.parseSearchPage(kind, payload);
        return { provider: "YouTube Music", items: page.items, next: page.next ?? null };
      },
    };
  }
  if (window.YouTubeMusicParser?.parseBrowse && window.YouTubeMusicParser?.parseArtistSection) {
    const parser = window.YouTubeMusicParser;
    const artistPhotoCache = new Map();
    const abort = () => {
      const error = Error("Carregamento musical cancelado.");
      error.name = "AbortError";
      return error;
    };
    const checkSignal = (signal) => {
      if (signal?.aborted) throw abort();
    };
    async function readArtistSection(section, handle, artist, signal) {
      const items = [],
        identities = new Set(),
        tokens = new Set();
      let request = handle.browseId
        ? { browseId: handle.browseId, params: handle.params }
        : { continuation: handle.continuation };
      if (request.continuation) tokens.add(request.continuation);
      let pages = 0,
        partial = false,
        reason;
      const pageLimit = parser.SECTION_LIMITS?.pages || 10,
        itemLimit = parser.SECTION_LIMITS?.items || 1000;
      while (pages < pageLimit && items.length < itemLimit) {
        checkSignal(signal);
        try {
          const payload = await musicRequest("browse_youtube_music_artist_section", {
            section,
            browseId: request.browseId ?? null,
            params: request.params ?? null,
            continuation: request.continuation ?? null,
          });
          checkSignal(signal);
          pages++;
          const parsed = parser.parseArtistSection(section, payload, artist);
          for (const row of parsed.items)
            if (!identities.has(row.catalogId) && items.length < itemLimit) {
              identities.add(row.catalogId);
              items.push(row);
            }
          const token = parsed.continuation;
          if (parsed.truncated) {
            partial = true;
            reason = "limit";
            break;
          }
          if (parsed.invalidContinuation) {
            partial = true;
            reason = "invalid-continuation";
            break;
          }
          if (!token) break;
          if (tokens.has(token)) {
            partial = true;
            reason = "repeated-continuation";
            break;
          }
          if (pages >= pageLimit || items.length >= itemLimit) {
            partial = true;
            reason = "limit";
            break;
          }
          tokens.add(token);
          request = { continuation: token };
        } catch (error) {
          if (signal?.aborted || error.name === "AbortError") throw abort();
          if (!items.length) throw error;
          partial = true;
          reason = "unavailable";
          break;
        }
      }
      return { items, pages, partial, ...(reason ? { reason } : {}) };
    }
    async function artistDiscography(artist, signal) {
      const entries = ["albums", "singles"].filter((section) => {
        const handle = artist.artistSections?.[section];
        return handle?.browseId || handle?.continuation;
      });
      const results = await Promise.allSettled(
        entries.map((section) =>
          readArtistSection(
            section,
            artist.artistSections[section],
            { artist: artist.title, artistCatalogId: artist.catalogId },
            signal,
          ),
        ),
      );
      checkSignal(signal);
      const items = new Map((artist.topAlbums || []).map((row) => [row.catalogId, row]));
      const sections = {};
      let partial = false;
      results.forEach((result, index) => {
        const section = entries[index];
        if (result.status === "rejected") {
          partial = true;
          sections[section] = { status: "unavailable" };
          return;
        }
        const value = result.value;
        if (value.partial) partial = true;
        sections[section] = {
          status: value.partial ? "partial" : "complete",
          count: value.items.length,
          pages: value.pages,
          ...(value.reason ? { reason: value.reason } : {}),
        };
        for (const row of value.items)
          items.set(row.catalogId, { ...items.get(row.catalogId), ...row });
      });
      return {
        ...artist,
        topAlbums: [...items.values()],
        discographyResolution: {
          status: partial ? "partial" : entries.length ? "complete" : "preview",
          sections,
        },
      };
    }
    async function artistPhoto(artist, signal) {
      if (artistPhotoCache.has(artist.catalogId)) return artistPhotoCache.get(artist.catalogId);
      if (!window.DesktopMusicSearch?.search) return "";
      try {
        const results = await window.DesktopMusicSearch.search("artist", artist.title, null, {
          signal,
        });
        checkSignal(signal);
        const image = results.items.find((item) => item.catalogId === artist.catalogId)?.image || "";
        if (artistPhotoCache.size >= 50)
          artistPhotoCache.delete(artistPhotoCache.keys().next().value);
        artistPhotoCache.set(artist.catalogId, image);
        return image;
      } catch {
        checkSignal(signal);
        return "";
      }
    }
    window.DesktopMusicBrowse = {
      async details(kind, browseId, { signal, phase = "full", artwork = true, force = false } = {}) {
        checkSignal(signal);
        if (kind === "music") {
          if (!/^[\w-]{11}$/.test(browseId || "")) throw Error("Identidade musical inválida.");
          const payload = await musicPayload("radio_youtube_music", { videoId: browseId }, force);
          checkSignal(signal);
          const track = parser.parseWatchQueue(payload).find((row) => row.videoId === browseId);
          if (!track) throw Error("Os detalhes desta música não estão disponíveis agora.");
          return track;
        }
        if (!parser.validBrowse(kind, browseId)) throw Error("Identidade musical inválida.");
        const payload = await musicPayload("browse_youtube_music", { kind, browseId }, force);
        checkSignal(signal);
        const detail = parser.parseBrowse(kind, browseId, payload);
        if (kind === "artist" && artwork) {
          if (force) artistPhotoCache.delete(detail.catalogId);
          const photo = await artistPhoto(detail, signal);
          if (photo) {
            detail.imageFallback = detail.image;
            detail.image = photo;
          }
        }
        return kind === "artist" && phase !== "core"
          ? artistDiscography(detail, signal)
          : detail;
      },
    };
    window.DesktopMusicRecommendations = {
      async recommendations(item, { localPool = false, signal, force = false } = {}) {
        checkSignal(signal);
        const id = item.catalogId || "";
        let rows = [],
          basis = "Conteúdo relacionado no YouTube Music";
        if (item.kind === "music") {
          const videoId =
            item.playbackSource?.videoId ||
            item.videoId ||
            id.match(/^ytmusic:video:([\w-]{11})$/)?.[1];
          if (!/^[\w-]{11}$/.test(videoId || ""))
            throw Error("Esta música não possui um ID de áudio do YouTube Music para gerar a rádio.");
          const payload = await musicPayload("radio_youtube_music", { videoId }, force);
          checkSignal(signal);
          rows = parser.parseRadio(payload, videoId).map((row) => ({
            ...row,
            recommendationSource: "YouTube Music",
            recommendationSignal: "radio",
          }));
          basis = "Rádio da faixa no YouTube Music";
        } else if (item.kind === "artist" || item.kind === "album") {
          const kind = item.kind,
            browseId = item.browseId || id.match(
              kind === "artist"
                ? /^ytmusic:artist:(UC[\w-]{8,80})$/
                : /^ytmusic:album:(MPRE[\w-]{4,120})$/,
            )?.[1];
          if (!parser.validBrowse(kind, browseId || ""))
            throw Error("A recomendação exige a identidade canônica do YouTube Music.");
          const detail = await window.DesktopMusicBrowse.details(kind, browseId, {
            phase: "core",
            artwork: false,
            signal,
          });
          checkSignal(signal);
          rows = (kind === "artist" ? detail.relatedArtists : detail.relatedAlbums) || [];
          const seen = new Set([id]);
          rows = rows
            .filter((row) => {
              if (
                row.kind !== kind ||
                !parser.validBrowse(kind, row.catalogId?.split(":").at(-1) || "") ||
                seen.has(row.catalogId)
              )
                return false;
              seen.add(row.catalogId);
              return true;
            })
            .slice(0, localPool ? 24 : 12)
            .map((row) => ({
              ...row,
              recommendationSource: "YouTube Music",
              recommendationSignal: "related",
            }));
          basis =
            kind === "artist"
              ? "Artistas relacionados no YouTube Music"
              : "Lançamentos relacionados no YouTube Music";
        } else {
          return [];
        }
        checkSignal(signal);
        Object.defineProperties(rows, {
          reserveAvailable: { value: false },
          sourceExhausted: { value: true },
          resolution: { value: { status: "complete", failures: 0, total: rows.length } },
          basis: { value: basis },
        });
        return rows;
      },
    };
  }
  const libraryCache = (() => {
    const key = "myspace-desktop-library-cache-v1";
    let storage;
    try { storage = window.localStorage; } catch {}
    function read() {
      try {
        const value = JSON.parse(storage?.getItem(key) || "null");
        if (value?.version !== 1) return { version: 1, games: {}, music: {} };
        return {
          version: 1,
          games: value.games && typeof value.games === "object" && !Array.isArray(value.games) ? value.games : {},
          music: value.music && typeof value.music === "object" && !Array.isArray(value.music) ? value.music : {},
        };
      } catch {
        return { version: 1, games: {}, music: {} };
      }
    }
    function save(category, snapshots) {
      if (!storage?.setItem) return;
      const value = read();
      value[category] = snapshots;
      try { storage.setItem(key, JSON.stringify(value)); }
      catch (error) { window.console?.warn("Não foi possível salvar o cache local do Desktop.", error); }
    }
    return {
      loadGames: () => read().games,
      saveGames: (snapshots) => save("games", snapshots),
      loadMusic: () => read().music,
      saveMusic: (snapshots) => save("music", snapshots),
    };
  })();
  document.documentElement.dataset.runtime = "tauri";
  const dialog = document.createElement("dialog");
  dialog.className = "desktop-poc";
  dialog.setAttribute("aria-labelledby", "desktopPocTitle");
  const heading = document.createElement("h2");
  heading.id = "desktopPocTitle";
  heading.textContent = "MySpace Desktop — PoC";
  const info = document.createElement("p");
  info.textContent = "Interface local em Tauri 2, sem servidor Node. Busca e playback do YouTube Music começam somente por ação do usuário.";
  const storage = document.createElement("p");
  storage.textContent = "Este aplicativo tem armazenamento separado do navegador. Para trazer coleção e mídias, exporte um pacote .myspace no navegador e importe-o aqui pelo fluxo de backup existente.";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const picker = document.createElement("button");
  picker.type = "button";
  picker.textContent = "Testar seletor nativo de arquivo";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Continuar para o MySpace";
  close.onclick = () => dialog.close();
  picker.onclick = async () => {
    picker.disabled = true;
    try {
      const path = await tauri.core.invoke("plugin:dialog|open", {
        options: { title: "MySpace Desktop — selecionar arquivo", multiple: false, directory: false },
      });
      status.textContent = path ? "Arquivo selecionado: " + path : "Seleção cancelada.";
    } catch (error) {
      status.textContent = "Não foi possível abrir o seletor nativo: " + String(error);
    } finally {
      picker.disabled = false;
    }
  };
  dialog.append(heading, info, storage, picker, close, status);
  if (window.DesktopFolders) {
    {
      const games = window.createDesktopGameLibrary?.({
        normalize: (...args) => window.Catalog.normalize(...args),
        onChange: () => window.dispatchEvent(new CustomEvent("desktop:games-changed")),
        loadCache: libraryCache.loadGames,
        saveCache: libraryCache.saveGames,
        artworkUrl: (appid, revision, kind) => tauri.core.convertFileSrc("steam-art-" + appid + "-" + revision + (["background", "vertical"].includes(kind) ? "-" + kind : ""), "myspace-music"),
        launchSteam: (appid) => tauri.core.invoke("launch_steam", { appid }),
      });
      if (games) window.DesktopGameLibrary = games;
      const music = window.createDesktopMusicLibrary?.({
        onChange: () => window.dispatchEvent(new CustomEvent("desktop:music-changed")),
        loadCache: libraryCache.loadMusic,
        saveCache: libraryCache.saveMusic,
        openFile: (fileId) => tauri.core.invoke("open_music", { fileId }),
        checkFile: (token) => tauri.core.invoke("check_music", { token }),
        closeFile: (token) => tauri.core.invoke("close_music", { token }),
        sourceUrl: (token) => tauri.core.convertFileSrc(token, "myspace-music"),
        artworkUrl: (id, revision) => tauri.core.convertFileSrc("artwork-" + id.replaceAll(":", "-") + "-" + revision, "myspace-music"),
      });
      if (music) window.DesktopMusicLibrary = music;
      const folders = window.DesktopFolders.create({
        games,
        music,
        listFolders: () => tauri.core.invoke("list_folders"),
        authorizeFolders: (category) => tauri.core.invoke("authorize_folders", { category }),
        revokeFolder: (id) => tauri.core.invoke("revoke_folder", { id }),
        discoverSteam: (id) => tauri.core.invoke("discover_steam", { id }),
        discoverMusic: (id) => tauri.core.invoke("discover_music", { id }),
      });
      const initialFolders = folders.refresh();
      const folderSection = document.createElement("section");
      const title = document.createElement("h3");
      title.textContent = "Pastas locais";
      const note = document.createElement("p");
      note.textContent = "Autorize uma vez pelo diálogo nativo. Remover revoga o acesso sem apagar arquivos. Referências antigas do navegador precisam ser selecionadas novamente. Reabrir: Ctrl+Shift+D.";
      const folderStatus = document.createElement("p");
      folderStatus.setAttribute("role", "status");
      folderSection.append(title, note, folderStatus);
      const controls = [];
      const initialRenders = [];
      let pending = false;
      async function action(operation) {
        if (pending) return;
        pending = true;
        controls.forEach((button) => { button.disabled = true; });
        try {
          await operation();
        } catch (error) {
          folderStatus.textContent = "Não foi possível atualizar as pastas: " + String(error);
        } finally {
          pending = false;
          controls.forEach((button) => { button.disabled = false; });
        }
      }
      for (const [category, label] of [["music", "Músicas"], ["games", "Jogos"], ["steam-artwork", "Artes Steam"]]) {
        const heading = document.createElement("h4");
        heading.textContent = category === "steam-artwork" ? "Artes Steam — selecione a pasta appcache\\librarycache do cliente Steam" : label;
        const list = document.createElement("ul");
        const add = document.createElement("button");
        add.textContent = "Adicionar pastas de " + label.toLowerCase();
        add.type = "button";
        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.textContent = "Verificar pastas de " + label.toLowerCase();
        controls.push(add, refresh);
        let revision = 0;
        async function render() {
          const currentRevision = ++revision;
          try {
            await initialFolders.catch(() => {});
            await folders.refresh();
          } catch (error) {
            folderStatus.textContent = "Falha ao carregar pastas: " + String(error);
            return;
          }
          if (currentRevision !== revision) return;
          list.replaceChildren();
          const state = folders.getState();
          if (state.error) {
            folderStatus.textContent = state.error;
            return;
          }
          for (const folder of state[category]) {
            const { path, id } = folder;
            const row = document.createElement("li");
            const text = document.createElement("span");
            text.textContent = path + " — " + (folder.state === "available" ? "disponível" : "indisponível ou identidade alterada; referência mantida");
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Remover referência";
            remove.setAttribute("aria-label", "Remover referência: " + path);
            remove.onclick = () => action(async () => {
              await folders.remove(category, id);
              folderStatus.textContent = "Acesso revogado; arquivos preservados.";
              await render();
              add.focus();
            });
            row.append(text, remove);
            if (category === "music") {
              const discover = document.createElement("button");
              discover.type = "button";
              discover.textContent = "Descobrir / atualizar músicas";
              const results = document.createElement("div");
              results.setAttribute("role", "status");
              discover.onclick = () => action(async () => {
                discover.disabled = true;
                results.textContent = "Lendo metadados locais (descoberta limitada)…";
                try {
                  const report = await folders.discoverMusic(id);
                  if (!folders.getState().music.some((entry) => entry.id === id)) return;
                  results.replaceChildren();
                  const summary = document.createElement("p");
                  const states = { complete: "concluída", partial: "parcial", unavailable: "pasta indisponível" };
                  summary.textContent = `${report.root} · ${states[report.state] || report.state} · ${report.tracks.length} arquivo(s) MP3/FLAC · ${report.entries} entradas verificadas`;
                  results.append(summary);
                  for (const track of report.tracks) {
                    const entry = document.createElement("p");
                    const duration = track.duration_seconds == null ? "duração indisponível" : `${Math.floor(track.duration_seconds / 60)}:${String(Math.floor(track.duration_seconds % 60)).padStart(2, "0")}`;
                    const state = { ready: "metadados disponíveis", "missing-metadata": "metadados incompletos", "invalid-or-limited": "arquivo inválido, inacessível ou leitura limitada" };
                    entry.textContent = `${track.format} · ${track.file_name} · ${track.title || "título ausente"} · ${track.artist || "artista ausente"} · ${track.album || "álbum ausente"} · ${duration} · ${state[track.state] || track.state} · ${track.relative_path}${track.error ? " · " + track.error : ""}`;
                    results.append(entry);
                  }
                  for (const warning of report.warnings) {
                    const entry = document.createElement("p");
                    entry.textContent = "Aviso: " + warning;
                    results.append(entry);
                  }
                } catch (error) {
                  results.textContent = "Falha na descoberta musical: " + String(error);
                } finally {
                  discover.disabled = false;
                }
              });
              row.append(discover, results);
            }
            if (category === "games") {
              const discover = document.createElement("button");
              discover.type = "button";
              discover.textContent = "Descobrir jogos Steam";
              const results = document.createElement("div");
              results.setAttribute("role", "status");
              discover.onclick = () => action(async () => {
                discover.disabled = true;
                results.textContent = "Consultando biblioteca autorizada…";
                try {
                  const report = await folders.discover(id);
                  if (!folders.getState().games.some((entry) => entry.id === id)) return;
                  results.replaceChildren();
                  const summary = document.createElement("p");
                  const states = { complete: "concluída", limited: "parcial (limite atingido)", cancelled: "cancelada", "invalid-folder": "pasta inválida ou indisponível", "not-steam-library": "biblioteca Steam não reconhecida", inaccessible: "sem acesso" };
                  summary.textContent = `${report.source} · ${report.root} · ${states[report.state] || report.state} · ${report.games.length} jogo(s)`;
                  results.append(summary);
                  const gameStates = { present: "diretório presente (execução não verificada)", missing: "instalação ausente", "not-directory": "não é diretório", "unavailable-or-outside-scope": "indisponível ou fora da pasta autorizada" };
                  for (const game of report.games) {
                    const entry = document.createElement("p");
                    entry.textContent = `Steam · ${game.name} · AppID ${game.appid} · ${gameStates[game.state] || game.state} · ${game.install_dir}`;
                    results.append(entry);
                  }
                  for (const error of report.errors) {
                    const entry = document.createElement("p");
                    entry.textContent = "Aviso: " + error;
                    results.append(entry);
                  }
                } catch (error) {
                  results.textContent = "Falha na descoberta: " + String(error);
                } finally {
                  discover.disabled = false;
                }
              });
              row.append(discover, results);
            }
            list.append(row);
          }
          if (!state[category].length) {
            const empty = document.createElement("li");
            empty.textContent = "Nenhuma pasta registrada.";
            list.append(empty);
            return;
          }
        }
        add.onclick = () => action(async () => {
          const result = await folders.add(category);
          folderStatus.textContent = result.cancelled ? "Seleção cancelada." : result.added + " pasta(s) adicionada(s). Duplicatas ignoradas.";
          await render();
          if (category === "games" && !result.cancelled) {
            for (const folder of folders.getState().games) await folders.discover(folder.id);
          }
          if (category === "music" && !result.cancelled) {
            for (const folder of folders.getState().music) await folders.discoverMusic(folder.id);
          }
        });
        refresh.onclick = () => action(async () => {
          await render();
          if (category === "steam-artwork") games?.refreshArtwork?.();
        });
        folderSection.append(heading, add, refresh, list);
        initialRenders.push(render());
      }
      dialog.append(folderSection);
      // Rebuild the transient local projection on desktop startup, without a picker.
      void Promise.all(initialRenders).then(async () => {
        for (const folder of folders.getState().music) {
          try { await folders.discoverMusic(folder.id); }
          catch (error) { folderStatus.textContent = "Falha ao atualizar músicas locais: " + String(error); }
        }
        for (const folder of folders.getState().games) {
          try { await folders.discover(folder.id); }
          catch (error) { folderStatus.textContent = "Falha ao atualizar jogos locais: " + String(error); }
        }
      }).catch((error) => { folderStatus.textContent = "Falha ao carregar jogos locais: " + String(error); });
    }
  }
  document.body.append(dialog);
  let opener;
  let previousInert = false;
  dialog.addEventListener("close", () => {
    dialog.inert = previousInert;
    opener?.focus({ preventScroll: true });
  });
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    previousInert = dialog.inert;
    dialog.inert = false;
    dialog.showModal();
  }
  document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || !event.shiftKey || event.code !== "KeyD") return;
    event.preventDefault();
    event.stopPropagation();
    open();
  });
  void tauri.core.invoke("plugin:app|version").then((version) => {
    heading.textContent += " · " + version;
  }).catch(() => {});
  open();
})();
