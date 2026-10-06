/* Apresentação e edição dos extras do perfil; dados e gravação pertencem ao compositor. */
function createProfileExtrasView({
  getData,
  save,
  onChange,
  isGalleryActive,
  navigate,
  el,
  button,
  section,
  imageNode,
  link,
  move,
  editor,
  videoFiles,
  MediaEmbeds,
  uid,
}) {
  const {
    openResource,
    schemaField,
    imageFields,
    resolveImage,
    storeItem,
    resource,
  } = editor;
  const { kinds, statuses } = Collection;
  const main = document.querySelector(".main-column"),
    aside = document.querySelector("aside");
  let galleryDirty = true;
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

  const favorites = section("top 8", "favorites", aside, () => editFavorite());
  const badges = section("selinhos", "badges", aside, () => editBadge());

  const video = section(
    "vídeo em destaque",
    "featuredVideo",
    main,
    editFeaturedVideo,
  );
  video.head.lastChild.textContent = "editar vídeo";
  video.body.className = "featured-video-body";
  main.insertBefore(video.box, $("music"));
  let localVideoUrl = "",
    localVideoId = "",
    videoRenderVersion = 0;
  function editFeaturedVideo() {
    openResource({
      title: "vídeo em destaque",
      item: getData().featuredVideo || {},
      fields: [
        schemaField("title", "Legenda (opcional)", "text", { maxLength: 120 }),
        schemaField("url", "Link do YouTube ou vídeo MP4/WebM", "url"),
        schemaField(
          "videoFile",
          "Ou envie um vídeo local (até 200 MB)",
          "file",
          { accept: "video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv" },
        ),
        schemaField("removeVideo", "Remover vídeo do perfil", "checkbox"),
      ],
      onSave: async (v) => {
        const previous = getData().featuredVideo || {};
        if (v.removeVideo) {
          if (save({ ...getData(), featuredVideo: {} })) {
            onChange();
            if (previous.localId)
              videoFiles.remove(previous.localId).catch(() => {});
          }
          return;
        }
        if (v.videoFile) {
          if (v.videoFile.size > 200 * 1024 * 1024)
            throw Error("Escolha um vídeo de até 200 MB.");
          if (!/\.(mp4|webm|ogv)$/i.test(v.videoFile.name))
            throw Error("Use um arquivo MP4, WebM ou OGV.");
          const localId = "featured-video:" + uid();
          await videoFiles.write(localId, v.videoFile);
          if (
            save({
              ...getData(),
              featuredVideo: {
                title: v.title || v.videoFile.name,
                url: "",
                localId,
                fileName: v.videoFile.name,
              },
            })
          ) {
            onChange();
            if (previous.localId)
              videoFiles.remove(previous.localId).catch(() => {});
          } else await videoFiles.remove(localId);
          return;
        }
        if (previous.localId && !v.url) {
          if (
            save({
              ...getData(),
              featuredVideo: { ...previous, title: v.title },
            })
          )
            onChange();
          return;
        }
        const embed = MediaEmbeds.parse(v.url);
        const direct = MediaEmbeds.directVideo(v.url);
        if (v.url && embed?.provider !== "youtube" && !direct)
          throw Error("Use um link do YouTube ou de arquivo MP4/WebM.");
        const info = embed ? await MediaEmbeds.metadata(embed.url) : null;
        if (
          save({
            ...getData(),
            featuredVideo: {
              title: v.title || info?.title || "",
              url: embed?.url || direct,
              thumbnail: info?.thumbnail || "",
            },
          })
        ) {
          onChange();
          if (previous.localId)
            videoFiles.remove(previous.localId).catch(() => {});
        }
      },
    });
  }
  async function renderFeaturedVideo() {
    const version = ++videoRenderVersion;
    const selected = getData().featuredVideo || {};
    if (localVideoId !== (selected.localId || "")) {
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
      localVideoUrl = "";
      localVideoId = selected.localId || "";
    }
    if (selected.localId && !localVideoUrl) {
      let file;
      try {
        file = await videoFiles.read(selected.localId);
      } catch {}
      if (version !== videoRenderVersion) return;
      if (!file) {
        video.body.replaceChildren(
          el(
            "p",
            "empty",
            "Vídeo local indisponível. Use editar vídeo para selecionar o arquivo novamente.",
          ),
        );
        return;
      }
      localVideoUrl = URL.createObjectURL(file);
    }
    const embed = MediaEmbeds.parse(getData().featuredVideo?.url);
    const direct =
      localVideoUrl || MediaEmbeds.directVideo(getData().featuredVideo?.url);
    if (embed?.provider !== "youtube" && !direct) {
      video.body.replaceChildren();
      return;
    }
    const source = embed?.src || direct;
    if (video.body.firstElementChild?.dataset.source !== source) {
      if (embed)
        video.body.replaceChildren(
          MediaEmbeds.surface(
            embed,
            getData().featuredVideo.title || "Vídeo em destaque",
            getData().featuredVideo,
          ),
        );
      else {
        const player = el("video", "direct-video");
        player.controls = true;
        player.preload = "metadata";
        player.src = direct;
        player.dataset.source = source;
        video.body.replaceChildren(player);
      }
    }
    let caption = video.body.querySelector("p");
    if (!caption) {
      caption = el("p", "video-caption");
      video.body.append(caption);
    }
    caption.textContent = getData().featuredVideo.title || "";
    caption.hidden = !caption.textContent;
  }
  const featuredCollection = section(
    "favoritos",
    "featuredCollection",
    main,
    () => navigate("colecao"),
  );
  featuredCollection.head.lastChild.textContent = "escolher títulos";
  main.insertBefore(featuredCollection.box, $("music"));
  const gallery = section("// fotos", "gallery", main, () => editPhoto());
  const blocks = el("div");
  blocks.id = "customBlocks";
  main.append(blocks);
  const blockAdd = button("＋ criar um bloco", () => editBlock());
  main.append(blockAdd);

  function applyProfileVisibility() {
    const visibility = getData().visibility || {};
    for (const [key, node] of Object.entries({
      about: $("about"),
      music: document.getElementById("ampHome") || $("music"),
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
        (key === "video" &&
          !getData().featuredVideo?.url &&
          !getData().featuredVideo?.localId) ||
        visibility[key] === false ||
        (key === "favorites" && !getData().favorites.length) ||
        (key === "badges" && !getData().badges.length) ||
        (key === "blocks" && !getData().blocks.length);
      if (key === "featured" && !getData().items.some((i) => i.featured))
        node.hidden = true;
    }
  }
  const sectionGroups = {
    main: ["about", "featured", "video", "music", "wall", "blocks"],
    sidebar: ["profile", "mood", "interests", "favorites", "badges"],
  };
  const sectionTitles = {
    profile: "Janela do perfil",
    about: "Sobre mim",
    featured: "Favoritos",
    video: "Vídeo em destaque",
    music: "Player de música",
    wall: "Mural",
    blocks: "Blocos livres",
    mood: "Mood",
    interests: "Interesses",
    favorites: "Top 8",
    badges: "Selinhos",
  };
  function normalizeSectionOrder(value = {}) {
    const result = {};
    for (const [group, defaults] of Object.entries(sectionGroups)) {
      const selected = Array.isArray(value?.[group]) ? value[group] : [];
      result[group] = [
        ...new Set(selected.filter((key) => defaults.includes(key))),
        ...defaults.filter((key) => !selected.includes(key)),
      ];
    }
    return result;
  }
  function applySectionOrder() {
    const nodes = {
      profile: $("profile"),
      about: $("about"),
      featured: featuredCollection.box,
      video: video.box,
      music: document.getElementById("ampHome") || $("music"),
      wall: $("wallText").parentElement.parentElement,
      blocks,
      mood: $("moodCard").parentElement.parentElement.parentElement,
      interests: $("interestTags").parentElement,
      favorites: favorites.box,
      badges: badges.box,
    };
    const order = normalizeSectionOrder(getData().sectionOrder);
    for (const keys of Object.values(order))
      keys.forEach((key, index) => {
        nodes[key].style.order = String(index);
      });
    blockAdd.style.order = "100";
  }
  function moveSection(group, key, direction) {
    const order = normalizeSectionOrder(getData().sectionOrder);
    const index = order[group].indexOf(key),
      target = index + direction;
    if (target < 0 || target >= order[group].length) return;
    [order[group][index], order[group][target]] = [
      order[group][target],
      order[group][index],
    ];
    if (save({ ...getData(), sectionOrder: order })) {
      applySectionOrder();
      manageSections();
    }
  }
  function manageSections() {
    resource.replaceChildren();
    const body = el("div", "editor-body");
    body.append(el("h2", "", "Seções do perfil"));
    body.append(
      el(
        "p",
        "note-hint",
        "Use as setas para ordenar os blocos em cada coluna. A ordem fica salva mesmo quando uma seção está oculta.",
      ),
    );
    const order = normalizeSectionOrder(getData().sectionOrder);
    for (const [group, keys] of Object.entries(order)) {
      body.append(
        el(
          "h3",
          "section-order-title",
          group === "main" ? "Coluna principal" : "Lateral",
        ),
      );
      const list = el("div", "section-order-list");
      keys.forEach((key, index) => {
        const row = el("div", "section-order-row");
        row.dataset.sectionKey = key;
        const label = el("label", "check-label", sectionTitles[key]);
        const input = el("input");
        input.type = "checkbox";
        input.checked = getData().visibility?.[key] !== false;
        if (key === "profile") {
          input.disabled = true;
          input.checked = getData().appearance?.profileLayout !== "banner";
          label.title =
            "A posição do perfil é configurada em Aparência → Perfil.";
        }
        input.onchange = () => {
          if (
            save({
              ...getData(),
              visibility: { ...getData().visibility, [key]: input.checked },
            })
          )
            applyProfileVisibility();
        };
        label.prepend(input);
        const controls = el("div", "section-order-controls");
        for (const [direction, text] of [
          [-1, "↑"],
          [1, "↓"],
        ]) {
          const control = button(text, () =>
            moveSection(group, key, direction),
          );
          control.disabled =
            direction < 0 ? index === 0 : index === keys.length - 1;
          control.setAttribute(
            "aria-label",
            (direction < 0 ? "Subir " : "Descer ") + sectionTitles[key],
          );
          controls.append(control);
        }
        row.append(label, controls);
        list.append(row);
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

  function editFavorite(item) {
    if (!item && getData().favorites.length >= 8) {
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
    if (!getData().favorites.length) {
      favorites.body.append(
        el("p", "empty", "Seus amigos, personagens ou sites favoritos."),
      );
      return;
    }
    const grid = el("div", "favorites-grid");
    for (const item of getData().favorites) {
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
    if (!getData().badges.length) {
      badges.body.append(el("p", "empty", "Adicione seus selinhos 88 × 31."));
      return;
    }
    const list = el("div", "badge-list");
    for (const item of getData().badges) {
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
    galleryDirty = false;
    gallery.body.replaceChildren();
    if (!getData().photos.length) {
      gallery.body.append(el("p", "empty", "Ainda não tem fotos aqui."));
      return;
    }
    const grid = el("div", "gallery-grid");
    for (const photo of getData().photos) {
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
    for (const item of getData().blocks) {
      const box = el("section", "panel"),
        head = el("div", "section-head");
      head.append(el("h3", "", item.title), actions("blocks", item, editBlock));
      const body = el("div", "block-body", item.text);
      if (item.url) body.append(link(item.url, item.linkText || item.url));
      box.append(head, body);
      blocks.append(box);
    }
  }

  let arrangingFavorites = false;
  function renderFeaturedCollection() {
    const grid = el("div", "featured-grid");
    const favorites = getData()
      .items.filter(
        (i) =>
          i.featured &&
          (!Object.hasOwn(kinds, getData().favoriteKind) ||
            i.kind === getData().favoriteKind),
      )
      .slice(0, 8);
    for (const [index, item] of favorites.entries()) {
      const card = button(
        "",
        () => window.TitlePages?.open(item),
        "featured-card",
      );
      card.dataset.layout = item.coverLayout || "vertical";
      card.dataset.kind = item.kind;
      const cover = el("div", "featured-cover");
      if (item.image) cover.append(imageNode(item.image, item.title));
      else cover.append(el("div", "featured-placeholder", kinds[item.kind]));
      card.append(cover);
      card.append(
        el("strong", "", item.title),
        el("small", "", statuses[item.status]),
      );
      const entry = el("div", "favorite-entry");
      entry.append(card);
      if (arrangingFavorites) {
        const tools = el("div", "favorite-order");
        for (const [delta, label] of [
          [-1, "←"],
          [1, "→"],
        ]) {
          const move = button(label, () => {
            const neighbor = favorites[index + delta];
            if (!neighbor) return;
            const rows = getData().items.slice(),
              from = rows.findIndex((row) => row.id === item.id),
              to = rows.findIndex((row) => row.id === neighbor.id);
            [rows[from], rows[to]] = [rows[to], rows[from]];
            if (save({ ...getData(), items: rows })) renderFeaturedCollection();
          });
          move.disabled = !favorites[index + delta];
          move.setAttribute(
            "aria-label",
            (delta < 0 ? "Mover antes: " : "Mover depois: ") + item.title,
          );
          tools.append(move);
        }
        entry.append(tools);
      }
      grid.append(entry);
    }
    const selectedKind = Object.hasOwn(kinds, getData().favoriteKind)
      ? getData().favoriteKind
      : "all";
    const heading = featuredCollection.head.querySelector("h3");
    heading.textContent =
      selectedKind === "all"
        ? "favoritos"
        : kinds[selectedKind].toLowerCase() + " favoritos";
    const filters = el("div", "favorite-filters");
    const select = el("select");
    select.setAttribute("aria-label", "Tipo de favoritos no perfil");
    select.append(new Option("Todos os favoritos", "all"));
    for (const [key, label] of Object.entries(kinds))
      select.append(new Option(label + " favoritos", key));
    select.value = selectedKind;
    select.onchange = () => {
      if (save({ ...getData(), favoriteKind: select.value }))
        renderFeaturedCollection();
    };
    const arrange = button(
      arrangingFavorites ? "concluir organização" : "ordenar favoritos",
      () => {
        arrangingFavorites = !arrangingFavorites;
        renderFeaturedCollection();
      },
      "text-action favorite-arrange",
    );
    arrange.setAttribute("aria-pressed", String(arrangingFavorites));
    arrange.disabled = favorites.length < 2;
    filters.append(select, arrange);
    const content = [filters, grid];
    if (!grid.children.length)
      content.push(
        el(
          "p",
          "empty",
          "Nenhum favorito deste tipo. Marque títulos na coleção ou escolha outro filtro.",
        ),
      );
    featuredCollection.body.replaceChildren(...content);
  }

  function ensureGallery() {
    if (isGalleryActive() && galleryDirty) renderGallery();
  }
  function render() {
    renderFeaturedVideo();
    renderFavorites();
    renderBadges();
    renderFeaturedCollection();
    ensureGallery();
    renderBlocks();
  }
  return {
    openPhoto: showPhoto,
    galleryRoot: gallery.box,
    render,
    renderFeaturedCollection,
    invalidatePhotos: () => {
      galleryDirty = true;
    },
    ensureGallery,
    applyVisibility: applyProfileVisibility,
    applySectionOrder,
    normalizeSectionOrder,
  };
}
