/* Camada visual dos editores; usa os mesmos formulários e salvamento. */
(() => {
  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls || "";
    if (text) n.textContent = text;
    return n;
  };
  const action = (text, fn, cls = "small") => {
    const b = node("button", cls, text);
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  function tabs(body, groups) {
    const bar = node("div", "editor-tabs");
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Seções do editor");
    const panels = [],
      buttons = [];
    function select(index) {
      panels.forEach((panel, i) => {
        panel.hidden = i !== index;
        buttons[i].setAttribute("aria-selected", String(i === index));
        buttons[i].tabIndex = i === index ? 0 : -1;
      });
    }
    groups.forEach((group, index) => {
      const panel = node("div", "editor-tab-panel");
      panel.id = "editor-panel-" + group.id;
      panel.setAttribute("role", "tabpanel");
      const b = action(group.title, () => select(index), "");
      b.id = "editor-tab-" + group.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", panel.id);
      panel.setAttribute("aria-labelledby", b.id);
      b.onkeydown = (event) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % groups.length;
        else if (event.key === "ArrowLeft")
          next = (index - 1 + groups.length) % groups.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = groups.length - 1;
        else return;
        event.preventDefault();
        select(next);
        buttons[next].focus();
      };
      panel.append(...group.nodes.filter(Boolean));
      bar.append(b);
      panels.push(panel);
      buttons.push(b);
    });
    const before =
      body.querySelector("#formError") ||
      body.querySelector(".error") ||
      body.querySelector(".form-actions");
    body.insertBefore(bar, before);
    for (const panel of panels) body.insertBefore(panel, before);
    select(0);
    return select;
  }
  function label(form, name) {
    return form.elements.namedItem(name)?.parentElement;
  }
  function details(title, children, cls = "editor-details") {
    const d = node("details", cls);
    d.append(node("summary", "", title), ...children.filter(Boolean));
    return d;
  }
  function decorateCollection(form, item) {
    const body = form.querySelector(".editor-body");
    body.classList.add("collection-editor");
    const content = node("div", "item-editor-layout"),
      coverColumn = node("div", "item-editor-cover"),
      fields = node("div", "item-editor-fields");
    const file = form.elements.namedItem("imageFile"),
      url = form.elements.namedItem("imageUrl"),
      clear = form.elements.namedItem("clearImage");
    const preview = node("div", "cover-preview"),
      img = node("img"),
      placeholder = node("span", "", "sem capa");
    img.alt = "Prévia da capa";
    img.hidden = true;
    preview.append(img, placeholder);
    let previewObject = "";
    function show(src) {
      img.hidden = !src;
      placeholder.hidden = !!src;
      if (src) img.src = src;
      else img.removeAttribute("src");
    }
    img.onerror = () => {
      img.hidden = true;
      placeholder.hidden = false;
      placeholder.textContent = "não consegui abrir a capa";
    };
    show(item?.image || "");
    const choose = action("trocar capa", () => file.click());
    const catalogImage = form.elements.namedItem("catalogImage");
    const restore = action("restaurar capa original", () => {
      const original = safeUrl(catalogImage.value);
      if (!original) return;
      file.value = "";
      if (previewObject) URL.revokeObjectURL(previewObject);
      previewObject = "";
      clear.checked = false;
      url.value = original;
      show(original);
    }, "small restore-catalog-cover");
    restore.hidden = !safeUrl(catalogImage.value);
    file.parentElement.classList.add("cover-file-field");
    file.onchange = () => {
      const f = file.files[0];
      if (!f) return;
      if (previewObject) URL.revokeObjectURL(previewObject);
      previewObject = URL.createObjectURL(f);
      clear.checked = false;
      show(previewObject);
    };
    url.oninput = () => {
      restore.hidden = !safeUrl(catalogImage.value);
      const value = safeUrl(url.value);
      if (value) {
        file.value = "";
        if (previewObject) URL.revokeObjectURL(previewObject);
        previewObject = "";
        clear.checked = false;
        show(value);
      } else if (!file.files.length) show(item?.image || "");
    };
    clear.onchange = () =>
      show(
        clear.checked
          ? ""
          : previewObject || safeUrl(url.value) || item?.image || "",
      );
    const coverOptions = details(
      "link / remover capa",
      [label(form, "imageUrl"), label(form, "clearImage")],
      "editor-details cover-options",
    );
    const layout = form.elements.namedItem("coverLayout");
    const layoutHint = node("p", "hint");
    const updateLayout = () => {
      preview.dataset.layout = layout.value;
      preview.dataset.kind = form.elements.namedItem("kind")?.value || item?.kind || "";
      const original = form.elements.namedItem(layout.value === "horizontal" ? "horizontalImage" : "verticalImage").value;
      const hasAlternatives = form.elements.namedItem("verticalImage").value || form.elements.namedItem("horizontalImage").value;
      if (hasAlternatives) {
        catalogImage.value = safeUrl(original);
        layoutHint.textContent = original ? "" : "Este formato não está disponível no catálogo. Você pode escolher uma imagem própria.";
      }
      restore.hidden = !safeUrl(catalogImage.value);
    };
    form.elements.namedItem("kind")?.addEventListener("change",updateLayout);
    layout.onchange = () => {
      const current = url.value || item?.image || "";
      const originals = [catalogImage.value, item?.catalogImage, form.elements.namedItem("verticalImage").value, form.elements.namedItem("horizontalImage").value].filter(Boolean);
      const useOriginal = !current || originals.includes(current);
      updateLayout();
      if (!file.files.length && !clear.checked && useOriginal && !restore.hidden) restore.click();
    };
    updateLayout();
    coverColumn.append(preview, label(form, "coverLayout"), layoutHint, choose, restore, label(form, "imageFile"), coverOptions);
    if (item?.localizedCoverImages?.length) {
      const region = node('select'); region.setAttribute('aria-label', 'Capa regional IGDB');
      region.append(new Option('Capa original do catálogo', item.verticalImage || item.catalogImage || item.image || ''));
      item.localizedCoverImages.forEach((image, index) => region.append(new Option(item.localizedCoverLabels?.[index] || 'Capa ' + (index + 1), image)));
      region.onchange = () => {
        const selected = safeUrl(region.value); if (!selected) return;
        file.value = ''; clear.checked = false; layout.value = 'vertical'; updateLayout(); url.value = selected; show(selected);
      };
      coverColumn.append(region);
    }
    const title = label(form, "title"),
      kind = label(form, "kind");
    title.classList.add("item-title-field");
    const identity = node("div", "item-identity");
    identity.append(title, kind);
    const status = form.elements.namedItem("status"),
      statusLabel = label(form, "status"),
      chips = node("div", "status-choices");
    status.hidden = true;
    for (const [value, text] of Object.entries(Collection.statuses)) {
      const b = action(
        text,
        () => {
          status.value = value;
          refreshStatus();
        },
        "",
      );
      b.dataset.status = value;
      chips.append(b);
    }
    statusLabel.append(chips);
    function refreshStatus() {
      for (const b of chips.children)
        b.setAttribute(
          "aria-pressed",
          String(status.value === b.dataset.status),
        );
    }
    refreshStatus();
    status.onchange = refreshStatus;
    const progress = node("div", "form-grid");
    progress.append(label(form, "progress"), label(form, "total"));
    const evaluation = node("div", "form-grid");
    evaluation.append(label(form, "unit"), label(form, "score"));
    const tracking = details("progresso, nota e plataforma", [
      progress,
      evaluation,
      label(form, "platform"),
    ]);
    const notes = details("notas e link", [
      label(form, "startedAt"),
      label(form, "finishedAt"),
      label(form, "lists"),
      label(form, "notes"),
      label(form, "url"),
    ]);
    fields.append(identity, statusLabel, label(form, "featured"), tracking, notes);
    content.append(coverColumn, fields);
    body.insertBefore(content, body.querySelector(".error"));
    form.querySelector("button[type=submit]").textContent = item?.id
      ? "salvar alterações"
      : "adicionar à coleção";
    const stopCatalog = attachCatalog(form, item, content);
    $("resourceEditor").onclose = () => {
      stopCatalog();
      if (previewObject) URL.revokeObjectURL(previewObject);
    };
    // Um erro em campo recolhido abre a seção antes da validação nativa.
    form.addEventListener(
      "invalid",
      (event) => {
        let parent = event.target.parentElement;
        while (parent && parent !== form) {
          if (parent.tagName.toLowerCase() === "details") parent.open = true;
          parent = parent.parentElement;
        }
      },
      true,
    );
  }
  function attachCatalog(form, item, content) {
    if (!window.Catalog) return () => {};
    const body = form.querySelector(".editor-body"),
      submit = form.querySelector("button[type=submit]"),
      kind = form.elements.namedItem("kind");
    const picker = node("section", "catalog-picker"),
      heading = node("h3", "", "O que você quer adicionar?"),
      bar = node("div", "catalog-searchbar");
    const category = node("select");
    category.setAttribute("aria-label", "Tipo de mídia");
    for (const [value, text] of Object.entries(Collection.kinds))
      category.append(new Option(text, value));
    category.value = kind.value;
    const gameProvider = node("select");
    gameProvider.setAttribute("aria-label", "Catálogo de jogos");
    gameProvider.append(new Option("Steam", "steam"), new Option("IGDB (opcional)", "igdb"));
    gameProvider.value = "steam";
    gameProvider.hidden = kind.value !== "game";
    const search = node("input");
    search.type = "search";
    search.placeholder = "Digite o nome de um título";
    search.maxLength = 120;
    search.setAttribute("aria-label", "Buscar título no catálogo");
    const status = node("p", "catalog-status"),
      results = node("div", "catalog-results"),
      selected = node("div", "catalog-selected");
    selected.hidden = true;
    status.setAttribute("role", "status");
    let controller,
      revision = 0,
      selectedId = "";
    const run = action("buscar", runSearch),
      manual = action(
        "adicionar manualmente",
        () => {
          content.hidden = false;
          submit.hidden = false;
          results.replaceChildren();
          selected.hidden = true;
          clearAttribution();
          form.elements.namedItem("title").value = search.value.trim();
          form.elements.namedItem("title").focus();
        },
        "catalog-manual",
      );
    const context = node('select'); context.setAttribute('aria-label','Buscar por');
    function updateContext() {
      context.replaceChildren(new Option('Nome do título / artista',''));
      if (category.value === 'artist') context.append(new Option('Música conhecida','song'));
      if (category.value === 'book') context.append(new Option('Autor','author'));
      context.value = ''; context.hidden = !['artist','book'].includes(category.value);
      search.placeholder = category.value === 'artist' ? 'Nome do artista ou música conhecida' : category.value === 'book' ? 'Título ou autor' : 'Digite o nome de um título';
    }
    updateContext();
    const platform = node('input'); platform.placeholder = 'Plataforma (opcional, IGDB)'; platform.setAttribute('aria-label','Filtrar jogos por plataforma'); platform.hidden = category.value !== 'game'; platform.maxLength = 80;
    bar.append(category, gameProvider, context, search, platform, run);
    picker.append(heading, bar, status, results, selected, manual);
    body.insertBefore(picker, content);
    if (!item) {
      content.hidden = true;
      submit.hidden = true;
    } else {
      const fold = node("details", "catalog-existing"),
        summary = node("summary", "", "buscar outro título");
      fold.append(summary, picker);
      body.insertBefore(fold, content);
      search.value = item.title;
    }
    const provider = () => {
      status.textContent =
        category.value === "game"
          ? "Catálogo: " + (gameProvider.value === "igdb" ? "IGDB · requer credenciais locais da Twitch." : "Steam · jogos disponíveis na loja.")
          : category.value === "other"
            ? "Busca geral na Wikipedia."
            : "Catálogo: " + (Catalog.names[category.value] || "Wikipedia");
    };
    provider();
    function cancel() {
      revision++;
      controller?.abort();
      run.disabled = false;
    }
    async function runSearch() {
      const query = search.value.trim();
      cancel();
      if (query.length < 2) {
        status.textContent = "Digite pelo menos 2 caracteres.";
        return;
      }
      const token = revision;
      controller = new AbortController();
      run.disabled = true;
      status.textContent = "Buscando…";
      selected.hidden = true;
      const activeController = controller;
      const timer = setTimeout(() => activeController.abort(), 20000);
      try {
        let items = await Catalog.search(category.value, query, {
          signal: controller.signal,
          provider: gameProvider.value,
          context: context.value,
        });
        if (category.value === 'game' && platform.value.trim()) {
          const needle = platform.value.trim().toLowerCase();
          const enriched = await Promise.all(items.map(async item => { if (!item.platforms?.length) { try { return await Catalog.details(item, { signal: controller.signal }); } catch { return item; } } return item; }));
          items = enriched.filter(item => (item.platforms || []).some(value => String(value).toLowerCase().includes(needle)));
        }
        if (token !== revision) return;
        status.textContent = items.length
          ? "Escolha o título abaixo."
          : "Não encontrei esse título. Tente outro nome ou adicione manualmente.";
        results.replaceChildren();
        const resultTarget=CatalogUI.resultTarget(items,results);
        for (const result of items) {
          const resultParent=resultTarget(result);
          const b = action("", () => {
            if (window.TitlePages) {
              $("resourceEditor").close();
              TitlePages.open(result);
            } else choose(result);
          }, "catalog-result");
          b.dataset.kind = result.kind;
          if (result.image) {
            const img = node("img");
            img.src = result.image;
            img.alt = "";
            img.loading = "lazy";
            const fallback = node('span', 'catalog-no-cover', '—'); fallback.hidden = true;
            let retried = false;
            img.onerror = () => {
              if (!retried && safeUrl(result.imageFallback, true) && result.imageFallback !== img.src) { retried = true; img.src = result.imageFallback; return; }
              img.hidden = true; fallback.hidden = false;
            };
            b.append(img, fallback);
          } else b.append(node("span", "catalog-no-cover", "—"));
          const text = node("span");
          text.append(
            node("strong", "", result.title),
            node("small", "", Catalog.describe(result)),
          );
          b.append(text);
          resultParent.append(b);
        }
      } catch (e) {
        if (token !== revision) return;
        status.textContent =
          e.name === "AbortError"
            ? "A busca demorou demais. Tente novamente ou adicione manualmente."
            : "Não foi possível buscar agora. Tente novamente ou adicione manualmente.";
        if(e.name !== "AbortError") console.warn("Catalog search failed",e);
      } finally {
        clearTimeout(timer);
        if (token === revision) {
          run.disabled = false;
        }
      }
    }
    function choose(result) {
      cancel();
      selectedId = result.catalogId;
      for (const [key, value] of Object.entries({
        title: result.title,
        kind: result.kind,
        imageUrl: result.image,
        catalogImage: result.image,
        url: result.url,
        total: result.total || 0,
        unit: result.unit,
        catalogId: result.catalogId,
        source: result.source,
      })) {
        const field = form.elements.namedItem(key);
        if (field) field.value = String(value);
      }
      form.elements.namedItem("clearImage").checked = !result.image;
      form.elements.namedItem("imageFile").value = "";
      form.elements.namedItem("imageUrl").oninput?.();
      form.elements.namedItem("clearImage").onchange?.();
      category.value = result.kind;
      content.hidden = false;
      submit.hidden = false;
      results.replaceChildren();
      selected.replaceChildren(node("span", "", "✓ " + result.title));
      const credit = node("a", "catalog-credit", result.source);
      credit.href = result.url;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      selected.append(credit);
      selected.hidden = false;
      status.textContent = "";
      manual.hidden = true;
      heading.textContent = "Título selecionado";
    }
    search.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    };
    search.oninput = () => {
      cancel();
      results.replaceChildren();
      provider();
      manual.hidden = false;
      if (selectedId) {
        heading.textContent = "O que você quer adicionar?";
        selected.hidden = true;
      }
    };
    function clearAttribution() {
      selectedId = "";
      for (const key of ["catalogId", "catalogImage", "source", "verticalImage", "horizontalImage"])
        form.elements.namedItem(key).value = "";
      content.querySelector(".restore-catalog-cover").hidden = true;
      selected.hidden = true;
    }
    form.elements.namedItem("title").oninput = clearAttribution;
    const previousKind = kind.onchange;
    kind.onchange = () => {
      gameProvider.hidden = kind.value !== "game";
      clearAttribution();
      previousKind?.();
      category.value = kind.value;
      updateContext(); platform.hidden = category.value !== 'game'; platform.value = '';
      cancel();
      results.replaceChildren();
      provider();
    };
    category.onchange = () => {
      updateContext(); platform.hidden = category.value !== 'game'; platform.value = '';
      gameProvider.hidden = category.value !== "game";
      kind.value = category.value;
      clearAttribution();
      previousKind?.();
      cancel();
      results.replaceChildren();
      provider();
      manual.hidden = false;
    };
    gameProvider.onchange = () => { cancel(); results.replaceChildren(); provider(); };
    return cancel;
  }
  function decorateAppearance(form) {
    const body = form.querySelector(".editor-body");
    const source = form.elements.namedItem('xmbSource');
    const sourceLabel = label(form, 'xmbSource');
    source.hidden = true;
    const choices = node('fieldset');
    choices.append(node('legend', '', 'Fundo do XMB'));
    const radios = [];
    for (const [value, title] of [['artwork', 'Artwork do item'], ['inherit', 'Usar aparência global'], ['custom', 'Personalizar XMB']]) {
      const row = node('label', 'check-label', title), radio = node('input');
      radio.type = 'radio'; radio.name = 'xmb-source-choice'; radio.value = value;
      radio.checked = source.value === value;
      radio.onchange = () => { source.value = value; update(); };
      radios.push(radio); row.prepend(radio); choices.append(row);
    }
    sourceLabel.hidden = true;
    sourceLabel.parentElement.append(choices);
    function update() {
      radios.forEach(radio => radio.checked = radio.value === source.value);
      for (const key of ['xmbUrl','xmbFile','xmbClear','xmbMode','xmbUseColor','xmbColor']) label(form, key).hidden = source.value !== 'custom';
      label(form, 'xmbGhostEnabled').hidden = source.value !== 'artwork';
      label(form, 'xmbGhostOpacity').hidden = source.value !== 'artwork' || !form.elements.namedItem('xmbGhostEnabled').checked;
      label(form, 'xmbArtworkIntensity').hidden = source.value !== 'artwork';
      label(form, 'xmbColor').hidden = source.value !== 'custom' || !form.elements.namedItem('xmbUseColor').checked;
    }
    source.onchange = update;
    form.elements.namedItem('xmbGhostEnabled').onchange = update;
    form.elements.namedItem('xmbUseColor').onchange = update;
    update();
    tabs(body, [
      { id: 'xmb', title: '// XMB', nodes: [choices, ...['xmbSource','xmbUrl','xmbFile','xmbClear','xmbMode','xmbUseColor','xmbColor','xmbTransparency','xmbArtworkIntensity','xmbGhostEnabled','xmbGhostOpacity'].map(k => label(form, k))] },
      {
        id: "background",
        title: "Fundo",
        nodes: [
          "backgroundFile",
          "backgroundUrl",
          "backgroundMode",
          "clearBackground",
        ].map((k) => label(form, k)),
      },
      {
        id: "style",
        title: "Estilo",
        nodes: ["layoutWidth", "cornerRadius", "font", "borderStyle", "opacity", "bannerHeight"].map((k) =>
          label(form, k),
        ),
      },
      {
        id: 'profile', title: 'Perfil',
        nodes: ['profileLayout', 'avatarShape', 'avatarBorder', 'profileWindowBorder'].map(k => label(form, k)),
      },
      {
        id: "colors",
        title: "Cores",
        nodes: [
          "useColors",
          "backgroundColor",
          "panelColor",
          "textColor",
          "accentColor",
          "borderColor",
        ].map((k) => label(form, k)),
      },
    ]);
  }
  // Perfil: os campos permanecem no mesmo form, divididos por intenção.
  const form = $("profileForm"),
    body = form.querySelector(".editor-body");
  const identity = label(form, "name").parentElement,
    avatar = $("avatarFile").parentElement.parentElement,
    theme = form.querySelector("fieldset"),
    music = $("musicFields");
  const selectProfile = tabs(body, [
    {
      id: "profile",
      title: "Perfil",
      nodes: [
        identity,
        label(form, "bio"),
        label(form, "interests"),
        label(form, "wall"),
      ],
    },
    { id: "images", title: "Imagens e tema", nodes: [avatar, theme] },
    { id: "music", title: "Música", nodes: [music] },
  ]);
  for (const hint of Array.from(body.children).filter(
    (n) => n.className === "hint",
  ))
    hint.remove();
  const originalOpen = openEditor;
  openEditor = function (section) {
    selectProfile(section === "music" ? 2 : section === "images" ? 1 : 0);
    originalOpen(section);
  };
  $("editBanner").onclick = () => openEditor("images");
  form.addEventListener(
    "invalid",
    (event) => {
      let parent = event.target.parentElement;
      while (parent && parent !== form) {
        if (parent.id === "editor-panel-profile") selectProfile(0);
        if (parent.id === "editor-panel-images") selectProfile(1);
        if (parent.id === "editor-panel-music") selectProfile(2);
        parent = parent.parentElement;
      }
    },
    true,
  );
  window.EditorUI = { decorateCollection, decorateAppearance };
})();
