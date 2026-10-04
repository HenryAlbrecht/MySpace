(() => {
  const node = (tag, text = "", cls = "") => {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = cls;
    return element;
  };
  const page = node("section", "", "page-view panel personalized-discovery");
  page.id = "personalizedDiscovery";
  page.hidden = true;
  const head = node("div", "", "section-head");
  head.append(node("h2", "para descobrir"));
  const intro = node(
    "p",
    "Sugestões a partir dos seus favoritos, gêneros e títulos da coleção.",
    "title-notice",
  );
  const loadButton = node("button", "carregar sugestões", "small");
  loadButton.type = "button";
  const status = node(
    "p",
    "Carregue sugestões para explorar títulos a partir da sua coleção.",
    "title-notice",
  );
  status.setAttribute("role", "status");
  const grid = node("div", "", "media-related-grid discovery-grid");
  let suggestions = [],
    dismissed = new Set();
  let rotation = 0,
    loadGeneration = 0;
  try {
    rotation = Number(sessionStorage.getItem("myspace-discovery-rotation")) || 0;
  } catch {}
  try {
    const stored = JSON.parse(localStorage.getItem("myspace-discovery-dismissed") || "[]");
    if (Array.isArray(stored))
      dismissed = new Set(stored.filter((key) => typeof key === "string").slice(0, 2000));
  } catch {}
  const identity = (item) => item.kind + ":" + item.catalogId;
  const filter = node("select", "", "discography-filter");
  filter.setAttribute("aria-label", "Tipo de sugestão");
  for (const [key, label] of Object.entries({ all: "Todas as mídias", ...Collection.kinds }))
    filter.append(new Option(label, key));
  filter.value = "all";
  filter.onchange = () => {
    renderCards();
    load();
  };
  const restore = node("button", "rever sugestões descartadas", "small");
  restore.type = "button";
  restore.onclick = () => {
    try {
      localStorage.removeItem("myspace-discovery-dismissed");
      dismissed.clear();
      renderCards();
    } catch {
      status.textContent = "Não consegui salvar sua preferência.";
    }
  };
  const body = node("div", "", "title-about");
  body.append(intro, loadButton, filter, restore, status, grid);
  page.append(head, body);
  const cards = new Map();
  function renderCards() {
    const focused = grid.contains(document.activeElement) ? document.activeElement : null;
    grid.querySelector(":scope > .title-notice")?.remove();
    const visible = suggestions.filter(
      (item) => !dismissed.has(identity(item)) && (filter.value === "all" || item.kind === filter.value),
    );
    const retained = new Set();
    for (const [index, item] of visible.entries()) {
      const key = identity(item);
      let entry = cards.get(key);
      if (!entry) {
        const wrapper = node("article", "", "discovery-choice"),
          card = node("button", "", "discover-card");
        card.type = "button";
        const frame = node("div", "", "title-cover"),
          placeholder = node("span"),
          image = node("img"),
          title = node("strong"),
          reason = node("small");
        image.loading = "lazy";
        image.decoding = "async";
        image.alt = "";
        image.hidden = true;
        frame.append(placeholder, image);
        card.append(frame, title, reason);
        const dismiss = node("button", "não tenho interesse", "discovery-dismiss");
        dismiss.type = "button";
        entry = { wrapper, card, frame, placeholder, image, title, reason, dismiss, item };
        card.onclick = () => TitlePages.open(entry.item);
        image.onerror = () => {
          image.hidden = true;
          placeholder.hidden = false;
        };
        dismiss.onclick = () => {
          const next = new Set(dismissed);
          next.add(identity(entry.item));
          try {
            localStorage.setItem("myspace-discovery-dismissed", JSON.stringify([...next].slice(-2000)));
            dismissed = next;
            renderCards();
            if (!dismiss.isConnected) (grid.querySelector("button") || loadButton).focus();
          } catch {
            status.textContent = "Não consegui salvar sua preferência.";
          }
        };
        wrapper.append(card, dismiss);
        cards.set(key, entry);
      }
      entry.item = item;
      entry.title.textContent = item.title;
      entry.reason.textContent = item.reason || "";
      entry.frame.dataset.kind = item.kind;
      entry.placeholder.textContent = item.kind === "artist" ? "foto indisponível" : "sem capa";
      entry.dismiss.setAttribute("aria-label", "Não tenho interesse em " + item.title);
      const src = safeUrl(item.image, true);
      if (entry.image.dataset.source !== (src || "")) {
        entry.image.dataset.source = src || "";
        entry.image.hidden = !src;
        entry.placeholder.hidden = !!src;
        if (src && window.Artwork) {
          Artwork.set(entry.image, src, { error: () => {
            entry.image.hidden = true;
            entry.placeholder.hidden = false;
          } });
        } else if (src) entry.image.src = src;
        else if (window.Artwork) Artwork.clear(entry.image);
        else entry.image.removeAttribute("src");
      }
      retained.add(key);
      if (grid.children[index] !== entry.wrapper)
        grid.insertBefore(entry.wrapper, grid.children[index] || null);
    }
    for (const [key, entry] of cards)
      if (!retained.has(key)) {
        entry.wrapper.remove();
        cards.delete(key);
      }
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    restore.hidden = !dismissed.size;
    if (suggestions.length && !visible.length)
      grid.append(
        node(
          "p",
          "Nenhuma sugestão com este filtro. Escolha outra mídia ou reveja as descartadas.",
          "title-notice",
        ),
      );
  }
  document.querySelector("main").insertBefore(page, document.querySelector("footer"));
  async function load() {
    const generation = ++loadGeneration;
    loadButton.disabled = true;
    grid.setAttribute("aria-busy", "true");
    status.textContent = "Preparando sugestões…";
    try {
      const requestedKind = filter.value;
      const result = await Catalog.forCollection(CollectionActions.getItems(), {
        rotation,
        kind: requestedKind,
        shouldContinue: () => generation === loadGeneration && !page.hidden,
        partial: (items) => {
          if (generation === loadGeneration && !page.hidden && items.length) {
            suggestions = items;
            renderCards();
          }
        },
        progress: (done, total) => {
          if (generation === loadGeneration)
            status.textContent = "Consultando títulos: " + done + " / " + total;
        },
      });
      if (generation !== loadGeneration || page.hidden) return;
      if (!result.items.length && result.failures && grid.children.length) {
        status.textContent = "As fontes estão indisponíveis. Suas sugestões anteriores foram mantidas.";
        return;
      }
      const previous = suggestions;
      suggestions = [
        ...result.items.filter((item) => !previous.some((old) => identity(old) === identity(item))),
        ...result.items.filter((item) => previous.some((old) => identity(old) === identity(item))),
      ];
      renderCards();
      rotation++;
      try {
        sessionStorage.setItem("myspace-discovery-rotation", String(rotation));
      } catch {}
      status.textContent = !result.seeds
        ? requestedKind === "all"
          ? "Adicione títulos à coleção e marque seus favoritos para começar."
          : "Adicione títulos deste tipo à coleção para receber sugestões."
        : !result.items.length
          ? "Não há sugestões novas agora. Tente novamente ou adicione outros favoritos."
          : result.failures
            ? "Algumas fontes não responderam; as demais sugestões estão disponíveis."
            : "Títulos da sua coleção foram omitidos.";
    } catch (error) {
      if (generation === loadGeneration) {
        console.warn("Discovery update failed", error);
        status.textContent = grid.children.length
          ? "Não consegui atualizar agora. Suas sugestões foram mantidas. Tente novamente."
          : "Não consegui carregar sugestões agora. Tente novamente.";
      }
    } finally {
      if (generation === loadGeneration) {
        loadButton.disabled = false;
        loadButton.textContent = grid.children.length ? "atualizar sugestões" : "tentar carregar sugestões";
        grid.setAttribute("aria-busy", "false");
      }
    }
  }
  function render() {
    const hidden = !location.hash.startsWith("#descobrir");
    if (hidden && !page.hidden) {
      loadGeneration++;
      loadButton.disabled = false;
      grid.setAttribute("aria-busy", "false");
    }
    page.hidden = hidden;
  }
  restore.hidden = !dismissed.size;
  loadButton.onclick = load;
  window.addEventListener("hashchange", render);
  render();
  window.DiscoveryPage = { load, render };
})();
