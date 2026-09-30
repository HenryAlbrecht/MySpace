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

  let playlistController;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.version === 1) {
      data = { ...data, ...saved };
      for (const k of [
        "items",
        "favorites",
        "badges",
        "photos",
        "blocks",
        "tracks",
      ])
        if (!Array.isArray(data[k])) data[k] = [];
    }
  } catch {}
  function save(next = data, recordHistory = true) {
    try {
      const previous = JSON.parse(localStorage.getItem(KEY) || '{}');
      const changes = [];
      const oldItems = new Map((previous.items || []).map(item => [item.id,item]));
      for (const item of next.items || []) {
        const old = oldItems.get(item.id); oldItems.delete(item.id);
        const fields = old ? ['status','score','progress','total','featured','startedAt','finishedAt','notes','lists'].filter(field => JSON.stringify(old[field]) !== JSON.stringify(item[field])) : ['adicionado'];
        if (fields.length) changes.push({ title: item.title, id: item.id, at: Date.now(), fields, before: old ? { status:old.status,score:old.score,progress:old.progress } : null, after: { status:item.status,score:item.score,progress:item.progress } });
      }
      for (const item of oldItems.values()) changes.push({ title:item.title, id:item.id, at:Date.now(), fields:['excluído'], before:{status:item.status,score:item.score,progress:item.progress}, after:null });
      next = { ...next, history: [...(Array.isArray(next.history) ? next.history : []), ...(recordHistory ? changes : [])].slice(-100) };
      localStorage.setItem(KEY, JSON.stringify(next));
      data = next;
      return true;
    } catch {
      toast(
        "Não foi possível salvar. Exporte seus dados e tente imagens menores.",
      );
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
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    img.onerror = () => {
      img.hidden = true;
      if (
        img.parentElement &&
        !img.parentElement.querySelector(".image-failed")
      )
        img.parentElement.append(
          el("span", "image-failed", "Imagem indisponível"),
        );
    };
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
  function actions(group, item, edit) {
    const row = el("div", "mini-actions");
    row.append(
      button("←", () => move(group, item.id, -1), ""),
      button("editar", () => edit(item), ""),
      button("→", () => move(group, item.id, 1), ""),
    );
    row.firstChild.setAttribute(
      "aria-label",
      "Mover para antes: " + (item.title || item.name || "item"),
    );
    row.lastChild.setAttribute(
      "aria-label",
      "Mover para depois: " + (item.title || item.name || "item"),
    );
    return row;
  }
  const main = document.querySelector(".main-column"),
    aside = document.querySelector("aside");
  const favorites = section("top 8", "favorites", aside, () => editFavorite());
  const badges = section("selinhos", "badges", aside, () => editBadge());
  const collection = section("// minha coleção", "collection", main, () =>
    editItem(),
  );
  main.insertBefore(collection.box, $("music").nextSibling);
  const profileInner = $('profile').querySelector('.profile-inner');
  const bannerProfile = el('div', 'banner-profile');
  $('banner').append(bannerProfile);
  const video = section('vídeo em destaque', 'featuredVideo', main, editFeaturedVideo);
  video.head.lastChild.textContent = 'editar vídeo';
  video.body.className = 'featured-video-body';
  main.insertBefore(video.box, $('music'));
  let localVideoUrl = '', localVideoId = '', videoRenderVersion = 0;
  function editFeaturedVideo() {
    openResource({ title: 'vídeo em destaque', item: data.featuredVideo || {}, fields: [
      schemaField('title', 'Legenda (opcional)', 'text', { maxLength: 120 }),
      schemaField('url', 'Link do YouTube ou vídeo MP4/WebM', 'url'),
      schemaField('videoFile', 'Ou envie um vídeo local (até 200 MB)', 'file', { accept: 'video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv' }),
      schemaField('removeVideo', 'Remover vídeo do perfil', 'checkbox')
    ], onSave: async v => {
      const previous = data.featuredVideo || {};
      if (v.removeVideo) {
        if (save({ ...data, featuredVideo: {} })) { renderExtras(); if (previous.localId) MediaStorage.remove(previous.localId).catch(() => {}); }
        return;
      }
      if (v.videoFile) {
        if (v.videoFile.size > 200 * 1024 * 1024) throw Error('Escolha um vídeo de até 200 MB.');
        if (!/\.(mp4|webm|ogv)$/i.test(v.videoFile.name)) throw Error('Use um arquivo MP4, WebM ou OGV.');
        const localId = 'featured-video:' + uid();
        await MediaStorage.put(localId, v.videoFile);
        if (save({ ...data, featuredVideo: { title: v.title || v.videoFile.name, url: '', localId, fileName: v.videoFile.name } })) {
          renderExtras();
          if (previous.localId) MediaStorage.remove(previous.localId).catch(() => {});
        } else await MediaStorage.remove(localId);
        return;
      }
      if (previous.localId && !v.url) {
        if (save({ ...data, featuredVideo: { ...previous, title: v.title } })) renderExtras();
        return;
      }
      const embed = MediaEmbeds.parse(v.url);
      const direct = MediaEmbeds.directVideo(v.url);
      if (v.url && embed?.provider !== 'youtube' && !direct) throw Error('Use um link do YouTube ou de arquivo MP4/WebM.');
      const info = embed ? await MediaEmbeds.metadata(embed.url) : null;
      if (save({ ...data, featuredVideo: { title: v.title || info?.title || '', url: embed?.url || direct, thumbnail: info?.thumbnail || '' } })) { renderExtras(); if (previous.localId) MediaStorage.remove(previous.localId).catch(() => {}); }
    }});
  }
  async function renderFeaturedVideo() {
    const version = ++videoRenderVersion;
    const selected = data.featuredVideo || {};
    if (localVideoId !== (selected.localId || '')) {
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
      localVideoUrl = ''; localVideoId = selected.localId || '';
    }
    if (selected.localId && !localVideoUrl) {
      let file;
      try { file = await MediaStorage.get(selected.localId); } catch {}
      if (version !== videoRenderVersion) return;
      if (!file) { video.body.replaceChildren(el('p', 'empty', 'Vídeo local indisponível. Use editar vídeo para selecionar o arquivo novamente.')); return; }
      localVideoUrl = URL.createObjectURL(file);
    }
    const embed = MediaEmbeds.parse(data.featuredVideo?.url);
    const direct = localVideoUrl || MediaEmbeds.directVideo(data.featuredVideo?.url);
    if (embed?.provider !== 'youtube' && !direct) { video.body.replaceChildren(); return; }
    const source = embed?.src || direct;
    if (video.body.firstElementChild?.dataset.source !== source) {
      if (embed) video.body.replaceChildren(MediaEmbeds.surface(embed, data.featuredVideo.title || 'Vídeo em destaque', data.featuredVideo));
      else {
        const player = el('video', 'direct-video'); player.controls = true; player.preload = 'metadata'; player.src = direct; player.dataset.source = source;
        video.body.replaceChildren(player);
      }
    }
    let caption = video.body.querySelector('p');
    if (!caption) { caption = el('p', 'video-caption'); video.body.append(caption); }
    caption.textContent = data.featuredVideo.title || '';
    caption.hidden = !caption.textContent;
  }
  const featuredCollection = section("favoritos", "featuredCollection", main, () => navigate("colecao"));
  featuredCollection.head.lastChild.textContent = "escolher títulos";
  main.insertBefore(featuredCollection.box, $("music"));
  const gallery = section("// fotos", "gallery", main, () => editPhoto());
  const blocks = el("div");
  blocks.id = "customBlocks";
  main.append(blocks);
  const blockAdd = button("＋ criar um bloco", () => editBlock());
  main.append(blockAdd);
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
  photosPage.append(gallery.box);
  pageRoot.insertBefore(collectionPage, document.querySelector("footer"));
  pageRoot.insertBefore(photosPage, document.querySelector("footer"));
  if(!window.location.hash && new URLSearchParams(window.location.search||'').has('party')) window.history.replaceState(null,'',window.location.pathname+window.location.search+'#spacevoice');
  const spaceVoice = createSpaceVoice({ getProfile: () => state, el, button,
    prepareAvatar:value=>preparePartyAvatar(value,PARTY_ROOM.MAX_AVATAR) });
  const voicePage = el('div', 'page-view');
  voicePage.id = 'spaceVoicePage';
  voicePage.hidden = true;
  voicePage.append(spaceVoice.root);
  pageRoot.insertBefore(voicePage, document.querySelector('footer'));
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
    window.Navigation?.capture(window.location.hash || '#perfil');
    const hash =
      "#" + page + (page === "colecao" && kind !== "all" ? "/" + kind : "");
    if (window.location.hash !== hash) window.location.hash = hash;
    applyRoute();
  }
  function applyRoute() {
    const parts = window.location.hash.replace(/^#/, "").split("/"),
      page = ["colecao", "collection"].includes(parts[0])
        ? "colecao"
        : ["fotos", "gallery"].includes(parts[0])
          ? "fotos"
          : ["buscar", "titulo", "descobrir", "spacevoice"].includes(parts[0])
            ? parts[0]
            : "perfil";
    columns.hidden = page !== "perfil";
    $("banner").hidden = page !== "perfil";
    collectionPage.hidden = page !== "colecao";
    photosPage.hidden = page !== "fotos";
    voicePage.hidden = page !== 'spacevoice';
    if (page === 'spacevoice') spaceVoice.show();
    else spaceVoice.hide();
    document.body.dataset.page = page;
    for (const a of nav.children) {
      if (a.dataset.route === (page === "titulo" ? "buscar" : page)) a.setAttribute("aria-current", "page");
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
      }
      renderCollection();
      collection.head.firstChild.textContent =
        kind === "all" ? "// coleção" : "// " + kinds[kind].toLowerCase();
    }
    applyProfileVisibility();
  }
  window.addEventListener("hashchange", applyRoute);
  function applyProfileVisibility() {
    const visibility = data.visibility || {};
    for (const [key, node] of Object.entries({
      about: $("about"),
      music: $("music"),
      wall: $("wallText").parentElement.parentElement,
      mood: $("moodCard").parentElement.parentElement.parentElement,
      interests: $("interestTags").parentElement,
      favorites: favorites.box,
      badges: badges.box,
      blocks,
      featured: featuredCollection.box,
      video: video.box,
    })) {
      node.hidden =
        (key === 'video' && !data.featuredVideo?.url && !data.featuredVideo?.localId) ||
        visibility[key] === false ||
        (key === "favorites" && !data.favorites.length) ||
        (key === "badges" && !data.badges.length) ||
        (key === "blocks" && !data.blocks.length);
      if (key === "featured" && !data.items.some(i => i.featured)) node.hidden = true;
    }
  }
  const sectionGroups = {
    main: ['about', 'featured', 'video', 'music', 'wall', 'blocks'],
    sidebar: ['profile', 'mood', 'interests', 'favorites', 'badges'],
  };
  const sectionTitles = { profile: 'Janela do perfil', about: 'Sobre mim', featured: 'Favoritos', video: 'Vídeo em destaque', music: 'Player de música', wall: 'Mural', blocks: 'Blocos livres', mood: 'Mood', interests: 'Interesses', favorites: 'Top 8', badges: 'Selinhos' };
  function normalizeSectionOrder(value = {}) {
    const result = {};
    for (const [group, defaults] of Object.entries(sectionGroups)) {
      const selected = Array.isArray(value?.[group]) ? value[group] : [];
      result[group] = [...new Set(selected.filter(key => defaults.includes(key))), ...defaults.filter(key => !selected.includes(key))];
    }
    return result;
  }
  function applySectionOrder() {
    const nodes = { profile: $('profile'), about: $('about'), featured: featuredCollection.box, video: video.box, music: $('music'), wall: $('wallText').parentElement.parentElement, blocks, mood: $('moodCard').parentElement.parentElement.parentElement, interests: $('interestTags').parentElement, favorites: favorites.box, badges: badges.box };
    const order = normalizeSectionOrder(data.sectionOrder);
    for (const keys of Object.values(order)) keys.forEach((key, index) => { nodes[key].style.order = String(index); });
    blockAdd.style.order = '100';
  }
  function moveSection(group, key, direction) {
    const order = normalizeSectionOrder(data.sectionOrder);
    const index = order[group].indexOf(key), target = index + direction;
    if (target < 0 || target >= order[group].length) return;
    [order[group][index], order[group][target]] = [order[group][target], order[group][index]];
    if (save({ ...data, sectionOrder: order })) { applySectionOrder(); manageSections(); }
  }
  function manageSections() {
    resource.replaceChildren();
    const body = el("div", "editor-body");
    body.append(el("h2", "", "Seções do perfil"));
    body.append(el('p', 'note-hint', 'Use as setas para ordenar os blocos em cada coluna. A ordem fica salva mesmo quando uma seção está oculta.'));
    const order = normalizeSectionOrder(data.sectionOrder);
    for (const [group, keys] of Object.entries(order)) {
      body.append(el('h3', 'section-order-title', group === 'main' ? 'Coluna principal' : 'Lateral'));
      const list = el('div', 'section-order-list');
      keys.forEach((key, index) => {
        const row = el('div', 'section-order-row'); row.dataset.sectionKey = key;
        const label = el('label', 'check-label', sectionTitles[key]);
        const input = el('input'); input.type = 'checkbox'; input.checked = data.visibility?.[key] !== false;
        if (key === 'profile') { input.disabled = true; input.checked = data.appearance?.profileLayout !== 'banner'; label.title = 'A posição do perfil é configurada em Aparência → Perfil.'; }
        input.onchange = () => { if (save({ ...data, visibility: { ...data.visibility, [key]: input.checked } })) applyProfileVisibility(); };
        label.prepend(input);
        const controls = el('div', 'section-order-controls');
        for (const [direction, text] of [[-1, '↑'], [1, '↓']]) {
          const control = button(text, () => moveSection(group, key, direction));
          control.disabled = direction < 0 ? index === 0 : index === keys.length - 1;
          control.setAttribute('aria-label', (direction < 0 ? 'Subir ' : 'Descer ') + sectionTitles[key]);
          controls.append(control);
        }
        row.append(label, controls); list.append(row);
      });
      body.append(list);
    }
    const add = el("div", "toolbar");
    for (const [title, action] of [
      ["＋ favorito", editFavorite],
      ["＋ selinho", editBadge],
      ["＋ bloco", editBlock],
      ["＋ vídeo", editFeaturedVideo],
    ])
      add.append(
        button(title, () => {
          resource.close();
          action();
        }),
      );
    body.append(
      add,
      el(
        "p",
        "note-hint",
        "Top 8 e selinhos só aparecem depois que você adicionar algo.",
      ),
      button("fechar", () => resource.close()),
    );
    resource.append(body);
    resource.showModal();
  }
  blockAdd.textContent = "editar seções do perfil";
  blockAdd.onclick = manageSections;
  blockAdd.classList.add("section-manager");
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
  const lightbox = el("dialog", "lightbox");
  document.body.append(lightbox);
  function showPhoto(photo) {
    lightbox.replaceChildren(
      button("fechar ×", () => lightbox.close()),
      imageNode(photo.image, photo.caption || "Foto"),
      el("p", "", photo.caption),
    );
    lightbox.showModal();
  }
  const schemaField = (name, label, type = "text", extra = {}) => ({
    name,
    label,
    type,
    ...extra,
  });
  async function prepareImage(file, max = 800, keepGif = false) {
    if (file.size > 3 * 1024 * 1024) throw Error("Use uma imagem de até 3 MB.");
    if (keepGif && file.type === "image/gif") {
      if (file.size > 1024 * 1024)
        throw Error("Para GIFs, use um arquivo de até 1 MB.");
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
        button(
          "excluir",
          () => confirmDelete(group, item.id),
          "small dialog-delete",
        ),
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
    if (group === 'items') item = validateItem(item);
    if (group === "items" && item.featured && !previous?.featured && data.items.filter(i => i.featured).length >= 8)
      throw Error("A vitrine tem até 8 títulos. Remova um destaque antes de adicionar outro.");
    const list = [...data[group]],
      value = { ...item, id: previous?.id || uid(), updated: Date.now() };
    const index = list.findIndex((i) => i.id === value.id);
    if (index < 0) list.push(value);
    else list[index] = value;
    if (!save({ ...data, [group]: list }))
      throw Error("Armazenamento cheio. Tente uma imagem menor.");
    renderExtras();
    window.TitlePages?.refresh();
    return value;
  }
  function confirmDelete(group, id) {
    const old = data[group].find((i) => i.id === id);
    if (!old) return;
    resource.replaceChildren();
    const body = el("div", "editor-body");
    body.append(
      el("h2", "", "Excluir este item?"),
      el(
        "p",
        "",
        old.title ||
          old.name ||
          old.caption ||
          "Este item será removido do seu perfil.",
      ),
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
  async function resolveImage(
    values,
    previous,
    key = "image",
    max = 800,
    keepGif = false,
  ) {
    if (values.clearImage) return "";
    if (values.imageFile) return prepareImage(values.imageFile, max, keepGif);
    if (values.imageUrl) {
      const url = safeUrl(values.imageUrl);
      if (!url) throw Error("Use um link de imagem com http ou https.");
      return url;
    }
    return previous?.[key] || "";
  }
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
        schemaField("lists", "Listas pessoais (separadas por vírgula)", "text", { maxLength: 1200, placeholder: 'Para jogar com amigos, Favoritos de infância' }),
        schemaField("finishedAt", "Data de conclusão", "date"),
        schemaField("notes", "Minhas notas / resenha", "textarea", { maxLength: 2000 }),
        schemaField("url", "Link", "url"),
        ...imageFields,
      ],
      onSave: async (values, old) => {
        const valid = validateItem(values);
        if (valid.url && !safeUrl(valid.url)) throw Error("Link inválido.");
        valid.image = await resolveImage(values, old);
        for (const k of ["imageFile", "imageUrl", "clearImage"])
          delete valid[k];
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
      music: "audições", album: "faixas",
      other: "itens",
    };
    if (!item)
      f.elements.namedItem("unit").value =
        unitFor[f.elements.namedItem("kind").value];
    f.elements.namedItem("kind").onchange = () => {
      f.elements.namedItem("unit").value =
        unitFor[f.elements.namedItem("kind").value];
    };
    window.EditorUI?.decorateCollection(f, item);
  }
  function editFavorite(item) {
    if (!item && data.favorites.length >= 8) {
      toast("Seu top 8 já está completo. Edite ou exclua um favorito.");
      return;
    }
    openResource({
      title: "top 8",
      group: "favorites",
      item,
      fields: [
        schemaField("name", "Nome", "text", { required: true, maxLength: 60 }),
        schemaField("url", "Link (opcional)", "url"),
        ...imageFields,
      ],
      onSave: async (v, old) => {
        storeItem(
          "favorites",
          {
            name: v.name,
            url: v.url,
            image: await resolveImage(v, old, "image", 300),
          },
          old,
        );
      },
    });
  }
  function editBadge(item) {
    openResource({
      title: "selinho 88 × 31",
      group: "badges",
      item,
      fields: [
        schemaField("name", "Texto / descrição", "text", {
          required: true,
          maxLength: 40,
        }),
        schemaField("url", "Link (opcional)", "url"),
        schemaField("background", "Cor de fundo", "color", {
          default: "#202b45",
        }),
        schemaField("color", "Cor do texto", "color", { default: "#c0adff" }),
        ...imageFields,
      ],
      onSave: async (v, old) => {
        storeItem(
          "badges",
          {
            name: v.name,
            url: v.url,
            background: v.background,
            color: v.color,
            image: await resolveImage(v, old, "image", 400, true),
          },
          old,
        );
      },
      help: "Escolha um GIF ou imagem de um selinho, ou escreva o seu.",
    });
  }
  function editPhoto(item) {
    openResource({
      title: "foto",
      group: "photos",
      item,
      fields: [
        schemaField("caption", "Legenda", "textarea", { maxLength: 500 }),
        ...imageFields,
      ],
      onSave: async (v, old) => {
        const image = await resolveImage(v, old, "image", 1400, true);
        if (!image) throw Error("Escolha uma imagem para o álbum.");
        storeItem("photos", { caption: v.caption, image }, old);
      },
    });
  }
  function editBlock(item) {
    openResource({
      title: "bloco livre",
      group: "blocks",
      item,
      fields: [
        schemaField("title", "Título", "text", {
          required: true,
          maxLength: 80,
        }),
        schemaField("text", "Texto", "textarea", { maxLength: 4000 }),
        schemaField("url", "Link (opcional)", "url"),
        schemaField("linkText", "Texto do link", "text", { maxLength: 80 }),
      ],
      onSave: async (v, old) => {
        storeItem("blocks", v, old);
      },
    });
  }
  function renderFavorites() {
    favorites.body.replaceChildren();
    if (!data.favorites.length) {
      favorites.body.append(
        el("p", "empty", "Seus amigos, personagens ou sites favoritos."),
      );
      return;
    }
    const grid = el("div", "favorites-grid");
    for (const item of data.favorites) {
      const card = el("div", "favorite"),
        a = link(item.url),
        portrait = el("div", "favorite-portrait");
      portrait.append(
        item.image
          ? imageNode(item.image, item.name)
          : el("span", "", item.name.slice(0, 1)),
      );
      a.append(portrait, el("span", "favorite-name", item.name));
      card.append(a, actions("favorites", item, editFavorite));
      grid.append(card);
    }
    favorites.body.append(grid);
  }
  function renderBadges() {
    badges.body.replaceChildren();
    if (!data.badges.length) {
      badges.body.append(el("p", "empty", "Adicione seus selinhos 88 × 31."));
      return;
    }
    const list = el("div", "badge-list");
    for (const item of data.badges) {
      const wrap = el("div", "badge-wrap"),
        a = link(item.url);
      a.className = "web-badge";
      a.style.backgroundColor = item.background;
      a.style.color = item.color;
      a.title = item.name;
      a.append(
        item.image
          ? imageNode(item.image, item.name)
          : document.createTextNode(item.name),
      );
      wrap.append(a, actions("badges", item, editBadge));
      list.append(wrap);
    }
    badges.body.append(list);
  }
  function renderGallery() {
    gallery.body.replaceChildren();
    if (!data.photos.length) {
      gallery.body.append(el("p", "empty", "Ainda não tem fotos aqui."));
      return;
    }
    const grid = el("div", "gallery-grid");
    for (const photo of data.photos) {
      const tile = el("div", "gallery-tile"),
        b = button("", () => showPhoto(photo), "gallery-photo");
      b.setAttribute(
        "aria-label",
        "Abrir foto: " + (photo.caption || "sem legenda"),
      );
      b.append(imageNode(photo.image, photo.caption || "Foto"));
      tile.append(
        b,
        el("p", "gallery-caption", photo.caption),
        actions("photos", photo, editPhoto),
      );
      grid.append(tile);
    }
    gallery.body.append(grid);
  }
  function renderBlocks() {
    blocks.replaceChildren();
    for (const item of data.blocks) {
      const box = el("section", "panel"),
        head = el("div", "section-head");
      head.append(el("h3", "", item.title), actions("blocks", item, editBlock));
      const body = el("div", "block-body", item.text);
      if (item.url) body.append(link(item.url, item.linkText || item.url));
      box.append(head, body);
      blocks.append(box);
    }
  }
  const collectionView = createCollectionView({
    container: collection,
    getData: () => data,
    getProfile: () => state,
    openPhoto: showPhoto,
    filters,
    navigate,
    editItem,
    storeItem,
    bulkUpdate: (ids, patch) => {
      const selected = new Set(ids);
      const {addList,removeList,...changes}=patch;
      const items = data.items.map(item => selected.has(item.id) ? validateItem({ ...item, ...changes, ...(patch.status === 'done' ? {progress:item.total || item.progress,finishedAt:item.finishedAt || new Date().toLocaleDateString('sv-SE')} : {}), lists: addList ? [...(item.lists || []), addList] : removeList ? (item.lists || []).filter(name => name !== removeList) : item.lists, updated:Date.now() }) : item);
      if (items.filter(item => item.featured).length > 8) throw Error('A vitrine tem até 8 favoritos.');
      if (!save({ ...data, items })) throw Error('Não consegui salvar as alterações.');
      renderExtras(); window.TitlePages?.refresh();
    },
    el,
    button,
    link,
    imageNode,
  });
  window.CollectionActions = { getItems: () => data.items, editItem, applyRoute, updateItem: (id, patch) => { const previous = data.items.find(item => item.id === id); if (!previous) throw new Error("Título não encontrado na coleção."); return storeItem("items", validateItem({ ...previous, ...patch }), previous); }, favoriteArtist: item => {
    const previous = data.items.find(row => row.kind === 'artist' && row.catalogId === item.catalogId);
    const value = validateItem({ ...item, ...(previous || {}), kind: 'artist', status: previous?.status || 'planned', featured: !previous?.featured, progress: 0, total: 0 });
    for (const key of ['topTracks','topAlbums','similarArtists','albumTracks']) delete value[key];
    return storeItem('items', value, previous);
  } };
  const { search, statusSelect } = collectionView;
  const renderCollection = collectionView.render;
  // Compatibility is resolved on read; the existing appearance save persists it.
  function xmbAppearance(a) {
    const legacy = a.xmbBackground;
    return {
      backgroundSource: legacy === 'desktop' ? 'inherit' : legacy === 'solid' ? 'custom' : 'artwork',
      customBackground: null, customBackgroundMode: 'cover',
      customBackgroundColor: null, panelOpacity: null, artworkIntensity: 50, ghostArtworkEnabled: true, ...a.xmb,
      // One-time compatibility default matches the formerly coupled intensity.
      ghostArtworkOpacity: a.xmb?.ghostArtworkOpacity ?? (75 - .5 * Math.max(0, Math.min(100, Number(a.xmb?.artworkIntensity ?? 50)))),
      // .035 was the old contextual default, not a user-facing intensity choice.
      artworkOpacity: a.xmb?.artworkOpacity == null || a.xmb.artworkOpacity === .035 ? 1 : a.xmb.artworkOpacity,
    };
  }
  function wallpaperRecipe(background, mode) {
    const url = safeUrl(background, true);
    return { image: url ? `url(${JSON.stringify(url)})` : 'none',
      size: mode === 'tile' ? 'auto' : mode === 'contain' ? 'contain' : 'cover',
      repeat: mode === 'tile' ? 'repeat' : 'no-repeat' };
  }
  function editAppearance() {
    const a = { avatarBorder: true, profileWindowBorder: true, ...data.appearance };
    const x = xmbAppearance(a);
    const transparency = Number((x.panelOpacity == null ? 100 - (a.opacity ?? 100) * .92 : 100 - x.panelOpacity).toFixed(1));
    Object.assign(a, { xmbSource: x.backgroundSource, xmbMode: x.customBackgroundMode,
      xmbColor: x.customBackgroundColor || getComputedStyle(document.body).getPropertyValue('--bg').trim(),
      xmbUseColor: !!x.customBackgroundColor, xmbTransparency: transparency, xmbArtworkIntensity: x.artworkIntensity,
      xmbGhostEnabled: x.ghostArtworkEnabled, xmbGhostOpacity: x.ghostArtworkOpacity });
    openResource({
      title: "aparência",
      item: a,
      fields: [
        schemaField("backgroundUrl", "Link do fundo (aceita GIF)", "url"),
        schemaField("backgroundFile", "Ou envie uma imagem / GIF", "file", {
          accept: "image/*",
        }),
        schemaField("clearBackground", "Remover fundo", "checkbox"),
        schemaField("backgroundMode", "Como mostrar o fundo", "select", {
          options: {
            tile: "Repetir (textura)",
            cover: "Preencher a tela",
            contain: "Centralizar",
          },
        }),
        schemaField('xmbSource', 'Fundo do XMB', 'select', { options: {
          artwork: 'Artwork do item', inherit: 'Usar aparência global', custom: 'Personalizar XMB',
        } }),
        schemaField('xmbUrl', 'Link do wallpaper XMB (aceita GIF)', 'url'),
        schemaField('xmbFile', 'Ou envie uma imagem / GIF', 'file', { accept: 'image/*' }),
        schemaField('xmbClear', 'Remover wallpaper XMB', 'checkbox'),
        schemaField('xmbMode', 'Modo do wallpaper XMB', 'select', { options: {
          tile: 'Repetir (textura)', cover: 'Preencher a tela', contain: 'Centralizar',
        } }),
        schemaField('xmbUseColor', 'Usar cor de fundo própria no XMB', 'checkbox'),
        schemaField('xmbColor', 'Cor de fundo XMB', 'color'),
        schemaField('xmbGhostEnabled', 'Mostrar artwork fantasma', 'checkbox'),
        schemaField('xmbGhostOpacity', 'Intensidade da artwork fantasma', 'range', { min: 0, max: 100, default: 50, step: .1 }),
        schemaField('xmbArtworkIntensity', 'Tratamento do fundo artwork (0: mais arte · 100: mais UI)', 'range', { min: 0, max: 100, default: 50 }),
        schemaField('xmbTransparency', 'Transparência da interface XMB (%)', 'range', { min: 0, max: 100, step: .1 }),
        schemaField('profileLayout', 'Posição do perfil', 'select', { options: { window: 'Janela na lateral', banner: 'Avatar e perfil no banner' } }),
        schemaField('avatarShape', 'Formato do avatar', 'select', { options: { square: 'Quadrado', round: 'Redondo' } }),
        schemaField('avatarBorder', 'Mostrar borda do avatar', 'checkbox'),
        schemaField('profileWindowBorder', 'Mostrar borda da janela do perfil', 'checkbox'),
        schemaField("layoutWidth", "Largura do site", "select", {
          options: { original: "Original", wide: "Amplo", full: "Expandido (tela toda)" },
        }),
        schemaField("cornerRadius", "Arredondamento das bordas (px)", "number", {
          min: 0, max: 24, default: 0,
        }),
        schemaField("font", "Fonte", "select", {
          options: {
            original: "Atual",
            mono: "Monoespaçada",
            verdana: "Verdana",
            serif: "Georgia",
          },
        }),
        schemaField("borderStyle", "Bordas", "select", {
          options: {
            solid: "Sólida",
            dashed: "Tracejada",
            double: "Dupla",
            none: "Sem borda",
          },
        }),
        schemaField("opacity", "Opacidade dos blocos (%)", "range", {
          min: 45,
          max: 100,
          default: 100,
        }),
        schemaField("bannerHeight", "Altura do banner (px)", "number", {
          min: 180,
          max: 600,
          default: 287,
        }),
        schemaField("useColors", "Usar minhas próprias cores", "checkbox"),
        schemaField("backgroundColor", "Fundo", "color", {
          default: getComputedStyle(document.body)
            .getPropertyValue("--bg")
            .trim(),
        }),
        schemaField("panelColor", "Blocos", "color", {
          default: getComputedStyle(document.body)
            .getPropertyValue("--panel")
            .trim(),
        }),
        schemaField("textColor", "Texto", "color", {
          default: getComputedStyle(document.body)
            .getPropertyValue("--text")
            .trim(),
        }),
        schemaField("accentColor", "Destaques", "color", {
          default: getComputedStyle(document.body)
            .getPropertyValue("--accent")
            .trim(),
        }),
        schemaField("borderColor", "Bordas", "color", {
          default: getComputedStyle(document.body)
            .getPropertyValue("--border")
            .trim(),
        }),
      ],
      onSave: async (v) => {
        let background = a.background || "";
        if (v.clearBackground) background = "";
        else if (v.backgroundFile)
          background = await prepareImage(v.backgroundFile, 1800, true);
        else if (v.backgroundUrl) background = safeUrl(v.backgroundUrl);
        let customBackground = x.customBackground;
        if (v.xmbClear) customBackground = null;
        else if (v.xmbFile) customBackground = await prepareImage(v.xmbFile, 1800, true);
        else if (v.xmbUrl) customBackground = safeUrl(v.xmbUrl);
        const next = {
          ...data.appearance, ...v,
          xmb: { ...x, backgroundSource: v.xmbSource, customBackground,
            ghostArtworkEnabled: v.xmbGhostEnabled,
            ghostArtworkOpacity: Math.max(0, Math.min(100, Number(v.xmbGhostOpacity))),
            artworkIntensity: Math.max(0, Math.min(100, Number(v.xmbArtworkIntensity))),
            customBackgroundMode: v.xmbMode,
            customBackgroundColor: v.xmbUseColor ? v.xmbColor : null,
            panelOpacity: Number(v.xmbTransparency) === transparency ? x.panelOpacity : 100 - Number(v.xmbTransparency) },
          background,
          opacity: Number(v.opacity),
          bannerHeight: Number(v.bannerHeight),
          cornerRadius: Number(v.cornerRadius),
        };
        for (const key of ['xmbSource','xmbUrl','xmbFile','xmbClear','xmbMode','xmbUseColor','xmbColor','xmbTransparency','xmbArtworkIntensity','xmbGhostEnabled','xmbGhostOpacity']) delete next[key];
        delete next.backgroundFile;
        delete next.clearBackground;
        if (next.bannerHeight < 180 || next.bannerHeight > 600)
          throw Error("Use uma altura entre 180 e 600 px.");
        if (!Number.isFinite(next.cornerRadius) || next.cornerRadius < 0 || next.cornerRadius > 24)
          throw Error("Use um arredondamento entre 0 e 24 px.");
        if (!save({ ...data, appearance: next }))
          throw Error(
            "Não foi possível salvar o fundo. Tente um arquivo menor.",
          );
        applyAppearance();
      },
    });
    const reset = button(
      "usar aparência do tema",
      () => {
        if (save({ ...data, appearance: {} })) {
          applyAppearance();
          resource.close();
        }
      },
      "small dialog-delete",
    );
    resource.querySelector(".form-actions").prepend(reset);
    window.EditorUI?.decorateAppearance(resource.querySelector("form"));
  }
  function applyAppearance() {
    const a = data.appearance || {},
      style = document.body.style;
    const x = xmbAppearance(a);
    document.body.dataset.xmbBackground = x.backgroundSource === 'inherit' ? 'desktop' : x.backgroundSource === 'custom' ? 'custom' : 'artwork';
    const wallpaper = wallpaperRecipe(x.customBackground, x.customBackgroundMode);
    for (const [key, value] of Object.entries(wallpaper)) style.setProperty('--xmb-wallpaper-' + key, value);
    style.setProperty('--xmb-background-color', /^#[0-9a-f]{6}$/i.test(x.customBackgroundColor || '') ? x.customBackgroundColor : 'var(--bg)');
    style.setProperty('--xmb-artwork-opacity', String(Math.max(0, Math.min(1, Number(x.artworkOpacity) || 0))));
    const intensity = Number.isFinite(Number(x.artworkIntensity)) ? Math.max(0, Math.min(100, Number(x.artworkIntensity))) / 100 : .5;
    style.setProperty('--xmb-artwork-blur', (8 + 32 * intensity) + 'px');
    style.setProperty('--xmb-atmosphere-opacity', String(.5 - .3 * intensity));
    document.body.dataset.xmbGhostArtwork = String(x.ghostArtworkEnabled !== false);
    const ghostIntensity = Number.isFinite(Number(x.ghostArtworkOpacity)) ? Math.max(0, Math.min(100, Number(x.ghostArtworkOpacity))) : 50;
    style.setProperty('--xmb-ghost-opacity', String(ghostIntensity * .0016));
    if (x.panelOpacity == null) style.removeProperty('--xmb-panel-opacity');
    else style.setProperty('--xmb-panel-opacity', Math.max(0, Math.min(100, Number(x.panelOpacity))) + '%');
    const onBanner = a.profileLayout === 'banner';
    document.body.dataset.layoutWidth = ['wide', 'full'].includes(a.layoutWidth) ? a.layoutWidth : 'original';
    const radius = Number(a.cornerRadius);
    style.setProperty('--corner-radius', (Number.isFinite(radius) ? Math.max(0, Math.min(24, radius)) : 0) + 'px');
    document.body.dataset.avatarShape = a.avatarShape === 'round' ? 'round' : 'square';
    document.body.dataset.avatarBorder = String(a.avatarBorder !== false);
    document.body.dataset.profileWindowBorder = String(a.profileWindowBorder !== false);
    $('profile').hidden = onBanner;
    bannerProfile.hidden = !onBanner;
    if (onBanner && profileInner.parentElement !== bannerProfile) bannerProfile.append(profileInner);
    if (!onBanner && profileInner.parentElement !== $('profile')) $('profile').insertBefore(profileInner, $('profile').querySelector('.profile-footer'));
    for (const name of [
      "--bg",
      "--panel",
      "--text",
      "--accent",
      "--border",
      "--panel2",
      "--muted",
      "--sans",
      "--display",
      "--panel-opacity",
    ])
      style.removeProperty(name);
    if (a.useColors) {
      for (const [key, name] of Object.entries({
        backgroundColor: "--bg",
        panelColor: "--panel",
        textColor: "--text",
        accentColor: "--accent",
        borderColor: "--border",
      }))
        if (/^#[0-9a-f]{6}$/i.test(a[key] || ""))
          style.setProperty(name, a[key]);
      style.setProperty(
        "--panel2",
        "color-mix(in srgb,var(--panel) 85%,var(--text))",
      );
      style.setProperty(
        "--muted",
        "color-mix(in srgb,var(--text) 70%,var(--panel))",
      );
    }
    const fonts = {
      mono: '"Courier New",monospace',
      verdana: "Verdana,sans-serif",
      serif: "Georgia,serif",
    };
    if (fonts[a.font]) {
      style.setProperty("--sans", fonts[a.font]);
      style.setProperty("--display", fonts[a.font]);
    }
    document.body.classList.toggle(
      "custom-panels",
      a.opacity !== undefined && a.opacity < 100,
    );
    style.setProperty(
      "--panel-opacity",
      Math.max(45, Math.min(100, a.opacity ?? 100)) + "%",
    );
    const bg = safeUrl(a.background, true);
    if (bg) {
      image(document.body, bg);
      const wallpaper = wallpaperRecipe(a.background, a.backgroundMode);
      style.backgroundSize = wallpaper.size;
      style.backgroundRepeat = wallpaper.repeat;
      style.backgroundPosition = "center";
      style.backgroundAttachment = "fixed";
    } else {
      for (const p of [
        "background-image",
        "background-size",
        "background-repeat",
        "background-position",
        "background-attachment",
      ])
        style.removeProperty(p);
    }
    for (const panel of document.querySelectorAll(".panel")) {
      panel.style.borderStyle = ["solid", "dashed", "double", "none"].includes(
        a.borderStyle,
      )
        ? a.borderStyle
        : "";
      panel.style.borderWidth = a.borderStyle === "double" ? "3px" : "";
    }
    $("banner").style.height = a.bannerHeight
      ? Math.min(600, Math.max(180, a.bannerHeight)) + "px"
      : "";
  }
  const originalRender = render;
  render = function () {
    originalRender();
    applyAppearance();
  };
  let arrangingFavorites = false;
  function renderFeaturedCollection() {
    const grid = el("div", "featured-grid");
    const favorites = data.items.filter(i => i.featured && (!Object.hasOwn(kinds, data.favoriteKind) || i.kind === data.favoriteKind)).slice(0,8);
    for (const [index,item] of favorites.entries()) {
      const card = button("", () => window.TitlePages?.open(item), "featured-card");
      card.dataset.layout = item.coverLayout || "vertical";
      card.dataset.kind = item.kind;
      const cover = el("div", "featured-cover");
      if (item.image) cover.append(imageNode(item.image, item.title));
      else cover.append(el("div", "featured-placeholder", kinds[item.kind]));
      card.append(cover);
      card.append(el("strong", "", item.title), el("small", "", statuses[item.status]));
      const entry = el('div','favorite-entry');entry.append(card);
      if (arrangingFavorites) {
        const tools = el('div','favorite-order');
        for (const [delta,label] of [[-1,'←'],[1,'→']]) {
          const move = button(label, () => {
            const neighbor=favorites[index+delta];if(!neighbor)return;
            const rows=data.items.slice(),from=rows.findIndex(row=>row.id===item.id),to=rows.findIndex(row=>row.id===neighbor.id);
            [rows[from],rows[to]]=[rows[to],rows[from]];
            if(save({...data,items:rows}))renderFeaturedCollection();
          });move.disabled=!favorites[index+delta];move.setAttribute('aria-label',(delta<0?'Mover antes: ':'Mover depois: ')+item.title);tools.append(move);
        }entry.append(tools);
      }
      grid.append(entry);
    }
    const selectedKind = Object.hasOwn(kinds, data.favoriteKind) ? data.favoriteKind : 'all';
    const heading = featuredCollection.head.querySelector('h3');
    heading.textContent = selectedKind === 'all' ? 'favoritos' : kinds[selectedKind].toLowerCase() + ' favoritos';
    const filters = el('div', 'favorite-filters');
    const select = el('select'); select.setAttribute('aria-label', 'Tipo de favoritos no perfil');
    select.append(new Option('Todos os favoritos', 'all'));
    for (const [key, label] of Object.entries(kinds)) select.append(new Option(label + ' favoritos', key));
    select.value = selectedKind;
    select.onchange = () => { if (save({ ...data, favoriteKind: select.value })) renderFeaturedCollection(); };
    const arrange = button(arrangingFavorites?'concluir organização':'ordenar favoritos',()=>{arrangingFavorites=!arrangingFavorites;renderFeaturedCollection();},'text-action favorite-arrange');arrange.setAttribute('aria-pressed',String(arrangingFavorites));arrange.disabled=favorites.length<2;
    filters.append(select,arrange);
    const content = [filters, grid];
    if (!grid.children.length) content.push(el('p', 'empty', 'Nenhum favorito deste tipo. Marque títulos na coleção ou escolha outro filtro.'));
    featuredCollection.body.replaceChildren(...content);
  }
  function renderExtras() {
    renderFeaturedVideo();
    renderFavorites();
    renderBadges();
    renderCollection();
    renderFeaturedCollection();
    renderGallery();
    renderBlocks();
    playlistController?.render();
    applyAppearance();
    applySectionOrder();
    applyProfileVisibility();
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
  const backupInfo=el('details','backup-info');backupInfo.append(el('summary','','estado do backup'));
  const backupDate=el('p','title-notice'),backupFiles=el('div','backup-files');
  function refreshBackupDate() {
    try { const last=JSON.parse(localStorage.getItem('myspace-last-backup') || 'null');backupDate.textContent=last&&Number.isFinite(last.at)?'Última exportação solicitada: '+new Date(last.at).toLocaleString('pt-BR')+' · '+(last.type==='package'?'com arquivos':'JSON sem arquivos locais'):'Você ainda não exportou um backup neste navegador.'; } catch {backupDate.textContent='Nenhuma exportação registrada.';}
  }
  function markBackup(type) {try{localStorage.setItem('myspace-last-backup',JSON.stringify({at:Date.now(),type}));}catch{}refreshBackupDate();}
  const inspectButton=button('verificar arquivos locais',async()=>{
    inspectButton.disabled=true;backupFiles.replaceChildren(el('p','','Verificando…'));
    try {
      const result=await MediaPackage.inspect(backupPayload());backupFiles.replaceChildren(el('p','',result.count+' arquivos vinculados · '+Math.round(result.totalBytes/1024/1024*10)/10+' MB disponíveis · '+result.missing.length+' ausentes'));
      for(const id of result.missing){const track=data.tracks.find(track=>track.id===id);const name=track?.fileName || (data.featuredVideo.localId===id?data.featuredVideo.fileName:'') || id;backupFiles.append(el('p','backup-missing',name+' · precisa ser vinculado novamente'));}
      if(!result.count)backupFiles.append(el('p','','Não há arquivos locais vinculados. Links de serviços externos permanecem links no backup.'));
    }catch(error){backupFiles.replaceChildren(el('p','error',error.message));}finally{inspectButton.disabled=false;}
  });
  backupInfo.append(backupDate,inspectButton,backupFiles);refreshBackupDate();
  function downloadBackup() {
    const payload = backupPayload();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = el("a");
    a.href = url;
    a.download =
      "myspace-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    markBackup('json');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup baixado com capas e banners. Arquivos locais de áudio/vídeo ficam neste navegador.");
  }
  footerTools.append(
    button("exportar backup", downloadBackup, ""),
    button('backup com arquivos', async event => {
      const control = event?.currentTarget; if (control) control.disabled = true;
      try {
        toast('Preparando o pacote com músicas e vídeos…');
        const result = await MediaPackage.create(backupPayload(), (done,total) => toast('Preparando arquivos: ' + done + ' / ' + total));
        const url = URL.createObjectURL(result.blob), anchor = el('a'); anchor.href = url; anchor.download = 'myspace-' + new Date().toISOString().slice(0,10) + '.myspace'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        markBackup('package');
        toast(result.missing.length ? 'Pacote baixado. ' + result.missing.length + ' arquivos não estão mais neste navegador.' : 'Pacote completo baixado com seus arquivos locais.');
      } catch (error) { toast(error.message || 'Não consegui preparar o pacote.'); }
      finally { if (control) control.disabled = false; }
    }, ''),
    button("importar backup", () => importInput.click(), ""),
  );
  document.querySelector("footer").append(footerTools);
  document.querySelector('footer').append(backupInfo);
  importInput.onchange = async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const isPackage = /\.myspace$/i.test(file.name || '');
      if (!isPackage && file.size > 50 * 1024 * 1024)
        throw Error("O backup é grande demais.");
      const packageData = isPackage ? await MediaPackage.read(file) : null;
      const payload = packageData?.payload || JSON.parse(await file.text());
      if (
        payload.format !== "myspace-backup" ||
        payload.version !== 1 ||
        !payload.profile ||
        !payload.extras
      )
        throw Error("Esse arquivo não é um backup do perfil.");
      const next = emptyData();
      const titlePreferences = payload.titlePreferences === undefined ? null : TitlePreferences.validate(payload.titlePreferences);
      for (const key of [
        "items",
        "favorites",
        "badges",
        "photos",
        "blocks",
        "tracks",
      ]) {
        if (
          !Array.isArray(payload.extras[key]) ||
          payload.extras[key].length > 500
        )
          throw Error("Backup inválido.");
        next[key] = payload.extras[key];
        for (const item of next[key]) {
          if (!item || typeof item !== "object" || typeof item.id !== "string")
            throw Error("Item inválido no backup.");
          for (const [field, v] of Object.entries(item))
            if (typeof v === 'object' && v !== null && !(['lists', 'genres', 'platforms', 'developers', 'publishers', 'screenshots', 'categories', 'dlcIds', 'relatedIds', 'packages', 'studios', 'synonyms', 'relationIds', 'relationTitles', 'relationImages', 'relationKinds', 'relationTypes', 'subjectPlaces', 'subjectPeople', 'subjectTimes', 'characterNames', 'characterImages', 'characterUrls', 'characterRoles', 'recommendationIds', 'recommendationTitles', 'recommendationImages', 'recommendationKinds', 'trackNames', 'artworks', 'artworkLabels', 'videoIds', 'videoTitles', 'localizedCoverImages', 'localizedCoverLabels', 'relatedGameIds', 'relatedGameTitles', 'relatedGameImages', 'relatedGameTypes', 'relatedGameYears'].includes(field) && Array.isArray(v) && v.length <= 100 && v.every(entry => typeof entry === 'string')))
              throw Error("Item inválido no backup.");
        }
      }
      for (const key of ["favorites", "badges"])
        for (const item of next[key])
          if (typeof item.name !== "string" || !item.name.trim())
            throw Error("Nome inválido no backup.");
      for (const key of ["blocks", "tracks"])
        for (const item of next[key])
          if (typeof item.title !== "string" || !item.title.trim())
            throw Error("Título inválido no backup.");
      for (const item of next.photos)
        if (typeof item.image !== "string" || !safeUrl(item.image, true))
          throw Error("Foto inválida no backup.");
      for (const key of [
        "items",
        "favorites",
        "badges",
        "photos",
        "blocks",
        "tracks",
      ]) {
        if (new Set(next[key].map((i) => i.id)).size !== next[key].length)
          throw Error("IDs repetidos no backup.");
        for (const item of next[key])
          for (const field of [
            "image",
            "caption",
            "url",
            "text",
            "linkText",
            "artist",
            "album",
            "fileName",
          ])
            if (item[field] !== undefined && typeof item[field] !== "string")
              throw Error("Campo inválido no backup.");
      }
      next.items = next.items.map(validateItem);
      if (payload.extras.history !== undefined) {
        if (!Array.isArray(payload.extras.history) || payload.extras.history.length > 100) throw Error('Histórico inválido.');
        next.history = payload.extras.history.map(row => {
          if (!row || typeof row.title !== 'string' || typeof row.id !== 'string' || !Number.isFinite(row.at) || !Array.isArray(row.fields) || row.fields.some(value => typeof value !== 'string')) throw Error('Histórico inválido.');
          const snapshot = value => value && typeof value === 'object' ? { status:String(value.status || '').slice(0,30), score:typeof value.score === 'number' ? value.score : null, progress:typeof value.progress === 'number' ? value.progress : 0 } : null;
          return { title:row.title.slice(0,120),id:row.id.slice(0,150),at:row.at,fields:row.fields.slice(0,20).map(value => value.slice(0,40)),before:snapshot(row.before),after:snapshot(row.after) };
        });
      }
      if (next.favorites.length > 8) throw Error("O top 8 tem itens demais.");
      if (
        payload.extras.appearance &&
        (typeof payload.extras.appearance !== "object" ||
          Array.isArray(payload.extras.appearance))
      )
        throw Error("Aparência inválida no backup.");
      const importedVideo = payload.extras.featuredVideo;
      if (importedVideo?.url && MediaEmbeds.parse(importedVideo.url)?.provider !== 'youtube' && !MediaEmbeds.directVideo(importedVideo.url)) throw Error('Vídeo inválido no backup.');
      if (importedVideo?.localId && (typeof importedVideo.localId !== 'string' || !/^featured-video:[a-zA-Z0-9-]{1,100}$/.test(importedVideo.localId))) throw Error('Vídeo local inválido no backup.');
      next.featuredVideo = { localId: importedVideo?.localId || '', fileName: typeof importedVideo?.fileName === 'string' ? importedVideo.fileName : '', thumbnail: safeUrl(importedVideo?.thumbnail) || '', url: importedVideo?.url || '', title: typeof importedVideo?.title === 'string' ? importedVideo.title.slice(0, 120) : '' };
      next.appearance = payload.extras.appearance || {};
      next.sectionOrder = normalizeSectionOrder(payload.extras.sectionOrder);
      next.favoriteKind = Object.hasOwn(kinds, payload.extras.favoriteKind) ? payload.extras.favoriteKind : "all";
      next.visibility = {};
      for (const k of [
        "about",
        "music",
        "wall",
        "mood",
        "interests",
        "favorites",
        "badges",
        "blocks",
        "featured",
        "video",
      ])
        if (typeof payload.extras.visibility?.[k] === "boolean")
          next.visibility[k] = payload.extras.visibility[k];
      for (const k of ["activeTrack", "startTrack"])
        next[k] = next.tracks.some((t) => t.id === payload.extras[k])
          ? payload.extras[k]
          : next.tracks[0]?.id || "";
      const profile = { ...defaults };
      for (const key of Object.keys(defaults))
        if (typeof payload.profile[key] === "string")
          profile[key] = payload.profile[key];
      openResource({
        title: "importar backup",
        fields: [],
        help: "Isso substitui o perfil, a coleção e as personalizações dos títulos presentes no backup. " + (packageData ? 'O pacote inclui ' + packageData.files.length + ' arquivos locais, que serão restaurados junto com o perfil.' : 'Arquivos locais de áudio/vídeo podem precisar ser vinculados novamente.'),
        onSave: async () => {
          const oldProfile = localStorage.getItem("myspace-profile-v1");
          const rollbackMedia = await MediaPackage.restore(packageData?.files || []);
          let rollbackPreferences;
          try { rollbackPreferences = titlePreferences === null ? () => {} : TitlePreferences.replace(titlePreferences); }
          catch (error) { await rollbackMedia(); throw error; }
          if (!persist(profile)) {
            rollbackPreferences(); await rollbackMedia(); throw Error("Não foi possível salvar o perfil.");
          }
          if (!save(next, false)) {
            if (oldProfile)
              localStorage.setItem("myspace-profile-v1", oldProfile);
            else localStorage.removeItem("myspace-profile-v1");
            rollbackPreferences();
            await rollbackMedia();
            throw Error("Não foi possível importar o backup.");
          }
        window.Undo?.clear();
        playlistController.cancel();
          if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
          localVideoUrl = ''; localVideoId = '';
          state = profile;
          localAudio = "";
          loadedSource = "";
          render();
          renderExtras();
          applyRoute();
          if (data.tracks.length)
            await playlistController.selectTrack(
              data.startTrack || data.tracks[0].id,
            );
        },
      });
    } catch (e) {
      toast(e.message || "Não foi possível importar o backup.");
    }
    importInput.value = "";
  };
  renderExtras();
  applyRoute();
  if (data.tracks.length)
    playlistController.selectTrack(
      data.startTrack || data.activeTrack || data.tracks[0].id,
    );
})();


