/* Personalização, coleção e playlist. Tudo local, sem serviços externos. */
(() => {
  const KEY = "myspace-extras-v1",
    { kinds, statuses, validateItem } = Collection;
  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  const emptyData = () => ({
    version: 1,
    items: [],
    favorites: [],
    badges: [],
    photos: [],
    blocks: [],
    tracks: [],
    featuredVideo: {},
    appearance: {},
    visibility: {},
    sectionOrder: {},
    favoriteKind: "all",
    activeTrack: "",
    startTrack: "",
    history: [],
  });
  let data = emptyData(),
    filters = { kind: "all", status: "all", query: "", sort: "recent" };

  let playlistController, collectionView;
  let profileExtras;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.version === 1) {
      data = { ...data, ...saved };
      for (const k of ["items", "favorites", "badges", "photos", "blocks", "tracks"])
        if (!Array.isArray(data[k])) data[k] = [];
    }
  } catch {}
  function save(next = data, recordHistory = true) {
    try {
      const previous = JSON.parse(localStorage.getItem(KEY) || "{}");
      const changes = [];
      const oldItems = new Map((previous.items || []).map((item) => [item.id, item]));
      for (const item of next.items || []) {
        const old = oldItems.get(item.id);
        oldItems.delete(item.id);
        const fields = old
          ? [
              "status",
              "score",
              "progress",
              "total",
              "featured",
              "startedAt",
              "finishedAt",
              "notes",
              "lists",
            ].filter((field) => JSON.stringify(old[field]) !== JSON.stringify(item[field]))
          : ["adicionado"];
        if (fields.length)
          changes.push({
            title: item.title,
            id: item.id,
            at: Date.now(),
            fields,
            before: old ? { status: old.status, score: old.score, progress: old.progress } : null,
            after: { status: item.status, score: item.score, progress: item.progress },
          });
      }
      for (const item of oldItems.values())
        changes.push({
          title: item.title,
          id: item.id,
          at: Date.now(),
          fields: ["excluído"],
          before: { status: item.status, score: item.score, progress: item.progress },
          after: null,
        });
      next = {
        ...next,
        history: [
          ...(Array.isArray(next.history) ? next.history : []),
          ...(recordHistory ? changes : []),
        ].slice(-100),
      };
      localStorage.setItem(KEY, JSON.stringify(next));
      if (next.items !== data.items) collectionView?.invalidate();
      if (next.photos !== data.photos) profileExtras?.invalidatePhotos();
      data = next;
      return true;
    } catch {
      toast("Não foi possível salvar. Exporte seus dados e tente imagens menores.");
      return false;
    }
  }
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const button = (text, action, cls = "small") => {
    const b = el("button", cls, text);
    b.type = "button";
    b.onclick = action;
    return b;
  };
  function imageNode(src, alt) {
    const img = el("img");
    img.alt = alt;
    img.loading = "lazy";
    const failed = () => {
      img.hidden = true;
      if (img.parentElement && !img.parentElement.querySelector(".image-failed"))
        img.parentElement.append(el("span", "image-failed", "Imagem indisponível"));
    };
    if (window.Artwork) Artwork.set(img, src, { error: failed });
    else {
      img.src = src;
      img.onerror = failed;
    }
    return img;
  }
  function link(url, label) {
    const a = el("a", "", label);
    a.href = /^#[a-z][a-z0-9_-]*$/i.test(url || "") ? url : safeUrl(url) || "#";
    if (safeUrl(url)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    return a;
  }
  function section(title, id, parent, action) {
    const box = el("section", "panel");
    box.id = id;
    const head = el("div", "section-head");
    head.append(el("h3", "", title));
    if (action) head.append(button("＋ adicionar", action));
    const body = el("div");
    head.dataset.section = id;
    box.append(head, body);
    parent.append(box);
    return { box, head, body };
  }
  function move(group, id, direction) {
    const list = [...data[group]],
      index = list.findIndex((i) => i.id === id),
      next = index + direction;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    if (save({ ...data, [group]: list })) renderExtras();
  }
  const main = document.querySelector(".main-column");
  const collection = section("// minha coleção", "collection", main, () => editItem());
  main.insertBefore(collection.box, $("music").nextSibling);
  const profileInner = $("profile").querySelector(".profile-inner");
  const bannerProfile = el("div", "banner-profile");
  $("banner").append(bannerProfile);
  const nav = document.querySelector(".nav>div");
  nav.replaceChildren();
  const pageRoot = document.querySelector("main"),
    columns = document.querySelector(".columns");
  const collectionPage = el("div", "page-view");
  collectionPage.id = "collectionPage";
  collectionPage.hidden = true;
  collectionPage.append(collection.box);
  const photosPage = el("div", "page-view");
  photosPage.id = "photosPage";
  photosPage.hidden = true;
  pageRoot.insertBefore(collectionPage, document.querySelector("footer"));
  pageRoot.insertBefore(photosPage, document.querySelector("footer"));
  if (!window.location.hash && new URLSearchParams(window.location.search || "").has("party"))
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + "#spacevoice",
    );
  let spaceVoice;
  const voicePage = el("div", "page-view");
  voicePage.id = "spaceVoicePage";
  voicePage.hidden = true;
  pageRoot.insertBefore(voicePage, document.querySelector("footer"));
  for (const [route, label] of [
    ["perfil", "PERFIL"],
    ["colecao", "COLEÇÃO"],
    ["fotos", "FOTOS"],
    ["spacevoice", "PARTY"],
    ["buscar", "BUSCAR"],
    ["descobrir", "DESCOBRIR"],
  ]) {
    const a = el("a", "", "[ " + label + " ]");
    a.href = "#" + route;
    a.dataset.route = route;
    a.onclick = (event) => {
      event.preventDefault();
      navigate(route);
    };
    nav.append(a);
  }
  function navigate(page, kind = "all") {
    window.Navigation?.capture(window.location.hash || "#perfil");
    const hash = "#" + page + (page === "colecao" && kind !== "all" ? "/" + kind : "");
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      applyRoute();
    }
  }
  function applyRoute() {
    const parts = window.location.hash.replace(/^#/, "").split("/"),
      page = ["colecao", "collection"].includes(parts[0])
        ? "colecao"
        : ["fotos", "gallery"].includes(parts[0])
          ? "fotos"
          : ["buscar", "titulo", "descobrir", "spacevoice", "tag"].includes(parts[0])
            ? parts[0]
            : "perfil";
    columns.hidden = page !== "perfil";
    $("banner").hidden = page !== "perfil";
    collectionPage.hidden = page !== "colecao";
    photosPage.hidden = page !== "fotos";
    voicePage.hidden = page !== "spacevoice";
    if (page === "spacevoice") {
      if (!spaceVoice) {
        spaceVoice = createSpaceVoice({
          getProfile: () => state,
          el,
          button,
          prepareAvatar: (value) => preparePartyAvatar(value, PARTY_ROOM.MAX_AVATAR),
        });
        voicePage.append(spaceVoice.root);
      }
      spaceVoice.show();
    } else spaceVoice?.hide();
    document.body.dataset.page = page;
    for (const a of nav.children) {
      if (a.dataset.route === (["titulo", "tag"].includes(page) ? "buscar" : page))
        a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    if (page === "colecao") {
      const kind = Object.hasOwn(kinds, parts[1]) ? parts[1] : "all";
      if (filters.kind !== kind) {
        filters.kind = kind;
        filters.status = "all";
        filters.query = "";
        search.value = "";
        statusSelect.value = "all";
        collectionView.invalidate();
      }
      collectionView.ensureRendered();
      collection.head.firstChild.textContent =
        kind === "all" ? "// coleção" : "// " + kinds[kind].toLowerCase();
    }
    if (page === "fotos") profileExtras.ensureGallery();
    profileExtras.applyVisibility();
  }
  window.addEventListener("hashchange", applyRoute);
  const top = document.querySelector(".topbar"),
    topTools = el("div", "toolbar");
  topTools.append(
    button("▧ APARÊNCIA", () => editAppearance()),
    $("editTop"),
  );
  top.append(topTools);
  const resource = el("dialog");
  resource.id = "resourceEditor";
  document.body.append(resource);
  const schemaField = (name, label, type = "text", extra = {}) => ({
    name,
    label,
    type,
    ...extra,
  });
  async function prepareImage(file, max = 800, keepGif = false) {
    if (file.size > 3 * 1024 * 1024) throw Error("Use uma imagem de até 3 MB.");
    if (keepGif && file.type === "image/gif") {
      if (file.size > 1024 * 1024) throw Error("Para GIFs, use um arquivo de até 1 MB.");
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(Error("Não consegui ler o GIF."));
        r.readAsDataURL(file);
      });
    }
    return resizeImage(file, max);
  }
  function openResource({ title, group, item, fields, onSave, help = "" }) {
    resource.replaceChildren();
    const form = el("form", "resource-form"),
      bar = el("div", "titlebar");
    bar.append(
      el("span", "", title),
      button("×", () => resource.close(), ""),
    );
    const body = el("div", "editor-body");
    if (help) body.append(el("p", "note-hint", help));
    for (const field of fields) {
      const label = el("label", "", field.label);
      if (field.type === "hidden") label.hidden = true;
      let input;
      if (field.type === "select") {
        input = el("select");
        for (const [value, name] of Object.entries(field.options))
          input.append(new Option(name, value));
      } else if (field.type === "textarea") input = el("textarea");
      else {
        input = el("input");
        input.type = field.type;
      }
      input.name = field.name;
      if (field.required) input.required = true;
      if (field.maxLength) input.maxLength = field.maxLength;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step) input.step = field.step;
      if (field.accept) input.accept = field.accept;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.type === "checkbox") {
        label.classList.add("check-label");
        input.checked = !!item?.[field.name];
        label.prepend(input);
      } else {
        input.value =
          field.type === "file"
            ? ""
            : (item?.[field.name] ??
              field.default ??
              (field.type === "select" ? Object.keys(field.options)[0] : ""));
        label.append(input);
        if (field.type === "range") {
          const output = el("output", "counter", input.value + "%");
          input.oninput = () => (output.textContent = input.value + "%");
          label.append(output);
        }
      }
      body.append(label);
    }
    const error = el("p", "error");
    error.setAttribute("role", "alert");
    const controls = el("div", "form-actions");
    if (item?.id && group)
      controls.append(
        button("excluir", () => confirmDelete(group, item.id), "small dialog-delete"),
      );
    controls.append(button("cancelar", () => resource.close()));
    const submit = el("button", "primary", "salvar");
    submit.type = "submit";
    controls.append(submit);
    body.append(error, controls);
    form.append(bar, body);
    resource.append(form);
    resource.showModal();
    form.onsubmit = async (event) => {
      event.preventDefault();
      submit.disabled = true;
      error.textContent = "";
      try {
        const values = {};
        for (const f of fields) {
          const input = form.elements.namedItem(f.name);
          values[f.name] =
            f.type === "checkbox"
              ? input.checked
              : f.type === "file"
                ? input.files[0]
                : input.value.trim();
        }
        await onSave(values, item);
        resource.close();
        toast("Salvo.");
      } catch (e) {
        error.textContent = e.message || "Não foi possível salvar.";
      } finally {
        submit.disabled = false;
      }
    };
  }
  function storeItem(group, item, previous) {
    // Catalog metadata can seed the editor without representing a saved item.
    if (previous && !previous.id) previous = undefined;
    if (
      group === "items" &&
      !previous &&
      item.kind === "music" &&
      item.catalogId?.startsWith("ytmusic:")
    ) {
      const source = window.MusicModel.source(item.playbackSource);
      if (
        !window.MusicModel.validCatalogId(item.kind, item.catalogId) ||
        source?.type !== "youtube" ||
        source.videoId !== item.catalogId.split(":")[2]
      )
        throw Error("Identidade e reprodução YouTube Music incompatíveis.");
    }
    if (
      group === "items" &&
      !previous &&
      window.MusicModel?.validCatalogId(item.kind, item.catalogId)
    ) {
      previous = data.items.find(
        (row) => row.kind === item.kind && row.catalogId === item.catalogId,
      );
      if (previous)
        item = {
          ...previous,
          ...item,
          status: previous.status,
          playbackSource: previous.playbackSource || item.playbackSource,
        };
    }
    if (
      group === "items" &&
      ["music", "album", "artist"].includes(item.kind) &&
      item.catalogId &&
      !window.MusicModel?.validCatalogId(item.kind, item.catalogId) &&
      (!previous ||
        previous.catalogId !== item.catalogId ||
        !data.items.some(
          (row) =>
            row.id === previous.id &&
            row.catalogId === previous.catalogId &&
            row.kind === item.kind,
        ))
    )
      throw Error("Adicione este título pela busca musical. Itens antigos podem ser editados.");
    if (
      group === "items" &&
      !previous &&
      item.kind === "music" &&
      item.catalogId?.startsWith("ytmusic:video:")
    ) {
      previous = window.MusicModel.findRecording(data.items, item);
      if (previous)
        item = {
          ...item,
          ...previous,
          playbackSource: previous.playbackSource || item.playbackSource,
          metadataSources: {
            ...window.MusicModel.references(item),
            ...previous.metadataSources,
            youtubeMusicId: item.catalogId.split(":")[2],
          },
        };
    }
    if (
      group === "items" &&
      previous &&
      item.kind === "music" &&
      item.catalogId?.startsWith("ytmusic:video:") &&
      previous.catalogId &&
      previous.catalogId !== item.catalogId
    ) {
      item = {
        ...item,
        ...previous,
        playbackSource: previous.playbackSource || item.playbackSource,
        metadataSources: {
          ...window.MusicModel.references(item),
          ...previous.metadataSources,
          youtubeMusicId: item.catalogId.split(":")[2],
        },
      };
    }
    if (group === "items" && !previous && item.kind === "music") {
      previous = data.items.find((row) => window.MusicModel?.sameItem(row, item));
      if (previous)
        item = {
          ...previous,
          ...item,
          status: previous.status,
          playbackSource: previous.playbackSource || item.playbackSource,
          metadataSources: { ...previous.metadataSources, ...window.MusicModel.references(item) },
        };
    }
    if (group === "items") item = validateItem(item);
    if (
      group === "items" &&
      item.featured &&
      !previous?.featured &&
      data.items.filter((i) => i.featured).length >= 8
    )
      throw Error("A vitrine tem até 8 títulos. Remova um destaque antes de adicionar outro.");
    const list = [...data[group]],
      value = { ...item, id: previous?.id || uid(), updated: Date.now() };
    const index = list.findIndex((i) => i.id === value.id);
    if (index < 0) list.push(value);
    else list[index] = value;
    if (!save({ ...data, [group]: list }))
      throw Error("Armazenamento cheio. Tente uma imagem menor.");
    renderExtras();
    if (group === "items") window.TitlePages?.patchCollectionState();
    if (group === "items" && !previous && value.kind === "music" && !value.playbackSource)
      void window.MusicBridge?.autoLink(value, { openChoose: true });
    return value;
  }
  function confirmDelete(group, id) {
    const old = data[group].find((i) => i.id === id);
    if (!old) return;
    resource.replaceChildren();
    const body = el("div", "editor-body");
    body.append(
      el("h2", "", "Excluir este item?"),
      el("p", "", old.title || old.name || old.caption || "Este item será removido do seu perfil."),
    );
    const row = el("div", "form-actions");
    row.append(
      button("cancelar", () => resource.close()),
      button(
        "excluir",
        () => {
          const next = {
            ...data,
            [group]: data[group].filter((i) => i.id !== id),
          };
          if (group === "tracks") {
            if (next.startTrack === id) next.startTrack = "";
            if (next.activeTrack === id) next.activeTrack = "";
          }
          if (!save(next)) return;
          if (group === "tracks") {
            playlistController.removeMedia(id);
            if (data.tracks.length && !data.activeTrack)
              playlistController.selectTrack(data.tracks[0].id);
            else if (!data.tracks.length) playlistController.clearTrack();
          }
          renderExtras();
          if (group === "items") window.TitlePages?.patchCollectionState();
          resource.close();
        },
        "primary",
      ),
    );
    body.append(row);
    resource.append(body);
    if (!resource.open) resource.showModal();
  }
  const imageFields = [
    schemaField("imageUrl", "Link da imagem", "url"),
    schemaField("imageFile", "Ou escolha uma imagem", "file", {
      accept: "image/*",
    }),
    schemaField("clearImage", "Remover imagem", "checkbox"),
  ];
  async function resolveImage(values, previous, key = "image", max = 800, keepGif = false) {
    if (values.clearImage) return "";
    if (values.imageFile) return prepareImage(values.imageFile, max, keepGif);
    if (values.imageUrl) {
      const url = safeUrl(values.imageUrl);
      if (!url) throw Error("Use um link de imagem com http ou https.");
      return url;
    }
    return previous?.[key] || "";
  }
  profileExtras = createProfileExtrasView({
    getData: () => data,
    save,
    onChange: renderExtras,
    isGalleryActive: () => !photosPage.hidden,
    navigate,
    el,
    button,
    section,
    imageNode,
    link,
    move,
    editor: {
      openResource,
      schemaField,
      imageFields,
      resolveImage,
      storeItem,
      resource,
    },
    videoFiles: {
      read: (id) => MediaStorage.get(id),
      write: (id, file) => MediaStorage.put(id, file),
      remove: (id) => MediaStorage.remove(id),
    },
    MediaEmbeds,
    uid,
  });
  photosPage.append(profileExtras.galleryRoot);
  const normalizeSectionOrder = profileExtras.normalizeSectionOrder;
  function editItem(item) {
    openResource({
      title: item?.id ? "editar coleção" : "adicionar à coleção",
      group: "items",
      item,
      fields: [
        schemaField("catalogId", "", "hidden"),
        schemaField("catalogImage", "", "hidden"),
        schemaField("source", "", "hidden"),
        schemaField("featured", "Favorito no perfil (até 8 títulos)", "checkbox"),
        schemaField("coverLayout", "Formato da capa", "select", {
          options: { vertical: "Vertical", horizontal: "Horizontal" },
          default: "vertical",
        }),
        schemaField("verticalImage", "", "hidden"),
        schemaField("horizontalImage", "", "hidden"),
        schemaField("title", "Título", "text", {
          required: true,
          maxLength: 120,
        }),
        schemaField("kind", "Tipo", "select", {
          options: kinds,
          default: filters.kind === "all" ? "game" : filters.kind,
        }),
        schemaField("status", "Status", "select", {
          options: statuses,
          default: "planned",
        }),
        schemaField("platform", "Plataforma / edição", "text", {
          maxLength: 80,
          placeholder: "PC, PS2, edição física…",
        }),
        schemaField("progress", "Progresso atual", "number", {
          min: 0,
          max: 100000,
          step: "any",
          default: 0,
        }),
        schemaField("total", "Total (0 se não souber)", "number", {
          min: 0,
          max: 100000,
          step: "any",
          default: 0,
        }),
        schemaField("unit", "Unidade", "select", {
          default: "horas",
          options: {
            horas: "horas",
            episódios: "episódios",
            capítulos: "capítulos",
            volumes: "volumes",
            páginas: "páginas",
            "%": "%",
            faixas: "faixas",
            audições: "audições",
            itens: "itens",
          },
        }),
        schemaField("score", "Nota de 0 a 10 (opcional)", "number", {
          min: 0,
          max: 10,
          step: "0.5",
        }),
        schemaField("startedAt", "Data de início", "date"),
        schemaField("lists", "Listas pessoais (separadas por vírgula)", "text", {
          maxLength: 1200,
          placeholder: "Para jogar com amigos, Favoritos de infância",
        }),
        schemaField("finishedAt", "Data de conclusão", "date"),
        schemaField("notes", "Minhas notas / resenha", "textarea", { maxLength: 2000 }),
        schemaField("url", "Link", "url"),
        ...imageFields,
      ],
      onSave: async (values, old) => {
        // The editor has no playback/source fields. Preserve catalog-seeded
        // music metadata before normalization, which otherwise fills nulls.
        const valid = validateItem(values.kind === "music" ? { ...old, ...values } : values);
        if (valid.url && !safeUrl(valid.url)) throw Error("Link inválido.");
        valid.image = await resolveImage(values, old);
        for (const k of ["imageFile", "imageUrl", "clearImage"]) delete valid[k];
        const value = { ...old, ...valid };
        if (old?.catalogId && old.catalogId !== valid.catalogId) {
          value.summary = "";
          value.description = "";
          value.genres = [];
        }
        storeItem("items", value, old);
      },
    });
    const f = resource.querySelector("form");
    const unitFor = {
      game: "horas",
      anime: "episódios",
      manga: "capítulos",
      book: "páginas",
      film: "itens",
      series: "episódios",
      music: "audições",
      album: "faixas",
      other: "itens",
    };
    if (!item) f.elements.namedItem("unit").value = unitFor[f.elements.namedItem("kind").value];
    f.elements.namedItem("kind").onchange = () => {
      f.elements.namedItem("unit").value = unitFor[f.elements.namedItem("kind").value];
    };
    window.EditorUI?.decorateCollection(f, item);
  }
  collectionView = createCollectionView({
    container: collection,
    getData: () => data,
    getProfile: () => state,
    isActive: () => !collectionPage.hidden,
    openPhoto: profileExtras.openPhoto,
    filters,
    navigate,
    editItem,
    storeItem,
    bulkUpdate: (ids, patch) => {
      const selected = new Set(ids);
      const { addList, removeList, ...changes } = patch;
      const items = data.items.map((item) =>
        selected.has(item.id)
          ? validateItem({
              ...item,
              ...changes,
              ...(patch.status === "done"
                ? {
                    progress: item.total || item.progress,
                    finishedAt: item.finishedAt || new Date().toLocaleDateString("sv-SE"),
                  }
                : {}),
              lists: addList
                ? [...(item.lists || []), addList]
                : removeList
                  ? (item.lists || []).filter((name) => name !== removeList)
                  : item.lists,
              updated: Date.now(),
            })
          : item,
      );
      if (items.filter((item) => item.featured).length > 8)
        throw Error("A vitrine tem até 8 favoritos.");
      if (!save({ ...data, items })) throw Error("Não consegui salvar as alterações.");
      renderExtras();
      window.TitlePages?.patchCollectionState();
    },
    el,
    button,
    link,
    imageNode,
  });
  // Catalog backfill is not a personal edit: no timestamps or history changes.
  function patchCatalogMetadata(id, fields = {}) {
    const previous = data.items.find((item) => item.id === id);
    if (!previous || previous.genres?.length) return false;
    const genres = Array.isArray(fields.genres)
      ? [
          ...new Set(
            fields.genres
              .filter((value) => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ].slice(0, 8)
      : [];
    if (!genres.length) return false;
    const patch = { genres };
    if (!previous.genresSource && typeof fields.genresSource === "string")
      patch.genresSource = fields.genresSource.slice(0, 120);
    const items = data.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    if (!save({ ...data, items }, false)) return false;
    renderCollection();
    profileExtras.renderFeaturedCollection();
    return true;
  }
  window.CollectionActions = {
    patchCatalogMetadata,
    quickAdd: (item) => {
      const previous =
        data.items.find((row) => MusicModel.sameItem(row, item)) ||
        (item.kind === "music" ? MusicModel.findRecording(data.items, item) : null);
      if (previous) return previous;
      return storeItem("items", {
        ...item,
        catalogImage: item.catalogImage || item.image || "",
        status: "planned",
        progress: 0,
        score: null,
        featured: false,
      });
    },
    saveMusic: (item) => {
      const previous = data.items.find(
        (i) =>
          i.kind === "music" &&
          (item.id === i.id ||
            (item.catalogId && item.catalogId === i.catalogId) ||
            (item.playbackSource?.fileRef &&
              item.playbackSource.fileRef === i.playbackSource?.fileRef) ||
            (item.playbackSource?.url && item.playbackSource.url === i.playbackSource?.url)),
      );
      return storeItem(
        "items",
        {
          ...previous,
          ...item,
          metadataSources: { ...previous?.metadataSources, ...item.metadataSources },
          kind: "music",
          status: previous?.status || item.status || "planned",
        },
        previous,
      );
    },
    getItems: () => data.items,
    editItem,
    applyRoute,
    updateItem: (id, patch) => {
      const previous = data.items.find((item) => item.id === id);
      if (!previous) throw new Error("Título não encontrado na coleção.");
      return storeItem("items", validateItem({ ...previous, ...patch }), previous);
    },
    favoriteArtist: (item) => {
      const previous = data.items.find(
        (row) => row.kind === "artist" && row.catalogId === item.catalogId,
      );
      const value = validateItem({
        ...item,
        ...(previous || {}),
        kind: "artist",
        status: previous?.status || "planned",
        featured: !previous?.featured,
        progress: 0,
        total: 0,
      });
      for (const key of ["topTracks", "topAlbums", "similarArtists", "albumTracks"])
        delete value[key];
      return storeItem("items", value, previous);
    },
  };
  const { search, statusSelect } = collectionView;
  const renderCollection = collectionView.render;
  // Compatibility is resolved on read; the existing appearance save persists it.
  const appearance = createProfileAppearance({
    getData: () => data,
    save,
    openResource,
    schemaField,
    prepareImage,
    resource,
    button,
    bannerProfile,
    profileInner,
  });
  function editAppearance() {
    return appearance.edit();
  }
  function applyAppearance() {
    return appearance.apply();
  }
  const originalRender = render;
  render = function () {
    originalRender();
    applyAppearance();
  };
  function renderExtras() {
    profileExtras.render();
    collectionView.ensureRendered();
    playlistController?.render();
    applyAppearance();
    profileExtras.applySectionOrder();
    profileExtras.applyVisibility();
  }
  playlistController = createPlaylistController({
    getData: () => data,
    save,
    move,
    confirmDelete,
    el,
    button,
    uid,
  });
  // Backup em JSON inclui imagens e dados; os arquivos de áudio ficam no navegador.
  const footerTools = el("div", "footer-tools"),
    importInput = el("input");
  importInput.type = "file";
  importInput.accept = "application/json,.json,.myspace";
  importInput.hidden = true;
  document.body.append(importInput);
  function backupPayload() {
    const payload = {
      format: "myspace-backup",
      version: 1,
      profile: state,
      extras: data,
      titlePreferences: TitlePreferences.collect(),
    };
    return payload;
  }
  const backupInfo = el("details", "backup-info");
  backupInfo.append(el("summary", "", "estado do backup"));
  const backupDate = el("p", "title-notice"),
    backupFiles = el("div", "backup-files");
  function refreshBackupDate() {
    try {
      const last = JSON.parse(localStorage.getItem("myspace-last-backup") || "null");
      backupDate.textContent =
        last && Number.isFinite(last.at)
          ? "Última exportação solicitada: " +
            new Date(last.at).toLocaleString("pt-BR") +
            " · " +
            (last.type === "package" ? "com arquivos" : "JSON sem arquivos locais")
          : "Você ainda não exportou um backup neste navegador.";
    } catch {
      backupDate.textContent = "Nenhuma exportação registrada.";
    }
  }
  function markBackup(type) {
    try {
      localStorage.setItem("myspace-last-backup", JSON.stringify({ at: Date.now(), type }));
    } catch {}
    refreshBackupDate();
  }
  const inspectButton = button("verificar arquivos locais", async () => {
    inspectButton.disabled = true;
    backupFiles.replaceChildren(el("p", "", "Verificando…"));
    try {
      const result = await MediaPackage.inspect(backupPayload());
      backupFiles.replaceChildren(
        el(
          "p",
          "",
          result.count +
            " arquivos vinculados · " +
            Math.round((result.totalBytes / 1024 / 1024) * 10) / 10 +
            " MB disponíveis · " +
            result.missing.length +
            " ausentes",
        ),
      );
      for (const id of result.missing) {
        const track = data.tracks.find((track) => track.id === id);
        const name =
          track?.fileName ||
          (data.featuredVideo.localId === id ? data.featuredVideo.fileName : "") ||
          id;
        backupFiles.append(el("p", "backup-missing", name + " · precisa ser vinculado novamente"));
      }
      if (!result.count)
        backupFiles.append(
          el(
            "p",
            "",
            "Não há arquivos locais vinculados. Links de serviços externos permanecem links no backup.",
          ),
        );
    } catch (error) {
      backupFiles.replaceChildren(el("p", "error", error.message));
    } finally {
      inspectButton.disabled = false;
    }
  });
  backupInfo.append(backupDate, inspectButton, backupFiles);
  refreshBackupDate();
  function downloadBackup() {
    const payload = backupPayload();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = el("a");
    a.href = url;
    a.download = "myspace-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    markBackup("json");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(
      "Backup baixado com capas e banners. Arquivos locais de áudio/vídeo ficam neste navegador.",
    );
  }
  footerTools.append(
    button("exportar backup", downloadBackup, ""),
    button(
      "backup com arquivos",
      async (event) => {
        const control = event?.currentTarget;
        if (control) control.disabled = true;
        try {
          toast("Preparando o pacote com músicas e vídeos…");
          const result = await MediaPackage.create(backupPayload(), (done, total) =>
            toast("Preparando arquivos: " + done + " / " + total),
          );
          const url = URL.createObjectURL(result.blob),
            anchor = el("a");
          anchor.href = url;
          anchor.download = "myspace-" + new Date().toISOString().slice(0, 10) + ".myspace";
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          markBackup("package");
          toast(
            result.missing.length
              ? "Pacote baixado. " +
                  result.missing.length +
                  " arquivos não estão mais neste navegador."
              : "Pacote completo baixado com seus arquivos locais.",
          );
        } catch (error) {
          toast(error.message || "Não consegui preparar o pacote.");
        } finally {
          if (control) control.disabled = false;
        }
      },
      "",
    ),
    button("importar backup", () => importInput.click(), ""),
  );
  document.querySelector("footer").append(footerTools);
  document.querySelector("footer").append(backupInfo);
  importInput.onchange = async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const isPackage = /\.myspace$/i.test(file.name || "");
      if (!isPackage && file.size > 50 * 1024 * 1024) throw Error("O backup é grande demais.");
      const packageData = isPackage ? await MediaPackage.read(file) : null;
      const payload = packageData?.payload || JSON.parse(await file.text());
      const { next, profile, titlePreferences } = validateProfileBackup(payload, {
        emptyData,
        normalizeSectionOrder,
        validateItem,
        kinds,
        defaults,
        safeUrl,
      });
      openResource({
        title: "importar backup",
        fields: [],
        help:
          "Isso substitui o perfil, a coleção e as personalizações dos títulos presentes no backup. " +
          (packageData
            ? "O pacote inclui " +
              packageData.files.length +
              " arquivos locais, que serão restaurados junto com o perfil."
            : "Arquivos locais de áudio/vídeo podem precisar ser vinculados novamente."),
        onSave: async () => {
          await restoreProfileBackup(
            { profile, next, titlePreferences, packageData },
            { persist, save },
          );
          window.Undo?.clear();
          window.dispatchEvent(new Event("myspace:preferences-restored"));
          playlistController.cancel();
          if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
          localVideoUrl = "";
          localVideoId = "";
          state = profile;
          localAudio = "";
          loadedSource = "";
          render();
          renderExtras();
          applyRoute();
          if (data.tracks.length)
            await playlistController.selectTrack(data.startTrack || data.tracks[0].id);
        },
      });
    } catch (e) {
      toast(e.message || "Não foi possível importar o backup.");
    }
    importInput.value = "";
  };
  window.MusicBridge?.initialize({
    getQueue: () => data.tracks,
    getActive: () => data.activeTrack,
    persist: () => save(),
  });
  renderExtras();
  applyRoute();
  if (data.tracks.length)
    playlistController.selectTrack(data.startTrack || data.activeTrack || data.tracks[0].id);
})();
