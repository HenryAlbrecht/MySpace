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
    ["music", "Música", ["music", "album", "artist"]],
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
  let folderFocusOffset = null;
  let listStartSpace = 0;
  let listEndSpace = 0;
  let folderTransition = null;
  const scrolling = new Map();
  const scrollDestinations = new Map();
  let wheelDirection = 0;
  let wheelSteps = 0;
  let category = "game";
  let active = false;
  let trigger;
  let background = [];
  let session = 0;
  let ownsFullscreen = false;
  let detailsLevel = false;
  let previewScroll = 0;
  let clockTimer;
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
  system.append(clock, nowEntry, backButton);
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
  const rootHelp =
    "← → áreas · ↑ ↓ navegar · Enter ação · D detalhes · O página completa · Esc voltar";
  const help = el("footer", "xmb-help", rootHelp);
  body.append(list, detail);
  root.append(header, nav, body, help, announcement);
  const backdrop = el("div", "xmb-backdrop");
  backdrop.setAttribute("aria-hidden", "true");
  root.append(backdrop);

  function selectionKey() {
    return foldersLevel ? "folders:" + area : category;
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
    root.dataset.rootColumn = previousRootColumn || String(!folderDepth && !foldersLevel);
    root.dataset.folderMeasure = "false";
    return Number.isFinite(destinationTop) ? focusY - destinationTop : null;
  }
  function restorePosition() {
    const saved = positions.get(selectionKey());
    if (saved) {
      list.scrollTop = root.dataset.rootColumn === "true" ? 0 : saved.list;
      detail.scrollTop = saved.detail;
    }
    if (!folderDepth && !foldersLevel) revealSelection(false);
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
    return transition;
  }
  function settleFolderTransition() {
    const transition = cancelFolderTransition();
    if (transition && !transition.committed) {
      transition.commit();
      transition.committed = true;
    }
  }
  function transitionFolderDepth(direction, commit, prepare = () => {}) {
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
      if (direction === "enter" && nav.cloneNode && nav.animate) {
        navigationTransition = capture(nav, "xmb-categories-transition-outgoing");
      } else if (direction === "exit" && nav.animate) {
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
  function openFolder(kind) {
    if (folderTransition) {
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

  function entries() {
    if (foldersLevel) {
      return categories.find(([key]) => key === area)[2].map((kind) => ({
        folder: kind,
        id: kind,
        title: Collection.kinds[kind],
      }));
    }
    if (category === "profile") {
      return [getProfile()];
    }
    if (category === "photos") {
      return getData().photos || [];
    }
    return Collection.filterItems(getData().items, {
      ...getFilters(),
      kind: category,
    });
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
  };
  function folderSummary(item) {
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
  let atmosphericImage;
  let identityImage;
  let artworkGap = true;
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
  function renderDetail(item) {
    const previousCover = detailCover;
    detail.replaceChildren();
    context.textContent =
      categoryButtons.get(area).textContent +
      (foldersLevel ? " · pastas" : " · " + (Collection.kinds[category] || "itens"));
    detail.append(context);
    if (item?.folder) {
      root.dataset.itemBackground = "false";
      backdrop.hidden = true;
      artworkGap = true;
      detail.append(el("h2", "", item.title));
      detail.append(el("p", "xmb-folder-summary", folderSummary(item)));
      detail.append(el("p", "xmb-folder-hint", "Enter / A para abrir · Esc / B para voltar"));
      detail.append(button("[ abrir pasta ]", () => openFolder(item.folder), "xmb-open"));
      return;
    }
    if (!item) {
      root.dataset.itemBackground = "false";
      artworkGap = true;
      backdrop.hidden = true;
      return;
    }
    const heading = el("h2", "", title(item));
    detail.append(heading);
    const image = category === "profile" ? item.avatar : item.xmbArt?.image || item.image;
    if (image) {
      const cover = previousCover || imageNode(image, title(item));
      detailCover = cover;
      cover.alt = title(item);
      if (previousCover) {
        prepareArtworkAfterGap(cover, image);
      }
      if (previousCover && window.Artwork) {
        Artwork.set(cover, image, {
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
    root.dataset.itemBackground = String(!!item.xmbArt?.background);
    const atmosphere = artworkSource({ customBackground: item.xmbArt?.background, cover: image });
    if (atmosphere) {
      backdrop.hidden = false;
      const atmosphereNode = atmosphericImage || imageNode(atmosphere, "");
      atmosphereNode.loading = "eager";
      // A failed decorative source falls back to the theme, without error text.
      const identityNode = identityImage || imageNode(atmosphere, "");
      atmosphericImage = atmosphereNode;
      identityImage = identityNode;
      identityNode.className = "xmb-artwork-identity";
      identityNode.loading = "eager";
      for (const image of [atmosphereNode, identityNode]) {
        prepareArtworkAfterGap(image, atmosphere);
        if (window.Artwork) {
          Artwork.set(image, atmosphere, {
            error: () => {
              image.hidden = true;
            },
          });
        } else {
          image.src = atmosphere;
        }
        image.hidden = false;
        if (!image.parentElement) {
          backdrop.append(image);
        }
      }
    } else {
      backdrop.hidden = true;
    }
    artworkGap = !image;
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
    const percent = (value) => (Math.max(-1, Math.min(1, Number(value) || 0)) + 1) * 50;
    return `${percent(art.x)}% ${percent(art.y)}%`;
  }
  function thumbnail(item, index, source) {
    const key = category + ":" + identity(item, index);
    let image = thumbnails.get(key);
    if (!image) {
      image = imageNode(source, "");
      thumbnails.set(key, image);
      if (thumbnails.size > 64) {
        thumbnails.delete(thumbnails.keys().next().value);
      }
    } else if (window.Artwork) {
      Artwork.set(image, source, {
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
      row.ondblclick = item.folder ? () => openFolder(item.folder) : activate;
      list.append(row);
    });
    if (!rows.length) {
      list.append(el("p", "xmb-empty", "Nenhum item nesta categoria com os filtros atuais."));
    }
    renderDetail(rows[selected]);
    root.dataset.area = area;
    root.dataset.kind = foldersLevel ? "" : category;
    root.dataset.artworkBorder =
      getData()?.appearance?.xmb?.artworkBorder === false ? "false" : "true";
    root.dataset.roundedArtwork =
      getData()?.appearance?.xmb?.roundedArtwork === true ? "true" : "false";
    if (!foldersLevel && category === "game") {
      root.dataset.gamePresentation =
        getData()?.appearance?.xmb?.gamePresentation === "pill" ? "pill" : "vertical";
    } else {
      delete root.dataset.gamePresentation;
    }
    root.dataset.level = detailsLevel ? "details" : foldersLevel ? "folders" : "root";
    root.dataset.folderDepth = String(folderDepth);
    root.dataset.rootColumn = String(!folderDepth && !foldersLevel);
    nav.inert = folderDepth || detailsLevel;
    backButton.textContent =
      foldersLevel || categories.find(([key]) => key === area)[2].length === 1
        ? "[ sair · Esc ]"
        : "[ pastas · Esc ]";
    announcement.textContent = `${categoryButtons.get(area).textContent} · ${rows.length ? title(rows[selected]) : "sem itens"}`;
    if (focus) {
      (list.children[selected]?.tagName === "BUTTON"
        ? list.children[selected]
        : categoryButtons.get(area)
      ).focus({ preventScroll: true });
    }
    updateHints();
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
      const copy = row.querySelector(":scope > .xmb-item-copy");
      const copyRect = index === selected && copy ? copy.getBoundingClientRect() : null;
      const imageStyle = image ? window.getComputedStyle(image) : null;
      const focused = index === selected;
      const imageScale =
        category === "game"
          ? root.dataset.gamePresentation === "pill"
            ? focused
              ? 1.12
              : 0.74
            : focused
              ? 1.14
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
      if (!image) {
        const placeholder = window.getComputedStyle(row, "::before");
        const transform = placeholder.transform.match(/^matrix\(([^,]+)/);
        const scale = transform ? Number.parseFloat(transform[1]) : 1;
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
    const helpTop = help.getBoundingClientRect?.().top;
    const safeBottom =
      Number.isFinite(helpTop) && helpTop > 0
        ? Math.min(window.innerHeight, helpTop) - 12 * designScale
        : window.innerHeight - 24 * designScale;
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
        ? 1.12
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
    if (fitsFolderRows && (contentHeight > list.clientHeight || listEndSpace > 0)) {
      const focus = folderFocus();
      setListSpaces(
        listStartSpace || Math.max(0, Math.round(focus - first.offsetHeight / 2)),
        Math.max(0, Math.round(list.clientHeight - focus - rowHalf)),
      );
    } else if (fitsFolderRows && Number.isFinite(folderFocusOffset)) {
      const selectedOffset = Math.max(0, row.offsetTop - first.offsetTop);
      const desiredStart = Math.max(0, folderFocus() - selectedOffset - rowHalf);
      const start = listStartSpace > 0 ? listStartSpace : desiredStart;
      setListSpaces(start, 0);
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
    const kinds = categories.find(([candidate]) => candidate === key)[2];
    foldersLevel = kinds.length > 1;
    category = folders.get(area) || kinds[0];
    detailsLevel = false;
    nav.inert = false;
    list.inert = false;
    render({ focus: true });
    restorePosition();
  }
  function updateHints() {
    root.dataset.inputMode = inputMode;
    help.textContent =
      inputMode === "gamepad"
        ? artEditor
          ? "↑ ↓ navegar · ← → mover nos controles · A escolher · B / Select / Options fechar"
          : detailsLevel
          ? "↑ ↓ rolar · B voltar · Y página completa"
          : folderDepth
            ? "D-pad / stick navegar · A ação/tocar · B voltar · Options Quick Menu"
            : foldersLevel
              ? "D-pad / stick navegar · A abrir pasta · B sair · Options Quick Menu"
              : `D-pad / stick navegar · A ação/tocar · B voltar · X detalhes · Y página completa · ${category === "game" ? "Select personalizar jogo · " : ""}Options Quick Menu`
        : artEditor
          ? "Tab navegar · Enter escolher · Esc fechar"
          : detailsLevel
          ? "↑ ↓ rolar detalhes · O página completa · Esc / Backspace voltar"
          : folderDepth
            ? "↑ ↓ navegar · Enter ação/tocar · Esc / Backspace voltar às pastas"
            : foldersLevel
              ? "← → áreas · ↑ ↓ pastas · Enter abrir pasta · Esc sair"
              : category === "game"
                ? "← → áreas · ↑ ↓ navegar · Enter ação · D detalhes · S personalizar jogo · O página completa · Esc voltar"
                : rootHelp;
  }
  function updateNowEntry() {
    const state = window.SPACEAMP?.getPlaybackState?.();
    nowEntry.hidden = !state?.available || !state?.title || !!state.stopped;
    nowEntry.textContent = state?.title
      ? "♪ " + state.title + (state.artist ? " · " + state.artist : "")
      : "";
    if (entryFocused && nowEntry.hidden) {
      entryFocused = false;
      list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    }
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
    const data = getData();
    const queued = data.tracks?.find((track) => track.id === data.activeTrack);
    const currentSource =
      current.playbackSource ||
      (current.sourceUrl
        ? selected?.type === "local"
          ? { type: "local", fileRef: current.sourceUrl }
          : { type: selected?.type, url: current.sourceUrl }
        : queued?.playbackSource);
    if (!currentSource) {
      return !!normalize(current.artist);
    }
    if (selected?.type === "local") {
      return selected.fileRef === (currentSource.fileRef || queued?.fileRef || queued?.id);
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
    if (foldersLevel) {
      if (item) openFolder(item.folder);
      return;
    }
    if (category !== "music") {
      activate();
      return;
    }
    if (!item?.playbackSource || !window.MusicModel || !window.SPACEAMP) {
      window.toast?.("Vincule a reprodução desta música na coleção.");
      activate();
      return;
    }
    const revision = ++primaryRevision;
    saveContext();
    try {
      const same = isCurrentSpaceAmpTrack(item);
      window.XmbHandoff?.prepare(handoffContext.art, item.image || item.artwork || "");
      if (!same) {
        await window.SPACEAMP.play(MusicModel.queueTrack(item));
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
  let artEditor = null;
  function focusArtEditorControl(editor, current, direction) {
    const controls = [
      ...editor.querySelectorAll(
        'input:not([type="file"]),button,.xmb-art-options-cover-adjust',
      ),
    ].filter((control) => !control.disabled && control.getClientRects().length);
    const index = controls.indexOf(current);
    const next = controls[
      Math.max(0, Math.min(controls.length - 1, (index < 0 ? 0 : index) + direction))
    ];
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: "nearest" });
  }
  function openArtEditor() {
    const item = entries()[selection()];
    if (category !== "game" || foldersLevel || detailsLevel || !item || artEditor) return;
    rememberPosition();
    const dialog = el("dialog", "xmb-art-options");
    const form = el("form", "xmb-art-options-form");
    const draft = { ...item.xmbArt };
    const origin = document.activeElement;
    dialog.setAttribute("aria-label", "Personalizar " + title(item));
    const heading = el("header", "xmb-art-options-header");
    heading.append(el("h2", "", title(item)), el("p", "", "Personalizar apresentação no XMB"));
    form.append(heading);
    const overview = el("section", "xmb-art-options-overview");
    const quickActions = el("div", "xmb-art-options-quick-actions");
    const favorite = el("label", "xmb-art-options-featured", "Destaque na coleção");
    const check = el("input", "");
    check.type = "checkbox";
    check.checked = item.featured === true;
    check.setAttribute("aria-label", "Destaque na coleção");
    favorite.prepend(check);
    quickActions.append(favorite);
    const stage = el("div", "xmb-art-options-stage");
    const coverCard = el(
      "figure",
      "xmb-art-options-preview-card xmb-art-options-cover-card",
    );
    const coverFrame = el("div", "xmb-art-options-cover-frame");
    const positionHint = el("div", "xmb-art-options-position-hint");
    positionHint.setAttribute("aria-hidden", "true");
    for (const [direction, glyph] of [
      ["up", "↑"],
      ["left", "←"],
      ["right", "→"],
      ["down", "↓"],
    ]) {
      positionHint.append(el("span", `xmb-art-options-position-${direction}`, glyph));
    }
    const wallpaperCard = el(
      "figure",
      "xmb-art-options-preview-card xmb-art-options-wallpaper-card",
    );
    const backdropPreview = el("img", "xmb-art-options-backdrop");
    backdropPreview.alt = "";
    backdropPreview.setAttribute("aria-hidden", "true");
    const preview = el("img", "xmb-art-options-preview");
    preview.alt = "Prévia da capa; A/Enter ativa o posicionamento e as setas movem a imagem";
    preview.tabIndex = 0;
    preview.classList.add("xmb-art-options-cover-adjust");
    preview.dataset.presentation =
      root.dataset.gamePresentation === "pill" ? "pill" : "vertical";
    coverFrame.dataset.presentation = preview.dataset.presentation;
    let positioningCover = false;
    const setCoverPositioning = (enabled) => {
      positioningCover = enabled;
      coverCard.dataset.positioning = String(enabled);
      dialog.dataset.coverPositioning = String(enabled);
    };
    dialog.toggleCoverPositioning = () => setCoverPositioning(!positioningCover);
    const alignStep = 0.12;
    const adjust = (value, delta) =>
      Math.round(Math.max(-1, Math.min(1, (Number(value) || 0) + delta)) * 100) / 100;
    const positionDeltas = {
      left: [-alignStep, 0],
      up: [0, -alignStep],
      right: [alignStep, 0],
      down: [0, alignStep],
    };
    const refresh = () => {
      const cover = draft.image || item.image || "";
      const background = draft.background || cover;
      if (background) backdropPreview.src = background;
      else backdropPreview.removeAttribute("src");
      backdropPreview.hidden = !background;
      if (cover) preview.src = cover;
      else preview.removeAttribute("src");
      preview.hidden = !cover;
      coverFrame.hidden = !cover;
      preview.style.objectPosition = gameArtPosition({ xmbArt: draft });
    };
    const nudge = (direction) => {
      const [x, y] = positionDeltas[direction] || [0, 0];
      draft.x = adjust(draft.x, x);
      draft.y = adjust(draft.y, y);
      refresh();
    };
    dialog.nudgeCover = nudge;
    coverFrame.append(preview, positionHint);
    coverCard.append(coverFrame);
    wallpaperCard.append(backdropPreview);
    stage.append(coverCard, wallpaperCard);
    overview.append(quickActions, stage);
    form.append(overview);
    const message = el("p", "");
    message.setAttribute("role", "status");
    for (const [key, caption] of [["image", "Capa"], ["background", "Wallpaper deste jogo"]]) {
      const field = el("fieldset", "xmb-art-options-media-row");
      field.append(el("legend", "", caption));
      const url = el("input", "");
      url.type = "text";
      url.placeholder = "URL da imagem";
      const savedValue = draft[key] || "";
      const isLocalImage = savedValue.startsWith("data:image/");
      url.value = isLocalImage ? "" : savedValue;
      if (isLocalImage) url.placeholder = "Imagem carregada do computador";
      url.setAttribute("aria-label", caption + " — URL");
      url.addEventListener("input", () => {
        const value = url.value.trim();
        if (value) draft[key] = value;
        else delete draft[key];
        url.placeholder = "URL da imagem";
        message.textContent = "";
        refresh();
      });
      const file = el("input", "");
      file.type = "file";
      file.accept = "image/*";
      file.setAttribute("aria-label", caption + " — arquivo");
      file.hidden = true;
      const chooseFile = button(
        "Escolher arquivo…",
        () => file.click(),
        "xmb-art-options-button",
      );
      chooseFile.type = "button";
      file.addEventListener("change", () => {
        const chosen = file.files[0];
        if (!chosen) return;
        if (!chosen.type.startsWith("image/") || chosen.size > 2 * 1024 * 1024) {
          message.textContent = "Escolha uma imagem de até 2 MB.";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (artEditor !== dialog) return;
          draft[key] = reader.result;
          url.value = "";
          url.placeholder = "Imagem carregada do computador";
          message.textContent = "";
          refresh();
        };
        reader.onerror = () => {
          message.textContent = "Não foi possível carregar essa imagem.";
        };
        reader.readAsDataURL(chosen);
      });
      const reset = button("×", () => {
        delete draft[key];
        url.value = "";
        url.placeholder = "URL da imagem";
        file.value = "";
        message.textContent = "";
        refresh();
      }, "xmb-art-options-button");
      reset.type = "button";
      reset.classList.add("xmb-art-options-clear-button");
      reset.setAttribute("aria-label", "Restaurar " + caption + " padrão");
      reset.title = "Restaurar " + caption + " padrão";
      const mediaActions = el("div", "xmb-art-options-media-actions");
      mediaActions.append(chooseFile, reset);
      field.append(url, file, mediaActions);
      form.append(field);
    }
    form.append(message);
    const save = button("Salvar", () => {}, "xmb-art-options-button");
    save.type = "submit";
    const cancel = button("Cancelar · B / Select", () => dialog.close(), "xmb-art-options-button");
    cancel.type = "button";
    const actions = el("div", "xmb-art-options-actions");
    actions.append(save, cancel);
    form.append(actions);
    form.addEventListener("keydown", (event) => {
      if (event.target === preview && event.key.startsWith("Arrow")) {
        event.preventDefault();
        if (positioningCover) {
          nudge(event.key.slice(5).toLowerCase());
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          focusArtEditorControl(dialog, preview, event.key === "ArrowUp" ? -1 : 1);
        }
        return;
      }
      if (event.target === preview && event.key === "Enter") {
        event.preventDefault();
        dialog.toggleCoverPositioning();
        return;
      }
      if (event.key === "Enter" && event.target?.matches('input[type="text"]')) {
        event.preventDefault();
      }
    });
    preview.addEventListener("blur", () => setCoverPositioning(false));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      for (const key of ["image", "background"]) {
        if (draft[key] && !/^(https?:\/\/|data:image\/|\/)/i.test(draft[key])) {
          message.textContent = "Use uma URL HTTP/HTTPS ou escolha um arquivo de imagem.";
          return;
        }
      }
      try {
        window.CollectionActions.updateItem(item.id, { xmbArt: draft, featured: check.checked });
        dialog.close();
        render();
        restorePosition();
        list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      } catch (error) {
        message.textContent = error.message;
      }
    });
    dialog.append(form);
    root.append(dialog);
    artEditor = dialog;
    dialog.addEventListener("close", () => {
      artEditor = null;
      dialog.remove();
      updateHints();
      (
        origin?.isConnected ? origin : list.querySelector('[aria-pressed="true"]')
      )?.focus({ preventScroll: true });
    });
    refresh();
    dialog.showModal();
    dialog.querySelector('input[type="text"]')?.focus({ preventScroll: true });
    updateHints();
  }
  function optionsAction(action) {
    if (action === "back" || action === "select" || action === "menu") {
      artEditor.close();
      return;
    }
    const controls = [
      ...artEditor.querySelectorAll(
        'input:not([type="file"]),button,.xmb-art-options-cover-adjust',
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
      current?.matches(".xmb-art-options-cover-adjust") &&
      ["up", "down", "left", "right"].includes(action)
    ) {
      if (artEditor.dataset.coverPositioning === "true") {
        artEditor.nudgeCover?.(action);
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
      const row = current?.closest(".xmb-art-options-media-actions,.xmb-art-options-actions");
      const buttons = [...(row?.querySelectorAll("button") || [])];
      const buttonIndex = buttons.indexOf(current);
      if (buttonIndex >= 0) {
        focusOption(buttons[buttonIndex + (action === "right" ? 1 : -1)]);
      }
    } else if (action === "primary") {
      if (current?.matches(".xmb-art-options-cover-adjust")) {
        artEditor.toggleCoverPositioning?.();
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
      if (action === "up" && selection() === 0 && !nowEntry.hidden) {
        entryFocused = true;
        nowEntry.tabIndex = 0;
        nowEntry.focus({ preventScroll: true });
        return;
      }
      selectItem(selection() + (action === "down" ? 1 : -1));
    }
  }
  window.addEventListener("xmb:action", (event) => {
    if (active) {
      inputMode = "gamepad";
      updateHints();
      semantic(event.detail);
    }
  });
  window.addEventListener("xmb:inputmode", (event) => {
    inputMode = event.detail;
    if (active) {
      updateHints();
    }
  });
  for (const type of ["spaceamp:trackchange", "spaceamp:playstate"]) {
    window.addEventListener(type, updateNowEntry);
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
    if (!active || !handoffContext) {
      return;
    }
    const saved = handoffContext;
    handoffContext = null;
    category = saved.category;
    area = saved.area;
    foldersLevel = saved.foldersLevel;
    folderDepth = saved.folderDepth === true;
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
    nav.inert = folderDepth || detailsLevel;
    list.scrollTop = saved.listScroll;
    nav.scrollLeft = saved.navScroll;
    detail.scrollTop = saved.detailScroll;
    entryFocused = saved.entryFocused;
    (saved.focus?.isConnected &&
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
    help.textContent = "↑ ↓ rolar detalhes · O página completa · Esc / Backspace voltar";
    renderDetail(item);
    detail.scrollTop = 0;
    detail.tabIndex = 0;
    detail.focus({ preventScroll: true });
    announcement.textContent = "Detalhes · " + title(item);
    updateHints();
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
        updateHints();
        return;
      }
      if (folderTransition.direction === "exit" && !folderTransition.committed) {
        return;
      }
      settleFolderTransition();
    }
    if (!detailsLevel) {
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
    backButton.textContent =
      categories.find(([key]) => key === area)[2].length > 1
        ? "[ pastas · Esc ]"
        : "[ sair · Esc ]";
    updateHints();
    const rows = entries();
    renderDetail(rows[selection(rows)]);
    detail.scrollTop = previewScroll;
    if (!folderDepth && !foldersLevel) revealSelection(false);
    (list.querySelector('[aria-pressed="true"]') || categoryButtons.get(area)).focus({
      preventScroll: true,
    });
    announcement.textContent = `${categoryButtons.get(area).textContent} · ${rows.length ? title(rows[selection(rows)]) : "sem itens"}`;
  }
  function openPage() {
    if (foldersLevel) return;
    const rows = entries();
    const item = rows[selection(rows)];
    const key = category;
    if (!item) {
      return;
    }
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
    artEditor?.close();
    if (!active) {
      return;
    }
    settleFolderTransition();
    active = false;
    folderDepth = false;
    root.dataset.folderDepth = "false";
    session++;
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
    updateClock();
    detailsLevel = false;
    folderDepth = false;
    root.dataset.level = "root";
    nav.inert = false;
    list.inert = false;
    detail.tabIndex = -1;
    backButton.textContent = "[ sair · Esc ]";
    help.textContent = rootHelp;
    const token = ++session;
    category = Object.hasOwn(Collection.kinds, getFilters().kind) ? getFilters().kind : category;
    area = categories.find(([, , kinds]) => kinds.includes(category))[0];
    folders.set(area, category);
    remembered.set("folders:" + area, category);
    foldersLevel = false;
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
        if (!folderDepth && !foldersLevel && !detailsLevel) revealSelection(false);
      }
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
        if (["s", "S"].includes(event.key) && !event.target?.matches("input")) {
          event.preventDefault();
          artEditor.close();
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
      updateHints();
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
