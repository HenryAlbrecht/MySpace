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
    let folderStorage;
    try {
      folderStorage = window.localStorage;
    } catch (error) {
      status.textContent = "Armazenamento indisponível: " + String(error);
    }
    if (folderStorage) {
      const folders = window.DesktopFolders.create({
        storage: folderStorage,
        pickFolders: () => tauri.core.invoke("plugin:dialog|open", {
          options: { title: "MySpace — selecionar pastas", multiple: true, directory: true },
        }),
        checkFolders: (paths) => tauri.core.invoke("check_folders", { paths }),
        discoverSteam: (path) => tauri.core.invoke("discover_steam", { path }),
      });
      const folderSection = document.createElement("section");
      const title = document.createElement("h3");
      title.textContent = "Pastas locais";
      const note = document.createElement("p");
      note.textContent = "Referências neste PC. Remover não apaga arquivos. A descoberta Steam pede confirmação nativa da pasta; não importa nem executa jogos. Reabrir: Ctrl+Shift+D.";
      const folderStatus = document.createElement("p");
      folderStatus.setAttribute("role", "status");
      folderSection.append(title, note, folderStatus);
      const controls = [];
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
      for (const [category, label] of [["music", "Músicas"], ["games", "Jogos"]]) {
        const heading = document.createElement("h4");
        heading.textContent = label;
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
          list.replaceChildren();
          const state = folders.getState();
          if (state.error) {
            folderStatus.textContent = state.error;
            return;
          }
          const labels = new Map();
          for (const path of state[category]) {
            const row = document.createElement("li");
            const text = document.createElement("span");
            text.textContent = path + " — verificando…";
            labels.set(path, text);
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Remover referência";
            remove.setAttribute("aria-label", "Remover referência: " + path);
            remove.onclick = () => action(async () => {
              folders.remove(category, path);
              folderStatus.textContent = "Referência removida; arquivos preservados.";
              await render();
              add.focus();
            });
            row.append(text, remove);
            if (category === "games") {
              const discover = document.createElement("button");
              discover.type = "button";
              discover.textContent = "Descobrir jogos Steam";
              const results = document.createElement("div");
              results.setAttribute("role", "status");
              discover.onclick = () => action(async () => {
                discover.disabled = true;
                results.textContent = "Confirme a pasta no diálogo do Windows para autorizar a leitura.";
                try {
                  const report = await folders.discover(path);
                  if (!folders.getState().games.includes(path)) return;
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
          const states = { available: "disponível", unavailable: "indisponível", inaccessible: "sem acesso", "not-directory": "não é uma pasta", unknown: "não verificada" };
          try {
            const availability = await folders.check(category);
            if (currentRevision !== revision) return;
            for (const [path, text] of labels) text.textContent = path + " — " + (states[availability.get(path)] || states.unknown);
          } catch (error) {
            if (currentRevision !== revision) return;
            for (const [path, text] of labels) text.textContent = path + " — não verificada";
            folderStatus.textContent = "Falha ao verificar pastas: " + String(error);
          }
        }
        add.onclick = () => action(async () => {
          const result = await folders.add(category);
          folderStatus.textContent = result.cancelled ? "Seleção cancelada." : result.added + " pasta(s) adicionada(s). Duplicatas ignoradas.";
          await render();
        });
        refresh.onclick = () => action(render);
        folderSection.append(heading, add, refresh, list);
        void render();
      }
      dialog.append(folderSection);
    }
  }
  document.body.append(dialog);
  let opener;
  dialog.addEventListener("close", () => opener?.focus({ preventScroll: true }));
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
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
