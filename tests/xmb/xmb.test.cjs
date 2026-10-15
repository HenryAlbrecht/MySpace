const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Collection = require("../../dist/collection/collection.js");
const { createSampler } = require("../../dist/xmb/xmb-input.js");

function setup({ fullscreen = "reject", items, gamePresentation, extendedDom = false } = {}) {
  const listeners = {},
    windowListeners = {};
  let doc;
  class Node {
    constructor(tag, className = "", text = "") {
      this.tagName = tag.toUpperCase();
      this.className = className;
      this.textContent = text;
      this.children = [];
      this.attributes = {};
      this.dataset = {};
      this.tabIndex = 0;
      this.inert = false;
      this.hidden = false;
      this.scrollTop = 0;
      this.clientHeight = 400;
      this.offsetTop = 0;
      this.offsetHeight = 40;
      this.style = {
        setProperty: (key, value) => {
          this.style[key] = String(value);
        },
        getPropertyValue: (key) => this.style[key] || "",
      };
      this.classList = {
        add: (...names) => {
          if (!extendedDom || !this.className.split(" ").includes("xmb-art-options-preview")) return;
          this.className = [...new Set([...this.className.split(" "), ...names])].join(" ");
        },
        remove() {},
      };
      this.type = "";
      this.src = "";
    }
    addEventListener(type, listener) {
      (this.listeners ||= {})[type] = listener;
    }
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
      }
    }
    replaceChildren(...nodes) {
      this.children = [];
      this.append(...nodes);
    }
    cloneNode(deep = false) {
      const clone = new Node(this.tagName, this.className, this.textContent);
      clone.attributes = { ...this.attributes };
      clone.dataset = { ...this.dataset };
      clone.tabIndex = this.tabIndex;
      clone.inert = this.inert;
      clone.hidden = this.hidden;
      clone.scrollTop = this.scrollTop;
      clone.clientHeight = this.clientHeight;
      clone.offsetTop = this.offsetTop;
      clone.offsetHeight = this.offsetHeight;
      clone.style = { ...this.style };
      if (deep) {
        clone.append(...this.children.map((child) => child.cloneNode(true)));
      }
      return clone;
    }
    remove() {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
      }
    }
    get isConnected() {
      return this === doc.body || !!this.parent?.isConnected;
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    focus() {
      doc.activeElement = this;
    }
    click() {
      this.clickCount = (this.clickCount || 0) + 1;
      this.onclick?.();
    }
    select() {}
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    getClientRects() {
      return this.hidden ? [] : [{}];
    }
    matches(selector) {
      return selector.split(",").some((part) => {
        const value = part.trim();
        if (value === "button") return this.tagName === "BUTTON";
        if (value === "img") return this.tagName === "IMG";
        if (value === 'input[type="file"]')
          return this.tagName === "INPUT" && this.type === "file";
        if (value === 'input:not([type="file"])')
          return this.tagName === "INPUT" && this.type !== "file";
        if (value === 'button,input[type=checkbox]')
          return this.tagName === "BUTTON" || (this.tagName === "INPUT" && this.type === "checkbox");
        if (value === ".xmb-art-options-quick-actions button")
          return (
            this.tagName === "BUTTON" &&
            this.parent?.className.split(" ").includes("xmb-art-options-quick-actions")
          );
        if (value === ".xmb-art-options-media-actions button")
          return (
            this.tagName === "BUTTON" &&
            this.parent?.className.includes("xmb-art-options-media-actions")
          );
        if (value.startsWith(".")) return this.className.split(" ").includes(value.slice(1));
        return false;
      });
    }
    contains(node) {
      return node === this || this.children.some((child) => child.contains(node));
    }
    scrollIntoView() {}
    querySelectorAll(selector) {
      if (selector === ":scope > .xmb-item") {
        return this.children.filter((node) => node.className === "xmb-item");
      }
      if (!extendedDom) {
        const match = (node) =>
          selector === "button"
            ? node.tagName === "BUTTON"
            : selector === "img"
              ? node.tagName === "IMG"
              : selector === ".xmb-item"
                ? node.className === "xmb-item"
                : selector === '[aria-pressed="true"]' && node.attributes["aria-pressed"] === "true";
        return this.children.flatMap((node) => [
          ...(match(node) ? [node] : []),
          ...node.querySelectorAll(selector),
        ]);
      }
      return this.children.flatMap((node) => [
        ...(node.matches(selector) ||
        (selector === '[aria-pressed="true"]' && node.attributes["aria-pressed"] === "true")
          ? [node]
          : []),
        ...node.querySelectorAll(selector),
      ]);
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0];
    }
    closest(selector) {
      if (selector === ".xmb-exit" || selector === ".xmb-page")
        return this.className.split(" ").includes(selector.slice(1))
          ? this
          : this.parent?.closest(selector);
      if (!extendedDom)
        return ["INPUT", "TEXTAREA", "SELECT"].includes(this.tagName) || this.isContentEditable
          ? this
          : null;
      if (selector.startsWith(".xmb-art-options-"))
        return this.matches(selector) ? this : this.parent?.closest(selector) || null;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(this.tagName) || this.isContentEditable
        ? this
        : null;
    }
    removeAttribute(key) {
      delete this.attributes[key];
      if (key === "src") this.src = "";
    }
  }
  doc = {
    body: new Node("body"),
    documentElement: new Node("html"),
    addEventListener: (key, fn) => {
      listeners[key] = fn;
    },
  };
  doc.documentElement.requestFullscreen = () =>
    fullscreen === "reject"
      ? Promise.reject(Error("denied"))
      : Promise.resolve().then(() => {
          doc.fullscreenElement = doc.documentElement;
          listeners.fullscreenchange();
        });
  doc.exitFullscreen = () => {
    doc.fullscreenElement = null;
    listeners.fullscreenchange();
    return Promise.resolve();
  };
  const normal = new Node("main"),
    trigger = new Node("button");
  normal.append(trigger);
  doc.body.append(normal);
  const data = {
    appearance: { xmb: gamePresentation ? { gamePresentation } : {} },
    items: items || [
      {
        id: "a",
        kind: "game",
        title: "Persona",
        status: "active",
        progress: 2,
        total: 12,
        score: 0,
      },
      { id: "b", kind: "game", title: "Burnout", status: "planned" },
      { id: "c", kind: "music", title: "Duvet", status: "done" },
    ],
    photos: [{ id: "photo", caption: "Foto real", image: "photo.png" }],
  };
  const filters = { kind: "game", sort: "title" },
    opened = [];
  const ctx = vm.createContext({
    Collection,
    URLSearchParams,
    fetch: async () => ({ ok: false, json: async () => ({ error: "fetch não configurado" }) }),
    document: doc,
    window: {
      setTimeout: () => 1,
      clearTimeout() {},
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: (key, fn) => {
        windowListeners[key] = fn;
      },
      getComputedStyle: () => ({
        getPropertyValue: (key) =>
          ({
            "--motion-fast": "150ms",
            "--motion-focus": "180ms",
            "--ease-xmb": "cubic-bezier(.16, 1, .3, 1)",
            "--xmb-music-selected-art-scale": "1.84",
          })[key] || "",
      }),
    },
  });
  vm.runInContext(fs.readFileSync("dist/xmb/xmb.js", "utf8"), ctx);
  const xmb = ctx.createXmb({
    getData: () => data,
    getProfile: () => ({ name: "Halourt", bio: "Bio real" }),
    getFilters: () => filters,
    openItem: (item) => opened.push(item),
    navigate: (page) => opened.push(page),
    openPhoto: (item) => opened.push(item),
    el: (...args) => new Node(...args),
    button: (text, onclick, className) => {
      const node = new Node("button", className, text);
      node.onclick = onclick;
      return node;
    },
    imageNode: (src, alt) => {
      const node = new Node("img", "", alt);
      node.offsetHeight = 84;
      return node;
    },
  });
  const root = () => doc.body.children.find((node) => node.className === "xmb");
  function key(key, extras = {}) {
    const event = {
      key,
      target: doc.activeElement || root(),
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {},
      ...extras,
    };
    listeners.keydown(event);
    return event;
  }
  const selected = () =>
    root()
      .querySelectorAll(".xmb-item")
      .find((node) => node.attributes["aria-pressed"] === "true")?.textContent;
  return {
    xmb,
    doc,
    data,
    filters,
    trigger,
    normal,
    root,
    key,
    selected,
    opened,
    listeners,
    windowListeners,
    window: ctx.window,
    ctx,
  };
}

function musicItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `track-${index}`,
    kind: "music",
    title: `Track ${String(index + 1).padStart(2, "0")}`,
  }));
}

function enterMusicFolder(h) {
  h.key("ArrowRight");
  assert.equal(h.root().dataset.level, "folders");
  h.key("Enter");
  assert.equal(h.root().dataset.folderDepth, "true");
  assert.equal(h.root().dataset.kind, "music");
}

function musicBackdropHarness({ background = "song-bg.jpg", playing = true } = {}) {
  const h = setup({ extendedDom: true, items: [
    { id: "song", kind: "music", title: "Song", artist: "Artist", image: "song.jpg",
      albumCatalogId: "album-id", xmbArt: background ? { background } : {} },
    { id: "album", kind: "album", catalogId: "album-id", title: "Album",
      image: "album.jpg", xmbArt: { image: "album-custom.jpg" } },
    { id: "game", kind: "game", title: "Game", image: "game.jpg", xmbPinned: true },
  ] });
  h.data.appearance.xmb.gameWallpaperTransitionEnabled = false;
  const state = { available: true, playing, title: "Song", collectionId: "song", artwork: "player.jpg" };
  h.window.SPACEAMP = { getPlaybackState: () => state };
  h.window.matchMedia = () => ({ matches: false });
  h.filters.kind = "music";
  h.xmb.enter(h.trigger);
  return {
    h, state,
    source: () => h.root().querySelector(".xmb-backdrop").children
      .find((node) => node.dataset.artworkSource)?.dataset.artworkSource,
    change: () => h.windowListeners["spaceamp:playstate"]({ type: "spaceamp:playstate" }),
  };
}

test("mídia XMB: fundo personalizado permanece pausado em Música e ondas seguem playback", () => {
  const { h, state, source, change } = musicBackdropHarness();
  assert.equal(source(), "song-bg.jpg");
  assert.equal(h.root().querySelector(".xmb-music-surface").dataset.wave, "true");
  state.playing = false;
  change();
  assert.equal(source(), "song-bg.jpg");
  assert.equal(h.root().querySelector(".xmb-music-surface").dataset.wave, "false");
  h.key("ArrowRight");
  assert.equal(h.root().dataset.musicBackdrop, "false");
  state.playing = true;
  change();
  assert.equal(source(), "song-bg.jpg");
  assert.equal(h.root().dataset.musicBackdrop, "true");
  h.window.matchMedia = () => ({ matches: true });
  change();
  assert.equal(h.root().querySelector(".xmb-music-surface").dataset.wave, "false");
});

test("mídia XMB: capa herdada do álbum, preferência e arte do jogo têm prioridade", () => {
  const { h, state, source, change } = musicBackdropHarness({ background: "" });
  assert.equal(source(), "album-custom.jpg");
  h.key("ArrowLeft");
  assert.equal(source(), "game.jpg");
  assert.equal(h.root().dataset.musicBackdrop, "false");
  h.key("ArrowRight");
  assert.equal(source(), "album-custom.jpg");
  h.data.appearance.xmb.musicBackdropEnabled = false;
  change();
  assert.equal(h.root().dataset.musicBackdrop, "false");
  assert.equal(h.root().querySelector(".xmb-backdrop").hidden, true);
  state.stopped = true;
  change();
  h.xmb.close();
  assert.equal(h.root().querySelector(".xmb-music-surface").dataset.wave, "false");
});

test("mídia XMB: troca imagem/vídeo sem transição substitui o elemento e libera o anterior", () => {
  const { h, source, change } = musicBackdropHarness();
  const track = h.data.items.find((item) => item.id === "song");
  track.xmbArt = { background: "background.mp4", backgroundVideo: true };
  change();
  const backdrop = h.root().querySelector(".xmb-backdrop");
  const video = backdrop.children.find((node) => node.dataset.artworkSource);
  assert.equal(video.tagName, "VIDEO");
  assert.equal(source(), "background.mp4");
  let paused = 0;
  video.pause = () => { paused++; };
  track.xmbArt = { background: "new-background.jpg" };
  change();
  assert.equal(paused, 1);
  assert.equal(video.isConnected, false);
  assert.equal(source(), "new-background.jpg");
  assert.equal(backdrop.children.find((node) => node.dataset.artworkSource).tagName, "IMG");
});

test("mídia XMB: editor da faixa salva a capa compartilhada no álbum associado", async () => {
  const { h } = musicBackdropHarness();
  h.data.items.find((item) => item.id === "song").xmbArt.background = "/song-bg.jpg";
  h.window.CollectionActions = {
    getItems: () => h.data.items,
    updateItem(id, patch) {
      const item = h.data.items.find((row) => row.id === id);
      Object.assign(item, patch);
      return item;
    },
  };
  h.ctx.XmbArtworkStorage = h.window.XmbArtworkStorage = {
    isReference: (source) => typeof source === "string" && source.startsWith("xmb-art:"),
    store: async () => "xmb-art:album-cover",
    remove() {},
  };
  h.windowListeners["xmb:action"]({ detail: "select" });
  const editor = h.root().querySelector(".xmb-art-options");
  assert.equal(editor.dataset.mediaKind, "music");
  assert.equal(editor.dataset.musicKind, "music");
  assert.equal(editor.querySelector(".xmb-art-options-preview").dataset.presentation, "square");
  const albumRow = editor.querySelectorAll(".xmb-art-options-media-row")
    .find((row) => row.children[0].textContent === "Capa do álbum");
  const file = albumRow.querySelector('input[type="file"]');
  file.files = [{ name: "album.jpg", type: "image/jpeg" }];
  await file.listeners.change();
  assert.equal(editor.saveArtEditor(), true);
  assert.equal(h.data.items.find((item) => item.id === "album").xmbArt.image, "xmb-art:album-cover");
  assert.equal(h.data.items.find((item) => item.id === "song").xmbArt.albumImage, undefined);
});

function modelListPadding(list, rows, rowTops, rowHeights, contentHeight) {
  const properties = {};
  const updateLayout = () => {
    const start = Number.parseFloat(properties["--xmb-list-start-space"]) || 0;
    const end = Number.parseFloat(properties["--xmb-list-end-space"]) || 0;
    rows.forEach((row, index) => {
      row.offsetTop = rowTops[index] + start;
      row.offsetHeight = rowHeights[index];
    });
    list.scrollHeight = contentHeight + start + end;
  };
  list.style = {
    setProperty: (key, value) => {
      properties[key] = value;
      updateLayout();
    },
  };
  updateLayout();
  return properties;
}

test("categorias, seleção lembrada, filtros reais, estados vazios e abertura existente", async () => {
  const h = setup();
  h.xmb.enter(h.trigger);
  await Promise.resolve();
  assert.equal(h.selected(), "Burnout");
  assert.equal(h.normal.inert, true);
  h.key("ArrowDown");
  assert.equal(h.selected(), "Persona");
  h.key("ArrowRight");
  assert.equal(h.selected(), "Músicas");
  assert.equal(h.xmb.isActive(), true);
  h.key("ArrowDown");
  h.key("ArrowLeft");
  assert.equal(h.selected(), "Persona");
  assert.equal(h.key("ArrowUp", { ctrlKey: true }).prevented, undefined);
  assert.equal(h.selected(), "Persona");
  assert.equal(h.key("Escape", { target: { isContentEditable: true } }).prevented, undefined);
  assert.equal(h.xmb.isActive(), true);
  assert.equal(h.key("ArrowDown", { target: { closest: () => ({}) } }).prevented, undefined);
  h.key("Enter");
  assert.equal(h.opened.length, 0);
  assert.equal(h.xmb.isActive(), true);
  assert.equal(h.root().dataset.level, "details");
  h.key("Escape");
  assert.equal(h.selected(), "Persona");
  assert.equal(h.root().dataset.level, "root");
  h.key("o");
  assert.equal(h.opened[0], h.data.items[0]);
  assert.equal(h.normal.inert, false);
  assert.equal(h.doc.activeElement, h.trigger);
  assert.equal(h.filters.kind, "game");
  h.filters.query = "inexistente";
  h.xmb.enter(h.trigger);
  assert.equal(h.selected(), undefined);
  h.key("Escape");
  assert.equal(h.root().hidden, true);
});

test("preferência de apresentação de jogos preserva seleção e não vaza para outras categorias", () => {
  const h = setup({ gamePresentation: "vertical" });
  h.xmb.enter(h.trigger);
  assert.equal(h.root().dataset.kind, "game");
  assert.equal(h.root().dataset.gamePresentation, "vertical");
  assert.equal(h.root().dataset.artworkBorder, "true");
  assert.equal(h.root().dataset.roundedArtwork, "false");
  h.key("ArrowDown");
  assert.equal(h.selected(), "Persona");
  h.data.appearance.xmb.gamePresentation = "pill";
  h.data.appearance.xmb.artworkBorder = false;
  h.data.appearance.xmb.roundedArtwork = true;
  h.xmb.close();
  h.xmb.enter(h.trigger);
  assert.equal(h.root().dataset.gamePresentation, "pill");
  assert.equal(h.root().dataset.artworkBorder, "false");
  assert.equal(h.root().dataset.roundedArtwork, "true");
  assert.equal(h.selected(), "Persona");
  h.key("ArrowRight");
  assert.equal(h.root().dataset.level, "folders");
  assert.equal(h.root().dataset.kind, "");
  assert.equal(h.root().dataset.gamePresentation, undefined);
  assert.equal(h.root().dataset.artworkBorder, "false");
  assert.equal(h.root().dataset.roundedArtwork, "true");
  h.key("ArrowLeft");
  assert.equal(h.root().dataset.kind, "game");
  assert.equal(h.root().dataset.gamePresentation, "pill");
  assert.equal(h.selected(), "Persona");
});

test("modo pílula mantém arte horizontal no XMB raiz sem preview duplicado", () => {
  const h = setup({
    gamePresentation: "pill",
    items: Array.from({ length: 4 }, (_, index) => ({
      id: `game-${index}`,
      kind: "game",
      title: `Game ${index}`,
      image: `game-${index}.jpg`,
    })),
  });
  h.xmb.enter(h.trigger);
  const list = h.root().children[2].children[0];

  h.key("ArrowDown");

  assert.equal(h.root().dataset.gamePresentation, "pill");
  assert.equal(h.root().dataset.rootColumn, "true");
  assert.equal(list.children[1].attributes["aria-pressed"], "true");
  assert.equal(list.children[1].style["--xmb-root-item-center"], "544.5px");
  assert.equal(h.root().dataset.upperPreview, undefined);
  assert.equal(
    h.root().children[0].children.some((node) => node.className === "xmb-upper-preview"),
    false,
  );

  const css = fs.readFileSync("dist/xmb.css", "utf8");
  assert.match(
    css,
    /data-game-presentation="pill"\]\[data-level="root"\]\s*\.xmb-item > img\s*\{[\s\S]*?object-fit:\s*cover;/,
  );
  assert.ok(list.children.every((row) => row.querySelectorAll("img").length <= 1));
});

test("wallpaper do jogo espera o foco e cruza suavemente; a preferência permite troca instantânea", () => {
  const items = [
    { id: "one", kind: "game", title: "Game One", image: "one.jpg" },
    { id: "two", kind: "game", title: "Game Two", image: "two.jpg" },
  ];
  const h = setup({ items });
  const timers = [];
  h.window.matchMedia = () => ({ matches: false });
  h.window.setTimeout = (callback, delay) => {
    timers.push({ callback, delay });
    return timers.length;
  };
  h.window.clearTimeout = () => {};
  h.xmb.enter(h.trigger);

  const backdrop = h.root().children.find((node) => node.className === "xmb-backdrop");
  const initialSettle = timers.find((timer) => timer.delay === 1000);
  assert.ok(initialSettle);
  initialSettle.callback();
  const initial = backdrop.children.find((node) =>
    node.className.includes("xmb-backdrop-wallpaper-incoming"),
  );
  assert.ok(initial);
  initial.onload();
  const outgoing = backdrop.children.find((node) => node.dataset.artworkSource === "one.jpg");
  h.key("ArrowDown");
  assert.equal(outgoing.dataset.artworkSource, "one.jpg");
  const settle = timers.filter((timer) => timer.delay === 1000).at(-1);
  assert.ok(settle);
  settle.callback();

  const incoming = backdrop.children.find((node) =>
    node.className.includes("xmb-backdrop-wallpaper-incoming"),
  );
  assert.ok(incoming);
  incoming.onload();
  assert.match(incoming.className, /xmb-backdrop-wallpaper-entering/);
  assert.match(outgoing.className, /xmb-backdrop-wallpaper-leaving/);

  const instant = setup({ items });
  instant.data.appearance.xmb.gameWallpaperTransitionEnabled = false;
  const artwork = {
    set(image, source, { error = () => {}, ready = () => {}, variant = "display" } = {}) {
      if (
        image.dataset.artworkSource === source &&
        image.dataset.artworkVariant === variant &&
        (image.dataset.artworkState === "loading" || image.dataset.artworkReady === "true")
      )
        return;
      image.dataset.artworkSource = source;
      image.dataset.artworkVariant = variant;
      image.dataset.artworkState = "ready";
      image.dataset.artworkReady = "true";
      image.src = source;
      ready();
    },
    clear(image) {
      delete image.dataset.artworkSource;
      delete image.dataset.artworkVariant;
      delete image.dataset.artworkReady;
      image.dataset.artworkState = "empty";
      image.removeAttribute("src");
    },
  };
  instant.ctx.Artwork = instant.window.Artwork = artwork;
  const instantTimers = [];
  instant.window.matchMedia = () => ({ matches: false });
  instant.window.setTimeout = (callback, delay) => {
    instantTimers.push({ callback, delay });
    return instantTimers.length;
  };
  instant.window.clearTimeout = () => {};
  instant.xmb.enter(instant.trigger);
  const instantBackdrop = instant.root().children.find(
    (node) => node.className === "xmb-backdrop",
  );
  const instantImage = instantBackdrop.children.find((node) =>
    node.className.includes("xmb-backdrop-wallpaper-active"),
  );
  instant.key("ArrowDown");
  assert.equal(instantImage.dataset.artworkSource, "two.jpg");
  assert.equal(instantImage.src, "two.jpg");
  assert.equal(
    instantBackdrop.children.some((node) =>
      node.className.includes("xmb-backdrop-wallpaper-incoming"),
    ),
    false,
  );
  assert.equal(instantTimers.some((timer) => timer.delay === 1000), false);
});

test("trocar de categoria limpa a arte antiga enquanto o novo wallpaper aguarda o foco", () => {
  const items = [
    { id: "game", kind: "game", title: "Game", image: "game.jpg" },
    { id: "music", kind: "music", title: "Album", image: "album.jpg" },
  ];
  const h = setup({ items });
  const timers = [];
  h.window.matchMedia = () => ({ matches: false });
  h.window.setTimeout = (callback, delay) => {
    timers.push({ callback, delay });
    return timers.length;
  };
  h.window.clearTimeout = () => {};
  h.xmb.enter(h.trigger);

  const root = h.root();
  const descendants = (node) =>
    node.children.flatMap((child) => [child, ...descendants(child)]);
  const categoryButton = (category) =>
    descendants(root).find((node) => node.dataset.category === category);
  const backdrop = root.children.find((node) => node.className === "xmb-backdrop");
  const css = fs.readFileSync("dist/xmb.css", "utf8");
  assert.doesNotMatch(
    css,
    /\.xmb\[data-item-background="true"\]::before\s*\{\s*background:\s*none;/,
  );
  const initialSettle = timers.find((timer) => timer.delay === 1000);
  initialSettle.callback();
  const gameWallpaper = backdrop.children.find((node) =>
    node.className.includes("xmb-backdrop-wallpaper-incoming"),
  );
  gameWallpaper.onload();

  categoryButton("music").click();
  assert.equal(backdrop.children.some((node) => node.dataset.artworkSource === "game.jpg"), false);

  const musicFolder = descendants(root).find((node) => node.dataset.folder === "music");
  musicFolder.ondblclick();
  const albumSettle = timers.find((timer) => timer.delay === 500);
  assert.ok(albumSettle);
  albumSettle.callback();
  const albumWallpaper = backdrop.children.find((node) =>
    node.className.includes("xmb-backdrop-wallpaper-incoming"),
  );
  albumWallpaper.onload();

  categoryButton("game").click();
  assert.equal(backdrop.children.some((node) => node.dataset.artworkSource === "album.jpg"), false);
  const gameReturnSettle = timers.find(
    (timer) => timer.delay === 1000 && timer !== initialSettle,
  );
  assert.ok(gameReturnSettle);
  gameReturnSettle.callback();
  const returnedGameWallpaper = backdrop.children.find((node) =>
    node.className.includes("xmb-backdrop-wallpaper-incoming"),
  );
  assert.equal(returnedGameWallpaper.dataset.artworkSource, "game.jpg");
});

test("fullscreen aceito, saída pelo navegador e Escape restauram a interface", async () => {
  const h = setup({ fullscreen: "accept" });
  h.xmb.enter(h.trigger);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  h.doc.fullscreenElement = null;
  h.listeners.fullscreenchange();
  assert.equal(h.xmb.isActive(), false);
  assert.equal(h.normal.inert, false);
  h.xmb.enter(h.trigger);
  await new Promise((resolve) => setImmediate(resolve));
  h.key("Escape");
  assert.equal(h.doc.fullscreenElement, null);
  assert.equal(h.doc.activeElement, h.trigger);
});

test("áreas, pastas vazias e retorno preservam seleção, scroll e filtro da Collection", () => {
  const h = setup();
  h.filters.kind = "music";
  h.xmb.enter(h.trigger);
  assert.equal(h.root().children.some((node) => node.className === "xmb-help"), false);
  assert.equal(h.root().dataset.area, "music");
  assert.equal(h.root().dataset.kind, "music");
  assert.equal(h.selected(), "Duvet");
  const list = h.root().children[2].children[0];
  list.scrollTop = 53;
  h.key("Escape");
  assert.equal(h.root().dataset.level, "folders");
  assert.equal(h.root().dataset.rootColumn, "true");
  assert.deepEqual(h.root().children[1].children.map((node) => node.textContent),
    ["Perfil", "Jogos", "Música", "Vídeo", "Leitura", "Fotos", "Outros"]);
  assert.equal(h.selected(), "Músicas");
  h.key("ArrowDown");
  h.key("Enter");
  assert.equal(h.root().dataset.kind, "album");
  assert.equal(h.root().dataset.rootColumn, "false");
  assert.equal(h.selected(), undefined);
  h.key("D");
  h.key("O");
  assert.equal(h.opened.length, 0);
  h.key("Escape");
  assert.equal(h.selected(), "Álbuns");
  assert.equal(h.root().dataset.rootColumn, "true");
  h.key("ArrowUp");
  h.key("Enter");
  assert.equal(h.selected(), "Duvet");
  assert.equal(h.root().dataset.rootColumn, "false");
  assert.equal(list.scrollTop, 53);
  assert.equal(h.doc.activeElement.dataset.itemId, "c");
  h.key("ArrowRight");
  assert.equal(h.root().dataset.area, "video");
  assert.equal(h.selected(), "Filmes");
  assert.equal(h.root().dataset.rootColumn, "true");
  h.key("ArrowRight");
  assert.equal(h.selected(), "Livros");
  h.key("ArrowLeft");
  h.key("ArrowLeft");
  assert.equal(h.root().dataset.level, "folders");
  assert.equal(h.selected(), "Músicas");
  h.key("Escape");
  assert.equal(h.xmb.isActive(), false);
  assert.equal(h.filters.kind, "music");
  assert.equal(h.data.items.length, 3);

  const reentry = setup();
  reentry.filters.kind = "music";
  reentry.xmb.enter(reentry.trigger);
  assert.equal(reentry.root().dataset.kind, "music");
  reentry.xmb.close();
  reentry.xmb.enter(reentry.trigger);
  assert.equal(reentry.root().dataset.level, "folders");
  assert.equal(reentry.root().dataset.kind, "");
  assert.equal(reentry.selected(), "Músicas");
});

test("entrada por album/artist e gamepad usam tipos reais sem tocar faixas", () => {
  for (const kind of ["album", "artist"]) {
    const h = setup();
    h.filters.kind = kind;
    h.data.items.push({ id: kind, kind, title: kind });
    let plays = 0;
    h.window.SPACEAMP = { play() { plays++; } };
    h.xmb.enter(h.trigger);
    assert.equal(h.root().dataset.area, "music");
    assert.equal(h.root().dataset.kind, kind);
    h.windowListeners["xmb:action"]({ detail: "primary" });
    assert.equal(h.root().dataset.level, "details");
    assert.equal(plays, 0);
    h.key("Escape");
    h.key("Escape");
    assert.equal(h.root().dataset.level, "folders");
    h.key("Enter");
    h.key("O");
    assert.equal(h.opened[0].kind, kind);
  }
});

test("cruz do PlayStation e A do Xbox ativam botões; X do Xbox não confirma", async () => {
  const h = setup({
    extendedDom: true,
    items: [
      {
        id: "game",
        kind: "game",
        title: "Burnout 3",
        status: "active",
        image: "https://images.example/cover.jpg",
      },
    ],
  });
  let requestedUrl = "";
  h.ctx.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            url: "https://cdn2.steamgriddb.com/icon-1.png",
            source: "SteamGridDB",
            title: "Burnout 3",
          },
          {
            url: "https://cdn2.steamgriddb.com/icon-2.png",
            source: "SteamGridDB",
            title: "Burnout 3: Revenge",
          },
          {
            url: "https://images.igdb.com/icon-1.jpg",
            source: "IGDB",
            title: "Burnout 3",
          },
          {
            url: "https://images.igdb.com/icon-2.jpg",
            source: "IGDB",
            title: "Burnout 3",
          },
          {
            url: "https://images.igdb.com/icon-3.jpg",
            source: "IGDB",
            title: "Burnout 3",
          },
        ],
      }),
    };
  };
  h.xmb.enter(h.trigger);
  h.windowListeners["xmb:action"]({ detail: "select" });
  assert.ok(h.doc.activeElement.className.includes("xmb-art-options-featured"));
  assert.equal(h.doc.activeElement.matches(".xmb-art-options-quick-actions button"), true);
  h.windowListeners["xmb:action"]({ detail: "right" });
  assert.ok(h.doc.activeElement.className.includes("xmb-art-options-cover-adjust"));
  h.windowListeners["xmb:action"]({ detail: "down" });
  assert.equal(h.doc.activeElement.textContent, "Buscar");
  const sample = createSampler((action) => h.windowListeners["xmb:action"]({ detail: action }));
  const pad = {
    mapping: "standard",
    index: 0,
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0],
  };
  sample(pad, 0);
  pad.buttons[2].pressed = true;
  sample(pad, 16);
  assert.equal(requestedUrl, "", "o botão X do Xbox não é usado como confirmação");
  pad.buttons[2].pressed = false;
  sample(pad, 32);
  pad.buttons[0].pressed = true;
  sample(pad, 48);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(requestedUrl, /\/api\/xmb\/game-art\?/);
  assert.match(requestedUrl, /mode=choose/);
  assert.match(requestedUrl, /slot=bubble/);
  assert.match(requestedUrl, /title=Burnout\+3/);
  const firstPicker = h.root().querySelector(".xmb-art-search-picker");
  const firstTiles = firstPicker.querySelectorAll(".xmb-art-search-tile");
  assert.equal(firstTiles.length, 5, "mostra candidatos dos dois provedores");
  assert.equal(h.doc.activeElement, firstTiles[0], "foca a primeira arte para o controle");
  pad.buttons[0].pressed = false;
  sample(pad, 64);
  pad.buttons[2].pressed = true;
  sample(pad, 80);
  assert.equal(h.doc.activeElement, firstTiles[0], "X do Xbox não confirma a arte");
  pad.buttons[2].pressed = false;
  sample(pad, 96);
  pad.buttons[1].pressed = true;
  sample(pad, 112);
  const editor = h.root().querySelector(".xmb-art-options");
  assert.equal(editor.open, true, "B / círculo volta ao editor sem salvá-lo");
  assert.equal(h.root().querySelector(".xmb-art-search-picker"), undefined);
  assert.equal(h.doc.activeElement.textContent, "Buscar");
  pad.buttons[1].pressed = false;
  sample(pad, 128);
  pad.buttons[0].pressed = true;
  sample(pad, 144);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const picker = h.root().querySelector(".xmb-art-search-picker");
  const tiles = picker.querySelectorAll(".xmb-art-search-tile");
  assert.equal(tiles.length, 5);
  pad.buttons[0].pressed = false;
  sample(pad, 160);
  pad.buttons[15].pressed = true;
  sample(pad, 176);
  assert.equal(h.doc.activeElement, tiles[1], "seta direita move a seleção no grid");
  pad.buttons[15].pressed = false;
  sample(pad, 192);
  pad.buttons[0].pressed = true;
  sample(pad, 208);
  assert.equal(
    h.root().querySelector(".xmb-art-options-bubble-preview").src,
    "https://cdn2.steamgriddb.com/icon-2.png",
    "A do Xbox / cruz do PlayStation aplica a arte focada",
  );
  assert.equal(h.doc.activeElement.textContent, "Buscar", "retorna o foco ao botão de busca");
  h.windowListeners["xmb:action"]({ detail: "right" });
  pad.buttons[0].pressed = false;
  sample(pad, 224);
  pad.buttons[0].pressed = true;
  sample(pad, 240);
  assert.equal(h.doc.activeElement.textContent, "Escolher arquivo…");
  const dialog = h.root().querySelector(".xmb-art-options");
  const fileInput = dialog.querySelector('input[type="file"]');
  assert.equal(fileInput.clickCount, 1, "A/cruz ativa a seleção do arquivo");
  h.windowListeners["xmb:action"]({ detail: "right" });
  pad.buttons[0].pressed = false;
  sample(pad, 256);
  pad.buttons[0].pressed = true;
  sample(pad, 272);
  assert.equal(h.doc.activeElement.textContent, "×");
  assert.equal(h.doc.activeElement.clickCount, 1, "A/cruz ativa o botão limpar");
  assert.equal(
    dialog.querySelector(".xmb-art-options-bubble-preview").src,
    "https://images.example/cover.jpg",
  );
});

test("transição de pasta sobrepõe saída e entrada e inverte ao voltar", async () => {
  for (const kind of ["music", "album", "artist"]) {
    const h = setup();
    h.filters.kind = kind;
    if (kind !== "music") {
      h.data.items.push({ id: kind, kind, title: kind });
    }
    h.xmb.enter(h.trigger);
    if (kind === "music") {
      h.key("Escape");
    } else {
      h.windowListeners["xmb:action"]({ detail: "primary" });
      h.key("Escape");
      h.key("Escape");
    }
    const root = h.root();
    const folder = h.selected();
    const nav = root.children[1];
    const list = root.children[2].children[0];
    const animations = [];
    const navigationAnimations = [];
    const horizontalReadings = [];
    const axisProperties = {};
    nav.style = { setProperty() {} };
    root.style = list.style = { setProperty: (key, value) => (axisProperties[key] = value) };
    nav.scrollLeft = 0;
    nav.children.forEach((control) => (control.offsetWidth = 60));
    const animate = (frames, options) => {
      let finish;
      const animation = {
        frames,
        options,
        finished: new Promise((resolve) => {
          finish = resolve;
        }),
        cancel: () => finish(),
        finish: () => finish(),
      };
      animations.push(animation);
      return animation;
    };
    const cloneNode = list.cloneNode.bind(list);
    const cloneNavigation = nav.cloneNode.bind(nav);
    list.animate = animate;
    list.cloneNode = (deep) => {
      const clone = cloneNode(deep);
      clone.animate = animate;
      return clone;
    };
    nav.animate = (frames, options) => {
      navigationAnimations.push({ frames, options });
      return animate(frames, options);
    };
    nav.cloneNode = (deep) => {
      const clone = cloneNavigation(deep);
      clone.animate = animate;
      return clone;
    };
    list.getBoundingClientRect = () => ({ top: 160, left: 24, width: 900, height: 600 });
    nav.getBoundingClientRect = () => ({ top: 70, left: 24, width: 900, height: 72 });
    h.window.getComputedStyle = (node) => {
      if (node === nav) {
        horizontalReadings.push([
          root.dataset.folderDepth,
          root.dataset.folderMeasure,
          nav.scrollLeft,
        ]);
      }
      return {
        flexBasis: node === nav ? "" : "80px",
        paddingLeft: node === nav ? "0px" : "",
        getPropertyValue: (key) =>
          node === root
            ? {
                "--motion-fast": "150ms",
                "--motion-focus": "180ms",
                "--ease-xmb": "cubic-bezier(.16, 1, .3, 1)",
              }[key] || ""
            : "",
      };
    };
    h.window.matchMedia = () => ({ matches: false });

    h.key("Enter");

    assert.equal(root.dataset.folderDepth, "true");
    assert.equal(animations.length, 2);
    assert.equal(animations[0].frames.at(-1).transform, "translateX(-32px)");
    assert.equal(animations[1].frames[0].transform, "translateX(32px)");
    assert.equal(animations[1].frames[0].opacity, 0.64);
    assert.equal(animations[0].options.duration, 180);
    assert.equal(animations[1].options.duration, 180);
    assert.equal(
      root.children.filter((node) => node.className.includes("transition-outgoing")).length,
      1,
    );
    assert.equal(
      root.children.filter((node) => node.className.includes("xmb-items-transition-outgoing"))
        .length,
      0,
    );

    h.key("Escape");

    assert.equal(root.dataset.folderDepth, "false");
    assert.equal(root.dataset.level, "folders");
    assert.equal(h.selected(), folder);
    assert.equal(animations.length, 5);
    assert.equal(animations[2].frames.at(-1).transform, "translateX(32px)");
    assert.equal(
      root.children.find((node) => node.className.includes("xmb-items-transition-outgoing"))
        .attributes["data-source-kind"],
      kind,
      "the outgoing list keeps its media kind for its visual styles",
    );
    assert.equal(animations[3].frames[0].transform, "translateX(-32px)");
    assert.equal(animations[3].frames[0].opacity, 0.64);
    assert.equal(animations[3].frames.at(-1).transform, "translateX(0)");
    assert.equal(animations[4].frames[0].transform, "translateX(-32px)");
    assert.equal(animations[4].frames[0].opacity, 0.64);
    assert.equal(animations[2].options.duration, 180);
    assert.equal(animations[3].options.duration, 180);
    assert.equal(animations[4].options.duration, 180);
    assert.equal(navigationAnimations.length, 1);
    assert.equal(navigationAnimations[0].frames[0].transform, "translateX(-32px)");
    assert.equal(navigationAnimations[0].frames.at(-1).transform, "translateX(0)");
    assert.ok(
      horizontalReadings.some(
        ([depth, measure, left]) => depth === "false" && measure === "true" && left === 0,
      ),
    );
    assert.ok(
      horizontalReadings.some(
        ([depth, measure, left]) => depth === "false" && measure === "false" && left === 160,
      ),
    );
    assert.equal(root.dataset.folderMeasure, "false");
    assert.equal(nav.scrollLeft, 160);
    assert.equal(axisProperties["--xmb-list-anchor"], "30px");
    assert.equal(
      root.children.some((node) => node.className.includes("categories-transition-incoming")),
      false,
    );
    animations[2].finish();
    animations[3].finish();
    animations[4].finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(root.dataset.folderTransition, "false");
    assert.equal(
      root.children.filter((node) => node.className.includes("transition-outgoing")).length,
      0,
    );

    h.key("Enter");
    h.key("Escape");
    assert.equal(root.dataset.folderDepth, "false");
    assert.equal(root.dataset.folderTransition, "true");
    assert.equal(navigationAnimations.length, 2);
    h.xmb.close();
    assert.equal(root.dataset.folderTransition, "false");
    assert.equal(
      root.children.some((node) => node.className.includes("transition-outgoing")),
      false,
    );
  }
});

test("transição de pasta é imediata com movimento reduzido", () => {
  const h = setup();
  h.filters.kind = "music";
  h.xmb.enter(h.trigger);
  h.key("Escape");
  h.window.matchMedia = () => ({ matches: true });

  h.key("Enter");

  assert.equal(h.root().dataset.folderDepth, "true");
  assert.equal(h.root().dataset.folderTransition, "false");
  assert.equal(
    h.root().children.some((node) => node.className.includes("transition-outgoing")),
    false,
  );
});

test("Perfil, Fotos, Tab e mudança externa de rota", async () => {
  const h = setup();
  h.xmb.enter(h.trigger);
  h.key("ArrowLeft");
  assert.equal(h.selected(), "Halourt");
  h.key("Tab");
  assert.ok(h.doc.activeElement.isConnected);
  h.key("Enter");
  h.key("O");
  assert.equal(h.opened[0], "perfil");
  h.xmb.enter(h.trigger);
  for (let i = 0; i < 4; i++) h.key("ArrowRight");
  assert.equal(h.selected(), "Foto real");
  h.key("Enter");
  h.key("o");
  assert.equal(h.opened[1], "fotos");
  assert.equal(h.opened[2], h.data.photos[0]);
  h.xmb.enter(h.trigger);
  h.windowListeners.hashchange();
  assert.equal(h.xmb.isActive(), false);
  await Promise.resolve();
});

test("sair antes da promessa de fullscreen resolver não deixa fullscreen pendente", async () => {
  const h = setup({ fullscreen: "accept" });
  h.xmb.enter(h.trigger);
  h.xmb.close();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.xmb.isActive(), false);
  assert.equal(h.doc.fullscreenElement, null);
  assert.equal(h.normal.inert, false);
});

test("detalhes preservam fullscreen, seleção, rolagem e foco na lista de uma pasta", async () => {
  const h = setup({ fullscreen: "accept", items: musicItems(5) });
  h.xmb.enter(h.trigger);
  await new Promise((resolve) => setImmediate(resolve));
  enterMusicFolder(h);
  const body = h.root().children[2],
    list = body.children[0],
    detail = body.children[1];
  list.clientHeight = 400;
  const rows = list.querySelectorAll(".xmb-item");
  modelListPadding(
    list,
    rows,
    rows.map((_, index) => index * 100),
    rows.map(() => 60),
    500,
  );
  h.key("ArrowDown");
  const row = h.doc.activeElement;
  const savedScrollTop = list.scrollTop;
  assert.ok(savedScrollTop > 0);
  detail.scrollTop = 19;
  h.key("Enter");
  assert.equal(h.opened.length, 0);
  assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  assert.equal(h.root().dataset.level, "details");
  assert.equal(h.doc.activeElement, detail);
  h.key("ArrowRight");
  h.key("ArrowDown");
  h.key("Tab");
  assert.equal(h.selected(), "Track 02");
  assert.equal(h.doc.activeElement.className, "xmb-exit");
  h.key("Backspace");
  assert.equal(h.doc.activeElement, row);
  assert.equal(list.scrollTop, savedScrollTop);
  assert.equal(detail.scrollTop, 19);
  assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  h.key("Enter");
  h.key("Escape");
  assert.equal(h.root().dataset.level, "root");
  assert.equal(h.xmb.isActive(), true);
  h.key("Escape", { repeat: true });
  assert.equal(h.xmb.isActive(), true);
  h.key("Escape");
  assert.equal(h.root().dataset.level, "folders");
  assert.equal(h.xmb.isActive(), true);
  h.key("Escape");
  assert.equal(h.xmb.isActive(), false);
  assert.equal(h.doc.fullscreenElement, null);
});

test("Escape interceptado pelo navegador nos detalhes conserva a raiz na viewport", async () => {
  const h = setup({ fullscreen: "accept" });
  h.xmb.enter(h.trigger);
  await new Promise((resolve) => setImmediate(resolve));
  h.key("Enter");
  h.doc.fullscreenElement = null;
  h.listeners.fullscreenchange();
  assert.equal(h.xmb.isActive(), true);
  assert.equal(h.root().dataset.level, "root");
  assert.equal(h.selected(), "Burnout");
  h.key("Escape");
  assert.equal(h.xmb.isActive(), false);
});

test("rolagem usa tokens, cancela movimentos anteriores e respeita movimento reduzido", () => {
  const h = setup({ items: musicItems(2) });
  h.window.innerHeight = 800;
  h.xmb.enter(h.trigger);
  enterMusicFolder(h);
  const list = h.root().children[2].children[0];
  const rows = list.querySelectorAll(".xmb-item");
  list.clientHeight = 400;
  const properties = modelListPadding(list, rows, [20, 300], [20, 20], 800);
  list.scrollLeft = 0;
  const frames = new Map();
  let frameId = 0;
  h.window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  h.window.cancelAnimationFrame = (id) => frames.delete(id);
  const tokens = {
    "--motion-focus": "180ms",
    "--ease-xmb": "cubic-bezier(.16, 1, .3, 1)",
    "--xmb-selection-clearance": "128px",
  };
  h.window.getComputedStyle = () => ({
    getPropertyValue: (key) => tokens[key],
  });
  h.window.matchMedia = () => ({ matches: false });
  const step = (now) => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(now);
  };
  h.key("ArrowDown");
  assert.equal(properties["--xmb-list-start-space"], "174px");
  assert.equal(properties["--xmb-list-end-space"], "206px");
  assert.equal(list.scrollTop, 0);
  assert.equal(frames.size, 1);
  step(0);
  step(90);
  assert.ok(list.scrollTop > 0 && list.scrollTop < 300, String(list.scrollTop));
  h.key("ArrowUp");
  assert.equal(frames.size, 1);
  step(100);
  step(280);
  assert.equal(list.scrollTop, 20);
  assert.equal(frames.size, 0);
  h.window.matchMedia = () => ({ matches: true });
  h.key("ArrowDown");
  assert.equal(list.scrollTop, 300);
  assert.equal(frames.size, 0);
  h.window.matchMedia = () => ({ matches: false });
  h.key("ArrowUp");
  assert.equal(frames.size, 1);
  h.xmb.close();
  assert.equal(frames.size, 0);
});

test("viewports curtos mantêm o foco proporcional até a responsividade landscape", () => {
  const h = setup({ items: musicItems(2) });
  h.window.innerHeight = 390;
  h.xmb.enter(h.trigger);
  enterMusicFolder(h);
  const list = h.root().children[2].children[0];
  const rows = list.querySelectorAll(".xmb-item");
  list.clientHeight = 260;
  modelListPadding(list, rows, [20, 300], [20, 20], 800);

  h.key("ArrowDown");

  assert.equal(Math.round(list.scrollTop), 300);
  assert.ok(Math.abs(rows[1].offsetTop + rows[1].offsetHeight / 2 - list.scrollTop - 119.6) < 0.01);
});

test("lista curta mantém os três jogos visíveis ao selecionar do primeiro ao último", () => {
  const h = setup();
  h.data.items.splice(0, h.data.items.length, ...[
    { id: "p3r", kind: "game", title: "Persona 3 Reload" },
    { id: "sol-trigger", kind: "game", title: "Sol Trigger" },
    { id: "burnout-3", kind: "game", title: "Burnout 3" },
  ]);
  h.xmb.enter(h.trigger);
  const nav = h.root().children[1];
  const list = h.root().children[2].children[0];
  const rows = list.querySelectorAll(".xmb-item");
  const properties = {};
  nav.getBoundingClientRect = () => ({ bottom: 100 });
  list.getBoundingClientRect = () => ({ top: 120 });
  list.clientHeight = 820;
  list.scrollHeight = 612;
  list.scrollTop = 0;
  list.style = {
    setProperty: (key, value) => {
      properties[key] = value;
    },
  };
  rows.forEach((row, index) => {
    row.offsetTop = index * 204;
    row.offsetHeight = 204;
  });

  assert.equal(h.selected(), "Burnout 3");
  h.key("ArrowDown");
  assert.equal(h.selected(), "Persona 3 Reload");
  assert.equal(list.scrollTop, 0);
  h.key("ArrowDown");
  assert.equal(h.selected(), "Sol Trigger");
  assert.equal(list.scrollTop, 0);
  h.key("ArrowUp");
  assert.equal(h.selected(), "Persona 3 Reload");
  h.key("ArrowUp");
  assert.equal(h.selected(), "Burnout 3");
  assert.equal(list.scrollTop, 0);
  assert.deepEqual(properties, {
    "--xmb-list-start-space": "0px",
    "--xmb-list-end-space": "0px",
  });
  assert.ok(
    rows.every((row) => row.offsetTop >= 0 && row.offsetTop + row.offsetHeight <= list.clientHeight),
  );
});

test("lista longa rola naturalmente e desloca o foco entre extremos", () => {
  const h = setup();
  h.data.items.splice(0, h.data.items.length, ...musicItems(12));
  h.window.innerHeight = 800;
  h.window.getComputedStyle = () => ({
    getPropertyValue: (key) =>
      ({ "--xmb-selection-clearance": "128px" })[key] || "180ms cubic-bezier(.16, 1, .3, 1)",
  });
  h.window.matchMedia = () => ({ matches: true });
  h.xmb.enter(h.trigger);
  enterMusicFolder(h);
  const list = h.root().children[2].children[0];
  const rows = list.querySelectorAll(".xmb-item");
  list.clientHeight = 400;
  const properties = modelListPadding(
    list,
    rows,
    rows.map((_, index) => index * 72),
    rows.map(() => 60),
    852,
  );

  assert.equal(h.selected(), "Track 01");
  for (let index = 0; index < 6; index += 1) h.key("ArrowDown");
  assert.equal(h.selected(), "Track 07");
  assert.equal(list.scrollTop, 432);
  assert.equal(rows[6].offsetTop + rows[6].offsetHeight / 2 - list.scrollTop, 184);
  for (let index = 0; index < 5; index += 1) h.key("ArrowDown");
  assert.equal(h.selected(), "Track 12");
  assert.equal(list.scrollTop, 792);
  assert.equal(list.scrollTop + list.clientHeight, list.scrollHeight);
  assert.equal(rows[11].offsetTop + rows[11].offsetHeight / 2 - list.scrollTop, 184);
  for (let index = 0; index < 11; index += 1) h.key("ArrowUp");
  assert.equal(h.selected(), "Track 01");
  assert.equal(list.scrollTop, 0);
  assert.equal(rows[0].offsetTop + rows[0].offsetHeight / 2 - list.scrollTop, 184);
  assert.deepEqual(properties, {
    "--xmb-list-start-space": "154px",
    "--xmb-list-end-space": "186px",
  });
});

test("capa vertical de jogos mantém margem superior ao navegar para baixo", () => {
  const h = setup();
  h.data.items.splice(
    0,
    h.data.items.length,
    ...Array.from({ length: 6 }, (_, index) => ({
      id: "game-" + index,
      kind: "game",
      title: "Game " + String(index + 1).padStart(2, "0"),
      image: "cover.png",
    })),
  );
  h.filters.kind = "game";
  h.window.innerHeight = 1080;
  h.window.innerWidth = 1920;
  h.xmb.enter(h.trigger);

  const nav = h.root().children[1];
  const list = h.root().children[2].children[0];
  const rows = list.querySelectorAll(".xmb-item");
  nav.getBoundingClientRect = () => ({ bottom: 100 });
  list.getBoundingClientRect = () => ({ top: 120 });
  list.clientHeight = 400;
  list.scrollHeight = 6 * 260;
  rows.forEach((row, index) => {
    row.offsetTop = index * 260;
    row.offsetHeight = 238;
    row.querySelector("img").offsetHeight = 210;
  });

  h.key("ArrowDown");

  const selected = rows[1];
  const center = selected.offsetTop + selected.offsetHeight / 2 - list.scrollTop;
  const artworkHalf = Math.ceil((210 * 1.14) / 2);
  assert.equal(h.selected(), "Game 02");
  assert.ok(center - artworkHalf >= 8, "the selected cover keeps clear space above the list edge");
});

test("pasta curta abre na altura da pasta e mantém os itens visíveis ao navegar", () => {
  const h = setup();
  h.data.items.splice(
    0,
    h.data.items.length,
    ...Array.from({ length: 7 }, (_, index) => ({
      id: "album-" + index,
      kind: "album",
      title: "Album " + (index + 1),
    })),
  );
  h.filters.kind = "music";
  h.window.innerHeight = 800;
  h.window.matchMedia = () => ({ matches: true });
  h.xmb.enter(h.trigger);
  h.key("Escape");

  const list = h.root().children[2].children[0];
  const spaces = {};
  list.clientHeight = 800;
  list.style = { setProperty: (key, value) => (spaces[key] = value) };
  list.getBoundingClientRect = () => ({ top: h.root().dataset.folderDepth === "true" ? 100 : 300 });
  Object.defineProperty(list, "scrollHeight", {
    get: () =>
      list.querySelectorAll(".xmb-item").length * 40 +
      Number.parseFloat(spaces["--xmb-list-start-space"] || "0") +
      Number.parseFloat(spaces["--xmb-list-end-space"] || "0"),
  });
  h.key("ArrowDown");
  const sourceFolder = list.querySelector('[aria-pressed="true"]');
  sourceFolder.getBoundingClientRect = () => ({ top: 420, height: 40 });
  h.key("Enter");

  const rows = list.querySelectorAll(".xmb-item");
  const startSpace = Number.parseFloat(spaces["--xmb-list-start-space"]);
  rows.forEach((row, index) => {
    row.offsetTop = startSpace + index * 40;
    row.offsetHeight = 40;
  });
  assert.equal(h.selected(), "Album 1");
  assert.equal(startSpace, 320, "the first album aligns with its selected folder row");
  assert.equal(Number.parseFloat(spaces["--xmb-list-end-space"]), 0);
  assert.equal(rows[0].offsetTop + rows[0].offsetHeight / 2, 340);

  h.key("ArrowDown");
  h.key("ArrowDown");

  assert.equal(h.selected(), "Album 3");
  assert.equal(Number.parseFloat(spaces["--xmb-list-start-space"]), startSpace);
  assert.equal(list.scrollTop, 0, "short content remains visible without forced scrolling");
  assert.ok(rows.at(-1).offsetTop + rows.at(-1).offsetHeight <= list.clientHeight);
});

test("pasta longa preserva o eixo quando a altura medida cruza o limite do viewport", () => {
  const h = setup();
  h.data.items.splice(
    0,
    h.data.items.length,
    ...Array.from({ length: 5 }, (_, index) => ({
      id: "track-" + index,
      kind: "music",
      title: "Track " + (index + 1),
    })),
  );
  h.filters.kind = "music";
  h.window.innerHeight = 800;
  h.window.matchMedia = () => ({ matches: true });
  h.xmb.enter(h.trigger);
  h.key("Escape");

  const list = h.root().children[2].children[0];
  const spaces = {};
  let measuredContentHeight = 420;
  list.clientHeight = 400;
  list.style = { setProperty: (key, value) => (spaces[key] = value) };
  list.getBoundingClientRect = () => ({ top: h.root().dataset.folderDepth === "true" ? 100 : 300 });
  Object.defineProperty(list, "scrollHeight", {
    get: () =>
      (h.root().dataset.folderDepth === "true" && list.querySelectorAll(".xmb-item").length > 3
        ? measuredContentHeight
        : list.querySelectorAll(".xmb-item").length * 40) +
      Number.parseFloat(spaces["--xmb-list-start-space"] || "0") +
      Number.parseFloat(spaces["--xmb-list-end-space"] || "0"),
  });
  list.querySelector('[aria-pressed="true"]').getBoundingClientRect = () => ({ top: 220, height: 40 });
  h.key("Enter");

  const rows = list.querySelectorAll(".xmb-item");
  const startSpace = Number.parseFloat(spaces["--xmb-list-start-space"]);
  rows.forEach((row, index) => {
    row.offsetTop = startSpace + index * 50;
    row.offsetHeight = 40;
  });
  assert.ok(startSpace > 0);
  assert.ok(Number.parseFloat(spaces["--xmb-list-end-space"]) > 0);

  measuredContentHeight = list.clientHeight - 1;
  h.key("ArrowDown");

  assert.equal(h.selected(), "Track 2");
  assert.ok(Number.parseFloat(spaces["--xmb-list-start-space"]) > 0);
  assert.ok(Number.parseFloat(spaces["--xmb-list-end-space"]) > 0);
  assert.ok(list.scrollTop > 0, "the selection advances without snapping the list to its top");
});

test("pasta longa mantém o eixo da pasta e o foco suave até a última música", () => {
  const h = setup();
  h.data.items.splice(
    0,
    h.data.items.length,
    ...Array.from({ length: 12 }, (_, index) => ({
      id: "folder-track-" + index,
      kind: "music",
      title: "Folder Track " + String(index + 1).padStart(2, "0"),
    })),
  );
  h.filters.kind = "music";
  h.window.innerHeight = 800;
  h.window.matchMedia = () => ({ matches: true });
  h.xmb.enter(h.trigger);
  h.key("Escape");
  assert.equal(h.selected(), "Músicas");

  const list = h.root().children[2].children[0];
  const properties = {};
  const spaceHistory = [];
  list.clientHeight = 400;
  list.scrollHeight = 1000;
  list.style = {
    setProperty: (key, value) => {
      properties[key] = value;
      spaceHistory.push([key, value]);
    },
  };
  list.getBoundingClientRect = () => ({ top: h.root().dataset.folderDepth === "true" ? 250 : 300 });
  list.querySelector('[aria-pressed="true"]').getBoundingClientRect = () => ({ top: 380, height: 40 });
  h.key("Enter");

  const rows = list.querySelectorAll(".xmb-item");
  const startSpace = Number.parseFloat(properties["--xmb-list-start-space"]);
  const endSpace = Number.parseFloat(properties["--xmb-list-end-space"]);
  rows.forEach((row, index) => {
    row.offsetTop = startSpace + index * 72;
    row.offsetHeight = 40;
  });
  list.scrollHeight = startSpace + (rows.length - 1) * 72 + 40 + endSpace;

  assert.equal(h.root().dataset.folderDepth, "true");
  assert.equal(h.selected(), "Folder Track 01");
  assert.ok(startSpace > 0 && endSpace > 0, "only the long inner list gets focal breathing space");
  assert.equal(rows[0].offsetTop + rows[0].offsetHeight / 2 - list.scrollTop, 150);
  for (let index = 0; index < 6; index += 1) h.key("ArrowDown");
  assert.equal(h.selected(), "Folder Track 07");
  assert.equal(rows[6].offsetTop + rows[6].offsetHeight / 2 - list.scrollTop, 150);
  assert.ok(rows[5].offsetTop + rows[5].offsetHeight / 2 - list.scrollTop < 150);
  assert.ok(
    spaceHistory.every(([, value]) => value !== "0px"),
    "selection changes never collapse the scroll breathing space mid-navigation",
  );
  rows[11].offsetHeight = 80;
  for (let index = 0; index < 5; index += 1) h.key("ArrowDown");
  assert.equal(h.selected(), "Folder Track 12");
  assert.equal(rows[11].offsetTop + rows[11].offsetHeight / 2 - list.scrollTop, 150);
  assert.equal(Number.parseFloat(properties["--xmb-list-end-space"]), 210);

  h.key("Escape");
  assert.equal(h.root().dataset.folderDepth, "false");
  assert.equal(h.selected(), "Músicas");
  assert.equal(list.scrollTop, 0);
  assert.equal(properties["--xmb-list-start-space"], "0px");
  assert.equal(properties["--xmb-list-end-space"], "0px");
});

test("pasta de álbuns mantém a artwork ampliada inteira ao chegar ao último item", () => {
  const h = setup();
  h.data.items.splice(
    0,
    h.data.items.length,
    ...Array.from({ length: 7 }, (_, index) => ({
      id: "album-track-" + index,
      kind: "album",
      title: "Album Track " + String(index + 1),
      image: "cover.png",
    })),
  );
  h.filters.kind = "music";
  h.window.innerHeight = 800;
  h.window.matchMedia = () => ({ matches: false });
  h.xmb.enter(h.trigger);
  h.key("Escape");
  h.key("ArrowDown");
  assert.equal(h.selected(), "Álbuns");

  const list = h.root().children[2].children[0];
  const properties = {};
  list.clientHeight = 400;
  list.scrollHeight = 1000;
  list.style = { setProperty: (key, value) => (properties[key] = value) };
  list.getBoundingClientRect = () => ({ top: h.root().dataset.folderDepth === "true" ? 250 : 300 });
  list.querySelector('[aria-pressed="true"]').getBoundingClientRect = () => ({ top: 580, height: 40 });
  h.key("Enter");

  const rows = list.querySelectorAll(".xmb-item");
  const startSpace = Number.parseFloat(properties["--xmb-list-start-space"]);
  const endSpace = Number.parseFloat(properties["--xmb-list-end-space"]);
  rows.forEach((row, index) => {
    row.offsetTop = startSpace + index * 72;
    row.offsetHeight = 40;
    row.querySelector("img").offsetHeight = 84;
  });
  list.scrollHeight = startSpace + (rows.length - 1) * 72 + 40 + endSpace;

  assert.ok(endSpace > 0, "the last row gets room for its expanded artwork");
  for (let index = 1; index < rows.length; index += 1) h.key("ArrowDown");

  const selected = rows[rows.length - 1];
  const center = selected.offsetTop + selected.offsetHeight / 2 - list.scrollTop;
  const artworkHalf = Math.ceil((84 * 1.84) / 2);
  assert.equal(h.selected(), "Album Track 7");
  assert.ok(center - artworkHalf >= 4, "the active cover stays inside the top edge");
  assert.ok(center + artworkHalf <= list.clientHeight - 4, "the active cover stays inside the bottom edge");
});

test("eixo horizontal ancora a categoria e os ícones verticais sem mover a página", () => {
  const h = setup();
  h.xmb.enter(h.trigger);
  const nav = h.root().children[1],
    properties = {};
  h.root().children[2].children[0].style = {
    setProperty: (key, value) => {
      properties[key] = value;
    },
  };
  nav.style = h.root().children[2].children[0].style;
  nav.clientWidth = 300;
  nav.scrollWidth = 960;
  nav.scrollLeft = 0;
  nav.scrollTop = 0;
  nav.children.forEach((control, index) => {
    control.offsetLeft = index * 80;
    control.offsetWidth = 60;
  });
  h.window.getComputedStyle = (node) => ({
    flexBasis: node === nav ? "" : "80px",
    paddingLeft: node === nav ? "0px" : "",
    getPropertyValue: () => "",
  });
  h.key("ArrowRight");
  assert.equal(properties["--xmb-list-anchor"], "30px");
  assert.equal(nav.scrollLeft, 160);
  assert.equal(nav.children[2].offsetLeft + 30 - nav.scrollLeft, 30);
  for (let i = 0; i < 4; i++) h.key("ArrowRight");
  assert.equal(nav.scrollLeft, 480);
  assert.equal(nav.children[6].offsetLeft + 30 - nav.scrollLeft, 30);
  h.window.matchMedia = () => ({ matches: true });
  h.key("ArrowLeft");
  assert.equal(nav.scrollLeft, 400);
  assert.equal(nav.children[5].offsetLeft + 30 - nav.scrollLeft, 30);
});

test("trocar de categoria dentro de uma pasta realinha o eixo horizontal", () => {
  const h = setup();
  h.xmb.enter(h.trigger);
  const nav = h.root().children[1];
  const list = h.root().children[2].children[0];
  const properties = {};
  list.style = nav.style = {
    setProperty: (key, value) => {
      properties[key] = value;
    },
  };
  nav.clientWidth = 300;
  nav.scrollWidth = 960;
  nav.scrollLeft = 0;
  nav.scrollTop = 0;
  nav.children.forEach((control, index) => {
    control.offsetLeft = index * 80;
    control.offsetWidth = 60;
  });
  h.window.getComputedStyle = (node) => ({
    flexBasis: node === nav ? "" : "80px",
    paddingLeft: node === nav ? "0px" : "",
    getPropertyValue: () => "",
  });
  h.window.matchMedia = () => ({ matches: true });

  h.key("ArrowRight");
  h.key("Enter");
  assert.equal(h.root().dataset.folderDepth, "true");

  h.key("ArrowRight");

  assert.equal(h.root().dataset.folderDepth, "false");
  assert.equal(nav.scrollLeft, 240);
  assert.equal(nav.children[3].offsetLeft + 30 - nav.scrollLeft, 30);
});

test("relógio usa locale, atualiza apenas no XMB e cancela timer ao sair", () => {
  const h = setup(),
    timers = new Map();
  let timerId = 0;
  h.window.setTimeout = (callback, delay) => {
    timers.set(++timerId, { callback, delay });
    return timerId;
  };
  h.window.clearTimeout = (id) => timers.delete(id);
  h.xmb.enter(h.trigger);
  const header = h.root().children[0],
    clock = header.children[1].children[0];
  assert.equal(header.children[0].textContent, "XMB v0.4");
  assert.equal(clock.tagName, "TIME");
  const instant = new Date(clock.attributes.datetime);
  assert.equal(
    clock.children[0].textContent,
    new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(instant),
  );
  assert.equal(clock.children[1].textContent, "◷");
  assert.equal(clock.children[1].attributes["aria-hidden"], "true");
  assert.equal(
    clock.children[2].textContent,
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(instant),
  );
  assert.ok(clock.attributes.title);
  assert.equal(timers.size, 1);
  const pending = [...timers.values()][0];
  assert.ok(pending.delay > 0 && pending.delay <= 60000);
  pending.callback();
  assert.equal(timers.size, 1);
  h.listeners.visibilitychange();
  assert.equal(timers.size, 1);
  h.key("Escape");
  assert.equal(timers.size, 0);
  h.listeners.visibilitychange();
  assert.equal(timers.size, 0);
  h.xmb.enter(h.trigger);
  assert.equal(timers.size, 1);
  h.xmb.close();
  assert.equal(timers.size, 0);
});
