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
  const scrolling = new Map();
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
    stopScroll(list);
    positions.set(selectionKey(), { list: list.scrollTop, detail: detail.scrollTop });
  }
  function restorePosition() {
    const saved = positions.get(selectionKey());
    if (saved) {
      list.scrollTop = saved.list;
      detail.scrollTop = saved.detail;
    }
  }
  function openFolder(kind) {
    rememberPosition();
    invalidateHandoff();
    folders.set(area, kind);
    category = kind;
    foldersLevel = false;
    render({ focus: true });
    restorePosition();
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
      backdrop.hidden = true;
      artworkGap = true;
      detail.append(el("h2", "", item.title));
      detail.append(el("p", "xmb-folder-hint", "Enter / A para abrir · Esc / B para voltar"));
      detail.append(button("[ abrir pasta ]", () => openFolder(item.folder), "xmb-open"));
      return;
    }
    if (!item) {
      artworkGap = true;
      backdrop.hidden = true;
      return;
    }
    const heading = el("h2", "", title(item));
    detail.append(heading);
    const image = category === "profile" ? item.avatar : item.image;
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
    const atmosphere = artworkSource({ cover: image });
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
    function fact(label, value) {
      if (Array.isArray(value)) {
        value = value.join(", ");
      }
      if (value == null || value === "") {
        return;
      }
      facts.append(el("dt", "", label), el("dd", "", String(value)));
    }
    if (category === "profile") {
      fact("Local", item.location);
      fact("Mood", item.mood);
      fact("Interesses", item.interests);
    } else if (category !== "photos") {
      fact("Tipo", Collection.kinds[item.kind]);
      fact("Status", Collection.statuses[item.status]);
      if (item.progress || item.total) {
        fact(
          "Progresso",
          `${item.progress || 0}${item.total ? " / " + item.total : ""}${item.unit ? " " + item.unit : ""}`,
        );
      }
      fact("Nota pessoal", item.score);
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
        fact(label, item[key]);
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
    list.replaceChildren();
    rows.forEach((item, index) => {
      const row = button(title(item), () => selectItem(index), "xmb-item");
      if (item.folder) {
        row.dataset.folder = item.folder;
        const icon = el("span", "xmb-folder-icon", "▱");
        icon.setAttribute("aria-hidden", "true");
        row.append(icon);
      }
      const cover = category === "profile" ? item.avatar : item.image;
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
    root.dataset.level = detailsLevel ? "details" : foldersLevel ? "folders" : "root";
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
    revealSelection(false);
    updateHints();
  }
  // A rolagem lê duração e curva dos tokens existentes; cada eixo cancela o movimento anterior.
  function stopScroll(node) {
    const frame = scrolling.get(node);
    if (frame != null) {
      window.cancelAnimationFrame?.(frame);
    }
    scrolling.delete(node);
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
      }
    };
    scrolling.set(node, window.requestAnimationFrame(tick));
  }
  function updateHorizontalAxis() {
    const control = categoryButtons.get(area);
    if (!nav.style?.setProperty || !control.offsetWidth) {
      return;
    }
    const index = categories.findIndex(([key]) => key === area);
    const shift = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 0
      : Math.max(-12, Math.min(12, ((categories.length - 1) / 2 - index) * 3));
    nav.style.setProperty("--xmb-axis-shift", shift + "px");
    nav.style.setProperty(
      "--xmb-indicator-x",
      control.offsetLeft + control.offsetWidth * 0.54 + shift + 3 - 9 + "px",
    );
  }
  function revealSelection(smooth = true) {
    const row = list.querySelector('[aria-pressed="true"]');
    if (!row) {
      return;
    }
    // Apenas o scroller interno; não movimenta a página que ficará por baixo.
    // Uma margem curta acomoda a escala e mantém vizinhos próximos do foco.
    const top = Math.max(0, row.offsetTop - 12);
    const bottom = row.offsetTop + row.offsetHeight + 12;
    const target =
      top < list.scrollTop
        ? top
        : bottom > list.scrollTop + list.clientHeight
          ? bottom - list.clientHeight
          : list.scrollTop;
    moveScroll(
      list,
      Math.max(
        0,
        Math.min(target, Math.max(0, (list.scrollHeight || list.clientHeight) - list.clientHeight)),
      ),
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
    const kinds = categories.find(([candidate]) => candidate === key)[2];
    foldersLevel = kinds.length > 1;
    category = folders.get(area) || kinds[0];
    detailsLevel = false;
    nav.inert = false;
    list.inert = false;
    render({ focus: true });
    restorePosition();
    const control = categoryButtons.get(key);
    if (!nav.clientWidth) {
      return;
    }
    const left = Math.max(0, control.offsetLeft - 20);
    const right = control.offsetLeft + control.offsetWidth + 24;
    const target =
      left < nav.scrollLeft
        ? left
        : right > nav.scrollLeft + nav.clientWidth
          ? right - nav.clientWidth
          : nav.scrollLeft;
    moveScroll(
      nav,
      nav.scrollTop || 0,
      Math.max(
        0,
        Math.min(target, Math.max(0, (nav.scrollWidth || nav.clientWidth) - nav.clientWidth)),
      ),
    );
  }
  function updateHints() {
    root.dataset.inputMode = inputMode;
    help.textContent =
      inputMode === "gamepad"
        ? detailsLevel
          ? "↑ ↓ rolar · B voltar · Y página completa"
          : foldersLevel
            ? "D-pad / stick navegar · A abrir pasta · B sair · Options Quick Menu"
            : "D-pad / stick navegar · A ação/tocar · B voltar · X detalhes · Y página completa · Options Quick Menu"
        : detailsLevel
          ? "↑ ↓ rolar detalhes · O página completa · Esc / Backspace voltar"
          : foldersLevel
            ? "← → áreas · ↑ ↓ pastas · Enter abrir pasta · Esc sair"
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
  function semantic(action) {
    if (!active || window.SpaceAmpNowPlaying?.isOpen()) {
      return;
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
    if (!detailsLevel) {
      if (!foldersLevel && categories.find(([key]) => key === area)[2].length > 1) {
        rememberPosition();
        invalidateHandoff();
        foldersLevel = true;
        remembered.set(selectionKey(), category);
        render({ focus: true });
        restorePosition();
        return;
      }
      close();
      return;
    }
    invalidateHandoff();
    detailsLevel = false;
    root.dataset.level = "root";
    nav.inert = false;
    list.inert = false;
    detail.tabIndex = -1;
    backButton.textContent =
      categories.find(([key]) => key === area)[2].length > 1
        ? "[ pastas · Esc ]"
        : "[ sair · Esc ]";
    help.textContent = rootHelp;
    const rows = entries();
    renderDetail(rows[selection(rows)]);
    detail.scrollTop = previewScroll;
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
    if (!active) {
      return;
    }
    active = false;
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
  document.addEventListener("visibilitychange", () => {
    if (active) {
      updateClock();
    }
  });
  document.addEventListener(
    "keydown",
    (event) => {
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
