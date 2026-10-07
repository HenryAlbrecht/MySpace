// Smoke test de interação em DOM simulado; não substitui inspeção visual.
const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
// Legacy preferences resolve without copying the global wallpaper.
const appearanceCode = fs.readFileSync('dist/profile-appearance.js', 'utf8');
const resolveXmb = vm.runInNewContext('(' + appearanceCode.slice(appearanceCode.indexOf('function xmbAppearance('), appearanceCode.indexOf('  function wallpaperRecipe(')) + ')');
for (const [legacy, source] of [[undefined,'artwork'], ['artwork','artwork'], ['desktop','inherit'], ['solid','custom']]) {
  const resolved = resolveXmb({ xmbBackground: legacy, background: 'global.png' });
  assert.equal(resolved.backgroundSource, source);
  assert.equal(resolved.customBackground, null);
  assert.equal(resolved.artworkOpacity, 1);
}
assert.equal(resolveXmb({ xmb: { artworkOpacity: .035 } }).artworkOpacity, 1);
assert.equal(resolveXmb({ xmb: { artworkOpacity: .6 } }).artworkOpacity, .6);
assert.equal(resolveXmb({ xmb: { artworkIntensity: 100 } }).ghostArtworkOpacity, 25);
assert.equal(resolveXmb({ xmb: { artworkIntensity: 0 } }).ghostArtworkOpacity, 75);
assert.equal(resolveXmb({ xmb: { artworkIntensity: 100, ghostArtworkOpacity: 50 } }).ghostArtworkOpacity, 50);
assert.equal(resolveXmb({ xmbBackground:'desktop', xmb:{backgroundSource:'custom',customBackground:'own.png'} }).customBackground, 'own.png');
class Node {
  constructor(tag = "div", text = "") {
    this.tagName = tag;
    this.textContent = text;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {
      setProperty(k, v) {
        this[k] = v;
      },
      removeProperty(k) {
        delete this[k];
      },
    };
    let inputValue = "";
    Object.defineProperty(this, "value", {
      get() {
        return inputValue;
      },
      set(value) {
        inputValue = String(value);
      },
      configurable: true,
    });
    this.files = [];
    this.className = "";
    this.open = false;
    this._popoverOpen = false;
    this.hidden = false;
    this.paused = true;
    this.classList = {
      contains: (k) => this.className.split(' ').includes(k),
      add: (k) => (this.className += " " + k),
      remove: (k) =>
        (this.className = this.className
          .split(" ")
          .filter((v) => v !== k)
          .join(" ")),
      toggle: (k, v) => {
        this.classList.remove(k);
        if (v) this.classList.add(k);
      },
    };
  }
  append(...nodes) {
    for (let n of nodes) {
      if (typeof n === "string") n = new Node("#text", n);
      n.remove();
      n.parentElement = this;
      this.children.push(n);
    }
  }
  prepend(...nodes) {
    for (const n of nodes.reverse()) {
      n.remove();
      n.parentElement = this;
      this.children.unshift(n);
    }
  }
  before(node) {
    this.parentElement.insertBefore(node, this);
  }
  after(node) {
    const siblings = this.parentElement.children;
    this.parentElement.insertBefore(node, siblings[siblings.indexOf(this) + 1]);
  }
  remove() {
    if (this.parentElement)
      this.parentElement.children = this.parentElement.children.filter(
        (n) => n !== this,
      );
    this.parentElement = null;
  }
  insertBefore(n, b) {
    if (!b) {
      this.append(n);
      return;
    }
    n.remove();
    const i = this.children.indexOf(b);
    if (i < 0) throw Error("insertBefore: nó ausente");
    n.parentElement = this;
    this.children.splice(i, 0, n);
  }
  replaceChildren(...nodes) {
    for (const n of this.children) n.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }
  get firstChild() {
    return this.children[0];
  }
  get lastChild() {
    return this.children.at(-1);
  }
  get firstElementChild() {
    return this.children.find((n) => n.tagName !== "#text");
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (["id", "class", "type", "name", "href", "src"].includes(k))
      this[k === "class" ? "className" : k] = String(v);
  }
  getAttribute(k) {
    return this.attributes[k] ?? this[k] ?? null;
  }
  removeAttribute(k) {
    delete this.attributes[k];
    delete this[k];
  }
  all() {
    return this.children.flatMap((n) => [n, ...n.all()]);
  }
  querySelectorAll(selector) {
    const match = (n, s) => {
      if (s.includes(">")) {
        const [a, b] = s.split(">");
        return match(n, b) && n.parentElement && match(n.parentElement, a);
      }
      const attr = s.match(/\[([^=]+)="?([^"\]]+)"?\]/);
      if (attr) {
        s = s.slice(0, s.indexOf("["));
        if (String(n.getAttribute(attr[1])) !== attr[2]) return false;
      }
      return s.startsWith("#")
        ? n.id === s.slice(1)
        : s.startsWith(".")
          ? n.className.split(" ").includes(s.slice(1))
          : !s || n.tagName === s;
    };
    return this.all().filter((n) => match(n, selector));
  }
  querySelector(s) {
    return this.querySelectorAll(s)[0] || null;
  }
  get elements() {
    return {
      namedItem: (name) => {
        const matches = this.all().filter((n) => n.name === name);
        if (matches.length < 2) return matches[0] || null;
        return {
          get value() {
            return matches.find((n) => n.checked)?.value || "";
          },
          set value(v) {
            for (const n of matches) n.checked = n.value === v;
          },
        };
      },
    };
  }
  addEventListener() {}
  focus() {}
  getBoundingClientRect() { return { top: 0, bottom: 300, left: 0, right: 500 }; }
  showModal() {
    this.open = true;
  }
  showPopover() {
    this._popoverOpen = true;
  }
  hidePopover() {
    this._popoverOpen = false;
  }
  matches(selector) {
    if (selector === ':popover-open') return this._popoverOpen;
    throw new Error(`Unsupported selector in smoke mock: ${selector}`);
  }
  close() {
    this.open = false;
  }
  scrollIntoView() {}
  pause() {
    this.paused = true;
    this.onpause?.();
  }
  load() {}
  async play() {
    this.paused = false;
    this.onplay?.();
  }
  click() {
    return this.onclick?.({ preventDefault() {} });
  }
}
function parse(html) {
  const doc = new Node("document"),
    stack = [doc];
  for (const token of html.match(/<[^>]+>|[^<]+/g)) {
    if (token.startsWith("</")) {
      stack.pop();
      continue;
    }
    if (token.startsWith("<!")) continue;
    if (token.startsWith("<")) {
      const name = token.match(/^<([\w-]+)/)?.[1];
      if (!name) continue;
      const n = new Node(name);
      for (const m of token.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
        if (m[1] === name) continue;
        n.setAttribute(m[1], m[2] ?? "");
        if (m[1] === "hidden") n.hidden = true;
      }
      stack.at(-1).append(n);
      if (!["meta", "link", "input", "img", "br"].includes(name)) stack.push(n);
    } else stack.at(-1).append(new Node("#text", token));
  }
  doc.body = doc.querySelector("body");
  doc.documentElement = doc.querySelector('html');
  doc.getElementById = (id) => doc.querySelector("#" + id);
  doc.createElement = (tag) => new Node(tag);
  doc.createTextNode = (text) => new Node("#text", text);
  return doc;
}
const doc = parse(fs.readFileSync("dist/index.html", "utf8")),
  storage = new Map();
const ctx = {
  document: doc,
  console,
  Event,
  CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } },
  dispatchEvent: () => {},
  ResizeObserver: class { observe() {} disconnect() {} },
  MutationObserver: class { observe() {} disconnect() {} },
  scrollX: 0,
  scrollY: 0,
  innerWidth: 1440,
  innerHeight: 900,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  AbortController,
  URLSearchParams,
  TextDecoder,
  TextEncoder,
  Uint8Array,
  Blob,
  URL,
  crypto: require("node:crypto").webcrypto,
  setTimeout: () => 0,
  clearTimeout: () => {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  Option: class extends Node {
    constructor(label, value) {
      super("option", label);
      this.value = value;
    }
  },
  FormData: class {
    constructor(form) {
      this.form = form;
    }
    get(name) {
      return this.form.elements.namedItem(name)?.value ?? null;
    }
  },
  localStorage: {
    get length() { return storage.size; },
    key: index => Array.from(storage.keys())[index] ?? null,
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  },
  getComputedStyle: () => ({ getPropertyValue: () => "#151923" }),
};
ctx.window = ctx;
ctx.SPACEVOICE_CONFIG = {transport:'local'};
ctx.BroadcastChannel = class { postMessage() {} close() {} };
let voiceRequests = 0, voiceStops = 0;
const voiceTrack = { enabled:true, label:'Microfone smoke', stop() { voiceStops++; } };
ctx.navigator = { mediaDevices: { getUserMedia: async () => {
  voiceRequests++;
  return { getAudioTracks: () => [voiceTrack], getTracks: () => [voiceTrack] };
} } };
ctx.location = { hash: "" };
ctx.addEventListener = () => {};
vm.createContext(ctx);

// Derive the order from the served page rather than maintaining a second list.
const scripts = [...fs.readFileSync('dist/index.html', 'utf8').matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
for (const file of scripts) {
  vm.runInContext(fs.readFileSync('dist/' + file, 'utf8'), ctx, { filename: file });
}
assert.ok(doc.getElementById('collection'));
assert.ok(doc.getElementById('globalSpaceAmp'));
assert.ok(doc.getElementById('spaceVoicePage'));
assert.equal(doc.body.dataset.page, 'perfil');
assert.equal(voiceRequests, 0, 'boot never captures microphone');
for (const name of ['Collection', 'CollectionActions', 'Catalog', 'TitlePages', 'MusicBridge', 'SPACEAMP', 'PARTY_ROOM']) {
  assert.ok(vm.runInContext(name, ctx), name + ' facade available');
}
assert.equal(doc.querySelectorAll('audio').length, 1, 'one player host');
for (const [facade, methods] of Object.entries({
  TitlePages: ['open', 'route', 'patchCollectionState', 'refresh'],
  CollectionActions: ['patchCatalogMetadata', 'quickAdd', 'saveMusic', 'getItems', 'editItem', 'applyRoute', 'updateItem', 'favoriteArtist'],
  SpaceAmpNowPlaying: ['open', 'close', 'isOpen'],
})) {
  for (const method of methods) {
    assert.equal(vm.runInContext(`typeof ${facade}.${method}`, ctx), 'function', `${facade}.${method}`);
  }
}
console.log('Page smoke: HTML script order, public facades, Profile/Collection/SPACEAMP/PARTY boot OK.');
