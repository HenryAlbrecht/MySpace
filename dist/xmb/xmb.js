/* Uma apresentação da coleção; não mantém cópias dos dados nem grava filtros. */
function createXmb({
  getData,
  getProfile,
  getFilters,
  openItem,
  navigate,
  openPhoto,
  el,
  button,
  imageNode,
}) {
  const categories = [
    ["profile", "Perfil", ["profile"]],
    ["game", "Jogos", ["game"]],
    ["music", "Música", ["music", "album", "artist", "playlists"]],
    ["video", "Vídeo", ["film", "series", "anime"]],
    ["reading", "Leitura", ["book", "manga"]],
    ["photos", "Fotos", ["photos"]],
    ["other", "Outros", ["other"]],
  ];
  const remembered = new Map();
  const positions = new Map();
  const folders = new Map();
  let area = "game";
  let foldersLevel = false;
  let folderDepth = false;
  let playlistTrackDepth = false;
  let playlistTrackPlaylistId = "";
  let folderFocusOffset = null;
  let listStartSpace = 0;
  let listEndSpace = 0;
  let folderTransition = null;
  const scrolling = new Map();
  const scrollDestinations = new Map();
  let wheelDirection = 0;
  let wheelSteps = 0;
  let category = "game";
  let gameBrowseLevel = "home";
  let gamePlatform = "";
  let active = false;
  let restoreFoldersOnEntry = false;
  let layoutRefreshFrame = null;
  let trigger;
  let background = [];
  let session = 0;
  let ownsFullscreen = false;
  let detailsLevel = false;
  let previewScroll = 0;
  let clockTimer;
  let playbackProgressTimer;
  let dashTimer;
  let dashHideTimer;
  let lastDashTrackKey = "";
  let handoffContext = null;
  let primaryRevision = 0;
  let entryFocused = false;
  let inputMode = "keyboard";
  const root = el("section", "xmb");
  root.hidden = true;
  root.tabIndex = -1;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Coleção — modo XMB");
  const header = el("header", "xmb-header");
  const backButton = button("[ sair · Esc ]", back, "xmb-exit");
  const system = el("div", "xmb-system");
  const clock = el("time", "xmb-clock");
  const clockDate = el("span", "xmb-clock-date");
  const clockIcon = el("span", "xmb-clock-icon", "◷");
  const clockHour = el("span", "xmb-clock-hour");
  clockIcon.setAttribute("aria-hidden", "true");
  clock.append(clockDate, clockIcon, clockHour);
  const locale = window.navigator?.languages;
  const clockFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const nowEntry = button(
    "",
    () => {
      entryFocused = true;
      openNowPlaying();
    },
    "xmb-now-playing",
  );
  nowEntry.hidden = true;
  nowEntry.tabIndex = -1;
  const nowCoverFrame = el("span", "xmb-now-playing-cover");
  const nowCoverFallback = el("span", "xmb-now-playing-cover-fallback", "♪");
  const nowCover = el("img", "xmb-now-playing-artwork");
  nowCover.alt = "";
  nowCover.setAttribute("aria-hidden", "true");
  nowCoverFallback.setAttribute("aria-hidden", "true");
  nowCoverFrame.append(nowCoverFallback, nowCover);
  const nowCopy = el("span", "xmb-now-playing-copy");
  const nowTitle = el("span", "xmb-now-playing-title");
  const nowArtist = el("span", "xmb-now-playing-artist");
  nowCopy.append(nowTitle, nowArtist);
  const nowProgress = el("span", "xmb-now-playing-progress");
  const nowProgressTrack = el("span", "xmb-now-playing-progress-track");
  const nowProgressFill = el("span", "xmb-now-playing-progress-fill");
  nowProgressTrack.append(nowProgressFill);
  const nowElapsed = el("span", "xmb-now-playing-time");
  const nowRemaining = el("span", "xmb-now-playing-time");
  nowProgress.append(nowProgressTrack, nowElapsed, nowRemaining);
  nowEntry.append(nowCoverFrame, nowCopy, nowProgress);
  const dashNotification = el("div", "xmb-dash-notification");
  const dashIcon = el("span", "xmb-dash-icon", "♫");
  const dashText = el("span", "xmb-dash-text");
  dashIcon.setAttribute("aria-hidden", "true");
  dashNotification.setAttribute("role", "status");
  dashNotification.setAttribute("aria-live", "polite");
  dashNotification.append(dashIcon, dashText);
  dashNotification.hidden = true;
  system.append(clock, backButton);
  header.append(el("span", "", "XMB v0.4"), system);

  function stopClock() {
    if (clockTimer !== undefined) {
      window.clearTimeout?.(clockTimer);
    }
    clockTimer = undefined;
  }
  function updateClock() {
    stopClock();
    if (!active) {
      return;
    }
    const now = new Date();
    clockDate.textContent = dateFormat.format(now);
    clockHour.textContent = clockFormat.format(now);
    clock.setAttribute("aria-label", clockDate.textContent + " · " + clockHour.textContent);
    clock.setAttribute("datetime", now.toISOString());
    clock.setAttribute("title", dateFormat.format(now));
    // Próxima virada de minuto, sem timers rodando fora do XMB.
    clockTimer = window.setTimeout?.(
      updateClock,
      60000 - now.getSeconds() * 1000 - now.getMilliseconds(),
    );
  }
  const nav = el("nav", "xmb-categories");
  nav.setAttribute("aria-label", "Áreas do sistema");
  const categoryButtons = new Map();
  for (const [key, label] of categories) {
    const control = button(label, () => selectCategory(key), "xmb-category");
    control.dataset.category = key;
    categoryButtons.set(key, control);
    nav.append(control);
  }
  const body = el("div", "xmb-body");
  const list = el("div", "xmb-items");
  list.addEventListener(
    "wheel",
    (event) => {
      if (
        root.dataset.rootColumn !== "true" ||
        detailsLevel ||
        !event.target?.closest?.(".xmb-item")
      ) {
        return;
      }
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const direction = Math.sign(delta);
      if (!direction) return;
      if (wheelDirection && wheelDirection !== direction) wheelSteps = 0;
      wheelDirection = direction;
      wheelSteps += delta;
      const steps = Math.trunc(wheelSteps / 100);
      if (steps) {
        wheelSteps -= steps * 100;
        selectItem(selection(entries()) + steps);
      }
    },
    { passive: false },
  );
  const detail = el("aside", "xmb-detail");
  const context = el("p", "xmb-context");
  list.setAttribute("aria-label", "Itens da categoria");
  detail.setAttribute("aria-label", "Detalhes do item selecionado");
  const announcement = el("span", "xmb-announcement");
  announcement.setAttribute("role", "status");
  body.append(list, detail);
  root.append(header, nav, body, nowEntry, dashNotification, announcement);
  const backdrop = el("div", "xmb-backdrop");
  backdrop.setAttribute("aria-hidden", "true");
  root.append(backdrop);

  function selectionKey() {
    return foldersLevel
      ? "folders:" + area
      : playlistTrackDepth
        ? "playlist-tracks:" + playlistTrackPlaylistId
        : category === "game"
          ? gameBrowseLevel === "titles"
            ? `game:titles:${gamePlatform}`
            : `game:${gameBrowseLevel}`
          : category;
  }
  function rememberPosition() {
    const destination = scrollDestinations.get(list);
    stopScroll(list);
    if (destination != null) list.scrollTop = destination;
    positions.set(selectionKey(), { list: list.scrollTop, detail: detail.scrollTop });
  }
  function setListSpaces(start, end) {
    listStartSpace = start;
    listEndSpace = end;
    list.style?.setProperty?.("--xmb-list-start-space", start + "px");
    list.style?.setProperty?.("--xmb-list-end-space", end + "px");
  }
  function measureFolderFocusOffset(row) {
    const bounds = row?.getBoundingClientRect?.();
    const focusY = bounds && bounds.top + bounds.height / 2;
    if (!Number.isFinite(focusY) || !list.getBoundingClientRect) {
      return null;
    }
    const previousDepth = root.dataset.folderDepth;
    const previousRootColumn = root.dataset.rootColumn;
    root.dataset.folderMeasure = "true";
    root.dataset.rootColumn = "false";
    root.dataset.folderDepth = "true";
    const destinationTop = list.getBoundingClientRect().top;
    root.dataset.folderDepth = previousDepth || String(folderDepth);
    root.dataset.rootColumn = previousRootColumn || String(!folderDepth);
    root.dataset.folderMeasure = "false";
    return Number.isFinite(destinationTop) ? focusY - destinationTop : null;
  }
  function restorePosition() {
    const saved = positions.get(selectionKey());
    if (saved) {
      list.scrollTop = root.dataset.rootColumn === "true" ? 0 : saved.list;
      detail.scrollTop = saved.detail;
    }
    if (!folderDepth) revealSelection(false);
  }
  function cancelFolderTransition() {
    const transition = folderTransition;
    if (!transition) {
      return null;
    }
    folderTransition = null;
    transition.animations?.forEach((animation) => animation.cancel());
    transition.snapshots?.forEach((snapshot) => snapshot.remove());
    list.inert = false;
    root.dataset.folderTransition = "false";
    if (transition.committed) {
      list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    }
    return transition;
  }
  function settleFolderTransition() {
    const transition = cancelFolderTransition();
    if (transition && !transition.committed) {
      transition.commit();
      transition.committed = true;
    }
  }
  function transitionFolderDepth(
    direction,
    commit,
    prepare = () => {},
    { animateNavigation = true } = {},
  ) {
    const style = window.getComputedStyle(root);
    const durationToken =
      style.getPropertyValue("--motion-focus").trim() ||
      style.getPropertyValue("--motion-fast").trim();
    const duration =
      Number.parseFloat(durationToken) * (durationToken.endsWith("ms") ? 1 : 1000);
    const easing = style.getPropertyValue("--ease-xmb").trim() || "ease";
    const transition = {
      animations: [],
      committed: false,
      commit,
      direction,
      snapshots: [],
      sourceFocus: document.activeElement,
    };
    folderTransition = transition;
    root.dataset.folderTransition = "true";
    list.inert = true;
    nav.inert = true;
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      !(duration > 0) ||
      !list.animate ||
      !list.cloneNode ||
      !root.append
    ) {
      list.inert = false;
      prepare();
      transition.commit();
      transition.committed = true;
      folderTransition = null;
      root.dataset.folderTransition = "false";
      return;
    }
    const bounds = list.getBoundingClientRect?.();
    if (
      !bounds ||
      !Number.isFinite(bounds.top) ||
      !Number.isFinite(bounds.left) ||
      !(bounds.width > 0) ||
      !(bounds.height > 0)
    ) {
      list.inert = false;
      prepare();
      transition.commit();
      transition.committed = true;
      folderTransition = null;
      root.dataset.folderTransition = "false";
      return;
    }
    const outgoingX = direction === "enter" ? -32 : 32;
    const incomingX = -outgoingX;
    try {
      const capture = (element, className) => {
        const rect = element.getBoundingClientRect();
        if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
          return null;
        }
        const snapshot = element.cloneNode(true);
        snapshot.className += " " + className;
        snapshot.setAttribute("aria-hidden", "true");
        snapshot.setAttribute("data-source-folder-depth", String(folderDepth));
        snapshot.setAttribute("data-source-level", root.dataset.level || "root");
        snapshot.setAttribute("data-source-kind", root.dataset.kind || "");
        snapshot.setAttribute("data-source-root-column", root.dataset.rootColumn || "false");
        snapshot.inert = true;
        snapshot.scrollTop = element.scrollTop;
        snapshot.scrollLeft = element.scrollLeft;
        Object.assign(snapshot.style, {
          position: "fixed",
          inset: "auto",
          top: rect.top + "px",
          left: rect.left + "px",
          width: rect.width + "px",
          height: rect.height + "px",
          margin: "0",
        });
        transition.snapshots.push(snapshot);
        root.append(snapshot);
        return snapshot;
      };
      const listSnapshot =
        direction === "exit" ? capture(list, "xmb-items-transition-outgoing") : null;
      let navigationTransition = null;
      if (direction === "enter" && animateNavigation && nav.cloneNode && nav.animate) {
        navigationTransition = capture(nav, "xmb-categories-transition-outgoing");
      } else if (direction === "exit" && animateNavigation && nav.animate) {
        const previousDepth = root.dataset.folderDepth;
        const previousMeasure = root.dataset.folderMeasure;
        const previousFolderDepth = folderDepth;
        root.dataset.folderMeasure = "true";
        root.dataset.folderDepth = "false";
        try {
          folderDepth = false;
          updateHorizontalAxis(false);
          navigationTransition = nav;
        } finally {
          folderDepth = previousFolderDepth;
          root.dataset.folderDepth = previousDepth || String(folderDepth);
          root.dataset.folderMeasure = previousMeasure || "false";
        }
      }
      if (direction === "exit" && !listSnapshot) {
        throw new Error("XMB list snapshot is unavailable");
      }
      prepare();
      transition.commit();
      transition.committed = true;
      list.inert = false;
      if (listSnapshot) {
        transition.animations.push(
          listSnapshot.animate(
            [
              { opacity: 1, transform: "translateX(0)" },
              { opacity: 0, transform: `translateX(${outgoingX}px)` },
            ],
            { duration, easing, fill: "both" },
          ),
        );
      }
      if (navigationTransition) {
        transition.animations.push(
          navigationTransition.animate(
            direction === "enter"
              ? [
                  { opacity: 1, transform: "translateX(0)" },
                  { opacity: 0, transform: `translateX(${outgoingX}px)` },
                ]
              : [
                  { opacity: 0.64, transform: `translateX(${incomingX}px)` },
                  { opacity: 1, transform: "translateX(0)" },
                ],
            { duration, easing, fill: "both" },
          ),
        );
      }
      transition.animations.push(
        list.animate(
          [
            { opacity: 0.64, transform: `translateX(${incomingX}px)` },
            { opacity: 1, transform: "translateX(0)" },
          ],
          { duration, easing, fill: "both" },
        ),
      );
    } catch {
      transition.animations.forEach((animation) => animation.cancel());
      transition.snapshots.forEach((snapshot) => snapshot.remove());
      list.inert = false;
      if (!transition.committed) {
        prepare();
        transition.commit();
        transition.committed = true;
      }
      folderTransition = null;
      root.dataset.folderTransition = "false";
      return;
    }
    void Promise.all(transition.animations.map((animation) => animation.finished)).then(
      () => {
        if (folderTransition === transition) {
          cancelFolderTransition();
        }
      },
      () => {
        if (folderTransition === transition) {
          cancelFolderTransition();
        }
      },
    );
  }
  function openFolder(kind, item) {
    if (folderTransition) {
      return;
    }
    if (area === "game" && category === "game" && item?.gameFolder) {
      rememberPosition();
      invalidateHandoff();
      folderFocusOffset = measureFolderFocusOffset(list.querySelector('[aria-pressed="true"]'));
      nav.inert = true;
      transitionFolderDepth("enter", () => {
        root.dataset.folderDepth = "true";
        folderDepth = true;
        detailsLevel = false;
        if (item.gameFolder === "all") {
          gameBrowseLevel = "platforms";
          gamePlatform = "";
        } else {
          gameBrowseLevel = "titles";
          gamePlatform = item.platformKey;
        }
        setListSpaces(0, 0);
        list.scrollTop = 0;
        detail.tabIndex = -1;
        list.inert = false;
        render({ focus: true });
        restorePosition();
        revealSelection(false);
      });
      return;
    }
    rememberPosition();
    invalidateHandoff();
    folderFocusOffset = measureFolderFocusOffset(list.querySelector('[aria-pressed="true"]'));
    nav.inert = true;
    transitionFolderDepth("enter", () => {
      root.dataset.folderDepth = "true";
      folders.set(area, kind);
      category = kind;
      foldersLevel = false;
      folderDepth = true;
      render({ focus: true });
      restorePosition();
      revealSelection(false);
    });
  }

  function gameItems() {
    return Collection.filterItems(getData().items, {
      ...getFilters(),
      kind: "game",
    }).filter((item) => !item.xmbHidden);
  }

  function gamePlatformLabel(item) {
    const values = [item.platform, ...(Array.isArray(item.platforms) ? item.platforms : [])]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const uniqueValues = [
      ...new Map(values.map((value) => [value.toLocaleLowerCase(), value])).values(),
    ];
    const catalogId = item.catalogId || item.metadataSources?.catalogId || "";
    if (
      /^steam:/i.test(catalogId) ||
      /^steam$/i.test(item.source || "") ||
      uniqueValues.some((value) => /\bsteam\b/i.test(value))
    ) {
      return "Steam";
    }
    const desktopPlatform = (value) =>
      /^(pc\b|windows\b|linux\b|mac(?:os)?\b|steam deck\b|epic(?: games)?\b|gog(?: galaxy)?\b|itch(?:\.io)?\b|amazon games\b|ubisoft connect\b|ea app\b|origin\b|battle\.net\b)/i.test(
        value,
      );
    const desktops = uniqueValues.filter(desktopPlatform);
    const systems = uniqueValues.filter((value) => !desktopPlatform(value));
    if (desktops.length && systems.length) return "Multiplataforma";
    if (systems.length > 1) return "Multiplataforma";
    if (systems.length === 1) return systems[0];
    if (uniqueValues.length || desktopPlatform(String(item.source || "").trim())) return "PC";
    return "Sem plataforma";
  }

  function gamePlatformFolders() {
    const counts = new Map();
    for (const item of gameItems()) {
      const platform = gamePlatformLabel(item);
      const key = platform.toLocaleLowerCase();
      const previous = counts.get(key);
      counts.set(key, { platform: previous?.platform || platform, count: (previous?.count || 0) + 1 });
    }
    return [...counts.values()]
      .sort((left, right) =>
        left.platform.localeCompare(right.platform, "pt-BR", { sensitivity: "base" }),
      )
      .map(({ platform, count }) => ({
        folder: "game-platform",
        gameFolder: "platform",
        id: "xmb-game-platform:" + platform,
        platformKey: platform,
        title: platform,
        gameCount: count,
      }));
  }

  function entries() {
    if (foldersLevel) {
      return categories.find(([key]) => key === area)[2].map((kind) => ({
        folder: kind,
        id: kind,
        title: kind === "playlists" ? "Playlists" : Collection.kinds[kind],
      }));
    }
    if (playlistTrackDepth) {
      const playlist = (window.MusicBridge?.getPlaylists?.() || []).find(
        (item) => String(item.id) === playlistTrackPlaylistId,
      );
      return (playlist?.tracks || []).map((track) => ({ ...track, kind: "music" }));
    }
    if (category === "profile") {
      return [getProfile()];
    }
    if (category === "photos") {
      return getData().photos || [];
    }
    if (category === "playlists") {
      return (window.MusicBridge?.getPlaylists?.() || []).map((playlist) => ({
        ...playlist,
        playlistId: playlist.id,
        kind: "playlist",
        title: playlist.name,
        trackCount: playlist.tracks?.length || 0,
        image: window.MusicBridge?.getPlaylistCover?.(playlist.id) ||
          playlist.tracks?.[0]?.image || playlist.tracks?.[0]?.album || "",
      }));
    }
    if (category === "game") {
      const games = gameItems();
      if (gameBrowseLevel === "home") {
        const pinned = games
          .filter((item) => item.xmbPinned)
          .sort((left, right) => left.title.localeCompare(right.title, "pt-BR"));
        return [
          ...pinned,
          {
            folder: "game-all",
            gameFolder: "all",
            id: "xmb-game-all",
            title: "Todos os jogos",
            gameCount: games.length,
          },
        ];
      }
      if (gameBrowseLevel === "platforms") return gamePlatformFolders();
      return games.filter(
        (item) =>
          gamePlatformLabel(item).toLocaleLowerCase() === gamePlatform.toLocaleLowerCase(),
      );
    }
    return Collection.filterItems(getData().items, {
      ...getFilters(),
      kind: category,
    }).filter((item) => category !== "game" || !item.xmbHidden);
  }
  const identity = (item, index) => item.id ?? index;
  const title = (item) =>
    item.folder
      ? item.title
      : category === "profile"
        ? item.name
        : category === "photos"
          ? item.caption || "Foto sem legenda"
          : item.title;
  const folderDescriptions = {
    music: "Faixas e fontes de reprodução da sua coleção.",
    album: "Álbuns, EPs e singles salvos na coleção.",
    artist: "Artistas salvos e suas fichas musicais.",
    film: "Filmes que você acompanha na coleção.",
    series: "Séries e seu progresso pessoal.",
    anime: "Animes e seu progresso pessoal.",
    book: "Livros e suas leituras.",
    manga: "Mangás e seu progresso de leitura.",
    playlists: "Playlists salvas na Biblioteca musical.",
  };
  function folderSummary(item) {
    if (item.folder === "game-all") {
      const count = gameItems().length;
      return `${count} ${count === 1 ? "jogo" : "jogos"} · Biblioteca organizada por plataforma.`;
    }
    if (item.folder === "game-platform") {
      const count = gameItems().filter(
        (game) =>
          gamePlatformLabel(game).toLocaleLowerCase() === item.platformKey.toLocaleLowerCase(),
      ).length;
      return `${count} ${count === 1 ? "jogo" : "jogos"} nesta plataforma.`;
    }
    if (item.folder === "playlists") {
      const count = window.MusicBridge?.getPlaylists?.().length || 0;
      return `${count} ${count === 1 ? "playlist salva" : "playlists salvas"} na Biblioteca musical.`;
    }
    const count = Collection.filterItems(getData().items, {
      ...getFilters(),
      kind: item.folder,
    }).length;
    return `${count} ${count === 1 ? "item" : "itens"} com os filtros atuais · ${folderDescriptions[item.folder]}`;
  }
  function selection(rows = entries()) {
    const index = rows.findIndex((item, i) => identity(item, i) === remembered.get(selectionKey()));
    return Math.max(0, index);
  }
  // Presentation-only priority. Future item adapters can supply a dedicated
  // horizontal backdrop or custom background without changing rendering.
  function artworkSource({ horizontalBackdrop, customBackground, cover }) {
    return horizontalBackdrop || customBackground || cover || null;
  }
  // Retain the last decoded artwork even while an empty category hides it.
  let detailCover;
  let activeBackdropImage;
  let pendingBackdropImage;
  let identityImage;
  let identitySource;
  let backdropSource;
  let backdropMediaType = "image";
  let backdropContext;
  let backdropRevision = 0;
  let backdropSettleTimer;
  let backdropCleanupTimer;
  let outgoingBackdropImage;
  const backdropCrossfadeMs = 460;
  let artworkGap = true;
  let idleMediaTimer;
  let screenshotTimer;
  let idleVideoFrame;
  let idleVideoElement;
  let idleScreenshotLayers = [];
  let idleScreenshotIndex = -1;
  let screenshotRevision = 0;
  let focusSoundTimer;
  let focusSoundRevision = 0;
  let focusSoundKey = "";
  function stopFocusSound() {
    focusSoundRevision++;
    if (focusSoundTimer !== undefined) window.clearTimeout?.(focusSoundTimer);
    focusSoundTimer = undefined;
    focusSoundKey = "";
    window.SPACEAMP?.stopCue?.();
  }
  function clearIdleMedia() {
    screenshotRevision++;
    if (idleMediaTimer !== undefined) window.clearTimeout?.(idleMediaTimer);
    if (screenshotTimer !== undefined) window.clearTimeout?.(screenshotTimer);
    idleMediaTimer = undefined;
    screenshotTimer = undefined;
    idleVideoFrame?.remove();
    idleVideoFrame = undefined;
    idleVideoElement?.pause?.();
    idleVideoElement?.removeAttribute?.("src");
    idleVideoElement?.load?.();
    idleVideoElement?.remove();
    idleVideoElement = undefined;
    idleScreenshotLayers.forEach((layer) => layer.remove());
    idleScreenshotLayers = [];
    idleScreenshotIndex = -1;
  }
  function updateFocusSound(item) {
    const art = item?.xmbArt || {};
    const source = category === "game" && art.focusAudioEnabled !== false ? art.focusAudio : "";
    const key = source ? `${identity(item, selection())}:${source}` : "";
    if (!key) {
      stopFocusSound();
      return;
    }
    if (key === focusSoundKey) return;
    stopFocusSound();
    focusSoundKey = key;
    const revision = focusSoundRevision;
    focusSoundTimer = window.setTimeout?.(async () => {
      focusSoundTimer = undefined;
      const url = await (window.XmbArtworkStorage?.resolveOriginal(source) || source);
      if (!url || revision !== focusSoundRevision || !active || focusSoundKey !== key) return;
      void window.SPACEAMP?.playCue?.(url);
    }, 1000);
  }
  function clearBackdropMedia(media) {
    if (media?.tagName === "VIDEO") {
      media.pause?.();
      media.removeAttribute?.("src");
      media.load?.();
    }
    media?.remove?.();
  }
  function prepareArtworkAfterGap(image, source) {
    if (!artworkGap || !window.Artwork) {
      return;
    }
    const sameReadySource =
      image.dataset.artworkState === "ready" && image.dataset.artworkSource === source;
    if (!sameReadySource && image.dataset.artworkReady === "true") {
      Artwork.clear(image);
    }
  }
  function cancelBackdropWork() {
    backdropRevision++;
    if (backdropSettleTimer !== undefined) window.clearTimeout?.(backdropSettleTimer);
    if (backdropCleanupTimer !== undefined) window.clearTimeout?.(backdropCleanupTimer);
    backdropSettleTimer = undefined;
    backdropCleanupTimer = undefined;
    if (pendingBackdropImage && pendingBackdropImage !== activeBackdropImage)
      clearBackdropMedia(pendingBackdropImage);
    if (outgoingBackdropImage && outgoingBackdropImage !== activeBackdropImage)
      clearBackdropMedia(outgoingBackdropImage);
    pendingBackdropImage = null;
    outgoingBackdropImage = null;
    if (activeBackdropImage)
      activeBackdropImage.className = "xmb-backdrop-wallpaper xmb-backdrop-wallpaper-active";
  }
  function loadBackdropImage(image, source, ready, error) {
    image.alt = "";
    image.loading = "eager";
    if (window.Artwork) {
      Artwork.set(image, source, { variant: "wallpaper", ready, error });
    } else {
      image.dataset.artworkSource = source;
      image.dataset.artworkVariant = "wallpaper";
      image.onload = ready;
      image.onerror = error;
      image.src = source;
    }
  }
  function loadBackdropVideo(video, source, ready, error) {
    video.dataset.artworkSource = source;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      ready();
      void video.play?.().catch?.(() => {});
    };
    video.onerror = error;
    Promise.resolve(window.XmbArtworkStorage?.resolveOriginal(source) || source)
      .then((url) => {
        if (!url || video.isConnected === false) return;
        video.src = url;
        video.load?.();
        if (video.readyState >= 2) {
          ready();
          void video.play?.().catch?.(() => {});
        }
      })
      .catch(error);
  }
  function appendBackdropImage(image) {
    if (identityImage?.parentElement === backdrop && backdrop.insertBefore)
      backdrop.insertBefore(image, identityImage);
    else backdrop.append(image);
  }
  function resetBackdropForContext() {
    const gameContext =
      category === "game"
        ? `:${gameBrowseLevel}${gameBrowseLevel === "titles" ? ":" + gamePlatform : ""}`
        : "";
    const context = `${area}:${category}:${foldersLevel ? "folders" : "items"}${gameContext}`;
    if (context === backdropContext) return;
    cancelBackdropWork();
    clearBackdropMedia(activeBackdropImage);
    activeBackdropImage = null;
    identityImage?.remove();
    identityImage = null;
    identitySource = null;
    if (detailCover) {
      if (window.Artwork) Artwork.clear(detailCover);
      else detailCover.removeAttribute("src");
    }
    backdropSource = null;
    backdropMediaType = "image";
    backdropContext = context;
  }
  function updateBackdrop(
    source,
    hasCustomBackground,
    mediaType = "image",
    objectPosition = "50% 50%",
  ) {
    root.dataset.itemBackground = String(hasCustomBackground);
    for (const media of [activeBackdropImage, pendingBackdropImage, outgoingBackdropImage])
      if (source && media?.dataset.artworkSource === source)
        media.style.objectPosition = objectPosition;
    if (!source) {
      backdrop.hidden = true;
      cancelBackdropWork();
      backdropSource = null;
      return;
    }
    backdrop.hidden = false;
    if (
      activeBackdropImage?.dataset.artworkSource === source &&
      (mediaType === "video") === (activeBackdropImage.tagName === "VIDEO")
    ) {
      cancelBackdropWork();
      backdropSource = source;
      return;
    }
    if (backdropSource === source && backdropMediaType === mediaType) return;

    cancelBackdropWork();
    const revision = backdropRevision;
    backdropSource = source;
    backdropMediaType = mediaType;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const transitionEnabled =
      getData()?.appearance?.xmb?.gameWallpaperTransitionEnabled !== false && !reducedMotion;

    const loadActive = (fadeIn = false) => {
      if (!activeBackdropImage) {
        activeBackdropImage = el(
          mediaType === "video" ? "video" : "img",
          `xmb-backdrop-wallpaper xmb-backdrop-wallpaper-${fadeIn ? "incoming" : "active"}`,
        );
        appendBackdropImage(activeBackdropImage);
      }
      activeBackdropImage.style.objectPosition = objectPosition;
      (mediaType === "video" ? loadBackdropVideo : loadBackdropImage)(
        activeBackdropImage,
        source,
        () => {
          if (revision !== backdropRevision) return;
          activeBackdropImage.className = `xmb-backdrop-wallpaper xmb-backdrop-wallpaper-${fadeIn ? "entering" : "active"}`;
        },
        () => {
          if (revision !== backdropRevision) return;
          backdropSource = null;
          if (!activeBackdropImage?.dataset.artworkReady) backdrop.hidden = true;
        },
      );
    };

    if (!transitionEnabled || !window.setTimeout) {
      loadActive();
      return;
    }

    const beginCrossfade = () => {
      if (revision !== backdropRevision) return;
      if (!activeBackdropImage) {
        loadActive(true);
        return;
      }
      const incoming = el(
        mediaType === "video" ? "video" : "img",
        "xmb-backdrop-wallpaper xmb-backdrop-wallpaper-incoming",
      );
      incoming.style.objectPosition = objectPosition;
      pendingBackdropImage = incoming;
      appendBackdropImage(incoming);
      (mediaType === "video" ? loadBackdropVideo : loadBackdropImage)(
        incoming,
        source,
        () => {
          if (revision !== backdropRevision) {
            incoming.remove();
            return;
          }
          const outgoing = activeBackdropImage;
          incoming.className =
            "xmb-backdrop-wallpaper xmb-backdrop-wallpaper-entering";
          activeBackdropImage = incoming;
          pendingBackdropImage = null;
          if (outgoing) {
            outgoing.className =
              "xmb-backdrop-wallpaper xmb-backdrop-wallpaper-leaving";
            outgoingBackdropImage = outgoing;
            backdropCleanupTimer = window.setTimeout?.(() => {
              if (outgoingBackdropImage === outgoing && activeBackdropImage !== outgoing)
                clearBackdropMedia(outgoing);
              if (outgoingBackdropImage === outgoing) outgoingBackdropImage = null;
              backdropCleanupTimer = undefined;
            }, backdropCrossfadeMs);
          }
        },
        () => {
          if (revision !== backdropRevision) return;
          clearBackdropMedia(incoming);
          pendingBackdropImage = null;
          backdropSource = activeBackdropImage?.dataset.artworkSource || null;
          if (!activeBackdropImage) backdrop.hidden = true;
        },
      );
    };

    const settleMs = category === "game" ? 1000 : 500;
    if (window.setTimeout)
      backdropSettleTimer = window.setTimeout(() => {
        backdropSettleTimer = undefined;
        beginCrossfade();
      }, settleMs);
    else beginCrossfade();
  }
  function selectedGameRow(item, revision) {
    if (revision !== screenshotRevision || !active || category !== "game") return null;
    const row = list.querySelector('.xmb-item[aria-pressed="true"]');
    return row?.dataset.itemId === String(identity(item, selection())) ? row : null;
  }
  function showIdleScreenshot(source, item, revision) {
    const row = selectedGameRow(item, revision);
    if (!row) return;
    while (idleScreenshotLayers.length < 2) {
      const layer = el("img", "xmb-game-idle-media xmb-game-idle-screenshot");
      layer.alt = "";
      layer.setAttribute("aria-hidden", "true");
      layer.style.objectPosition =
        row.querySelector(":scope > img")?.style.objectPosition || "50% 100%";
      row.append(layer);
      idleScreenshotLayers.push(layer);
    }
    if (idleScreenshotLayers.some((layer) => layer.parentElement !== row)) {
      idleScreenshotLayers.forEach((layer) => layer.remove());
      idleScreenshotLayers = [];
      idleScreenshotIndex = -1;
      return showIdleScreenshot(source, item, revision);
    }
    const nextIndex = idleScreenshotIndex === 0 ? 1 : 0;
    const next = idleScreenshotLayers[nextIndex];
    const reveal = () => {
      if (!selectedGameRow(item, revision)) return;
      next.dataset.visible = "true";
      if (idleScreenshotIndex >= 0)
        idleScreenshotLayers[idleScreenshotIndex].dataset.visible = "false";
      idleScreenshotIndex = nextIndex;
    };
    if (window.Artwork)
      Artwork.set(next, source, { variant: "display", ready: reveal, error: () => {} });
    else {
      next.onload = reveal;
      next.onerror = reveal;
      next.src = source;
    }
  }
  function showIdleYoutubeVideo(source, gameTitle, revision) {
    const item = entries()[selection()];
    const row = item && selectedGameRow(item, revision);
    if (!row) return;
    const embed = typeof MediaEmbeds === "undefined" ? null : MediaEmbeds.parse(source);
    if (embed?.provider !== "youtube") return;
    const frame = MediaEmbeds.frame(embed, "Trailer de " + gameTitle);
    const playerUrl = new URL(frame.src);
    playerUrl.searchParams.set("autoplay", "1");
    playerUrl.searchParams.set("controls", "0");
    playerUrl.searchParams.set("loop", "1");
    playerUrl.searchParams.set("mute", item.xmbArt?.idleVideoMuted === false ? "0" : "1");
    playerUrl.searchParams.set("playlist", embed.videoId || playerUrl.pathname.split("/").pop());
    frame.src = playerUrl.href;
    frame.className = "xmb-game-idle-media xmb-game-idle-video-player";
    frame.loading = "eager";
    frame.tabIndex = -1;
    idleVideoFrame?.remove();
    idleVideoFrame = frame;
    row.append(frame);
    const reveal = () => {
      if (revision === screenshotRevision && frame.isConnected) frame.dataset.visible = "true";
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(reveal);
    else reveal();
  }
  function showIdleLocalVideo(source, item, revision) {
    const row = selectedGameRow(item, revision);
    if (!row) return;
    const video = el("video", "xmb-game-idle-media xmb-game-idle-video-player");
    video.autoplay = true;
    video.loop = true;
    video.muted = item.xmbArt?.idleVideoMuted !== false;
    video.controls = false;
    video.playsInline = true;
    video.preload = "auto";
    video.style.objectPosition =
      row.querySelector(":scope > img")?.style.objectPosition || "50% 100%";
    video.setAttribute("aria-label", "Vídeo em espera de " + title(item));
    idleVideoElement = video;
    const reveal = () => {
      if (selectedGameRow(item, revision)) video.dataset.visible = "true";
    };
    video.onloadeddata = reveal;
    row.append(video);
    Promise.resolve(window.XmbArtworkStorage?.resolveOriginal(source) || source)
      .then((url) => {
        if (!url || !selectedGameRow(item, revision)) return;
        video.src = url;
        video.load?.();
        void video.play?.().then(reveal).catch(() => {});
      })
      .catch(() => {});
  }
  function scheduleGameIdleMedia(item) {
    if (category !== "game" || !item || item.folder) return;
    const art = item.xmbArt || {};
    const mode = getData()?.appearance?.xmb?.gameIdleMedia || "video";
    const screenshots = Array.isArray(art.screenshots) ? art.screenshots.filter(Boolean) : [];
    const idleVideo = art.idleVideo;
    if (mode === "off") return;
    if (mode === "screenshots" && !screenshots.length) return;
    if (mode === "video" && !idleVideo) return;
    const revision = screenshotRevision;
    idleMediaTimer = window.setTimeout(() => {
      idleMediaTimer = undefined;
      if (mode === "screenshots") {
        let index = 0;
        const showNext = () => {
          if (revision !== screenshotRevision) return;
          showIdleScreenshot(screenshots[index], item, revision);
          index = (index + 1) % screenshots.length;
          screenshotTimer = window.setTimeout(showNext, 4000);
        };
        showNext();
      } else if (revision === screenshotRevision) {
        if (
          typeof MediaEmbeds !== "undefined" &&
          MediaEmbeds.parse(idleVideo)?.provider === "youtube"
        ) showIdleYoutubeVideo(idleVideo, title(item), revision);
        else showIdleLocalVideo(idleVideo, item, revision);
      }
    }, 5000);
  }
  function renderDetail(item) {
    clearIdleMedia();
    updateFocusSound(item);
    resetBackdropForContext();
    const previousCover = detailCover;
    detail.replaceChildren();
    context.textContent =
      categoryButtons.get(area).textContent +
      (foldersLevel
        ? " · pastas"
        : category === "game" && gameBrowseLevel === "platforms"
          ? " · plataformas"
          : category === "game" && gameBrowseLevel === "titles"
            ? " · " + gamePlatform
            : " · " +
              (playlistTrackDepth
                ? "faixas da playlist"
                : category === "playlists"
                  ? "playlists"
                  : Collection.kinds[category] || "itens"));
    detail.append(context);
    if (item?.folder) {
      updateBackdrop(null, false);
      backdrop.hidden = true;
      artworkGap = true;
      detail.append(el("h2", "", item.title));
      detail.append(el("p", "xmb-folder-summary", folderSummary(item)));
      detail.append(el("p", "xmb-folder-hint", "Enter / A para abrir · Esc / B para voltar"));
      detail.append(button("[ abrir pasta ]", () => openFolder(item.folder, item), "xmb-open"));
      return;
    }
    if (!item) {
      updateBackdrop(null, false);
      artworkGap = true;
      backdrop.hidden = true;
      return;
    }
    if (category === "playlists" && !playlistTrackDepth) {
      updateBackdrop(null, false);
      backdrop.hidden = true;
      artworkGap = true;
      detail.append(el("h2", "", title(item)));
      const count = item.trackCount || 0;
      detail.append(el("p", "xmb-folder-summary", `${count} ${count === 1 ? "faixa" : "faixas"}`));
      detail.append(
        button(
          count > 1 ? "[ escolher faixa · Enter ]" : "[ ▶ tocar playlist · Enter ]",
          () =>
            count > 1
              ? openPlaylistTracks(item)
              : void playVirtualPlaylist(item),
          "xmb-open xmb-play",
        ),
      );
      if (count) {
        const tracks = el("ol", "xmb-playlist-tracks");
        for (const [index, track] of item.tracks.entries()) {
          tracks.append(el("li", "", `${String(index + 1).padStart(2, "0")} · ${track.title}${track.artist ? " — " + track.artist : ""}`));
        }
        detail.append(tracks);
      }
      return;
    }
    const heading = el("h2", "", title(item));
    detail.append(heading);
    const image = category === "profile" ? item.avatar : item.xmbArt?.image || item.image;
    if (image) {
      const cover = previousCover || imageNode(image, title(item), { variant: "display" });
      detailCover = cover;
      cover.alt = title(item);
      if (previousCover) {
        prepareArtworkAfterGap(cover, image);
      }
      if (previousCover && window.Artwork) {
        Artwork.set(cover, image, {
          variant: "display",
          error: () => {
            cover.hidden = true;
          },
        });
      } else if (previousCover) {
        cover.src = image;
      }
      cover.hidden = false;
      detail.append(cover);
    }
    const art = item.xmbArt || {};
    const atmosphere = artworkSource({
      customBackground: art.backgroundVideo ? null : art.background,
      cover: image,
    });
    const backdropMedia = art.background || image;
    updateBackdrop(
      backdropMedia,
      !!art.background,
      art.backgroundVideo ? "video" : "image",
      gameWallpaperPosition(item),
    );
    const identityArtwork = art.backgroundVideo ? image : atmosphere;
    if (identityArtwork) {
      const identityNode = identityImage || imageNode(identityArtwork, "", { variant: "display" });
      identityImage = identityNode;
      identityNode.className = "xmb-artwork-identity";
      identityNode.loading = "eager";
      if (identitySource !== identityArtwork && window.Artwork) Artwork.clear(identityNode);
      identitySource = identityArtwork;
      prepareArtworkAfterGap(identityNode, identityArtwork);
      if (window.Artwork) {
        Artwork.set(identityNode, identityArtwork, {
          variant: "display",
          error: () => {
            identityNode.hidden = true;
          },
        });
      } else {
        identityNode.src = atmosphere;
      }
      identityNode.hidden = false;
      if (!identityNode.parentElement) backdrop.append(identityNode);
    }
    artworkGap = !image;
    scheduleGameIdleMedia(item);
    const facts = el("dl", "xmb-facts");
    function fact(label, value, extended = false) {
      if (Array.isArray(value)) {
        value = value.join(", ");
      }
      if (value == null || value === "") {
        return;
      }
      const className = extended ? "xmb-fact-extended" : "";
      facts.append(el("dt", className, label), el("dd", className, String(value)));
    }
    if (category === "profile") {
      fact("Local", item.location);
      fact("Mood", item.mood);
      fact("Interesses", item.interests, true);
    } else if (category !== "photos") {
      fact("Tipo", Collection.kinds[item.kind]);
      fact("Status", Collection.statuses[item.status]);
      if (item.progress || item.total) {
        fact(
          "Progresso",
          `${item.progress || 0}${item.total ? " / " + item.total : ""}${item.unit ? " " + item.unit : ""}`,
        );
      }
      fact("Nota pessoal", item.score, true);
      for (const [key, label] of Object.entries({
        artist: "Artista",
        authors: "Autores",
        author: "Autor",
        platform: "Plataforma",
        platforms: "Plataformas",
        releaseDate: "Lançamento",
        year: "Ano",
        genres: "Gêneros",
        tags: "Tags",
        developers: "Desenvolvedores",
        publishers: "Publicadoras",
        lists: "Listas",
        startedAt: "Início",
        finishedAt: "Conclusão",
        albumTitle: "Álbum",
      })) {
        fact(
          label,
          item[key],
          !["artist", "authors", "author", "platform", "platforms", "releaseDate", "year", "albumTitle"].includes(key),
        );
      }
    }
    if (item.kind === "music" && item.playbackSource && window.MusicModel && window.SPACEAMP) {
      detail.append(button("[ ▶ tocar · Enter ]", primary, "xmb-open xmb-play"));
    }
    detail.append(facts);
    const summary = category === "profile" ? item.bio : item.summary || item.description;
    if (summary) {
      detail.append(
        el(
          "p",
          "xmb-summary",
          String(summary)
            .replace(/<[^>]*>/g, " ")
            .trim(),
        ),
      );
    }
    if (item.notes) {
      detail.append(el("p", "xmb-notes", item.notes));
    }
    if (!detailsLevel) {
      detail.append(
        button(
          item.kind === "music" ? "[ detalhes · D ]" : "[ detalhes · Enter ]",
          activate,
          "xmb-open",
        ),
      );
    }
    detail.append(button("[ página completa · O ]", openPage, "xmb-open xmb-page"));
  }
  // Reuse thumbnails already visited; this does not preload other categories.
  const thumbnails = new Map();
  function gameArtPosition(item) {
    const art = item?.xmbArt || {};
    const percent = (value, fallback) =>
      (Math.max(-1, Math.min(1, Number(value ?? fallback) || 0)) + 1) * 50;
    return `${percent(art.x, 0)}% ${percent(art.y, 1)}%`;
  }
  function gameWallpaperPosition(item) {
    const art = item?.xmbArt || {};
    const percent = (value) => (Math.max(-1, Math.min(1, Number(value) || 0)) + 1) * 50;
    return `${percent(art.backgroundX)}% ${percent(art.backgroundY)}%`;
  }
  function gameArtReferences(art) {
    return Object.values(art || {})
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value) => window.XmbArtworkStorage?.isReference(value));
  }
  function thumbnail(item, index, source) {
    const key = category + ":" + identity(item, index);
    let image = thumbnails.get(key);
    if (!image) {
      image = imageNode(source, "", { variant: "thumb" });
      thumbnails.set(key, image);
      if (thumbnails.size > 64) {
        thumbnails.delete(thumbnails.keys().next().value);
      }
    } else if (window.Artwork) {
      Artwork.set(image, source, {
        variant: "thumb",
        ready: () => {
          image.hidden = false;
        },
        error: () => {
          image.hidden = true;
        },
      });
    } else {
      image.src = source;
    }
    image.style.objectPosition = category === "game" ? gameArtPosition(item) : "";
    return image;
  }
  function render({ focus = false } = {}) {
    const rows = entries();
    const selected = selection(rows);
    if (rows.length) {
      remembered.set(selectionKey(), identity(rows[selected], selected));
    }
    for (const [key, control] of categoryButtons) {
      control.setAttribute("aria-pressed", String(key === area));
      control.tabIndex = key === area ? 0 : -1;
    }
    updateHorizontalAxis();
    if (!folderDepth) {
      folderFocusOffset = null;
      setListSpaces(0, 0);
    }
    list.replaceChildren();
    rows.forEach((item, index) => {
      const label = title(item);
      const row = button(label, () => selectItem(index), "xmb-item");
      row.replaceChildren();
      row.setAttribute("aria-label", label);
      if (item.folder) {
        row.dataset.folder = item.folder;
      }
      const copy = el("span", "xmb-item-copy");
      copy.append(el("span", "xmb-item-title", label));
      const secondary = item.folder
        ? folderSummary(item)
        : category === "profile"
          ? item.mood || item.location
          : category === "playlists"
            ? playlistTrackDepth
              ? item.artist || item.albumTitle || "Faixa da playlist"
              : `${item.trackCount} ${item.trackCount === 1 ? "faixa" : "faixas"}`
            : item.artist ||
            item.platform ||
            item.author ||
            item.authors?.join(", ") ||
            item.year ||
            Collection.statuses[item.status];
      if (secondary) {
        const description = el("small", "xmb-item-secondary", String(secondary));
        description.setAttribute("aria-hidden", "true");
        copy.append(description);
      }
      row.append(copy);
      if (item.folder) {
        const icon = el("span", "xmb-folder-icon", "▱");
        icon.setAttribute("aria-hidden", "true");
        row.append(icon);
      }
      const cover = category === "profile" ? item.avatar : item.xmbArt?.image || item.image;
      if (cover) {
        row.append(thumbnail(item, index, cover));
      }
      row.dataset.index = String(index);
      row.dataset.itemId = String(identity(item, index));
      row.setAttribute("aria-pressed", String(index === selected));
      row.tabIndex = index === selected ? 0 : -1;
      row.ondblclick = item.folder ? () => openFolder(item.folder, item) : activate;
      list.append(row);
    });
    if (!rows.length) {
      list.append(el("p", "xmb-empty", "Nenhum item nesta categoria com os filtros atuais."));
    }
    renderDetail(rows[selected]);
    root.dataset.area = area;
    root.dataset.kind =
      foldersLevel || (category === "game" && gameBrowseLevel === "platforms") ? "" : category;
    root.dataset.artworkBorder =
      getData()?.appearance?.xmb?.artworkBorder === false ? "false" : "true";
    root.dataset.roundedArtwork =
      getData()?.appearance?.xmb?.roundedArtwork === true ? "true" : "false";
    if (
      !foldersLevel &&
      category === "game" &&
      gameBrowseLevel !== "platforms"
    ) {
      root.dataset.gamePresentation =
        getData()?.appearance?.xmb?.gamePresentation === "vertical" ? "vertical" : "pill";
    } else {
      delete root.dataset.gamePresentation;
    }
    root.dataset.level = detailsLevel
      ? "details"
      : foldersLevel || (category === "game" && gameBrowseLevel === "platforms")
        ? "folders"
        : playlistTrackDepth
          ? "playlist-tracks"
          : "root";
    root.dataset.folderDepth = String(folderDepth);
    root.dataset.playlistTrackDepth = String(playlistTrackDepth);
    root.dataset.rootColumn = String(!folderDepth);
    nav.inert = folderDepth || detailsLevel;
    updateNowEntry();
    syncPlaybackProgress();
    backButton.textContent =
      playlistTrackDepth
        ? "[ playlists · Esc ]"
        : category === "game" && gameBrowseLevel !== "home"
          ? "[ pastas · Esc ]"
          : foldersLevel || categories.find(([key]) => key === area)[2].length === 1
            ? "[ sair · Esc ]"
            : "[ pastas · Esc ]";
    announcement.textContent = `${categoryButtons.get(area).textContent} · ${rows.length ? title(rows[selected]) : "sem itens"}`;
    if (focus) {
      (list.children[selected]?.tagName === "BUTTON"
        ? list.children[selected]
        : folderDepth
          ? backButton
          : categoryButtons.get(area)
      ).focus({ preventScroll: true });
    }
    updateInputMode();
    revealSelection(false);
  }
  function updateRootColumn(selected) {
    const rows = Array.from(list.querySelectorAll(":scope > .xmb-item"));
    if (!rows.length) {
      list.scrollTop = 0;
      return;
    }
    const designScale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const originY = (window.innerHeight - 1080 * designScale) / 2;
    const focusCenter = originY + 544.5 * designScale;
    const aboveCenter = originY + 105 * designScale;
    const preferredBelowCenter = originY + 785 * designScale;
    const stackGap = 63 * designScale;
    const computedRoot = window.getComputedStyle(root);
    const activeCategory = categoryButtons.get(area);
    const navBounds = nav.getBoundingClientRect?.();
    const listBounds = list.getBoundingClientRect?.();
    const navStyle = window.getComputedStyle(nav);
    const categoryStyle = activeCategory ? window.getComputedStyle(activeCategory) : null;
    const navInset = Number.parseFloat(navStyle.paddingLeft) || 0;
    const categoryStep =
      Number.parseFloat(categoryStyle?.flexBasis) || activeCategory?.offsetWidth || 0;
    const anchor =
      navBounds && listBounds && categoryStep
        ? navBounds.left + navInset + categoryStep / 2 - listBounds.left
        : Number.parseFloat(computedRoot.getPropertyValue("--xmb-axis-anchor")) || 0;
    const metrics = rows.map((row, index) => {
      const image = row.querySelector(":scope > img");
      const folderIcon = row.querySelector(".xmb-folder-icon");
      const copy = row.querySelector(":scope > .xmb-item-copy");
      const copyRect = index === selected && copy ? copy.getBoundingClientRect() : null;
      const imageStyle = image ? window.getComputedStyle(image) : null;
      const folderStyle = folderIcon ? window.getComputedStyle(folderIcon) : null;
      const focused = index === selected;
      const imageScale =
        category === "game"
          ? root.dataset.gamePresentation === "pill"
            ? focused
              ? window.innerWidth >= 701
                ? 1.344
                : 1.12
              : 0.74
            : focused
              ? window.innerWidth >= 701
                ? 1.368
                : 1.14
              : window.innerWidth >= 701
                ? 0.65
                : 1
          : ["photos", "other"].includes(area) && window.innerWidth >= 701
            ? focused
              ? 1.12
              : 1
            : focused
              ? 1.08
              : 0.96;
      let width = image
        ? image.offsetWidth || Number.parseFloat(imageStyle?.width) || 0
        : 0;
      let height = image
        ? (image.offsetHeight || Number.parseFloat(imageStyle?.height) || 0) * imageScale
        : 0;
      if (folderIcon) {
        const folderTransform = folderStyle?.transform?.match(/^matrix\(([^,]+)/);
        const folderScale = Number.parseFloat(folderTransform?.[1]) || 1;
        width =
          folderIcon.offsetWidth ||
          Number.parseFloat(folderStyle?.width) ||
          Number.parseFloat(computedRoot.getPropertyValue("--xmb-thumb-width")) ||
          0;
        height =
          (folderIcon.offsetHeight ||
            Number.parseFloat(folderStyle?.height) ||
            Number.parseFloat(computedRoot.getPropertyValue("--xmb-thumb-height")) * 0.72 ||
            0) * folderScale;
      } else if (!image) {
        const placeholder = window.getComputedStyle(row, "::before");
        const transform = placeholder.transform?.match(/^matrix\(([^,]+)/);
        const scale = Number.parseFloat(transform?.[1]) || 1;
        width =
          Number.parseFloat(placeholder.width) ||
          Number.parseFloat(computedRoot.getPropertyValue("--xmb-thumb-width")) ||
          row.offsetWidth;
        height =
          Number.parseFloat(placeholder.height) * scale ||
          Number.parseFloat(computedRoot.getPropertyValue("--xmb-thumb-height")) ||
          row.offsetHeight;
      }
      return {
        width: Math.max(1, width),
        height: Math.max(height, copyRect?.height || 0, 1),
      };
    });
    const safeBottom = window.innerHeight - 24 * designScale;
    const focusBottom = focusCenter + metrics[selected].height / 2;
    const availableBelow = Math.max(0, safeBottom - focusBottom);
    let visibleBelowCount = 0;
    let totalBelowHeight = 0;
    const minimumGap = 12 * designScale;
    for (let index = selected + 1; index < rows.length && index <= selected + 6; index += 1) {
      const nextHeight = metrics[index].height;
      if (totalBelowHeight + nextHeight + (visibleBelowCount + 1) * minimumGap > availableBelow) {
        break;
      }
      totalBelowHeight += nextHeight;
      visibleBelowCount += 1;
    }
    let belowGaps = [];
    let belowCenter = preferredBelowCenter;
    if (visibleBelowCount) {
      const firstHeight = metrics[selected + 1].height;
      const preferredFirstGap = Math.max(
        minimumGap,
        preferredBelowCenter - focusBottom - firstHeight / 2,
      );
      const preferredGaps = Array.from({ length: visibleBelowCount }, (_, index) =>
        index === 0 ? preferredFirstGap : stackGap,
      );
      const gapBudget = Math.max(
        minimumGap * visibleBelowCount,
        availableBelow - totalBelowHeight,
      );
      const preferredExtra = preferredGaps.reduce((sum, gap) => sum + gap - minimumGap, 0);
      const availableExtra = gapBudget - minimumGap * visibleBelowCount;
      const gapScale = preferredExtra > 0 ? Math.min(1, availableExtra / preferredExtra) : 0;
      belowGaps = preferredGaps.map((gap) => minimumGap + (gap - minimumGap) * gapScale);
      belowCenter = focusBottom + belowGaps[0] + firstHeight / 2;
    }
    const centers = Array(rows.length);
    centers[selected] = focusCenter;
    for (let index = selected - 1; index >= 0; index -= 1) {
      centers[index] = index === selected - 1
        ? aboveCenter
        : centers[index + 1] - metrics[index + 1].height / 2 - stackGap - metrics[index].height / 2;
    }
    for (let index = selected + 1; index < rows.length; index += 1) {
      centers[index] =
        index === selected + 1
          ? belowCenter
          : centers[index - 1] +
            metrics[index - 1].height / 2 +
            (belowGaps[index - selected - 1] || stackGap) +
            metrics[index].height / 2;
    }
    rows.forEach((row, index) => {
      const fullyWithinViewport =
        centers[index] - metrics[index].height / 2 >= 0 &&
        centers[index] + metrics[index].height / 2 <= safeBottom;
      const visibleByPosition =
        index <= selected || index <= selected + visibleBelowCount;
      row.dataset.rootColumnVisible = String(
        index === selected ||
          (Math.abs(index - selected) <= 6 && visibleByPosition && fullyWithinViewport),
      );
      row.dataset.rootColumnAbove = String(index === selected - 1);
      row.style.setProperty("--xmb-root-item-center", centers[index] + "px");
      row.style.setProperty("--xmb-root-item-left", anchor - metrics[index].width / 2 + "px");
    });
    list.scrollTop = 0;
    list.scrollLeft = 0;
  }
  // A rolagem lê duração e curva dos tokens existentes; cada eixo cancela o movimento anterior.
  function stopScroll(node) {
    const frame = scrolling.get(node);
    if (frame != null) {
      window.cancelAnimationFrame?.(frame);
    }
    scrolling.delete(node);
    scrollDestinations.delete(node);
  }
  function moveScroll(node, top, left, smooth = true) {
    stopScroll(node);
    if (
      !smooth ||
      !window.requestAnimationFrame ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      node.scrollTop = top;
      node.scrollLeft = left;
      return;
    }
    const style = window.getComputedStyle(node);
    const token = style.getPropertyValue("--motion-focus").trim();
    const duration = parseFloat(token) * (token.endsWith("ms") ? 1 : 1000);
    const curve = style
      .getPropertyValue("--ease-xmb")
      .match(/[\d.]+/g)
      ?.map(Number);
    if (!(duration > 0) || curve?.length !== 4) {
      node.scrollTop = top;
      node.scrollLeft = left;
      return;
    }
    scrollDestinations.set(node, top);
    const fromTop = node.scrollTop;
    const fromLeft = node.scrollLeft;
    if (fromTop === top && fromLeft === left) {
      return;
    }
    const bezier = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    const ease = (progress) => {
      let low = 0;
      let high = 1;
      for (let i = 0; i < 14; i++) {
        const mid = (low + high) / 2;
        if (bezier(mid, curve[0], curve[2]) < progress) {
          low = mid;
        } else {
          high = mid;
        }
      }
      return bezier((low + high) / 2, curve[1], curve[3]);
    };
    let start;
    const tick = (now) => {
      if (!active) {
        scrolling.delete(node);
        scrollDestinations.delete(node);
        return;
      }
      start ??= now;
      const progress = Math.min(1, (now - start) / duration);
      const amount = ease(progress);
      node.scrollTop = fromTop + (top - fromTop) * amount;
      node.scrollLeft = fromLeft + (left - fromLeft) * amount;
      if (progress < 1) {
        scrolling.set(node, window.requestAnimationFrame(tick));
      } else {
        node.scrollTop = top;
        node.scrollLeft = left;
        scrolling.delete(node);
        scrollDestinations.delete(node);
      }
    };
    scrolling.set(node, window.requestAnimationFrame(tick));
  }
  function updateHorizontalAxis(smooth = true) {
    const control = categoryButtons.get(area);
    if (
      !nav.style?.setProperty ||
      !control.offsetWidth ||
      folderDepth ||
      root.dataset.folderDepth === "true"
    ) {
      return;
    }
    const navStyle = window.getComputedStyle(nav);
    const categoryStyle = window.getComputedStyle(control);
    const step = Number.parseFloat(categoryStyle.flexBasis) || control.offsetWidth;
    const navInset = Number.parseFloat(navStyle.paddingLeft) || 0;
    const anchor = navInset + control.offsetWidth / 2;
    const index = categories.findIndex(([key]) => key === area);
    const target = Math.max(0, index * step);
    list.style?.setProperty?.("--xmb-list-anchor", anchor + "px");
    root.style?.setProperty?.("--xmb-list-anchor", anchor + "px");
    moveScroll(nav, nav.scrollTop || 0, target, smooth);
  }
  function scheduleLayoutRefresh(expectedSession = session) {
    if (!window.requestAnimationFrame) return;
    if (layoutRefreshFrame != null) {
      window.cancelAnimationFrame?.(layoutRefreshFrame);
    }
    layoutRefreshFrame = window.requestAnimationFrame(() => {
      layoutRefreshFrame = window.requestAnimationFrame(() => {
        layoutRefreshFrame = null;
        if (
          !active ||
          session !== expectedSession ||
          folderTransition ||
          folderDepth ||
          detailsLevel
        ) {
          return;
        }
        updateHorizontalAxis(false);
        revealSelection(false);
      });
    });
  }
  nav.addEventListener("transitionend", (event) => {
    if (
      !active ||
      event.propertyName !== "flex-basis" ||
      event.target !== categoryButtons.get(area) ||
      folderDepth ||
      root.dataset.folderDepth === "true"
    ) {
      return;
    }
    updateHorizontalAxis();
  });
  function revealSelection(smooth = true) {
    const items = entries();
    const selected = selection(items);
    const row = list.querySelector('[aria-pressed="true"]');
    if (!row) {
      setListSpaces(0, 0);
      return;
    }
    if (root.dataset.rootColumn === "true" && !detailsLevel) {
      setListSpaces(0, 0);
      updateRootColumn(selected);
      return;
    }
    const rows = list.querySelectorAll(".xmb-item");
    const first = rows[0];
    const last = rows[rows.length - 1];
    const rowHalf = Math.min(row.offsetHeight / 2, list.clientHeight / 2);
    const artScale = Number.parseFloat(
      window.getComputedStyle?.(root)?.getPropertyValue("--xmb-music-selected-art-scale"),
    );
    const selectedArtwork =
      (folderDepth && area === "music") ||
      (!folderDepth && !foldersLevel && category === "game")
        ? row.querySelector?.("img")
        : null;
    const selectedArtworkScale = folderDepth
      ? artScale
      : !foldersLevel && root.dataset.gamePresentation === "pill"
        ? window.innerWidth >= 701
          ? 1.344
          : 1.12
        : window.innerWidth >= 701
          ? 1.368
          : 1.14;
    const artworkHalf =
      selectedArtwork && Number.isFinite(selectedArtworkScale) && selectedArtwork.offsetHeight
        ? Math.ceil((selectedArtwork.offsetHeight * selectedArtworkScale) / 2) +
          (folderDepth ? 4 : 8)
        : rowHalf;
    const focusHalf = Math.min(Math.max(rowHalf, artworkHalf), list.clientHeight / 2);
    const folderFocus = () => {
      const preferred = Number.isFinite(folderFocusOffset)
        ? folderFocusOffset
        : list.clientHeight * 0.46;
      return Math.min(
        Math.max(preferred, first.offsetHeight / 2, focusHalf),
        list.clientHeight - focusHalf,
      );
    };
    const rawContentHeight = () =>
      Math.max(
        Math.max(0, (list.scrollHeight || 0) - listStartSpace - listEndSpace),
        last.offsetTop + last.offsetHeight - first.offsetTop,
      );
    const contentHeight = rawContentHeight();
    const fitsFolderRows =
      folderDepth &&
      list.clientHeight >= Math.max(first.offsetHeight, last.offsetHeight, row.offsetHeight);
    if (
      fitsFolderRows &&
      (contentHeight > list.clientHeight ||
        listEndSpace > 0 ||
        Number.isFinite(folderFocusOffset))
    ) {
      const focus = folderFocus();
      setListSpaces(
        listStartSpace || Math.max(0, Math.round(focus - first.offsetHeight / 2)),
        Math.max(0, Math.round(list.clientHeight - focus - rowHalf)),
      );
    } else {
      setListSpaces(0, 0);
    }
    if (!folderDepth && !foldersLevel && category === "game") {
      setListSpaces(Math.max(0, artworkHalf - first.offsetHeight / 2),
        Math.max(0, artworkHalf - last.offsetHeight / 2));
    }
    const targetScroll = () => {
      const contentHeight = rawContentHeight() + listStartSpace + listEndSpace;
      const maxScroll = Math.max(0, contentHeight - list.clientHeight);
      if (maxScroll === 0) {
        return list.scrollTop;
      }
      const viewportFocus = list.clientHeight * 0.46;
      let focus = folderDepth ? folderFocus() : viewportFocus;
      if (window.innerHeight >= 500 && !folderDepth) {
        const clearance =
          parseFloat(window.getComputedStyle?.(root)?.getPropertyValue("--xmb-selection-clearance")) || 128;
        const navBottom = nav.getBoundingClientRect?.().bottom;
        const listTop = list.getBoundingClientRect?.().top;
        if (Number.isFinite(navBottom) && Number.isFinite(listTop)) {
          focus = Math.min(viewportFocus, navBottom + clearance - listTop);
        }
      }
      const previousItem = items[selected - 1];
      const previousRow = list.children[selected - 1];
      const previousArtwork =
        category === "profile" ? previousItem?.avatar : previousItem?.image;
      if (
        !folderDepth &&
        category !== "game" &&
        rows.length > 3 &&
        window.innerHeight >= 520 &&
        window.innerWidth >= 700 &&
        previousArtwork &&
        previousRow?.offsetHeight
      ) {
        focus = Math.min(focus, previousRow.offsetHeight / 2 - 1);
      }
      if (!folderDepth && !foldersLevel && category === "game" && selectedArtwork) {
        focus = Math.max(focus, artworkHalf);
      }
      if (folderDepth) {
        focus = folderFocus();
      } else {
        focus = Math.max(0, Math.round(focus));
      }
      const rowCenter = row.offsetTop + row.offsetHeight / 2;
      const currentCenter = rowCenter - list.scrollTop;
      const comfort = Math.min(focus * 0.2, list.clientHeight * 0.12);
      const edgeHalf =
        folderDepth || (!foldersLevel && category === "game") ? focusHalf : row.offsetHeight / 2;
      const focusStart = Math.max(edgeHalf, focus - comfort);
      const focusEnd = Math.min(list.clientHeight - edgeHalf, focus + comfort);
      const target =
        currentCenter < focusStart || currentCenter > focusEnd ? rowCenter - focus : list.scrollTop;
      return Math.max(0, Math.min(target, maxScroll));
    };
    let target = targetScroll();
    if (!folderDepth && !foldersLevel && category === "game") {
      const selectedTop = row.offsetTop + row.offsetHeight / 2 - artworkHalf;
      const selectedBottom = row.offsetTop + row.offsetHeight / 2 + artworkHalf - list.clientHeight;
      target = Math.max(selectedBottom, Math.min(target, selectedTop));
      const maxScroll = Math.max(
        0,
        rawContentHeight() + listStartSpace + listEndSpace - list.clientHeight,
      );
      target = Math.max(0, Math.min(target, maxScroll));
    }
    moveScroll(
      list,
      target,
      list.scrollLeft || 0,
      smooth,
    );
  }
  function invalidateHandoff() {
    primaryRevision++;
    handoffContext = null;
    window.XmbHandoff?.cleanup();
  }
  function selectItem(index) {
    entryFocused = false;
    const rows = entries();
    if (!rows.length) {
      return;
    }
    index = Math.max(0, Math.min(rows.length - 1, index));
    if (index === selection(rows)) {
      return;
    }
    invalidateHandoff();
    remembered.set(selectionKey(), identity(rows[index], index));
    // Mantém os nós das linhas para a transição de seleção funcionar.
    for (const row of list.querySelectorAll(".xmb-item")) {
      const selected = Number(row.dataset.index) === index;
      row.setAttribute("aria-pressed", String(selected));
      row.tabIndex = selected ? 0 : -1;
      if (selected) {
        row.focus({ preventScroll: true });
      }
    }
    renderDetail(rows[index]);
    announcement.textContent = title(rows[index]);
    revealSelection();
  }
  function selectCategory(key) {
    rememberPosition();
    invalidateHandoff();
    entryFocused = false;
    if (key === area) {
      render({ focus: true });
      return;
    }
    area = key;
    folderDepth = false;
    root.dataset.folderDepth = "false";
    gameBrowseLevel = "home";
    gamePlatform = "";
    const kinds = categories.find(([candidate]) => candidate === key)[2];
    foldersLevel = kinds.length > 1;
    category = folders.get(area) || kinds[0];
    playlistTrackDepth = false;
    playlistTrackPlaylistId = "";
    detailsLevel = false;
    nav.inert = false;
    list.inert = false;
    render({ focus: true });
    restorePosition();
  }
  function updateInputMode() {
    root.dataset.inputMode = inputMode;
  }
  function formatPlaybackTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }
  function updateNowProgress() {
    const state = window.SPACEAMP?.getPlaybackState?.();
    const time = window.SPACEAMP?.getPlaybackTime?.() || state || {};
    const position = Math.max(0, Number(time.position) || 0);
    const duration = Math.max(0, Number(time.duration) || 0);
    const progress = duration ? Math.min(100, (position / duration) * 100) : 0;
    nowProgressFill.style.width = progress + "%";
    nowElapsed.textContent = formatPlaybackTime(position);
    nowRemaining.textContent = duration
      ? "-" + formatPlaybackTime(Math.max(0, duration - position))
      : "-0:00";
  }
  function syncPlaybackProgress() {
    const state = window.SPACEAMP?.getPlaybackState?.();
    if (!active || nowEntry.hidden || !state?.playing || state.stopped) {
      window.clearTimeout(playbackProgressTimer);
      playbackProgressTimer = undefined;
      updateNowProgress();
      return;
    }
    if (playbackProgressTimer !== undefined) return;
    playbackProgressTimer = window.setTimeout(() => {
      playbackProgressTimer = undefined;
      updateNowProgress();
      syncPlaybackProgress();
    }, 250);
  }
  function updateNowEntry() {
    const state = window.SPACEAMP?.getPlaybackState?.();
    const fullPlayerOpen = window.SpaceAmpNowPlaying?.isOpen?.() === true;
    nowEntry.hidden =
      !active ||
      fullPlayerOpen ||
      !state?.available ||
      !state?.title ||
      !!state.stopped;
    nowTitle.textContent = state?.title || "";
    nowArtist.textContent = state?.artist || "";
    nowArtist.hidden = !state?.artist;
    nowEntry.setAttribute(
      "aria-label",
      state?.title
        ? "Abrir reprodução: " + state.title + (state.artist ? " · " + state.artist : "")
        : "Abrir reprodução",
    );
    const artwork = typeof state?.artwork === "string" ? state.artwork : "";
    if (nowCover.dataset.nowPlayingSource !== artwork) {
      nowCover.dataset.nowPlayingSource = artwork;
      nowCoverFrame.classList.remove("has-artwork");
      if (artwork && window.Artwork?.set) {
        window.Artwork.set(nowCover, artwork, {
          ready: () => nowCoverFrame.classList.add("has-artwork"),
          error: () => nowCoverFrame.classList.remove("has-artwork"),
          variant: "thumb",
        });
      } else if (artwork) {
        nowCover.src = artwork;
        nowCover.onload = () => nowCoverFrame.classList.add("has-artwork");
        nowCover.onerror = () => nowCoverFrame.classList.remove("has-artwork");
      } else {
        window.Artwork?.clear?.(nowCover);
      }
    }
    updateNowProgress();
    if (entryFocused && nowEntry.hidden) {
      entryFocused = false;
      if (!window.SpaceAmpNowPlaying?.isOpen()) {
        list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      }
    }
  }
  function dismissDashNotification() {
    window.clearTimeout(dashTimer);
    window.clearTimeout(dashHideTimer);
    dashTimer = undefined;
    dashHideTimer = undefined;
    dashNotification.classList.remove("is-visible");
    dashNotification.hidden = true;
  }
  function showDashNotification(state) {
    const text = state.title + (state.artist ? " — " + state.artist : "");
    dashText.textContent = text;
    dashNotification.hidden = false;
    dashNotification.classList.remove("is-visible");
    void dashNotification.offsetWidth;
    dashNotification.classList.add("is-visible");
    window.clearTimeout(dashTimer);
    window.clearTimeout(dashHideTimer);
    const words = text.trim().split(/\s+/).length;
    const duration = Math.max(3000, Math.min(5000, 3000 + words * 180));
    dashTimer = window.setTimeout(() => {
      dashNotification.classList.remove("is-visible");
      dashHideTimer = window.setTimeout(() => {
        dashNotification.hidden = true;
        dashHideTimer = undefined;
      }, 280);
      dashTimer = undefined;
    }, duration);
  }
  function handlePlaybackChange(event) {
    if (event.type === "spaceamp:progress") {
      if (active) updateNowProgress();
      return;
    }
    updateNowEntry();
    syncPlaybackProgress();
    const state = window.SPACEAMP?.getPlaybackState?.();
    if (!active || !state?.available || !state.title || !state.playing || state.stopped) return;
    const trackKey =
      state.trackId || state.sourceUrl || state.title + "\u0000" + (state.artist || "");
    if (trackKey === lastDashTrackKey) return;
    lastDashTrackKey = trackKey;
    showDashNotification(state);
  }
  function saveContext() {
    stopScroll(list);
    stopScroll(nav);
    const rows = entries();
    const index = selection(rows);
    handoffContext = {
      category,
      area,
      foldersLevel,
      folderDepth,
      playlistTrackDepth,
      playlistTrackPlaylistId,
      id: rows[index] ? identity(rows[index], index) : null,
      index,
      listScroll: list.scrollTop,
      navScroll: nav.scrollLeft || 0,
      detailScroll: detail.scrollTop,
      detailsLevel,
      focus: document.activeElement,
      entryFocused,
      art: list.querySelector('[aria-pressed="true"]')?.querySelector("img"),
    };
  }
  function openNowPlaying(preserve = false) {
    settleFolderTransition();
    if (!preserve || !handoffContext) {
      saveContext();
    }
    const item = entries().find((row, index) => identity(row, index) === handoffContext.id);
    const visualHandoff =
      !entryFocused &&
      handoffContext.category === "music" &&
      !!item &&
      isCurrentSpaceAmpTrack(item);
    if (!visualHandoff) window.XmbHandoff?.cleanup();
    window.SpaceAmpNowPlaying?.open(document.activeElement);
    updateNowEntry();
    syncPlaybackProgress();
    const target = document.querySelector?.("#spaceampNowPlaying .np-cover");
    if (visualHandoff) {
      window.XmbHandoff?.run(handoffContext.art, target);
    }
    window.XmbHandoff?.enterPresentation(document.querySelector?.("#spaceampNowPlaying"));
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      for (const node of [nav, body]) {
        node.animate?.(
          [
            { opacity: 1, transform: "none" },
            { opacity: 0.94, transform: "scale(.995)" },
          ],
          { duration: 200, easing: "cubic-bezier(.16,1,.3,1)" },
        );
      }
    }
  }
  function isCurrentSpaceAmpTrack(item) {
    const current = window.SPACEAMP?.getPlaybackState?.();
    if (!current?.available || current.stopped) {
      return false;
    }
    const normalize = (value) =>
      String(value || "")
        .trim()
        .toLocaleLowerCase();
    if (
      normalize(item.title) !== normalize(current.title) ||
      normalize(item.artist) !== normalize(current.artist)
    ) {
      return false;
    }
    const selected = window.MusicModel.source(item.playbackSource);
    const catalogId = item.catalogId || item.metadataSources?.catalogId || "";
    if (current.catalogId && catalogId && current.catalogId === catalogId) return true;
    if (current.collectionId && item.id && current.collectionId === item.id) return true;
    const currentSource =
      current.playbackSource ||
      (current.sourceUrl
        ? selected?.type === "local"
          ? { type: "local", fileRef: current.sourceUrl }
          : { type: selected?.type, url: current.sourceUrl }
        : null);
    if (!currentSource) {
      return !!normalize(current.artist);
    }
    if (selected?.type === "local") {
      return selected.fileRef === currentSource.fileRef;
    }
    let source;
    try {
      source = window.MusicModel.source(currentSource);
    } catch {
      return false;
    }
    return (
      !!source &&
      (selected.type === "youtube"
        ? selected.videoId === source.videoId
        : selected.url === source.url)
    );
  }
  async function primary() {
    if (entryFocused) {
      openNowPlaying();
      return;
    }
    const item = entries()[selection()];
    if (item?.folder) {
      openFolder(item.folder, item);
      return;
    }
    if (foldersLevel) {
      if (item) openFolder(item.folder, item);
      return;
    }
    if (category === "playlists") {
      if (!item) return;
      if (playlistTrackDepth) {
        await playVirtualPlaylist(
          { playlistId: playlistTrackPlaylistId },
          selection(),
        );
      } else if ((item.tracks?.length || 0) > 1) {
        openPlaylistTracks(item);
      } else {
        await playVirtualPlaylist(item);
      }
      return;
    }
    if (category !== "music") {
      activate();
      return;
    }
    if (!item || !window.MusicBridge || !window.SPACEAMP) {
      window.toast?.("Vincule a reprodução desta música na coleção.");
      activate();
      return;
    }
    const revision = ++primaryRevision;
    saveContext();
    try {
      const track = await window.MusicBridge.prepareTrack(item);
      if (!active || revision !== primaryRevision) return;
      if (!window.MusicBridge.canPlay(track)) {
        window.toast?.("Escolha uma fonte de áudio para esta música.");
        activate();
        return;
      }
      const same = isCurrentSpaceAmpTrack(track);
      window.XmbHandoff?.prepare(handoffContext.art, item.image || item.artwork || "");
      if (!same) {
        const tracks = entries().filter((entry) => entry.kind === "music");
        const startIndex = Math.max(0, tracks.findIndex((entry) =>
          window.MusicModel.sameItem(entry, item) || entry.id === item.id,
        ));
        await window.MusicBridge.play(track, {
          context: {
            type: "collection",
            sourceId: "xmb-collection",
            title: "Collection",
            tracks,
            startIndex,
          },
        });
      }
      if (!active || revision !== primaryRevision) {
        return;
      }
      openNowPlaying(true);
    } catch (error) {
      window.XmbHandoff?.cleanup();
      window.toast?.(error.message);
    }
  }
  async function playVirtualPlaylist(item, startIndex = 0) {
    if (!item || !window.MusicBridge?.playPlaylist) {
      window.toast?.("Biblioteca musical indisponível.");
      return;
    }
    const revision = ++primaryRevision;
    saveContext();
    try {
      await window.MusicBridge.playPlaylist(item.playlistId || item.id, startIndex);
      if (!active || revision !== primaryRevision) return;
      openNowPlaying(true);
    } catch (error) {
      window.XmbHandoff?.cleanup();
      window.toast?.(error.message);
    }
  }
  function openPlaylistTracks(item) {
    if (folderTransition) return;
    const playlistId = String(item?.playlistId || item?.id || ""),
      playlist = (window.MusicBridge?.getPlaylists?.() || []).find(
        (entry) => String(entry.id) === playlistId,
      );
    if (!playlistId || (playlist?.tracks?.length || 0) < 2) return;
    rememberPosition();
    invalidateHandoff();
    folderFocusOffset = measureFolderFocusOffset(list.querySelector('[aria-pressed="true"]'));
    transitionFolderDepth("enter", () => {
      setListSpaces(0, 0);
      list.scrollTop = 0;
      detailsLevel = false;
      detail.tabIndex = -1;
      list.inert = false;
      playlistTrackPlaylistId = playlistId;
      playlistTrackDepth = true;
      folderDepth = true;
      root.dataset.playlistTrackDepth = "true";
      render({ focus: true });
      restorePosition();
      revealSelection(false);
    });
  }
  let artEditor = null;
  function focusArtEditorControl(editor, current, direction) {
    const controls = [
      ...editor.querySelectorAll(
        'input:not([type="file"]),button,.xmb-art-options-cover-adjust,.xmb-art-options-wallpaper-adjust',
      ),
    ].filter((control) => !control.disabled && control.getClientRects().length);
    const index = controls.indexOf(current);
    const next = controls[
      Math.max(0, Math.min(controls.length - 1, (index < 0 ? 0 : index) + direction))
    ];
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: "nearest" });
  }
  function adjacentArtEditorMediaControl(editor, current, direction) {
    const rows = [...editor.querySelectorAll(".xmb-art-options-media-row")];
    const currentRow = current.closest(".xmb-art-options-media-row");
    const rowIndex = rows.indexOf(currentRow);
    const actions = currentRow.querySelector(".xmb-art-options-media-actions");
    const buttons = [...(actions?.querySelectorAll("button:not(:disabled)") || [])];
    const nextRow = rows[rowIndex + direction];
    if (nextRow) {
      const nextButtons = [...nextRow.querySelectorAll(".xmb-art-options-media-actions button")];
      const role = current.className
        .split(" ")
        .find((name) => name.startsWith("xmb-art-options-media-role-"));
      const match =
        role && nextButtons.find((control) => control.className.split(" ").includes(role));
      const currentIndex = buttons.indexOf(current);
      return match || nextButtons[Math.max(0, Math.min(currentIndex, nextButtons.length - 1))];
    }
    if (direction < 0 && rowIndex === 0) {
      return editor.querySelector(".xmb-art-options-wallpaper-adjust");
    }
    return null;
  }
  function openArtEditor() {
    const item = entries()[selection()];
    if (
      category !== "game" ||
      foldersLevel ||
      detailsLevel ||
      !item ||
      item.folder ||
      artEditor
    ) {
      return;
    }
    rememberPosition();
    const dialog = el("dialog", "xmb-art-options");
    const form = el("form", "xmb-art-options-form");
    const draft = {
      ...item.xmbArt,
      x: item.xmbArt?.x ?? 0,
      y: item.xmbArt?.y ?? 1,
      screenshots: [...(item.xmbArt?.screenshots || [])],
    };
    if (typeof draft.idleVideoMuted !== "boolean") draft.idleVideoMuted = true;
    const newlyStoredArt = new Set();
    const origin = document.activeElement;
    dialog.setAttribute("aria-label", "Personalizar " + title(item));
    const heading = el("header", "xmb-art-options-header");
    let editedTitle = title(item);
    const titleHeading = el("h2", "", editedTitle);
    const titleInput = el("input", "xmb-art-options-title-input");
    titleInput.type = "text";
    titleInput.maxLength = 120;
    titleInput.value = editedTitle;
    titleInput.hidden = true;
    titleInput.setAttribute("aria-label", "Título do jogo");
    const finishTitleEdit = () => {
      editedTitle = titleInput.value.trim();
      if (editedTitle) titleHeading.textContent = editedTitle;
      titleInput.hidden = true;
      titleHeading.hidden = false;
    };
    heading.append(
      titleHeading,
      titleInput,
      el(
        "p",
        "",
        "B / Círculo / Select / Backspace salva e sai automaticamente",
      ),
    );
    form.append(heading);
    const overview = el("section", "xmb-art-options-overview");
    const quickActions = el("div", "xmb-art-options-quick-actions");
    const editTitle = button(
      "Editar título",
      () => {
        titleInput.value = editedTitle;
        titleHeading.hidden = true;
        titleInput.hidden = false;
        titleInput.focus({ preventScroll: true });
        titleInput.select();
      },
      "xmb-art-options-button xmb-art-options-action",
    );
    editTitle.type = "button";
    titleInput.addEventListener("input", () => {
      editedTitle = titleInput.value;
    });
    titleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finishTitleEdit();
        editTitle.focus({ preventScroll: true });
      }
    });
    titleInput.addEventListener("blur", finishTitleEdit);
    let pinned = item.xmbPinned === true;
    const pinnedToggle = button(
      pinned ? "Desfixar da tela inicial" : "Fixar na tela inicial",
      () => {
        pinned = !pinned;
        pinnedToggle.textContent = pinned
          ? "Desfixar da tela inicial"
          : "Fixar na tela inicial";
        pinnedToggle.setAttribute("aria-pressed", String(pinned));
        pinnedToggle.setAttribute(
          "aria-label",
          pinned ? "Desfixar da tela inicial do XMB" : "Fixar na tela inicial do XMB",
        );
      },
      "xmb-art-options-button xmb-art-options-action xmb-art-options-pin",
    );
    pinnedToggle.type = "button";
    pinnedToggle.setAttribute("aria-pressed", String(pinned));
    pinnedToggle.setAttribute(
      "aria-label",
      pinned ? "Desfixar da tela inicial do XMB" : "Fixar na tela inicial do XMB",
    );
    pinnedToggle.title = "Atalho na categoria Jogos; o jogo também continua em Todos os jogos.";
    let featured = item.featured === true;
    const featuredToggle = button(
      featured ? "★ Favorito no perfil" : "☆ Favoritar no perfil",
      () => {
        featured = !featured;
        featuredToggle.textContent = featured
          ? "★ Favorito no perfil"
          : "☆ Favoritar no perfil";
        featuredToggle.setAttribute("aria-pressed", String(featured));
        featuredToggle.setAttribute(
          "aria-label",
          featured ? "Remover favorito do perfil" : "Favoritar no perfil",
        );
      },
      "xmb-art-options-button xmb-art-options-featured",
    );
    featuredToggle.type = "button";
    featuredToggle.setAttribute("aria-pressed", String(featured));
    featuredToggle.setAttribute(
      "aria-label",
      featured ? "Remover favorito do perfil" : "Favoritar no perfil",
    );
    let hiddenFromXmb = item.xmbHidden === true;
    const hiddenToggle = button(
      hiddenFromXmb ? "Mostrar" : "Ocultar",
      () => {
        hiddenFromXmb = !hiddenFromXmb;
        hiddenToggle.textContent = hiddenFromXmb ? "Mostrar" : "Ocultar";
        hiddenToggle.setAttribute("aria-pressed", String(hiddenFromXmb));
        hiddenToggle.setAttribute(
          "aria-label",
          hiddenFromXmb ? "Mostrar no XMB" : "Ocultar do XMB",
        );
      },
      "xmb-art-options-button xmb-art-options-action",
    );
    hiddenToggle.type = "button";
    hiddenToggle.setAttribute("aria-pressed", String(hiddenFromXmb));
    hiddenToggle.setAttribute(
      "aria-label",
      hiddenFromXmb ? "Mostrar no XMB" : "Ocultar do XMB",
    );
    hiddenToggle.title = "O jogo continua na coleção e pode ser reexibido por lá.";
    quickActions.append(editTitle, pinnedToggle, featuredToggle, hiddenToggle);
    const stage = el("div", "xmb-art-options-stage");
    const bubbleCard = el(
      "figure",
      "xmb-art-options-preview-card xmb-art-options-bubble-card",
    );
    const bubbleFrame = el("div", "xmb-art-options-bubble-frame");
    const bubblePreview = el("img", "xmb-art-options-bubble-preview");
    bubblePreview.alt = "Ícone da bolha do jogo";
    const bubblePlaceholder = el("span", "xmb-art-options-bubble-placeholder", "PS VITA");
    bubblePlaceholder.setAttribute("aria-hidden", "true");
    bubbleFrame.append(bubblePreview, bubblePlaceholder);
    bubbleCard.append(bubbleFrame);
    const coverCard = el(
      "figure",
      "xmb-art-options-preview-card xmb-art-options-cover-card",
    );
    const coverFrame = el("div", "xmb-art-options-cover-frame");
    const createPositionHint = () => {
      const hint = el("div", "xmb-art-options-position-hint");
      hint.setAttribute("aria-hidden", "true");
      for (const [direction, glyph] of [
        ["up", "↑"],
        ["left", "←"],
        ["right", "→"],
        ["down", "↓"],
      ]) {
        hint.append(el("span", `xmb-art-options-position-${direction}`, glyph));
      }
      return hint;
    };
    const positionHint = createPositionHint();
    const wallpaperCard = el(
      "figure",
      "xmb-art-options-preview-card xmb-art-options-wallpaper-card",
    );
    const wallpaperFrame = el("div", "xmb-art-options-wallpaper-frame");
    wallpaperFrame.tabIndex = 0;
    wallpaperFrame.setAttribute("role", "group");
    wallpaperFrame.setAttribute(
      "aria-label",
      "Prévia do wallpaper; A/Enter ativa o posicionamento e as setas movem a imagem",
    );
    wallpaperFrame.classList.add("xmb-art-options-wallpaper-adjust");
    const backdropPreview = el("img", "xmb-art-options-backdrop");
    const backdropVideoPreview = el("video", "xmb-art-options-backdrop-video");
    backdropVideoPreview.muted = true;
    backdropVideoPreview.loop = true;
    backdropVideoPreview.autoplay = true;
    backdropVideoPreview.playsInline = true;
    backdropPreview.alt = "";
    backdropPreview.setAttribute("aria-hidden", "true");
    backdropVideoPreview.setAttribute("aria-hidden", "true");
    const wallpaperPositionHint = createPositionHint();
    wallpaperFrame.append(backdropPreview, backdropVideoPreview, wallpaperPositionHint);
    wallpaperCard.append(wallpaperFrame);
    const preview = el("img", "xmb-art-options-preview");
    preview.alt = "Prévia da capa; A/Enter ativa o posicionamento e as setas movem a imagem";
    preview.tabIndex = 0;
    preview.classList.add("xmb-art-options-cover-adjust");
    preview.dataset.presentation =
      root.dataset.gamePresentation === "pill" ? "pill" : "vertical";
    coverFrame.dataset.presentation = preview.dataset.presentation;
    let positioningTarget = "";
    const setPositioning = (target = "") => {
      positioningTarget = target;
      coverCard.dataset.positioning = String(target === "cover");
      wallpaperCard.dataset.positioning = String(target === "background");
      dialog.dataset.coverPositioning = String(target === "cover");
      dialog.dataset.backgroundPositioning = String(target === "background");
      updateInputMode();
    };
    dialog.toggleCoverPositioning = () =>
      setPositioning(positioningTarget === "cover" ? "" : "cover");
    dialog.toggleWallpaperPositioning = () =>
      setPositioning(positioningTarget === "background" ? "" : "background");
    const alignStep = 0.12;
    const adjust = (value, delta) =>
      Math.round(Math.max(-1, Math.min(1, (Number(value) || 0) + delta)) * 100) / 100;
    const positionDeltas = {
      left: [-alignStep, 0],
      up: [0, -alignStep],
      right: [alignStep, 0],
      down: [0, alignStep],
    };
    const nudgePosition = (target, direction) => {
      const [x, y] = positionDeltas[direction] || [0, 0];
      if (target === "background") {
        draft.backgroundX = adjust(draft.backgroundX, x);
        draft.backgroundY = adjust(draft.backgroundY, y);
      } else {
        draft.x = adjust(draft.x, x);
        draft.y = adjust(draft.y, y);
      }
      refresh();
    };
    const setPreviewImage = (image, source, variant) => {
      if (!source) {
        if (window.Artwork) Artwork.clear(image);
        else image.removeAttribute("src");
        return;
      }
      if (window.Artwork) Artwork.set(image, source, { variant });
      else image.src = source;
    };
    const refresh = () => {
      const cover = draft.image || item.image || "";
      const bubble = draft.bubble || cover;
      const background = draft.background || cover;
      setPreviewImage(bubblePreview, bubble, "thumb");
      bubblePreview.hidden = !bubble;
      bubblePlaceholder.hidden = !!bubble;
      if (draft.backgroundVideo && draft.background) {
        const source = draft.background;
        void XmbArtworkStorage.resolveOriginal(source).then((url) => {
          if (
            dialog.open &&
            draft.backgroundVideo &&
            draft.background === source &&
            backdropVideoPreview.src !== url
          ) {
            backdropVideoPreview.src = url;
            backdropVideoPreview.load?.();
            void backdropVideoPreview.play?.().catch?.(() => {});
          }
        });
        backdropPreview.hidden = true;
        backdropVideoPreview.hidden = false;
      } else {
        backdropVideoPreview.pause?.();
        backdropVideoPreview.removeAttribute("src");
        backdropVideoPreview.hidden = true;
        setPreviewImage(backdropPreview, background, "display");
        backdropPreview.hidden = !background;
      }
      const wallpaperPosition = gameWallpaperPosition({ xmbArt: draft });
      backdropPreview.style.objectPosition = wallpaperPosition;
      backdropVideoPreview.style.objectPosition = wallpaperPosition;
      setPreviewImage(preview, cover, "display");
      preview.hidden = !cover;
      coverFrame.hidden = !cover;
      preview.style.objectPosition = gameArtPosition({ xmbArt: draft });
    };
    dialog.nudgeCover = (direction) => nudgePosition("cover", direction);
    dialog.nudgeWallpaper = (direction) => nudgePosition("background", direction);
    coverFrame.append(preview, positionHint);
    coverCard.append(coverFrame);
    stage.append(bubbleCard, coverCard, wallpaperCard);
    overview.append(quickActions, stage);
    form.append(overview);
    const message = el("p", "");
    message.setAttribute("role", "status");
    function openSearchPicker(key, caption, opener, mediaType = "art") {
      const pickerDialog = el("dialog", "xmb-art-search-picker");
      const panel = el("section", "xmb-art-search-panel");
      const heading = el("header", "xmb-art-search-header");
      const headingCopy = el("div", "xmb-art-search-heading-copy");
      const headingTitle = el("h2", "", "Escolher " + caption.toLowerCase());
      const isMediaSearch = mediaType !== "art";
      const headingStatus = el(
        "p",
        "",
        isMediaSearch
          ? mediaType === "audio"
            ? "Ajuste os termos e busque trilhas no YouTube Music."
            : "Ajuste os termos e busque vídeos no YouTube."
          : "Buscando imagens no SteamGridDB e no IGDB…",
      );
      headingStatus.setAttribute("role", "status");
      let runMediaSearch;
      const searchInput = isMediaSearch ? el("input", "xmb-art-search-input") : null;
      const searchButton = isMediaSearch
        ? button("Buscar", () => runMediaSearch?.(), "xmb-art-options-button")
        : null;
      const searchControls = isMediaSearch ? el("div", "xmb-art-search-controls") : null;
      if (searchInput && searchControls) {
        searchInput.type = "search";
        searchInput.maxLength = 120;
        searchInput.value = (
          editedTitle.trim() + (mediaType === "audio" ? " soundtrack" : " trailer gameplay")
        ).slice(0, 120);
        searchInput.placeholder =
          mediaType === "audio"
            ? "Ex.: Persona 4 soundtrack / theme"
            : "Ex.: Persona 4 trailer / gameplay";
        searchInput.setAttribute(
          "aria-label",
          mediaType === "audio" ? "Buscar trilha por termos" : "Buscar vídeo por termos",
        );
        searchButton.type = "button";
        searchButton.classList.add("xmb-art-search-submit");
        searchControls.append(searchInput, searchButton);
      }
      const closePicker = button(
        "Voltar",
        () => dismissPicker(),
        "xmb-art-options-button",
      );
      closePicker.type = "button";
      closePicker.setAttribute("aria-label", "Voltar para personalização do jogo");
      headingCopy.append(headingTitle, headingStatus);
      heading.append(headingCopy);
      if (searchControls) heading.append(searchControls);
      heading.append(closePicker);
      const grid = el("div", "xmb-art-search-grid");
      const footer = el(
        "p",
        "xmb-art-search-footer",
        isMediaSearch
          ? "Edite os termos · Setas navegam · A / ✕ busca ou escolhe · □ / X baixa quando disponível · B / ◯ volta"
          : "Setas navegam · A / ✕ escolhe · B / ◯ volta",
      );
      let state;
      let pickerDismissed = false;
      let downloadingCandidate = false;
      const downloadCandidate = async (candidate) => {
        if (downloadingCandidate || artEditor !== dialog || !pickerDialog.open) return;
        downloadingCandidate = true;
        headingStatus.textContent = "Baixando mídia para armazenar offline…";
        try {
          const blob = await window.MediaDownload.download(
            candidate.url,
            mediaType,
            getData()?.appearance?.xmb?.mediaDownloadIntervalSeconds ?? 60,
            {
              title: candidate.title || title(item),
              artist: candidate.artist || "",
            },
          );
          const extension =
            {
              "audio/aac": ".aac",
              "audio/aiff": ".aiff",
              "audio/flac": ".flac",
              "audio/mpeg": ".mp3",
              "audio/mp4": ".m4a",
              "audio/ogg": ".ogg",
              "audio/wav": ".wav",
              "audio/webm": ".webm",
              "video/mp4": ".mp4",
              "video/x-matroska": ".mkv",
              "video/quicktime": ".mov",
              "video/x-msvideo": ".avi",
              "video/webm": ".webm",
              "video/ogg": ".ogv",
            }[blob.type.split(";")[0].toLowerCase()] || ".media";
          const file = new File(
            [blob],
            (mediaType === "audio" ? "trilha" : "video") + extension,
            { type: blob.type },
          );
          const reference = await XmbArtworkStorage.store(file);
          newlyStoredArt.add(reference);
          if (artEditor !== dialog || !pickerDialog.open) {
            void XmbArtworkStorage.remove(reference);
            return;
          }
          window.MediaDownload.saveFile(
            blob,
            (mediaType === "audio" ? "trilha - " : "video - ") +
              (candidate.title || title(item)) +
              extension,
          );
          draft[key] = reference;
          message.textContent = "Arquivo baixado e mídia guardada offline.";
          refresh();
          dismissPicker();
        } catch (error) {
          if (artEditor === dialog && pickerDialog.open)
            headingStatus.textContent = error.message || "Não foi possível guardar offline.";
        } finally {
          downloadingCandidate = false;
        }
      };
      const dismissPicker = () => {
        if (pickerDismissed) return;
        pickerDismissed = true;
        if (pickerDialog.open) pickerDialog.close();
        if (dialog.activeArtSearchPicker === state) dialog.activeArtSearchPicker = null;
        pickerDialog.remove();
        if (artEditor === dialog && dialog.open && opener.isConnected)
          opener.focus({ preventScroll: true });
      };
      state = {
        dialog: pickerDialog,
        opener,
        close: dismissPicker,
        selectedIndex: 0,
        tiles: [],
        candidates: [],
        searchInput,
        searchButton,
        move(action) {
          const focused = document.activeElement;
          if (isMediaSearch && focused === searchInput) {
            if (action === "down" || action === "right")
              searchButton.focus({ preventScroll: true });
            else if (action === "up") closePicker.focus({ preventScroll: true });
            return;
          }
          if (isMediaSearch && focused === searchButton) {
            if (action === "up" || action === "left")
              searchInput.focus({ preventScroll: true });
            else if (action === "down" && state.tiles.length)
              state.tiles[0].focus({ preventScroll: true });
            return;
          }
          if (isMediaSearch && focused === closePicker) {
            if (action === "down") searchInput.focus({ preventScroll: true });
            return;
          }
          if (!state.tiles.length) {
            if (isMediaSearch) searchInput.focus({ preventScroll: true });
            else closePicker.focus({ preventScroll: true });
            return;
          }
          const tileIndex = state.tiles.indexOf(document.activeElement);
          let nextIndex = tileIndex < 0 ? 0 : tileIndex;
          const gridColumns = window.getComputedStyle?.(grid)?.gridTemplateColumns?.trim();
          const columns = gridColumns ? gridColumns.split(/\s+/).length : 4;
          if (isMediaSearch && action === "up" && tileIndex >= 0 && tileIndex < columns) {
            searchButton.focus({ preventScroll: true });
            return;
          }
          if (tileIndex >= 0) {
            if (action === "left") nextIndex = Math.max(0, nextIndex - 1);
            if (action === "right") nextIndex = Math.min(state.tiles.length - 1, nextIndex + 1);
            if (action === "up") nextIndex = Math.max(0, nextIndex - columns);
            if (action === "down")
              nextIndex = Math.min(state.tiles.length - 1, nextIndex + columns);
          }
          state.selectedIndex = nextIndex;
          const target = state.tiles[nextIndex];
          target?.focus({ preventScroll: true });
          target?.scrollIntoView({ block: "nearest" });
        },
        choose() {
          if (document.activeElement === closePicker) {
            closePicker.click();
            return;
          }
          if (isMediaSearch && document.activeElement === searchInput) {
            searchButton.click();
            return;
          }
          if (isMediaSearch && document.activeElement === searchButton) {
            searchButton.click();
            return;
          }
          state.tiles[state.selectedIndex]?.click();
        },
        downloadSelected() {
          if (!isMediaSearch) return;
          const candidate = state.candidates[state.selectedIndex];
          if (document.activeElement !== state.tiles[state.selectedIndex]) return;
          if (!candidate?.downloadAllowed) {
            headingStatus.textContent =
              mediaType === "audio"
                ? "Esta faixa não permite download offline."
                : "Este vídeo não permite download offline.";
            return;
          }
          void downloadCandidate(candidate);
        },
      };
      pickerDialog.setAttribute(
        "aria-label",
        (isMediaSearch ? "Escolher mídia de " : "Escolher arte de ") + caption.toLowerCase(),
      );
      pickerDialog.append(panel);
      panel.append(heading, grid, footer);
      dialog.activeArtSearchPicker = state;
      pickerDialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        pickerDialog.close();
      });
      pickerDialog.addEventListener("close", () => {
        dismissPicker();
      });
      dialog.append(pickerDialog);
      pickerDialog.showModal();
      let searchRevision = 0;
      const search = (query = "") => {
        const requestRevision = ++searchRevision;
        if (isMediaSearch) {
          query = String(query || "").trim();
          if (query.length < 2) {
            searchButton.disabled = false;
            headingStatus.textContent = "Digite pelo menos 2 caracteres para buscar.";
            searchInput.focus({ preventScroll: true });
            return;
          }
          grid.replaceChildren();
          state.tiles = [];
          state.candidates = [];
          state.selectedIndex = 0;
          headingStatus.textContent =
            mediaType === "audio"
              ? "Buscando trilhas no YouTube Music…"
              : "Buscando vídeos no YouTube…";
          searchButton.disabled = true;
        }
        const params = new URLSearchParams(
          isMediaSearch
            ? { title: editedTitle.trim(), type: mediaType }
            : { title: editedTitle.trim(), slot: key, mode: "choose" },
        );
        if (isMediaSearch) params.set("q", query);
        if (!isMediaSearch && key === "image")
          params.set("presentation", preview.dataset.presentation);
        void fetch(
          (isMediaSearch ? "/api/xmb/game-media?" : "/api/xmb/game-art?") + params.toString(),
          {
            headers: { Accept: "application/json" },
          },
        )
          .then(async (response) => {
            const result = await response.json().catch(() => ({}));
            if (!response.ok)
              throw new Error(
                result.error ||
                  (isMediaSearch ? "Não foi possível buscar mídia." : "Não foi possível buscar imagens."),
              );
            return result;
          })
          .then((result) => {
            if (
              artEditor !== dialog ||
              !pickerDialog.open ||
              requestRevision !== searchRevision
            )
              return;
            const candidates = Array.isArray(result.items)
              ? result.items
              : result.url
                ? [result]
                : [];
            if (!candidates.length) {
              headingStatus.textContent = isMediaSearch
                ? "Nenhuma mídia compatível foi encontrada para este jogo."
                : "Nenhuma imagem compatível foi encontrada.";
              return;
            }
            const sources = [
              ...new Set(candidates.map((candidate) => candidate.source).filter(Boolean)),
            ];
            headingStatus.textContent =
              candidates.length +
              " resultados · " +
              (sources.length
                ? sources.join(" e ")
                : isMediaSearch
                  ? mediaType === "audio"
                    ? "YouTube Music"
                    : "YouTube"
                  : "SteamGridDB e IGDB");
            if (result.failedSources?.length || result.emptySources?.length) {
              const unavailable = [
                ...new Set([...(result.failedSources || []), ...(result.emptySources || [])]),
              ];
              headingStatus.textContent += " · sem resultados de " + unavailable.join(" e ");
            }
            for (const candidate of candidates) {
              if (!/^https:\/\//i.test(candidate.url || "")) continue;
              const tile = button("", () => {
                if (artEditor !== dialog || !pickerDialog.open) return;
                draft[key] = candidate.url;
                if (key === "background") draft.backgroundVideo = false;
                message.textContent =
                  (isMediaSearch ? "Mídia escolhida em " : "Imagem escolhida em ") +
                  candidate.source +
                  (candidate.title ? " — " + candidate.title : "") +
                  ".";
                refresh();
                dismissPicker();
              }, "xmb-art-search-tile");
              tile.type = "button";
              tile.setAttribute(
                "aria-label",
                [candidate.source, candidate.title, candidate.artist || candidate.gameTitle]
                  .filter(Boolean)
                  .join(": "),
              );
              const image = el("img", "xmb-art-search-image");
              image.alt = candidate.title || "";
              image.loading = "lazy";
              image.style.aspectRatio = isMediaSearch
                ? "16 / 9"
                : key === "bubble"
                  ? "1"
                  : key === "background"
                    ? "16 / 9"
                    : preview.dataset.presentation === "pill"
                      ? "1.9 / 1"
                      : "2 / 3";
              const thumbnail = isMediaSearch ? candidate.thumbnail : candidate.url;
              if (thumbnail) {
                if (window.Artwork) Artwork.set(image, thumbnail, { variant: "thumb" });
                else image.src = thumbnail;
              }
              const labels = el("span", "xmb-art-search-labels");
              labels.append(
                el("span", "xmb-art-search-source", candidate.source || "Imagem"),
                el(
                  "span",
                  "xmb-art-search-title",
                  [candidate.title || "Título não informado", candidate.artist || candidate.gameTitle]
                    .filter(Boolean)
                    .join(" · "),
                ),
              );
              tile.append(image, labels);
              tile.addEventListener("focus", () => {
                state.selectedIndex = state.tiles.indexOf(tile);
              });
              tile.addEventListener("click", () => {
                state.selectedIndex = state.tiles.indexOf(tile);
              });
              state.tiles.push(tile);
              state.candidates.push(candidate);
              const result = el("article", "xmb-media-search-result");
              result.append(tile);
              grid.append(result);
            }
            if (!state.tiles.length) {
              headingStatus.textContent = isMediaSearch
                ? "A busca não retornou mídias compatíveis."
                : "A busca não retornou URLs de imagem válidas.";
              return;
            }
            state.selectedIndex = 0;
            state.tiles[0].focus({ preventScroll: true });
          })
          .catch((error) => {
            if (
              artEditor !== dialog ||
              !pickerDialog.open ||
              requestRevision !== searchRevision
            )
              return;
            headingStatus.textContent =
              error.message ||
              (isMediaSearch ? "Não foi possível buscar mídia." : "Não foi possível buscar imagens.");
            if (isMediaSearch) searchInput.focus({ preventScroll: true });
            else closePicker.focus({ preventScroll: true });
          })
          .finally(() => {
            if (isMediaSearch && requestRevision === searchRevision)
              searchButton.disabled = false;
          });
      };
      if (isMediaSearch) {
        runMediaSearch = () => search(searchInput.value);
        searchInput.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          runMediaSearch();
        });
        searchInput.focus({ preventScroll: true });
      } else {
        closePicker.focus({ preventScroll: true });
        search();
      }
    }
    const mediaRows = [
      { key: "bubble", caption: "Ícone da bolha", accept: "image/*", searchable: true },
      { key: "image", caption: "Capa", accept: "image/*", searchable: true },
      {
        key: "background",
        caption: "Wallpaper deste jogo",
        accept: "image/*,video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv",
        searchable: true,
      },
      {
        key: "idleVideo",
        caption: "Trailer / vídeo em espera",
        accept: "video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv",
        searchType: "video",
      },
      {
        key: "focusAudio",
        caption: "Som ao destacar",
        accept: "audio/*",
        searchType: "audio",
      },
      { key: "screenshots", caption: "Capturas de tela", accept: "image/*", multiple: true },
    ];
    for (const row of mediaRows) {
      const { key, caption } = row;
      const field = el("fieldset", "xmb-art-options-media-row");
      field.append(el("legend", "", caption));
      const file = el("input", "");
      file.type = "file";
      file.accept = row.accept;
      file.multiple = !!row.multiple;
      file.setAttribute("aria-label", caption + " — arquivo");
      file.hidden = true;
      const chooseFile = button(
        row.multiple
          ? "Adicionar capturas" + (draft.screenshots.length ? ` (${draft.screenshots.length})` : "…")
          : key === "focusAudio"
            ? "Escolher áudio…"
            : key === "idleVideo"
              ? "Escolher vídeo…"
              : "Escolher arquivo…",
        () => file.click(),
        "xmb-art-options-button",
      );
      chooseFile.type = "button";
      chooseFile.className += " xmb-art-options-media-role-file";
      let scrape;
      if (row.searchable || row.searchType) {
        scrape = button(
          "Buscar",
          () => {
            if (scrape.disabled) return;
            openSearchPicker(key, caption, scrape, row.searchType || "art");
          },
          "xmb-art-options-button",
        );
        scrape.type = "button";
        scrape.className += " xmb-art-options-media-role-search";
        scrape.title = row.searchType
          ? row.searchType === "audio"
            ? "Buscar trilhas no YouTube Music"
            : "Buscar vídeos no YouTube"
          : "Buscar opções no SteamGridDB e no IGDB";
        scrape.setAttribute(
          "aria-label",
          "Buscar " +
            caption +
            (row.searchType
              ? row.searchType === "audio"
                ? " no YouTube Music"
                : " no YouTube"
              : " no SteamGridDB e no IGDB"),
        );
      }
      let soundToggle;
      if (key === "focusAudio") {
        soundToggle = button(
          draft.focusAudioEnabled === false ? "Áudio desligado" : "Áudio ligado",
          () => {
            draft.focusAudioEnabled = draft.focusAudioEnabled === false;
            soundToggle.textContent = draft.focusAudioEnabled ? "Áudio ligado" : "Áudio desligado";
            soundToggle.setAttribute("aria-pressed", String(draft.focusAudioEnabled));
          },
          "xmb-art-options-button",
        );
        soundToggle.type = "button";
        soundToggle.className += " xmb-art-options-media-role-audio";
        soundToggle.setAttribute("aria-pressed", String(draft.focusAudioEnabled !== false));
        soundToggle.setAttribute("aria-label", "Reproduzir som ao destacar o jogo");
      }
      let idleVideoToggle;
      if (key === "idleVideo") {
        idleVideoToggle = button(
          draft.idleVideoMuted === false ? "Áudio ligado" : "Áudio desligado",
          () => {
            draft.idleVideoMuted = !draft.idleVideoMuted;
            idleVideoToggle.textContent = draft.idleVideoMuted
              ? "Áudio desligado"
              : "Áudio ligado";
            idleVideoToggle.setAttribute("aria-pressed", String(!draft.idleVideoMuted));
          },
          "xmb-art-options-button",
        );
        idleVideoToggle.type = "button";
        idleVideoToggle.className += " xmb-art-options-media-role-audio";
        idleVideoToggle.setAttribute("aria-pressed", String(draft.idleVideoMuted === false));
        idleVideoToggle.setAttribute("aria-label", "Reproduzir o áudio do vídeo em espera");
      }
      file.addEventListener("change", async () => {
        const chosenFiles = [...(file.files || [])];
        if (!chosenFiles.length) return;
        const valid = chosenFiles.every((chosen) =>
          key === "background"
            ? chosen.type.startsWith("image/") || chosen.type.startsWith("video/")
            : row.multiple
              ? chosen.type.startsWith("image/")
              : key === "focusAudio"
                ? chosen.type.startsWith("audio/")
                : key === "idleVideo"
                  ? chosen.type.startsWith("video/")
                  : chosen.type.startsWith("image/"),
        );
        if (!valid) {
          message.textContent =
            key === "focusAudio"
              ? "Escolha um arquivo de áudio."
              : key === "idleVideo" ||
                  (key === "background" &&
                    chosenFiles.some((chosen) => chosen.type.startsWith("video/")))
                ? "Escolha um vídeo MP4, WebM ou Ogg compatível com o navegador."
                : "Escolha arquivos de imagem.";
          return;
        }
        chooseFile.disabled = true;
        message.textContent = row.multiple ? "Preparando capturas…" : "Preparando mídia…";
        try {
          if (row.multiple) {
            const current = [...draft.screenshots];
            if (current.length + chosenFiles.length > 24)
              throw Error("Adicione até 24 capturas por jogo.");
            for (const chosen of chosenFiles) {
              const reference = await XmbArtworkStorage.store(chosen);
              newlyStoredArt.add(reference);
              if (artEditor !== dialog) {
                void XmbArtworkStorage.remove(reference);
                return;
              }
              current.push(reference);
            }
            draft.screenshots = current;
            chooseFile.textContent = `Adicionar capturas (${current.length})`;
          } else {
            const chosen = chosenFiles[0];
            const reference = await XmbArtworkStorage.store(chosen);
            newlyStoredArt.add(reference);
            if (artEditor !== dialog) {
              void XmbArtworkStorage.remove(reference);
              return;
            }
            draft[key] = reference;
            if (key === "background") draft.backgroundVideo = chosen.type.startsWith("video/");
          }
          message.textContent = "";
          refresh();
        } catch (error) {
          message.textContent =
            error?.name === "QuotaExceededError"
              ? "O navegador ficou sem espaço para guardar essa mídia."
              : error.message || "Não foi possível guardar essa mídia.";
        } finally {
          chooseFile.disabled = false;
          file.value = "";
        }
      });
      const reset = button("×", () => {
        if (row.multiple) {
          draft.screenshots = [];
          chooseFile.textContent = "Adicionar capturas…";
        } else delete draft[key];
        if (key === "background") delete draft.backgroundVideo;
        file.value = "";
        message.textContent = "";
        refresh();
      }, "xmb-art-options-button");
      reset.type = "button";
      reset.className += " xmb-art-options-media-role-clear";
      reset.classList.add("xmb-art-options-clear-button");
      reset.setAttribute("aria-label", "Restaurar " + caption + " padrão");
      reset.title = "Restaurar " + caption + " padrão";
      const mediaActions = el("div", "xmb-art-options-media-actions");
      if (soundToggle) mediaActions.append(soundToggle);
      if (idleVideoToggle) mediaActions.append(idleVideoToggle);
      if (scrape) mediaActions.append(scrape);
      mediaActions.append(chooseFile, reset);
      field.append(file, mediaActions);
      if (row.multiple) {
        field.append(
          el(
            "p",
            "xmb-art-options-media-hint",
            "Com “Alternar capturas” ativo, estas imagens se revezam após 5 s com o jogo selecionado. Adicione-as aqui; nada é capturado automaticamente.",
          ),
        );
      }
      form.append(field);
    }
    form.append(message);
    form.addEventListener("keydown", (event) => {
      if (
        event.target === titleInput ||
        event.target.matches("input[type='url'],input[type='search']")
      )
        return;
      const target =
        event.target === preview
          ? "cover"
          : event.target === wallpaperFrame
            ? "background"
            : "";
      if (target && event.key.startsWith("Arrow")) {
        event.preventDefault();
        if (positioningTarget === target) {
          nudgePosition(target, event.key.slice(5).toLowerCase());
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          focusArtEditorControl(dialog, event.target, event.key === "ArrowUp" ? -1 : 1);
        } else if (event.key === "ArrowLeft") {
          if (target === "cover") pinnedToggle.focus({ preventScroll: true });
          else preview.focus({ preventScroll: true });
        }
        return;
      }
      if (target && event.key === "Enter") {
        event.preventDefault();
        if (target === "cover") dialog.toggleCoverPositioning();
        else dialog.toggleWallpaperPositioning();
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        optionsAction(event.key.slice(5).toLowerCase());
      }
    });
    preview.addEventListener("blur", () => {
      if (positioningTarget === "cover") setPositioning();
    });
    wallpaperFrame.addEventListener("blur", () => {
      if (positioningTarget === "background") setPositioning();
    });
    const saveArtEditor = () => {
      dialog.activeArtSearchPicker?.close?.();
      const cleanupUncommittedArt = () => {
        const currentRefs = new Set(
          window.CollectionActions.getItems().flatMap((entry) =>
            gameArtReferences(entry.xmbArt),
          ),
        );
        for (const reference of newlyStoredArt)
          if (!currentRefs.has(reference)) void XmbArtworkStorage.remove(reference);
      };
      for (const key of ["bubble", "image", "background", "focusAudio", "idleVideo"]) {
        if (
          draft[key] &&
          !/^(https?:\/\/|data:(image|audio|video)\/|\/|xmb-art:)/i.test(draft[key])
        ) {
          message.textContent = "Use uma URL HTTP/HTTPS compatível ou escolha um arquivo local.";
          return false;
        }
      }
      if (
        !Array.isArray(draft.screenshots) ||
        draft.screenshots.length > 24 ||
        draft.screenshots.some(
          (source) =>
            typeof source !== "string" ||
            !/^(https?:\/\/|data:image\/|\/|xmb-art:)/i.test(source),
        )
      ) {
        message.textContent = "As capturas precisam ser imagens válidas (até 24 por jogo).";
        return false;
      }
      try {
        const oldArt = item.xmbArt || {};
        const updated = window.CollectionActions.updateItem(item.id, {
          title: editedTitle.trim(),
          xmbArt: draft,
          featured,
          xmbPinned: pinned,
          xmbHidden: hiddenFromXmb,
        });
        if (updated === false) {
          cleanupUncommittedArt();
          message.textContent = "Não foi possível salvar as alterações.";
          return false;
        }
        const currentRefs = new Set(
          window.CollectionActions.getItems().flatMap((entry) =>
            gameArtReferences(entry.xmbArt),
          ),
        );
        for (const reference of gameArtReferences(oldArt)) {
          if (!currentRefs.has(reference))
            void XmbArtworkStorage.remove(reference);
        }
        for (const reference of newlyStoredArt)
          if (!currentRefs.has(reference)) void XmbArtworkStorage.remove(reference);
        dialog.close();
        render();
        restorePosition();
        list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
        return true;
      } catch (error) {
        cleanupUncommittedArt();
        message.textContent = error.message;
        return false;
      }
    };
    dialog.saveArtEditor = saveArtEditor;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveArtEditor();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      saveArtEditor();
    });
    dialog.append(form);
    root.append(dialog);
    artEditor = dialog;
    dialog.addEventListener("close", () => {
      dialog.activeArtSearchPicker?.close?.();
      backdropVideoPreview.pause?.();
      backdropVideoPreview.removeAttribute("src");
      backdropVideoPreview.load?.();
      artEditor = null;
      dialog.remove();
      updateInputMode();
      (
        origin?.isConnected ? origin : list.querySelector('[aria-pressed="true"]')
      )?.focus({ preventScroll: true });
    });
    refresh();
    dialog.showModal();
    pinnedToggle.focus({ preventScroll: true });
    updateInputMode();
  }
  function optionsAction(action) {
    const picker = artEditor.activeArtSearchPicker;
    if (picker?.dialog.open) {
      if (action === "back") {
        picker.close();
      } else if (action === "select" || action === "menu") {
        picker.close();
        artEditor.saveArtEditor?.();
      } else if (action === "primary") {
        picker.choose();
      } else if (action === "secondary") {
        picker.downloadSelected?.();
      } else if (["left", "right", "up", "down"].includes(action)) {
        picker.move(action);
      }
      return;
    }
    if (action === "back" || action === "select" || action === "menu") {
      artEditor.saveArtEditor?.();
      return;
    }
    const controls = [
      ...artEditor.querySelectorAll(
        'input:not([type="file"]),button,.xmb-art-options-cover-adjust,.xmb-art-options-wallpaper-adjust',
      ),
    ].filter(
      (control) => !control.disabled && control.getClientRects().length,
    );
    const current = document.activeElement;
    const index = controls.indexOf(current);
    const focusOption = (control) => {
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: "nearest" });
    };
    if (
      current?.matches(".xmb-art-options-quick-actions button") &&
      action === "right"
    ) {
      focusOption(artEditor.querySelector(".xmb-art-options-cover-adjust"));
    } else if (current?.matches(".xmb-art-options-media-actions button")) {
      if (action === "up" || action === "down") {
        const adjacent = adjacentArtEditorMediaControl(artEditor, current, action === "up" ? -1 : 1);
        if (adjacent) focusOption(adjacent);
      } else if (action === "left" || action === "right") {
        const row = current.closest(".xmb-art-options-media-actions");
        const buttons = [...row.querySelectorAll("button")];
        focusOption(buttons[buttons.indexOf(current) + (action === "right" ? 1 : -1)]);
      } else if (action === "primary") {
        current.click();
      }
    } else if (
      current?.matches(".xmb-art-options-cover-adjust") &&
      action === "left" &&
      artEditor.dataset.coverPositioning !== "true"
    ) {
      focusOption(artEditor.querySelector(".xmb-art-options-pin"));
    } else if (
      current?.matches(".xmb-art-options-wallpaper-adjust") &&
      action === "left" &&
      artEditor.dataset.backgroundPositioning !== "true"
    ) {
      focusOption(artEditor.querySelector(".xmb-art-options-cover-adjust"));
    } else if (
      current?.matches(".xmb-art-options-cover-adjust") &&
      ["up", "down", "left", "right"].includes(action)
    ) {
      if (artEditor.dataset.coverPositioning === "true") {
        artEditor.nudgeCover?.(action);
      } else if (action === "up" || action === "down") {
        focusArtEditorControl(artEditor, current, action === "up" ? -1 : 1);
      }
    } else if (
      current?.matches(".xmb-art-options-wallpaper-adjust") &&
      ["up", "down", "left", "right"].includes(action)
    ) {
      if (artEditor.dataset.backgroundPositioning === "true") {
        artEditor.nudgeWallpaper?.(action);
      } else if (action === "up" || action === "down") {
        focusArtEditorControl(artEditor, current, action === "up" ? -1 : 1);
      }
    } else if (action === "up" || action === "down") {
      const next = controls[
        Math.max(
          0,
          Math.min(
            controls.length - 1,
            (index < 0 ? 0 : index) + (action === "down" ? 1 : -1),
          ),
        )
      ];
      focusOption(next);
    } else if (action === "left" || action === "right") {
      const row = current?.closest(".xmb-art-options-media-actions");
      const buttons = [...(row?.querySelectorAll("button") || [])];
      const buttonIndex = buttons.indexOf(current);
      if (buttonIndex >= 0) {
        focusOption(buttons[buttonIndex + (action === "right" ? 1 : -1)]);
      }
    } else if (action === "primary") {
      if (current?.matches(".xmb-art-options-cover-adjust")) {
        artEditor.toggleCoverPositioning?.();
      } else if (current?.matches(".xmb-art-options-wallpaper-adjust")) {
        artEditor.toggleWallpaperPositioning?.();
      } else if (current?.matches("button,input[type=checkbox]")) current.click();
    }
  }
  function semantic(action) {
    if (!active || window.SpaceAmpNowPlaying?.isOpen()) {
      return;
    }
    if (artEditor) {
      optionsAction(action);
      return;
    }
    if (action === "select") {
      openArtEditor();
      return;
    }
    if (folderTransition) {
      if (action === "back") {
        back();
        return;
      }
      if (action === "menu") {
        settleFolderTransition();
      } else {
        return;
      }
    }
    if (action === "menu") {
      window.XmbQuickMenu?.open({ surface: "xmb", openNowPlaying: () => openNowPlaying() });
    } else if (action === "primary") {
      void primary();
    } else if (action === "back") {
      if (entryFocused) {
        entryFocused = false;
        list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      } else {
        back();
      }
    } else if (action === "secondary") {
      activate();
    } else if (action === "tertiary") {
      openPage();
    } else if (action === "left" || action === "right") {
      if (detailsLevel) {
        return;
      }
      const index = categories.findIndex(([key]) => key === area);
      selectCategory(
        categories[
          Math.max(0, Math.min(categories.length - 1, index + (action === "right" ? 1 : -1)))
        ][0],
      );
    } else if (action === "up" || action === "down") {
      if (detailsLevel) {
        detail.scrollTop += action === "down" ? 40 : -40;
        return;
      }
      if (entryFocused) {
        if (action === "down") {
          entryFocused = false;
          list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
        }
        return;
      }
      selectItem(selection() + (action === "down" ? 1 : -1));
    }
  }
  window.addEventListener("xmb:action", (event) => {
    if (active) {
      inputMode = "gamepad";
      updateInputMode();
      semantic(event.detail);
    }
  });
  window.addEventListener("xmb:inputmode", (event) => {
    inputMode = event.detail;
    if (active) {
      updateInputMode();
    }
  });
  for (const type of ["spaceamp:trackchange", "spaceamp:playstate", "spaceamp:progress"]) {
    window.addEventListener(type, handlePlaybackChange);
  }
  window.addEventListener("spaceamp:nowplaying-closing", () => {
    if (!active || !handoffContext) {
      return;
    }
    const rows = entries();
    const saved = handoffContext;
    const index = rows.findIndex((row, i) => identity(row, i) === saved.id);
    const target = list.querySelector('[aria-pressed="true"]')?.querySelector("img");
    if (index >= 0 && saved.category === "music" && isCurrentSpaceAmpTrack(rows[index])) {
      window.XmbHandoff?.run(document.querySelector("#spaceampNowPlaying .np-cover"), target);
    } else window.XmbHandoff?.cleanup();
  });
  window.addEventListener("spaceamp:nowplaying-closed", () => {
    updateNowEntry();
    syncPlaybackProgress();
    if (!active || !handoffContext) {
      return;
    }
    const saved = handoffContext;
    handoffContext = null;
    category = saved.category;
    area = saved.area;
    foldersLevel = saved.foldersLevel;
    folderDepth = saved.folderDepth === true;
    playlistTrackDepth = saved.playlistTrackDepth === true;
    playlistTrackPlaylistId = saved.playlistTrackPlaylistId || "";
    const rows = entries();
    const index = rows.findIndex((row, i) => identity(row, i) === saved.id);
    if (index >= 0) {
      remembered.set(selectionKey(), saved.id);
    }
    const selected = list.querySelector('[aria-pressed="true"]');
    const visibleRows = [...list.querySelectorAll(".xmb-item")];
    if (
      visibleRows.length !== rows.length ||
      visibleRows.some((node, i) => node.dataset.itemId !== String(identity(rows[i], i))) ||
      !selected ||
      selected.dataset.itemId !==
        String(index < 0 ? identity(rows[selection(rows)] || {}, selection(rows)) : saved.id)
    ) {
      render();
    }
    root.dataset.folderDepth = String(folderDepth);
    root.dataset.playlistTrackDepth = String(playlistTrackDepth);
    nav.inert = folderDepth || detailsLevel;
    list.scrollTop = saved.listScroll;
    nav.scrollLeft = saved.navScroll;
    detail.scrollTop = saved.detailScroll;
    entryFocused = saved.entryFocused && !nowEntry.hidden;
    (saved.focus?.isConnected &&
    !saved.focus.hidden &&
    (!saved.focus.matches(".xmb-item") || saved.focus.getAttribute("aria-pressed") === "true")
      ? saved.focus
      : entryFocused
        ? nowEntry
        : list.querySelector('[aria-pressed="true"]') || root
    ).focus({ preventScroll: true });
  });
  root.addEventListener("focusin", (event) => {
    const row = event.target.closest(".xmb-item");
    if (!active || !row || row.getAttribute("aria-pressed") === "true") return;
    if (window.SpaceAmpNowPlaying?.isOpen() || window.XmbQuickMenu?.isOpen()) return;
    list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  });
  function activate() {
    if (detailsLevel || foldersLevel) {
      return;
    }
    const rows = entries();
    const item = rows[selection(rows)];
    if (!item) {
      return;
    }
    if (item.folder) {
      openFolder(item.folder, item);
      return;
    }
    invalidateHandoff();
    detailsLevel = true;
    stopScroll(list);
    stopScroll(nav);
    previewScroll = detail.scrollTop;
    root.dataset.level = "details";
    // Conserva as linhas, seleção e posições dos scrollers do nível anterior.
    nav.inert = true;
    list.inert = true;
    backButton.textContent = "[ voltar · Esc ]";
    renderDetail(item);
    detail.scrollTop = 0;
    detail.tabIndex = 0;
    detail.focus({ preventScroll: true });
    announcement.textContent = "Detalhes · " + title(item);
    updateInputMode();
  }
  function back() {
    if (folderTransition) {
      if (folderTransition.direction === "enter" && !folderTransition.committed) {
        const transition = cancelFolderTransition();
        root.dataset.folderDepth = String(folderDepth);
        nav.inert = folderDepth || detailsLevel;
        list.inert = detailsLevel;
        if (transition.sourceFocus?.isConnected) {
          transition.sourceFocus.focus({ preventScroll: true });
        }
        updateInputMode();
        return;
      }
      if (folderTransition.direction === "exit" && !folderTransition.committed) {
        return;
      }
      settleFolderTransition();
    }
    if (!detailsLevel) {
      if (playlistTrackDepth) {
        rememberPosition();
        invalidateHandoff();
        transitionFolderDepth(
          "exit",
          () => {
            setListSpaces(0, 0);
            list.scrollTop = 0;
            playlistTrackDepth = false;
            playlistTrackPlaylistId = "";
            root.dataset.playlistTrackDepth = "false";
            render({ focus: true });
            restorePosition();
            revealSelection(false);
          },
          undefined,
          { animateNavigation: false },
        );
        return;
      }
      if (category === "game" && gameBrowseLevel !== "home") {
        rememberPosition();
        invalidateHandoff();
        const nextLevel = gameBrowseLevel === "titles" ? "platforms" : "home";
        transitionFolderDepth(
          "exit",
          () => {
            gameBrowseLevel = nextLevel;
            if (nextLevel !== "titles") gamePlatform = "";
            folderDepth = nextLevel !== "home";
            root.dataset.folderDepth = String(folderDepth);
            render({ focus: true });
            restorePosition();
            revealSelection(false);
          },
          () => {
            if (nextLevel === "home") root.dataset.folderDepth = "false";
          },
          { animateNavigation: nextLevel === "home" },
        );
        return;
      }
      if (!foldersLevel && categories.find(([key]) => key === area)[2].length > 1) {
        rememberPosition();
        invalidateHandoff();
        transitionFolderDepth("exit", () => {
          folderDepth = false;
          foldersLevel = true;
          remembered.set(selectionKey(), category);
          render({ focus: true });
          restorePosition();
        }, () => {
          root.dataset.folderDepth = "false";
        });
        return;
      }
      close();
      return;
    }
    invalidateHandoff();
    detailsLevel = false;
    root.dataset.level = "root";
    nav.inert = folderDepth;
    list.inert = false;
    detail.tabIndex = -1;
    backButton.textContent = playlistTrackDepth
      ? "[ faixas · Esc ]"
      : category === "game" && gameBrowseLevel !== "home"
        ? "[ pastas · Esc ]"
        : categories.find(([key]) => key === area)[2].length > 1
          ? "[ pastas · Esc ]"
          : "[ sair · Esc ]";
    updateInputMode();
    const rows = entries();
    renderDetail(rows[selection(rows)]);
    detail.scrollTop = previewScroll;
    if (!folderDepth) revealSelection(false);
    (list.querySelector('[aria-pressed="true"]') || categoryButtons.get(area)).focus({
      preventScroll: true,
    });
    announcement.textContent = `${categoryButtons.get(area).textContent} · ${rows.length ? title(rows[selection(rows)]) : "sem itens"}`;
  }
  function openPage() {
    if (foldersLevel || category === "playlists") return;
    const rows = entries();
    const item = rows[selection(rows)];
    const key = category;
    if (!item) {
      return;
    }
    if (item.folder) return;
    close();
    if (key === "profile") {
      navigate("perfil");
    } else if (key === "photos") {
      navigate("fotos");
      openPhoto(item);
    } else {
      openItem(item);
    }
  }
  function releaseFullscreen() {
    if (ownsFullscreen && document.fullscreenElement === document.documentElement) {
      ownsFullscreen = false;
      try {
        Promise.resolve(document.exitFullscreen()).catch(() => {});
      } catch {}
    }
  }
  function close() {
    if (artEditor && artEditor.saveArtEditor?.() === false) {
      return;
    }
    if (!active) {
      return;
    }
    settleFolderTransition();
    active = false;
    window.clearTimeout(playbackProgressTimer);
    playbackProgressTimer = undefined;
    dismissDashNotification();
    restoreFoldersOnEntry = true;
    clearIdleMedia();
    stopFocusSound();
    folderDepth = false;
    gameBrowseLevel = "home";
    gamePlatform = "";
    playlistTrackDepth = false;
    playlistTrackPlaylistId = "";
    root.dataset.folderDepth = "false";
    root.dataset.playlistTrackDepth = "false";
    session++;
    if (layoutRefreshFrame != null) {
      window.cancelAnimationFrame?.(layoutRefreshFrame);
      layoutRefreshFrame = null;
    }
    primaryRevision++;
    handoffContext = null;
    window.XmbHandoff?.cleanup();
    stopClock();
    stopScroll(list);
    stopScroll(nav);
    root.hidden = true;
    for (const [node, inert] of background) {
      node.inert = inert;
    }
    background = [];
    document.body.classList.remove("xmb-active");
    releaseFullscreen();
    trigger?.focus({ preventScroll: true });
  }
  function enter(source) {
    composeSystemMenu();
    if (active) {
      return;
    }
    if (!root.isConnected) {
      document.body.append(root);
    }
    trigger = source || document.activeElement;
    active = true;
    updateNowEntry();
    syncPlaybackProgress();
    updateClock();
    detailsLevel = false;
    folderDepth = false;
    gameBrowseLevel = "home";
    gamePlatform = "";
    playlistTrackDepth = false;
    playlistTrackPlaylistId = "";
    root.dataset.level = "root";
    nav.inert = false;
    list.inert = false;
    detail.tabIndex = -1;
    backButton.textContent = "[ sair · Esc ]";
    const token = ++session;
    category = Object.hasOwn(Collection.kinds, getFilters().kind) ? getFilters().kind : category;
    area = categories.find(([, , kinds]) => kinds.includes(category))[0];
    folders.set(area, category);
    remembered.set("folders:" + area, category);
    const kinds = categories.find(([key]) => key === area)[2];
    foldersLevel = restoreFoldersOnEntry && kinds.length > 1;
    restoreFoldersOnEntry = false;
    background = [...document.body.children]
      .filter((node) => node !== root)
      .map((node) => [node, node.inert]);
    for (const [node] of background) {
      node.inert = true;
    }
    document.body.classList.add("xmb-active");
    root.hidden = false;
    render({ focus: true });
    restorePosition();
    scheduleLayoutRefresh(token);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        Promise.resolve(document.documentElement.requestFullscreen())
          .then(() => {
            ownsFullscreen = document.fullscreenElement === document.documentElement;
            if (!active || token !== session) {
              releaseFullscreen();
            }
          })
          .catch(() => {}); // A interface continua funcionando na viewport.
      } catch {}
    }
  }
  document.addEventListener("fullscreenchange", () => {
    if (active && document.fullscreenElement === document.documentElement) {
      scheduleLayoutRefresh();
    }
    if (ownsFullscreen && !document.fullscreenElement) {
      ownsFullscreen = false;
      if (window.XmbQuickMenu?.isOpen()) {
        window.XmbQuickMenu.close();
        return;
      }
      if (window.SpaceAmpNowPlaying?.isOpen()) {
        window.SpaceAmpNowPlaying.close();
        return;
      }
      // Alguns navegadores interceptam Esc para sair do fullscreen nativo.
      // Nesse caso, conserva o shell na viewport e volta apenas um nível.
      if (detailsLevel || (!foldersLevel && categories.find(([key]) => key === area)[2].length > 1)) {
        back();
      } else {
        close();
      }
    }
  });
  window.addEventListener("hashchange", () => close());
  window.addEventListener("resize", () => {
    if (active) {
      updateHorizontalAxis();
      if (!folderTransition) {
        if (!folderDepth && !detailsLevel) revealSelection(false);
      }
      scheduleLayoutRefresh();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (active) {
      updateClock();
    }
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (artEditor) {
        const editingText = event.target.matches?.(
          'input:not([type="file"]),textarea,[contenteditable="true"]',
        );
        if (!editingText && ["s", "S", "Backspace", "Escape"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          artEditor.saveArtEditor?.();
        }
        return;
      }
      if (window.XmbQuickMenu?.isOpen()) return;
      if (window.SpaceAmpNowPlaying?.isOpen()) {
        return;
      }
      if (!active || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }
      if (
        event.target?.isContentEditable ||
        event.target?.closest?.(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
        )
      ) {
        return;
      }
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Enter",
          "Escape",
          "Backspace",
          "Tab",
          "o",
          "O",
          "d",
          "D",
          "s",
          "S",
        ].includes(event.key)
      ) {
        return;
      }
      if (
        event.key === "Enter" &&
        (event.target.closest?.(".xmb-exit") ||
          event.target.closest?.(".xmb-page") ||
          event.target.closest?.(".xmb-play") ||
          event.target.closest?.(".xmb-now-playing"))
      ) {
        return;
      }
      inputMode = "keyboard";
      updateInputMode();
      event.preventDefault();
      event.stopPropagation();
      if (
        event.repeat &&
        ["Enter", "Escape", "Backspace", "o", "O", "d", "D"].includes(event.key)
      ) {
        return;
      }
      const map = {
        Escape: "back",
        Backspace: "back",
        Enter: "primary",
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        o: "tertiary",
        O: "tertiary",
        d: "secondary",
        D: "secondary",
        s: "select",
        S: "select",
      };
      if (map[event.key]) {
        semantic(map[event.key]);
      } else if (event.key === "Tab") {
        const controls = [...root.querySelectorAll("button")].filter(
          (node) =>
            node.tabIndex >= 0 && (!detailsLevel || (!nav.contains(node) && !list.contains(node))),
        );
        const index = controls.indexOf(document.activeElement);
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
      // Na raiz, Backspace evita voltar o histórico; nos detalhes, volta um nível.
    },
    true,
  );
  function composeSystemMenu() {
    window.XmbQuickMenu?.composeSystem({
      getState: () => ({
        xmbActive: active,
        fullscreen: !!document.fullscreenElement,
        fullscreenAvailable: !!document.documentElement.requestFullscreen,
      }),
      async toggleFullscreen() {
        if (document.fullscreenElement) {
          const owned = ownsFullscreen;
          ownsFullscreen = false;
          try {
            await document.exitFullscreen();
          } catch (error) {
            ownsFullscreen = owned;
            throw error;
          }
        } else {
          const requestedFromXmb = active;
          const token = session;
          await document.documentElement.requestFullscreen();
          ownsFullscreen =
            requestedFromXmb && document.fullscreenElement === document.documentElement;
          if (requestedFromXmb && (!active || token !== session)) releaseFullscreen();
        }
      },
      exitXmb: close,
    });
  }
  composeSystemMenu();
  window.addEventListener("xmb:quickmenu-ready", composeSystemMenu);
  return { enter, close, isActive: () => active };
}
