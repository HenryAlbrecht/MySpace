/* System command surface; Music and System are explicitly composed by owners. */
(() => {
  let music;
  let system;
  let sectionId = "music";
  let rail;
  let content;
  let musicSection;
  let systemSection;
  let railFocus = false;
  let shell;
  let origin;
  let selectedId = "play";
  let inertBefore = false;
  let rows = [];
  let heading;
  let artist;
  let artwork;
  let status;
  let help;
  let commandStatus;
  let playbackTimer = null;
  let adjusting = false;
  const lastRows = {music: "play", system: "fullscreen"};

  const isOpen = () => !!shell?.open;
  const availableRows = () => rows.filter(row => row.section === sectionId && !row.node.hidden && !row.node.disabled);

  function focusRow(id = selectedId) {
    const row = availableRows().find(row => row.id === id) || availableRows()[0];
    if (!row) return;
    setAdjusting(false);
    railFocus = false;
    selectedId = row.id;
    lastRows[sectionId] = row.id;
    row.node.focus({preventScroll: true});
    row.node.scrollIntoView({block: "nearest", behavior: "instant"});
  }

  function close(controller = false) {
    if (!isOpen()) return;
    clearInterval(playbackTimer);
    playbackTimer = null;
    setAdjusting(false);
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
    shell.classList.add("xqm-reordering");
    shell.close();
    shell.showModal();
    requestAnimationFrame(() => shell.classList.remove("xqm-reordering"));
    focusRow();
  }

  async function run(command) {
    try {
      commandStatus.textContent = "";
      await command();
      refresh();
    } catch {
      if (isOpen()) commandStatus.textContent = "Comando indisponível neste contexto.";
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
    musicSection = section;
    systemSection = node("section", "xqm-system");
    systemSection.setAttribute("aria-label", "Sistema");
    rail = node("nav", "xqm-rail");
    rail.setAttribute("aria-label", "Seções do Quick Menu");
    for (const [id, label] of [["music", "Música"], ["system", "Sistema"]]) {
      const button = node("button", "xqm-row", label);
      button.type = "button";
      button.dataset.section = id;
      button.onclick = () => { selectSection(id); focusRow(); };
      button.onfocus = () => { setAdjusting(false); railFocus = true; sectionId = id; selectedId = lastRows[id]; refresh(); };
      rail.append(button);
    }
    content = node("div", "xqm-content");
    content.append(musicSection, systemSection);
    const body = node("div", "xqm-body");
    body.append(rail, content);
    help = node("p", "xqm-help");
    commandStatus = node("p", "xqm-status");
    commandStatus.setAttribute("role", "status");
    shell.append(header, body, commandStatus, help);
    document.body.append(shell);

    function add(id, label, activate, adjust, display, hidden = () => false) {
      const button = node("button", "xqm-row");
      button.type = "button";
      button.dataset.command = id;
      const name = node("span", "xqm-label", label);
      const value = node("span", "xqm-value");
      button.append(name, value);
      const row = {section: "music", id, node: button, name, value, activate, adjust, display, hidden};
      rows.push(row);
      button.onclick = () => {
        if (adjust) setAdjusting(!adjusting);
        else void run(activate);
      };
      button.onfocus = () => {
        if (selectedId !== id || railFocus) setAdjusting(false);
        railFocus = false;
        selectedId = id;
        lastRows[sectionId] = id;
      };
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
      }, id === "lyricsEnabled" ? null : change, () => choices().find(option => option.value === music.getState().preferences[id])?.label, () => origin?.surface === "xmb");
    }
    preference("lyricsEnabled", "Letras", () => [{value: false, label: "OFF"}, {value: true, label: "ON"}]);
    for (const [id, label] of [["romanization", "Transliteração"], ["translation", "Tradução da fonte"]]) {
      const option = () => music.getState().lyricsOptions?.find(option => option.id === id);
      add(id, label, () => music.toggleLyricsOption(id), null,
        () => option()?.pressed ? "ON" : "OFF", () => origin?.surface !== "lyrics" || !option());
    }
    add("video", "Vídeo", () => music.toggleVideo(), null, () => music.getState().videoMode ? "ON" : "OFF", () => origin?.surface === "xmb" || !music.getState().videoAvailable);
    preference("visualizerMode", "Visualizador", () => music.getState().choices.visualizerMode);
    preference("backgroundMode", "Fundo", () => music.getState().choices.backgroundMode);
    preference("uiMode", "Interface", () => music.getState().choices.uiMode);
    add("now-playing", "Abrir Now Playing", () => {
      const openPresentation = origin?.openNowPlaying || music.openNowPlaying;
      const target = origin?.target;
      close();
      openPresentation(target);
    }, null, null, () => music.getState().nowPlayingOpen);
    for (const [id, label, activate, display, hidden] of [
      ["fullscreen", "Fullscreen", () => system.toggleFullscreen(), () => system.getState().fullscreen ? "ON" : "OFF", () => !system?.getState().fullscreenAvailable],
      ["exit-xmb", "Sair do XMB", () => { close(); system.exitXmb(); }, null, () => !system?.getState().xmbActive],
    ]) {
      add(id, label, activate, null, display, hidden);
      const row = rows[rows.length - 1];
      row.section = "system";
      systemSection.append(row.node);
    }
    shell.addEventListener("cancel", event => { event.preventDefault(); close(); });
    shell.addEventListener("focusin", event => {
      const row = availableRows().find(row => row.id === selectedId);
      if (adjusting && event.target !== row?.node) setAdjusting(false);
    });
  }

  function refreshPlaybackStatus(state = music?.getState() || {}) {
    if (!isOpen()) return;
    const time = value => Math.floor((value || 0) / 60) + ":" + String(Math.floor((value || 0) % 60)).padStart(2, "0");
    const text = (state.playbackStatus === "loading" ? "Carregando…" : state.playing ? "Tocando" : "Pausado") +
      (state.duration > 0 ? " · " + time(state.position) + " / " + time(state.duration) : "");
    if (status.textContent !== text) status.textContent = text;
  }

  function refreshHints() {
    if (!help) return;
    const controller = window.XmbInput?.getMode() === "gamepad";
    help.textContent = adjusting
      ? controller ? "←→ ajustar · A/B/□ concluir" : "←→ ajustar · Enter / Esc concluir"
      : controller
        ? "↑↓ navegar · ← seções · A confirmar/editar · B/Options voltar · □ Volume · △ Play/Pause · L1/R1 faixa"
        : "Tab / ↑↓ navegar · ← seções · Enter confirmar/editar · Esc voltar";
  }

  function setAdjusting(value) {
    adjusting = value;
    for (const row of rows) row.node.classList.toggle("xqm-adjusting", value && row.id === selectedId && row.section === sectionId);
    refreshHints();
  }

  function refresh() {
    if (!isOpen()) return;
    const state = music?.getState() || {};
    const scrollTop = shell.scrollTop;
    const previousIndex = rows.findIndex(row => row.id === selectedId);
    heading.textContent = state.title;
    artist.textContent = state.artist;
    artwork.hidden = !state.artwork;
    if (state.artwork && artwork.getAttribute("src") !== state.artwork) artwork.src = state.artwork;
    refreshPlaybackStatus(state);
    refreshHints();
    if (state.accent) shell.style.setProperty("--xqm-accent", state.accent);
    else shell.style.removeProperty("--xqm-accent");
    for (const row of rows) {
      row.node.hidden = (row.section === "music" && !music?.isAvailable()) || row.hidden();
      row.name.textContent = row.id === "play" ? state.playing ? "Pausar" : "Reproduzir" : row.name.textContent;
      row.value.textContent = row.node.hidden ? "" : row.display?.() || "";
      row.node.setAttribute("aria-label", `${row.name.textContent}${row.value.textContent ? `: ${row.value.textContent}` : ""}`);
    }
    musicSection.hidden = sectionId !== "music";
    systemSection.hidden = sectionId !== "system";
    for (const button of rail.querySelectorAll("button")) {
      button.hidden = button.dataset.section === "music" ? !music?.isAvailable() : !systemAvailable();
      button.setAttribute("aria-pressed", String(button.dataset.section === sectionId));
    }
    if (!railFocus && !availableRows().some(row => row.id === selectedId)) {
      const nearest = availableRows().reduce((best, row) => !best || Math.abs(rows.indexOf(row) - previousIndex) < Math.abs(rows.indexOf(best) - previousIndex) ? row : best, null);
      focusRow(nearest?.id);
    } else shell.scrollTop = scrollTop;
  }

  function open(context = {}) {
    if (isOpen()) return true;
    if (!music?.isAvailable() && !systemAvailable()) return false;
    if (!shell) build();
    origin = {target: document.activeElement, surface: music?.getState().nowPlayingOpen ? "player" : "xmb", ...context};
    commandStatus.textContent = "";
    inertBefore = shell.inert;
    shell.inert = false;
    shell.showModal();
    document.body.classList.add("xmb-quick-menu-open");
    sectionId = music?.isAvailable() ? "music" : "system";
    railFocus = false;
    selectedId = sectionId === "music" ? "play" : "fullscreen";
    refresh();
    focusRow();
    playbackTimer = setInterval(refreshPlaybackStatus, 400);
    return true;
  }

  function action(name, controller = true) {
    if (adjusting && ["primary", "back", "secondary"].includes(name)) {
      setAdjusting(false);
      return;
    }
    if (name === "back" || name === "menu") { close(controller); return; }
    if (name === "tertiary") {
      if (music?.isAvailable()) void run(() => music.togglePlayback());
      return;
    }
    if (name === "secondary") {
      if (music?.isAvailable()) { selectSection("music"); focusRow("volume"); setAdjusting(true); }
      return;
    }
    if (railFocus) {
      const buttons = [...rail.querySelectorAll("button")].filter(button => !button.hidden);
      const index = buttons.findIndex(button => button.dataset.section === sectionId);
      if (name === "up" || name === "down") buttons[Math.max(0, Math.min(buttons.length - 1, index + (name === "down" ? 1 : -1)))]?.focus();
      else if (name === "right" || name === "primary") focusRow();
      return;
    }
    if (name === "previous" || name === "next") {
      if (!music?.isAvailable()) return;
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
    } else if ((name === "left" || name === "right") && row?.adjust && adjusting) {
      void run(() => row.adjust(name === "right" ? 1 : -1));
    } else if (name === "right" && row?.adjust) {
      setAdjusting(true);
    } else if (name === "left") {
      rail.querySelector(`[data-section="${sectionId}"]`).focus();
    }
  }

  window.addEventListener("xmb:action", event => {
    if (!isOpen()) return;
    event.stopImmediatePropagation();
    action(event.detail);
  }, true);
  document.addEventListener("keydown", event => {
    if (!isOpen()) return;
    if (adjusting && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      action("primary", false);
      return;
    }
    const keys = {ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Escape: "back", Backspace: "back", ContextMenu: "menu"};
    if (!keys[event.key]) return; // Native Tab/Enter/Space remain accessible.
    event.preventDefault();
    event.stopImmediatePropagation();
    action(keys[event.key], false);
  }, true);
  for (const type of ["spaceamp:trackchange", "spaceamp:playstate", "spaceamp:progress", "spaceamp:presentationchange", "spaceamp:lyricsoptionschange"]) {
    window.addEventListener(type, refresh);
  }
  window.addEventListener("xmb:inputmode", refresh);
  window.addEventListener("spaceamp:video-layerchange", promote);
  document.addEventListener("fullscreenchange", refresh);
  window.addEventListener("spaceamp:nowplaying-closing", () => close());
  function systemAvailable() {
    const state = system?.getState();
    return !!(state?.fullscreenAvailable || state?.xmbActive);
  }
  function selectSection(id) {
    sectionId = id;
    railFocus = false;
    setAdjusting(false);
    selectedId = lastRows[id];
    refresh();
  }
  window.XmbQuickMenu = {open, close, isOpen, composeMusic: section => { music = section; }, composeSystem: section => { system = section; }};
  window.dispatchEvent(new Event("xmb:quickmenu-ready"));
})();
