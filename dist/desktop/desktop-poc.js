/* Optional desktop diagnostic. Existing browser boot and data owners stay unchanged. */
(() => {
  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) return;
  document.documentElement.dataset.runtime = "tauri";
  const dialog = document.createElement("dialog");
  dialog.className = "desktop-poc";
  dialog.setAttribute("aria-labelledby", "desktopPocTitle");
  const heading = document.createElement("h2");
  heading.id = "desktopPocTitle";
  heading.textContent = "MySpace Desktop — PoC";
  const info = document.createElement("p");
  info.textContent = "Interface local em Tauri 2, sem servidor Node. Os providers online ainda estão em migração.";
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
        artworkUrl: (appid, revision, kind) => tauri.core.convertFileSrc("steam-art-" + appid + "-" + revision + (kind === "background" ? "-background" : ""), "myspace-music"),
        launchSteam: (appid) => tauri.core.invoke("launch_steam", { appid }),
      });
      if (games) window.DesktopGameLibrary = games;
      const music = window.createDesktopMusicLibrary?.({
        onChange: () => window.dispatchEvent(new CustomEvent("desktop:music-changed")),
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
