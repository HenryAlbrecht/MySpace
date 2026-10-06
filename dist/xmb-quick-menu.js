/* System command surface. Music is its first explicitly composed section. */
(() => {
  let music;
  let shell;
  let origin;
  let selectedId = "play";
  let inertBefore = false;
  let rows = [];
  let heading;
  let artist;
  let artwork;
  let status;

  const isOpen = () => !!shell?.open;
  const availableRows = () => rows.filter(row => !row.node.hidden && !row.node.disabled);

  function focusRow(id = selectedId) {
    const row = availableRows().find(row => row.id === id) || availableRows()[0];
    if (!row) return;
    selectedId = row.id;
    row.node.focus({preventScroll: true});
    row.node.scrollIntoView({block: "nearest", behavior: "instant"});
  }

  function close(controller = false) {
    if (!isOpen()) return;
    const saved = origin;
    origin = null;
    shell.close();
    shell.inert = inertBefore;
    document.body.classList.remove("xmb-quick-menu-open");
    if (saved?.restoreFocus) saved.restoreFocus(controller);
    else if (saved?.target?.isConnected) saved.target.focus({preventScroll: true});
  }

  function promote() {
    if (!isOpen()) return;
    // Video may have promoted its existing iframe/chrome after this dialog.
    shell.close();
    shell.showModal();
    focusRow();
  }

  async function run(command, promoteAfter = false) {
    try {
      await command();
      refresh();
      if (promoteAfter) promote();
    } catch {
      if (isOpen()) status.textContent = "Comando indisponível nesta fonte.";
    }
  }

  function build() {
    const node = (tag, className, text = "") => {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      return element;
    };
    shell = node("dialog", "xmb-quick-menu");
    shell.id = "xmbQuickMenu";
    shell.setAttribute("aria-label", "Quick Menu do sistema");
    const header = node("header", "xqm-header");
    const title = node("h2", "", "Quick Menu");
    const exit = node("button", "xqm-close", "Fechar · B");
    exit.type = "button";
    exit.onclick = () => close();
    header.append(title, exit);
    const section = node("section", "xqm-music");
    section.setAttribute("aria-label", "Música");
    const summary = node("div", "xqm-track");
    artwork = node("img", "xqm-artwork");
    artwork.alt = "";
    const metadata = node("div", "xqm-metadata");
    heading = node("h3", "");
    artist = node("p", "");
    status = node("p", "xqm-status");
    metadata.append(heading, artist, status);
    summary.append(artwork, metadata);
    const commands = node("div", "xqm-commands");
    section.append(summary, commands);
    shell.append(header, section, node("p", "xqm-help", "↑↓ navegar · ←→ ajustar · A confirmar · B / Options voltar · LB / RB faixa"));
    document.body.append(shell);

    function add(id, label, activate, adjust, display, hidden = () => false) {
      const button = node("button", "xqm-row");
      button.type = "button";
      button.dataset.command = id;
      const name = node("span", "xqm-label", label);
      const value = node("span", "xqm-value");
      button.append(name, value);
      const row = {id, node: button, name, value, activate, adjust, display, hidden};
      rows.push(row);
      button.onclick = () => void run(activate, id === "video");
      button.onfocus = () => { selectedId = id; };
      commands.append(button);
    }
    // Music commands read the owner on every use; no track/preferences store.
    add("previous", "Anterior", () => music.navigate("previous"));
    add("play", "Play / Pause", () => music.togglePlayback());
    add("next", "Próxima", () => music.navigate("next"));
    add("volume", "Volume", () => {}, direction => {
      music.setVolume(Math.max(0, Math.min(1, music.getState().volume + direction * 0.05)));
    }, () => `${Math.round(music.getState().volume * 100)}%`);

    function preference(id, label, choices) {
      const change = direction => {
        const values = choices();
        const index = values.findIndex(option => option.value === music.getState().preferences[id]);
        const next = values[Math.max(0, Math.min(values.length - 1, index + direction))];
        music.setPreference(id, next.value);
      };
      add(id, label, () => {
        if (id === "lyricsEnabled") music.setPreference(id, !music.getState().preferences[id]);
        else change(1);
      }, change, () => choices().find(option => option.value === music.getState().preferences[id])?.label);
    }
    preference("lyricsEnabled", "Lyrics", () => [{value: false, label: "OFF"}, {value: true, label: "ON"}]);
    add("video", "Vídeo", () => music.toggleVideo(), direction => {
      if (music.getState().videoMode !== (direction > 0)) music.toggleVideo();
    }, () => music.getState().videoMode ? "ON" : "OFF", () => !music.getState().videoAvailable);
    preference("visualizerMode", "Visualizer", () => music.getState().choices.visualizerMode);
    preference("backgroundMode", "Fundo", () => music.getState().choices.backgroundMode);
    preference("uiMode", "Interface", () => music.getState().choices.uiMode);
    add("now-playing", "Abrir Now Playing", () => {
      const openPresentation = origin?.openNowPlaying || music.openNowPlaying;
      const target = origin?.target;
      close();
      openPresentation(target);
    }, null, null, () => music.getState().nowPlayingOpen);
    shell.addEventListener("cancel", event => { event.preventDefault(); close(); });
  }

  function refresh() {
    if (!isOpen()) return;
    const state = music.getState();
    heading.textContent = state.title;
    artist.textContent = state.artist;
    artwork.hidden = !state.artwork;
    if (state.artwork && artwork.getAttribute("src") !== state.artwork) artwork.src = state.artwork;
    status.textContent = state.playbackStatus === "loading" ? "Carregando…" : state.playing ? "Tocando" : "Pausado";
    if (state.accent) shell.style.setProperty("--xqm-accent", state.accent);
    else shell.style.removeProperty("--xqm-accent");
    for (const row of rows) {
      row.node.hidden = row.hidden();
      row.name.textContent = row.id === "play" ? state.playing ? "Pausar" : "Reproduzir" : row.name.textContent;
      row.value.textContent = row.display?.() || "";
      row.node.setAttribute("aria-label", `${row.name.textContent}${row.value.textContent ? `: ${row.value.textContent}` : ""}`);
    }
    if (!availableRows().some(row => row.id === selectedId)) focusRow();
  }

  function open(context = {}) {
    if (isOpen()) return true;
    if (!music?.isAvailable()) return false;
    if (!shell) build();
    origin = {target: document.activeElement, ...context};
    inertBefore = shell.inert;
    shell.inert = false;
    shell.showModal();
    document.body.classList.add("xmb-quick-menu-open");
    selectedId = "play";
    refresh();
    focusRow();
    return true;
  }

  function action(name, controller = true) {
    if (name === "back" || name === "menu") { close(controller); return; }
    if (name === "previous" || name === "next") {
      void run(() => music.navigate(name));
      return;
    }
    const visible = availableRows();
    const index = Math.max(0, visible.findIndex(row => row.id === selectedId));
    const row = visible[index];
    if (name === "up" || name === "down") {
      focusRow(visible[Math.max(0, Math.min(visible.length - 1, index + (name === "down" ? 1 : -1)))]?.id);
    } else if (name === "primary") {
      row?.node.click();
    } else if ((name === "left" || name === "right") && row?.adjust) {
      void run(() => row.adjust(name === "right" ? 1 : -1), row.id === "video");
    }
  }

  window.addEventListener("xmb:action", event => {
    if (!isOpen()) return;
    event.stopImmediatePropagation();
    action(event.detail);
  }, true);
  document.addEventListener("keydown", event => {
    if (!isOpen()) return;
    const keys = {ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Escape: "back", Backspace: "back", ContextMenu: "menu"};
    if (!keys[event.key]) return; // Native Tab/Enter/Space remain accessible.
    event.preventDefault();
    event.stopImmediatePropagation();
    action(keys[event.key], false);
  }, true);
  for (const type of ["spaceamp:trackchange", "spaceamp:playstate", "spaceamp:progress", "spaceamp:presentationchange"]) {
    window.addEventListener(type, () => {
      refresh();
      if (type === "spaceamp:trackchange") promote();
    });
  }
  window.addEventListener("spaceamp:nowplaying-closing", () => close());
  window.XmbQuickMenu = {open, close, isOpen, composeMusic: section => { music = section; }};
})();
