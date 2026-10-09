const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Collection = require("../../dist/collection/collection.js");

function setup({ fullscreen = "reject" } = {}) {
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
      this.style = {};
      this.classList = { add() {}, remove() {} };
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
    contains(node) {
      return node === this || this.children.some((child) => child.contains(node));
    }
    scrollIntoView() {}
    querySelectorAll(selector) {
      const match = (node) =>
        selector === "button"
          ? node.tagName === "BUTTON"
          : selector === ".xmb-item"
            ? node.className === "xmb-item"
            : selector === '[aria-pressed="true"]' && node.attributes["aria-pressed"] === "true";
      return this.children.flatMap((node) => [
        ...(match(node) ? [node] : []),
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
      return ["INPUT", "TEXTAREA", "SELECT"].includes(this.tagName) || this.isContentEditable
        ? this
        : null;
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
    appearance: { xmb: {} },
    items: [
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
    document: doc,
    window: {
      addEventListener: (key, fn) => {
        windowListeners[key] = fn;
      },
      getComputedStyle: () => ({
        getPropertyValue: (key) =>
          ({
            "--motion-fast": "150ms",
            "--motion-focus": "180ms",
            "--ease-xmb": "cubic-bezier(.16, 1, .3, 1)",
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
    imageNode: (src, alt) => new Node("img", "", alt),
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
  };
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
  const h = setup();
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
  assert.equal(h.root().dataset.area, "music");
  assert.equal(h.root().dataset.kind, "music");
  assert.equal(h.selected(), "Duvet");
  const list = h.root().children[2].children[0];
  list.scrollTop = 53;
  h.key("Escape");
  assert.equal(h.root().dataset.level, "folders");
  assert.deepEqual(h.root().children[1].children.map((node) => node.textContent),
    ["Perfil", "Jogos", "Música", "Vídeo", "Leitura", "Fotos", "Outros"]);
  assert.equal(h.selected(), "Músicas");
  h.key("ArrowDown");
  h.key("Enter");
  assert.equal(h.root().dataset.kind, "album");
  assert.equal(h.selected(), undefined);
  h.key("D");
  h.key("O");
  assert.equal(h.opened.length, 0);
  h.key("Escape");
  assert.equal(h.selected(), "Álbuns");
  h.key("ArrowUp");
  h.key("Enter");
  assert.equal(h.selected(), "Duvet");
  assert.equal(list.scrollTop, 53);
  assert.equal(h.doc.activeElement.dataset.itemId, "c");
  h.key("ArrowRight");
  assert.equal(h.root().dataset.area, "video");
  assert.equal(h.selected(), "Filmes");
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
    const navigationMeasures = [];
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
    nav.animate = animate;
    nav.cloneNode = (deep) => {
      const clone = cloneNavigation(deep);
      clone.animate = animate;
      return clone;
    };
    list.getBoundingClientRect = () => ({ top: 160, left: 24, width: 900, height: 600 });
    nav.getBoundingClientRect = () => {
      navigationMeasures.push([root.dataset.folderDepth, root.dataset.folderMeasure]);
      return { top: 70, left: 24, width: 900, height: 72 };
    };
    h.window.matchMedia = () => ({ matches: false });

    h.key("Enter");

    assert.equal(root.dataset.folderDepth, "true");
    assert.equal(animations.length, 3);
    assert.equal(animations[0].frames.at(-1).transform, "translateX(-32px)");
    assert.equal(animations[1].frames.at(-1).transform, "translateX(-32px)");
    assert.equal(animations[2].frames[0].transform, "translateX(32px)");
    assert.equal(animations[2].frames[0].opacity, 0.64);
    assert.equal(animations[0].options.duration, 180);
    assert.equal(animations[1].options.duration, 180);
    assert.equal(
      root.children.filter((node) => node.className.includes("transition-outgoing")).length,
      2,
    );

    h.key("Escape");

    assert.equal(root.dataset.folderDepth, "false");
    assert.equal(root.dataset.level, "folders");
    assert.equal(h.selected(), folder);
    assert.equal(animations.length, 6);
    assert.equal(animations[3].frames.at(-1).transform, "translateX(32px)");
    assert.equal(animations[4].frames[0].transform, "translateX(-32px)");
    assert.equal(animations[4].frames[0].opacity, 0.64);
    assert.equal(animations[4].frames.at(-1).transform, "translateX(0)");
    assert.equal(animations[5].frames[0].transform, "translateX(-32px)");
    assert.equal(animations[5].frames[0].opacity, 0.64);
    assert.equal(animations[3].options.duration, 180);
    assert.equal(animations[4].options.duration, 180);
    assert.equal(animations[5].options.duration, 180);
    assert.equal(nav.style.visibility, "hidden");
    assert.deepEqual(navigationMeasures.at(-1), ["false", "true"]);
    assert.equal(root.dataset.folderMeasure, "false");
    assert.equal(
      root.children.filter((node) => node.className.includes("categories-transition-incoming")).length,
      1,
    );
    animations[3].finish();
    animations[4].finish();
    animations[5].finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(root.dataset.folderTransition, "false");
    assert.equal(nav.style.visibility, "");
    assert.equal(
      root.children.filter((node) => node.className.includes("transition-outgoing")).length,
      0,
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

test("detalhes preservam fullscreen, seleção, rolagem e foco até o segundo Escape", async () => {
  const h = setup({ fullscreen: "accept" });
  h.xmb.enter(h.trigger);
  await new Promise((resolve) => setImmediate(resolve));
  h.key("ArrowDown");
  const body = h.root().children[2],
    list = body.children[0],
    detail = body.children[1];
  const row = h.doc.activeElement;
  list.scrollTop = 73;
  detail.scrollTop = 19;
  h.key("Enter");
  assert.equal(h.opened.length, 0);
  assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  assert.equal(h.root().dataset.level, "details");
  assert.equal(h.doc.activeElement, detail);
  h.key("ArrowRight");
  h.key("ArrowDown");
  h.key("Tab");
  assert.equal(h.selected(), "Persona");
  assert.equal(h.doc.activeElement.className, "xmb-exit");
  h.key("Backspace");
  assert.equal(h.doc.activeElement, row);
  assert.equal(list.scrollTop, 73);
  assert.equal(detail.scrollTop, 19);
  assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  h.key("Enter");
  h.key("Escape");
  assert.equal(h.root().dataset.level, "root");
  assert.equal(h.xmb.isActive(), true);
  h.key("Escape", { repeat: true });
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
  const h = setup();
  h.window.innerHeight = 800;
  h.xmb.enter(h.trigger);
  const nav = h.root().children[1],
    list = h.root().children[2].children[0],
    rows = list.querySelectorAll(".xmb-item");
  nav.getBoundingClientRect = () => ({ bottom: 100 });
  list.getBoundingClientRect = () => ({ top: 120 });
  list.clientHeight = 400;
  list.scrollHeight = 800;
  list.style = {
    setProperty: (key, value) => {
      list.styles ||= {};
      list.styles[key] = value;
    },
  };
  list.scrollLeft = 0;
  rows[0].offsetTop = 20;
  rows[0].offsetHeight = 20;
  rows[1].offsetTop = 300;
  rows[1].offsetHeight = 20;
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
  assert.equal(list.styles["--xmb-list-start-space"], "0px");
  assert.equal(list.styles["--xmb-list-end-space"], "0px");
  assert.equal(list.scrollTop, 0);
  assert.equal(frames.size, 1);
  step(0);
  step(90);
  assert.ok(list.scrollTop > 0 && list.scrollTop < 264);
  h.key("ArrowUp");
  assert.equal(frames.size, 1);
  step(100);
  step(280);
  assert.equal(list.scrollTop, 0);
  assert.equal(frames.size, 0);
  h.window.matchMedia = () => ({ matches: true });
  h.key("ArrowDown");
  assert.equal(list.scrollTop, 202);
  assert.equal(frames.size, 0);
  h.window.matchMedia = () => ({ matches: false });
  h.key("ArrowUp");
  assert.equal(frames.size, 1);
  h.xmb.close();
  assert.equal(frames.size, 0);
});

test("viewports curtos mantêm o foco proporcional até a responsividade landscape", () => {
  const h = setup();
  h.window.innerHeight = 390;
  h.xmb.enter(h.trigger);
  const nav = h.root().children[1],
    list = h.root().children[2].children[0],
    rows = list.querySelectorAll(".xmb-item");
  nav.getBoundingClientRect = () => ({ bottom: 100 });
  list.getBoundingClientRect = () => ({ top: 120 });
  list.clientHeight = 400;
  list.scrollHeight = 800;
  list.style = {
    setProperty: (key, value) => {
      list.styles ||= {};
      list.styles[key] = value;
    },
  };
  rows[0].offsetTop = 20;
  rows[0].offsetHeight = 20;
  rows[1].offsetTop = 300;
  rows[1].offsetHeight = 20;

  h.key("ArrowDown");

  assert.equal(list.styles["--xmb-list-start-space"], "0px");
  assert.equal(list.styles["--xmb-list-end-space"], "0px");
  assert.equal(list.scrollTop, 126);
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
  h.data.items.splice(
    0,
    h.data.items.length,
    ...Array.from({ length: 12 }, (_, index) => ({
      id: "track-" + index,
      kind: "music",
      title: "Track " + String(index + 1).padStart(2, "0"),
    })),
  );
  h.filters.kind = "music";
  h.window.innerHeight = 800;
  h.window.getComputedStyle = () => ({
    getPropertyValue: (key) =>
      ({ "--xmb-selection-clearance": "128px" })[key] || "180ms cubic-bezier(.16, 1, .3, 1)",
  });
  h.window.matchMedia = () => ({ matches: true });
  h.xmb.enter(h.trigger);
  const nav = h.root().children[1];
  const list = h.root().children[2].children[0];
  const rows = list.querySelectorAll(".xmb-item");
  const properties = {};
  nav.getBoundingClientRect = () => ({ bottom: 100 });
  list.getBoundingClientRect = () => ({ top: 120 });
  list.clientHeight = 400;
  list.scrollHeight = 852;
  list.style = {
    setProperty: (key, value) => {
      properties[key] = value;
    },
  };
  rows.forEach((row, index) => {
    row.offsetTop = index * 72;
    row.offsetHeight = 60;
  });

  assert.equal(h.selected(), "Track 01");
  for (let index = 0; index < 6; index += 1) h.key("ArrowDown");
  assert.equal(h.selected(), "Track 07");
  assert.equal(list.scrollTop, 354);
  assert.equal(rows[6].offsetTop + rows[6].offsetHeight / 2 - list.scrollTop, 108);
  for (let index = 0; index < 5; index += 1) h.key("ArrowDown");
  assert.equal(h.selected(), "Track 12");
  assert.equal(list.scrollTop, 452);
  assert.equal(list.scrollTop + list.clientHeight, list.scrollHeight);
  assert.equal(rows[11].offsetTop + rows[11].offsetHeight / 2 - list.scrollTop, 370);
  for (let index = 0; index < 11; index += 1) h.key("ArrowUp");
  assert.equal(h.selected(), "Track 01");
  assert.equal(list.scrollTop, 0);
  assert.equal(rows[0].offsetTop + rows[0].offsetHeight / 2 - list.scrollTop, 30);
  assert.deepEqual(properties, {
    "--xmb-list-start-space": "0px",
    "--xmb-list-end-space": "0px",
  });
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
