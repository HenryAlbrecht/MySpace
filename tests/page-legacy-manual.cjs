// HISTORICAL: old DOM interactions; not a current acceptance suite. See tests/README.md.
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
    this.hidden = false;
    this.paused = true;
    this.classList = {
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
  showModal() {
    this.open = true;
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
for (const file of [
  "audio-tags.js",
  "media-embeds.js",
  "app.js",
  "collection.js",
  "media-storage.js",
  "media-package.js",
  "playlist.js",
  "collection-view.js",
  "title-preferences.js",
  "voice/ice-config.js",
  "voice/network.js",
  "voice/room-metadata.js",
  "voice/room.js",
  "voice/media-settings.js",
  "voice/media.js",
  "voice/state.js",
  "voice/devices.js",
  "voice/levels.js",
  "voice/chat.js",
  "voice/signaling-local.js",
  "voice/peer.js",
  "voice/session.js",
  "party-chat-ui.js",
  "spacevoice.js",
  "backup-validation.js",
  "profile-appearance.js",
  "extras.js",
  "catalog.js",
  "editor-ui.js",
  "catalog-discovery.js",
  "title-banner.js",
  "title-gallery.js",
  "title-pages.js",
  "discovery-page.js",
])
  vm.runInContext(fs.readFileSync("dist/" + file, "utf8"), ctx, {
    filename: file,
  });
const read = () => JSON.parse(storage.get("myspace-extras-v1"));
const event = { preventDefault() {} };
async function submitResource(values) {
  const form = doc.getElementById("resourceEditor").querySelector("form");
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements.namedItem(key);
    assert.ok(field, key);
    field.value = value;
  }
  await form.onsubmit(event);
  const error = form.querySelector(".error");
  assert.equal(error.textContent, "");
}
(async () => {
  assert.equal(doc.body.dataset.xmbBackground, 'artwork', 'preferência ausente preserva artwork');
  assert.ok(doc.getElementById("collection"));
  assert.equal(
    doc.querySelector(".nav>div").children.filter((n) => n.tagName === "a")
      .length,
    6,
  );
  assert.equal(doc.getElementById("collectionPage").hidden, true);
  const voiceLink = doc.querySelector('.nav>div').children.find(n => n.dataset.route === 'spacevoice');
  assert.equal(voiceLink.textContent,'[ PARTY ]');
  voiceLink.click();
  assert.equal(doc.getElementById('spaceVoicePage').hidden, false);
  assert.equal(doc.body.dataset.page, 'spacevoice');
  assert.equal(doc.querySelector('.spacevoice').querySelector('h2').textContent,'PARTY');
  const voiceButtons = doc.querySelector('.spacevoice').querySelectorAll('button');
  assert.ok(voiceButtons.some(n => n.textContent.includes('entrar na chamada')));
  assert.equal(voiceButtons.find(n => n.attributes['aria-label']==='Compartilhar tela').disabled, true);
  assert.equal(doc.querySelector('.spacevoice-participants').children.length, 1);
  assert.equal(voiceRequests, 0, 'loading and navigating never requests microphone');
  await voiceButtons.find(n => n.textContent.includes('entrar na chamada')).onclick();
  for(let i=0;i<30;i++) await Promise.resolve();
  assert.equal(doc.querySelector('.spacevoice').dataset.joined, 'true');
  assert.equal(voiceRequests, 1);
  voiceButtons.find(n => n.attributes['aria-label']==='Silenciar microfone').click();
  assert.equal(voiceTrack.enabled, false);
  doc.querySelector(".nav>div").children[1].click();
  assert.equal(voiceStops, 1, 'leaving SPACEVOICE releases capture');
  assert.equal(doc.querySelector('.spacevoice').dataset.joined, 'false');
  assert.equal(doc.querySelector(".columns").hidden, true);
  assert.equal(doc.getElementById("collectionPage").hidden, false);
  doc.querySelector(".collection-tabs").children[1].click();
  assert.equal(ctx.location.hash, "#colecao/game");
  doc
    .getElementById("collection")
    .querySelector(".section-head")
    .querySelector("button")
    .click();
  assert.equal(doc.querySelector(".item-editor-layout").hidden, true);
  doc.querySelector(".catalog-manual").click();
  assert.equal(doc.querySelector(".item-editor-layout").hidden, false);
  assert.ok(doc.querySelector(".cover-preview"));
  assert.equal(doc.querySelector(".editor-details").open, false);
  assert.ok(doc.querySelector(".status-choices"));
  await submitResource({
    title: "Teste de jogo",
    kind: "game",
    status: "active",
    progress: "4",
    total: "20",
    unit: "horas",
    score: "8",
    startedAt: '2026-09-01',
    notes: 'Primeira linha\nSegunda linha',
  });
  assert.equal(read().items[0].progress, 4);
  assert.equal(read().items[0].score, 8);
  assert.equal(read().items[0].startedAt,'2026-09-01');
  assert.equal(read().items[0].notes,'Primeira linha\nSegunda linha');
  assert.equal(doc.querySelector(".shelf-actions"), null);
  const collectionSearch = doc.querySelector(".collection-controls").querySelector("input");
  collectionSearch.value = "Teste"; collectionSearch.oninput();
  await ctx.TitlePages.open(read().items[0]);
  doc.querySelector(".title-complete").click();
  assert.equal(read().items[0].status, "done");
  assert.equal(read().items[0].progress, 20);
  assert.match(read().items[0].finishedAt,/^\d{4}-\d{2}-\d{2}$/);
  doc.querySelector(".title-favorite").click();
  doc.getElementById("titlePage").querySelectorAll("button").find(button => button.textContent === "← voltar").click();
  assert.equal(collectionSearch.value, "Teste", "Voltar da ficha mantém a busca da coleção");
  collectionSearch.value = ""; collectionSearch.oninput();
  assert.equal(read().items[0].featured, true);
  assert.equal(doc.getElementById("featuredCollection").hidden, false);
  assert.equal(doc.querySelector(".featured-grid").children.length, 1);
  assert.equal(doc.querySelector('.advanced-filters').hidden,true);
  doc.querySelector('.filter-toggle').click();assert.equal(doc.querySelector('.advanced-filters').hidden,false);assert.equal(doc.querySelector('.filter-toggle').attributes['aria-expanded'],'true');
  doc.querySelector('.filter-toggle').click();assert.equal(doc.querySelector('.advanced-filters').hidden,true);
  assert.equal(doc.querySelector('.collection-bulk').hidden,true);
  doc.querySelector('.bulk-toggle').click();
  const bulk = doc.querySelector('.collection-bulk');
  const bulkButton = text => bulk.querySelectorAll('button').find(button=>button.textContent===text);
  assert.equal(bulk.querySelector('.bulk-apply').disabled,true);
  bulkButton('selecionar visíveis').click();
  bulk.querySelector('.bulk-action').value='addList';bulk.querySelector('.bulk-action').onchange();bulk.querySelector('input').value='Para jogar com amigos';bulk.querySelector('.bulk-apply').click();
  assert.equal(read().items[0].lists[0],'Para jogar com amigos');
  assert.ok(read().history.some(entry=>entry.fields.includes('lists')));
  bulkButton('selecionar visíveis').click();bulk.querySelector('.bulk-action').value='status';bulk.querySelector('.bulk-action').onchange();bulk.querySelectorAll('select')[1].value='paused';bulk.querySelector('.bulk-apply').click();assert.equal(read().items[0].status,'paused');
  bulkButton('selecionar visíveis').click();bulk.querySelectorAll('select')[1].value='done';bulk.querySelector('.bulk-apply').click();
  const listFilter=doc.querySelector('.advanced-filters').querySelectorAll('select').find(select=>select.dataset.filter==='list');listFilter.value='Para jogar com amigos';listFilter.onchange();assert.equal(doc.querySelector('.shelf').children.length,1);
  listFilter.value='';listFilter.onchange();doc.querySelector('.bulk-toggle').click();
  assert.equal(bulk.hidden,true);assert.equal(doc.querySelectorAll('.bulk-check').length,0);
  const favoriteFilter = doc.querySelector('.favorite-filters').querySelector('select');
  favoriteFilter.value = 'game'; favoriteFilter.onchange();
  assert.equal(read().favoriteKind, 'game');
  assert.equal(doc.getElementById('featuredCollection').querySelector('h3').textContent, 'jogos favoritos');
  assert.equal(doc.querySelector('.featured-grid').children.length, read().items.filter(item => item.featured && item.kind === 'game').length);
  const resetFavorites = doc.querySelector('.favorite-filters').querySelector('select');
  resetFavorites.value = 'all'; resetFavorites.onchange();
  assert.equal(doc.querySelector('.featured-grid').children.length, 1);
  doc.querySelector(".nav>div").children[0].click();
  assert.equal(doc.getElementById("collectionPage").hidden, true);
  assert.equal(doc.getElementById("favorites").hidden, true);
  doc.querySelector(".main-column").lastChild.click();
  doc
    .getElementById("resourceEditor")
    .querySelector(".toolbar")
    .children[0].click();
  await submitResource({ name: "Um favorito", url: "https://example.com" });
  assert.equal(read().favorites.length, 1);
  assert.equal(doc.getElementById("favorites").hidden, false);
  doc.querySelector(".main-column").lastChild.click();
  doc
    .getElementById("resourceEditor")
    .querySelector(".toolbar")
    .children[1].click();
  await submitResource({
    name: "Teste 88x31",
    background: "#111111",
    color: "#ffffff",
  });
  assert.equal(read().badges.length, 1);
  doc.querySelector(".nav>div").children[2].click();
  assert.equal(doc.getElementById("photosPage").hidden, false);
  assert.equal(doc.querySelector(".columns").hidden, true);
  doc.getElementById("gallery").querySelector("button").click();
  await submitResource({
    caption: "Foto de teste",
    imageUrl: "https://example.com/photo.png",
  });
  assert.equal(read().photos.length, 1);
  doc.querySelector(".nav>div").children[0].click();
  doc.querySelector(".main-column").lastChild.click();
  doc
    .getElementById("resourceEditor")
    .querySelector(".toolbar")
    .children[2].click();
  await submitResource({
    title: "Meus links",
    text: "Meu texto",
    url: "https://example.com",
    linkText: "Um link",
  });
  assert.equal(read().blocks.length, 1);
  doc.querySelector(".topbar").querySelector(".toolbar").firstChild.click();
  await submitResource({
    font: "mono",
    opacity: "75",
    bannerHeight: "340",
    borderStyle: "dashed",
  });
  assert.equal(doc.getElementById("banner").style.height, "340px");
  assert.equal(read().appearance.opacity, 75);
  assert.equal(read().appearance.xmb.backgroundSource, 'artwork');
  // Mesma tela, mesma persistência e um único wallpaper compartilhado.
  for (const [backgroundMode, size, repeat] of [['tile','auto','repeat'], ['cover','cover','no-repeat'], ['contain','contain','no-repeat']]) {
    doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
    const appearanceForm = doc.getElementById('resourceEditor').querySelector('form');
    const xmbField = appearanceForm.elements.namedItem('xmbSource');
    assert.ok(xmbField);
    assert.ok(xmbField.parentElement.parentElement.id === 'editor-panel-xmb');
    await submitResource({ xmbSource:'inherit', backgroundUrl:'https://example.com/shared-wallpaper.png', backgroundMode });
    assert.equal(read().appearance.xmb.backgroundSource, 'inherit');
    assert.equal(read().appearance.background, 'https://example.com/shared-wallpaper.png');
    assert.equal(doc.body.dataset.xmbBackground, 'desktop');
    assert.equal(doc.body.style.backgroundSize, size);
    assert.equal(doc.body.style.backgroundRepeat, repeat);
    assert.equal(doc.body.style.backgroundPosition, 'center');
    assert.equal(doc.body.style.backgroundAttachment, 'fixed');
    assert.equal(Object.hasOwn(read().appearance, 'xmbCustomBackground'), false);
  }
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  doc.getElementById('resourceEditor').querySelector('form').elements.namedItem('useColors').checked = true;
  await submitResource({ xmbSource:'custom', xmbUseColor:true, xmbColor:'#123456', backgroundColor:'#123456' });
  assert.equal(doc.body.dataset.xmbBackground, 'custom');
  assert.equal(read().appearance.xmb.backgroundSource, 'custom');
  assert.equal(doc.body.style['--bg'], '#123456');
  assert.equal(read().appearance.background, 'https://example.com/shared-wallpaper.png');
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  await submitResource({ xmbSource:'custom', xmbUrl:'https://example.com/xmb.png', xmbMode:'tile', xmbTransparency:'40' });
  assert.equal(read().appearance.xmb.customBackground, 'https://example.com/xmb.png');
  assert.equal(read().appearance.background, 'https://example.com/shared-wallpaper.png');
  assert.equal(doc.body.style['--xmb-wallpaper-repeat'], 'repeat');
  assert.equal(doc.body.style['--xmb-panel-opacity'], '60%');
  for (const [mode, size, repeat] of [['cover','cover','no-repeat'], ['contain','contain','no-repeat']]) {
    doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
    await submitResource({ xmbMode:mode });
    assert.equal(doc.body.style['--xmb-wallpaper-size'], size);
    assert.equal(doc.body.style['--xmb-wallpaper-repeat'], repeat);
  }
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  await submitResource({ xmbSource:'inherit', backgroundMode:'contain' });
  assert.equal(read().appearance.xmb.customBackground, 'https://example.com/xmb.png');
  assert.equal(doc.body.style.backgroundSize, 'contain');
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  doc.getElementById('resourceEditor').querySelector('form').elements.namedItem('xmbClear').checked = true;
  await submitResource({ xmbSource:'custom' });
  assert.equal(read().appearance.xmb.customBackground, null);
  assert.equal(doc.body.style['--xmb-wallpaper-image'], 'none');
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  await submitResource({ xmbSource:'artwork' });
  assert.equal(doc.body.dataset.xmbBackground, 'artwork');
  assert.equal(read().appearance.xmb.backgroundSource, 'artwork');
  for (const [value, blur, opacity] of [[0,'8px',.5],[50,'24px',.35],[100,'40px',.2]]) {
    doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
    const intensityField = doc.getElementById('resourceEditor').querySelector('form').elements.namedItem('xmbArtworkIntensity');
    assert.equal(intensityField.parentElement.hidden, false);
    await submitResource({ xmbArtworkIntensity:String(value) });
    assert.equal(read().appearance.xmb.artworkIntensity, value);
    assert.equal(Number(doc.body.style['--xmb-ghost-opacity']), .08, 'ghost is independent of atmospheric treatment');
    assert.equal(doc.body.style['--xmb-artwork-blur'], blur);
    assert.ok(Math.abs(Number(doc.body.style['--xmb-atmosphere-opacity']) - opacity) < 1e-8);
  }
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  const ghostForm = doc.getElementById('resourceEditor').querySelector('form');
  const ghostToggle = ghostForm.elements.namedItem('xmbGhostEnabled');
  ghostToggle.checked = false;
  ghostToggle.onchange();
  assert.equal(ghostForm.elements.namedItem('xmbGhostOpacity').parentElement.hidden, true);
  await submitResource({ xmbGhostOpacity:'100' });
  assert.equal(read().appearance.xmb.ghostArtworkEnabled, false);
  assert.equal(doc.body.dataset.xmbGhostArtwork, 'false');
  assert.equal(Number(doc.body.style['--xmb-ghost-opacity']), .16);
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  const enabledForm = doc.getElementById('resourceEditor').querySelector('form');
  enabledForm.elements.namedItem('xmbGhostEnabled').checked = true;
  enabledForm.elements.namedItem('xmbGhostEnabled').onchange();
  assert.equal(enabledForm.elements.namedItem('xmbGhostOpacity').parentElement.hidden, false);
  await submitResource({ xmbGhostOpacity:'0' });
  assert.equal(doc.body.dataset.xmbGhostArtwork, 'true');
  assert.equal(Number(doc.body.style['--xmb-ghost-opacity']), 0);
  assert.equal(doc.body.style['--xmb-artwork-blur'], '40px');
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  await submitResource({ profileLayout: 'banner', avatarShape: 'round' });
  assert.equal(doc.getElementById('profile').hidden, true);
  assert.equal(doc.getElementById('avatar').parentElement.parentElement.className, 'banner-profile');
  assert.equal(doc.body.dataset.avatarShape, 'round');
  doc.querySelector('.topbar').querySelector('.toolbar').firstChild.click();
  await submitResource({ profileLayout: 'window', avatarShape: 'square' });
  assert.equal(doc.getElementById('profile').hidden, false);
  assert.equal(doc.getElementById('avatar').parentElement.parentElement.id, 'profile');
  doc.querySelector('.main-column').lastChild.click();
  doc.getElementById('resourceEditor').querySelector('.toolbar').children[3].click();
  await submitResource({ url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Vídeo favorito' });
  assert.equal(doc.getElementById('featuredVideo').hidden, false);
  doc.getElementById('featuredVideo').querySelector('.video-launch').click();
  assert.equal(doc.getElementById('featuredVideo').querySelector('iframe').src, 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&autoplay=1');

  doc.getElementById("addMusic").click();
  assert.equal(doc.getElementById("editor-panel-music").hidden, false);
  assert.equal(doc.getElementById("editor-panel-profile").hidden, true);
  const profile = doc.getElementById("profileForm");
  for (const [key, value] of Object.entries({
    song: "Faixa de teste",
    artist: "Artista",
    musicUrl: "https://example.com/music.mp3",
  }))
    profile.elements.namedItem(key).value = value;
  await profile.onsubmit(event);
  assert.equal(read().tracks.length, 1);
  assert.equal(read().tracks[0].title, "Faixa de teste");
  assert.equal(doc.getElementById("songTitle").textContent, "Faixa de teste");
  const player = doc.getElementById("audio");
  const originalPause = player.pause, originalLoad = player.load;
  let pauses = 0, loads = 0;
  player.pause = function () { pauses++; return originalPause.call(this); };
  player.load = function () { loads++; return originalLoad.call(this); };
  player.paused = false;
  player.currentTime = 37;
  await doc.querySelector(".playlist-rows").firstChild.querySelector(".mini-actions").firstChild.click();
  vm.runInContext('pending.album = "data:image/jpeg;base64,Y292ZXI=";', ctx);
  await profile.onsubmit(event);
  assert.equal(pauses, 0, "Opening or saving album metadata must not pause audio");
  assert.equal(loads, 0, "Album artwork must not reload the audio source");
  assert.equal(player.currentTime, 37);
  assert.equal(player.paused, false);
  player.pause = originalPause;
  player.load = originalLoad;
  doc.getElementById("addMusic").click();
  for (const [key, value] of Object.entries({
    song: "Segunda faixa",
    artist: "Outro artista",
    musicUrl: "https://example.com/second.mp3",
  }))
    profile.elements.namedItem(key).value = value;
  await profile.onsubmit(event);
  assert.equal(read().tracks.length, 2);
  doc.querySelector(".playlist-track").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(doc.getElementById("songTitle").textContent, "Faixa de teste");
  doc.getElementById("editProfile").click();
  assert.equal(doc.getElementById("editor-panel-profile").hidden, false);
  assert.equal(doc.getElementById("editor-panel-music").hidden, true);
  profile.elements.namedItem("tagline").value = "Frase pessoal";
  await profile.onsubmit(event);
  assert.equal(read().tracks.length, 2);
  assert.equal(
    JSON.parse(storage.get("myspace-profile-v1")).tagline,
    "Frase pessoal",
  );
  doc.getElementById('addMusic').click();
  profile.elements.namedItem('musicUrl').value = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC';
  await profile.onsubmit(event);
  const platformFrame = doc.querySelector('.music-embed').querySelector('.provider-surface');
  assert.equal(platformFrame.querySelector('iframe').src, 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?theme=0');
  doc.getElementById('editProfile').click();
  profile.elements.namedItem('tagline').value = 'Mantém o player';
  await profile.onsubmit(event);
  assert.equal(doc.querySelector('.music-embed').querySelector('.provider-surface'), platformFrame);
  doc.querySelector('.section-manager').click();
  let musicRow = doc.querySelectorAll('.section-order-row').find(row => row.dataset.sectionKey === 'music');
  musicRow.querySelector('.section-order-controls').firstElementChild.click();
  assert.deepEqual(Array.from(read().sectionOrder.main), ['about', 'featured', 'music', 'video', 'wall', 'blocks']);
  assert.equal(doc.getElementById('music').style.order, '2');
  assert.equal(doc.querySelector('.music-embed').querySelector('.provider-surface'), platformFrame);
  musicRow = doc.querySelectorAll('.section-order-row').find(row => row.dataset.sectionKey === 'music');
  const musicVisibility = musicRow.querySelector('input');
  musicVisibility.checked = false; musicVisibility.onchange();
  assert.equal(doc.getElementById('music').hidden, true);
  musicVisibility.checked = true; musicVisibility.onchange();
  assert.equal(doc.getElementById('music').style.order, '2');
  doc.getElementById('resourceEditor').close();
  // Local video uploads persist a Blob; caption changes retain the playing element.
  const videoFiles = new Map();
  ctx.MediaStorage = { put: async (id, value) => videoFiles.set(id, value), get: async id => videoFiles.get(id), remove: async id => videoFiles.delete(id), putMany: async entries => { for (const [id,file] of entries) file === undefined ? videoFiles.delete(id) : videoFiles.set(id,file); } };
  doc.getElementById('featuredVideo').querySelector('button').click();
  const videoForm = doc.getElementById('resourceEditor').querySelector('form');
  const clip = new Blob(['fixture'], { type: 'video/mp4' });
  clip.name = 'clip.mp4';
  videoForm.elements.namedItem('videoFile').files = [clip];
  await videoForm.onsubmit(event);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(read().featuredVideo.localId);
  const nativeVideo = doc.getElementById('featuredVideo').querySelector('video');
  assert.ok(nativeVideo.src.startsWith('blob:'));
  doc.getElementById('featuredVideo').querySelector('button').click();
  await submitResource({ title: 'Nova legenda' });
  assert.equal(doc.getElementById('featuredVideo').querySelector('video'), nativeVideo);
  ctx.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: { Media: {
        id: 42,
        title: { english: "Catalog anime" },
        episodes: 26,
        siteUrl: "https://example.com/anime",
        coverImage: { extraLarge: "https://example.com/anime.jpg" },
        description: "<p>Fixture synopsis.</p>",
        genres: ["Adventure"],
      }, Page: { media: [
        {
          id: 42,
          title: { english: "Catalog anime" },
          episodes: 26,
          siteUrl: "https://example.com/anime",
          coverImage: { extraLarge: "https://example.com/anime.jpg" },
        },
      ] } },
    }),
  });
  doc.querySelector(".nav>div").children[1].click();
  doc
    .getElementById("collection")
    .querySelector(".section-head")
    .querySelector("button")
    .click();
  const searchBar = doc.querySelector(".catalog-searchbar");
  searchBar.querySelector("select").value = "anime";
  searchBar.querySelector("select").onchange();
  searchBar.querySelector("input").value = "Catalog fixture";
  await searchBar.lastChild.click();
  assert.ok(doc.querySelector(".catalog-result"));
  doc.querySelector(".catalog-result").click();
  await new Promise(setImmediate);
  assert.equal(doc.getElementById("resourceEditor").open, false);
  assert.equal(doc.getElementById("titlePage").hidden, false);
  assert.equal(doc.getElementById("collectionPage").hidden, true);
  assert.equal(doc.querySelector(".title-summary").textContent, "Fixture synopsis.");
  doc.querySelector(".title-actions").firstChild.click();
  assert.equal(doc.querySelector(".item-editor-layout").hidden, false);
  const itemForm = doc.getElementById("resourceEditor").querySelector("form");
  const coverUrl = itemForm.elements.namedItem("imageUrl");
  coverUrl.value = "https://example.com/custom.jpg";
  coverUrl.oninput();
  doc.querySelector(".restore-catalog-cover").click();
  assert.equal(coverUrl.value, "https://example.com/anime.jpg");
  coverUrl.value = "https://example.com/custom.jpg";
  coverUrl.oninput();
  await submitResource({ status: "planned" });
  assert.equal(read().items[1].title, "Catalog anime");
  assert.equal(read().items[1].total, 26);
  assert.equal(read().items[1].source, "AniList");
  assert.equal(read().items[1].image, "https://example.com/custom.jpg");
  assert.equal(read().items[1].catalogImage, "https://example.com/anime.jpg");
  assert.equal(read().items[1].score, null);
  assert.equal(read().items[1].summary, "<p>Fixture synopsis.</p>");
  doc.querySelector(".nav>div").children[3].click();
  await ctx.TitlePages.route();
  const discover = doc.querySelector(".discover-search");
  discover.querySelector("select").value = "anime";
  discover.querySelector("input").value = "Catalog fixture";
  await discover.onsubmit(event);
  assert.equal(doc.getElementById("discoverPage").hidden, false);
  assert.ok(doc.querySelector(".discover-card"));
  doc.querySelector(".discover-card").click();
  await new Promise(setImmediate);
  assert.equal(doc.querySelector(".title-actions").firstChild.textContent, "editar na coleção");
  assert.equal(doc.querySelector(".title-layout").querySelector("img").src, "https://example.com/custom.jpg");
  doc.getElementById("titlePage").querySelector(".section-head").firstChild.click();
  assert.equal(doc.getElementById("discoverPage").hidden, false);
  assert.equal(ctx.location.hash, "#buscar/anime/Catalog%20fixture");
  ctx.fetch = async () => ({ ok: true, json: async () => ({ query: { pages: [{ pageid: 991, title: "Game detail fixture", extract: "A real synopsis field.", fullurl: "https://en.wikipedia.org/wiki/Fixture" }] } }) });
  ctx.location.hash = "#titulo/game/wiki%3A991";
  ctx.CollectionActions.applyRoute();
  await ctx.TitlePages.route();
  assert.equal(doc.getElementById("titlePage").querySelector("h1").textContent, "Game detail fixture");
  assert.equal(doc.getElementById("titlePage").querySelector(".title-summary").textContent, "A real synopsis field.");
  const originalItems = read().items.length;
  doc.querySelector(".title-actions").firstChild.click();
  await submitResource({ status: "planned" });
  assert.equal(read().items.length, originalItems + 1);
  assert.equal(read().items.at(-1).catalogId, "wiki:991");
  const bookDetails = await ctx.Catalog.details({ kind: "book", catalogId: "ol:/works/OL999W", total: 200, unit: "páginas" }, {
    fetcher: async () => ({ ok: true, json: async () => ({ title: "Book fixture", description: { value: "Book synopsis" }, covers: [22], subjects: ["Fantasy"] }) }),
  });
  assert.equal(bookDetails.summary, "Book synopsis");
  assert.equal(bookDetails.total, 200);
  assert.ok(bookDetails.image.endsWith("22-L.jpg"));
  ctx.fetch = async url => ({ ok: true, json: async () => url.startsWith("/api/steam/search") ? {
    items: [{ id: 42, name: "Steam game fixture", tiny_image: "https://example.com/steam.jpg" }],
  } : {
    steam_appid: 42, name: "Steam game fixture", short_description: "Game summary from Steam.",
    cover_image: "https://example.com/steam.jpg", header_image: "https://example.com/header.jpg",
    developers: ["Developer"], release_date: { date: "2020" }, genres: [{ description: "Adventure" }], platforms: { windows: true },
  } });
  discover.querySelector("select").value = "game";
  discover.querySelector("input").value = "Steam game fixture";
  await discover.onsubmit(event);
  doc.querySelector(".discover-card").click();
  await new Promise(setImmediate);
  assert.equal(doc.getElementById("titlePage").querySelector("h1").textContent, "Steam game fixture");
  assert.equal(doc.getElementById("titlePage").querySelector(".title-summary").textContent, "Game summary from Steam.");
  doc.querySelector(".title-actions").firstChild.click();
  const steamForm = doc.getElementById("resourceEditor").querySelector("form");
  const coverLayout = steamForm.elements.namedItem("coverLayout");
  coverLayout.value = "horizontal";
  coverLayout.onchange();
  assert.equal(steamForm.elements.namedItem("imageUrl").value, "https://example.com/header.jpg");
  await submitResource({ status: "planned" });
  assert.equal(read().items.at(-1).catalogId, "steam:42");
  assert.equal(read().items.at(-1).source, "Steam");
  assert.equal(read().items.at(-1).coverLayout, "horizontal");
  assert.equal(read().items.at(-1).image, "https://example.com/header.jpg");
  ctx.fetch = async () => ({ ok: true, json: async () => ({ kind: 'game', source: 'IGDB', catalogId: 'igdb:777', title: 'IGDB fixture', image: 'https://example.com/original.jpg', verticalImage: 'https://example.com/original.jpg', bannerImage: 'https://example.com/banner.jpg', summary: 'Summary '.repeat(140), artworks: ['https://example.com/art.jpg', 'https://example.com/art2.jpg'], screenshots: ['https://example.com/shot.jpg'], localizedCoverImages: ['https://example.com/jp.jpg'], localizedCoverLabels: ['Japan'], recommendationIds: ['igdb:778'], recommendationTitles: ['Similar game'], recommendationImages: ['https://example.com/similar.jpg'], recommendationKinds: ['game'] }) });
  ctx.location.hash = '#titulo/game/igdb%3A777'; ctx.CollectionActions.applyRoute(); await ctx.TitlePages.route();
  const headings = doc.getElementById('titlePage').querySelectorAll('h2').map(n => n.textContent);
  assert.ok(!headings.some(text => text.includes('AniList')));
  assert.equal(headings.filter(text => text === 'para descobrir').length, 1);
  const allButtons = doc.getElementById('titlePage').querySelectorAll('button');
  assert.equal(allButtons.filter(n => n.textContent === 'usar como capa').length, 0);
  assert.equal(doc.getElementById('titlePage').querySelectorAll('.gallery-banner-action').length, 3);
  assert.ok(doc.getElementById('titlePage').querySelector('.quick-regional-cover'));
  const folds = doc.getElementById('titlePage').querySelectorAll('.title-fold');
  assert.equal(folds.length, 3);
  assert.ok(folds.every(fold => !fold.open && fold.querySelector('summary') && fold.querySelector('.title-fold-body')));
  for(const fold of folds) {const deferred=fold.querySelectorAll('img').filter(image=>image.dataset.deferredSrc);if(deferred.length){assert.ok(!deferred[0].src);const expected=deferred[0].dataset.deferredSrc;fold.open=true;fold.ontoggle();assert.equal(deferred[0].src,expected);fold.open=false;}}
  const readMore=doc.querySelector('.summary-read-more');assert.equal(readMore.hidden,false);readMore.click();assert.equal(readMore.getAttribute('aria-expanded'),'true');readMore.click();assert.equal(readMore.getAttribute('aria-expanded'),'false');
  doc.getElementById('titlePage').querySelector('.gallery-preview').click();
  const viewer=doc.querySelector('.gallery-viewer');assert.equal(viewer.open,true);assert.equal(viewer.querySelector('img').src,'https://example.com/art.jpg');
  viewer.querySelector('.gallery-next').click();assert.equal(viewer.querySelector('img').src,'https://example.com/art2.jpg');
  viewer.querySelector('.gallery-set-banner').click();assert.equal(viewer.querySelector('.gallery-set-banner').disabled,true);assert.equal(doc.getElementById('titlePage').querySelector('.title-banner').querySelector('img').src,'https://example.com/art2.jpg');
  viewer.querySelector('.gallery-previous').click();assert.equal(viewer.querySelector('img').src,'https://example.com/art.jpg');viewer.querySelector('.gallery-close').click();assert.equal(viewer.open,false);
  doc.getElementById('titlePage').querySelector('.gallery-banner-action').click();
  assert.equal(doc.getElementById('titlePage').querySelector('.title-banner').querySelector('img').src, 'https://example.com/art.jpg');
  doc.getElementById('titlePage').querySelectorAll('button').find(n => n.textContent === 'restaurar banner do catálogo').click();
  assert.equal(doc.getElementById('titlePage').querySelector('.title-banner').querySelector('img').src, 'https://example.com/banner.jpg');
  doc.getElementById('titlePage').querySelectorAll('button').find(n => n.textContent === 'editar banner').click();
  const bannerEditor = doc.querySelector('.title-banner-editor');
  const bannerInputs = bannerEditor.querySelectorAll('input');
  const bannerUrl = bannerInputs.find(n => n.type === 'url');
  bannerUrl.value = 'https://example.com/custom.jpg'; bannerUrl.oninput();
  const ranges = bannerInputs.filter(n => n.type === 'range');
  ranges[0].value = '420'; ranges[0].oninput();
  ranges[1].value = '1.5'; ranges[1].oninput();
  ranges[3].value = '25'; ranges[3].oninput();
  bannerEditor.querySelectorAll('button').find(n => n.textContent === 'salvar banner').click();
  const customHero = doc.getElementById('titlePage').querySelector('.title-banner');
  assert.equal(customHero.style.height, '420px');
  assert.equal(customHero.querySelector('img').src, 'https://example.com/custom.jpg');
  assert.equal(customHero.querySelector('img').style.transform, 'scale(1.5)');
  assert.equal(customHero.querySelector('img').style.objectPosition, '50% 25%');
  doc.getElementById('titlePage').querySelectorAll('button').find(n => n.textContent === 'editar banner').click();
  doc.querySelector('.title-banner-editor').querySelectorAll('button').find(n => n.textContent === 'restaurar original').click();
  assert.equal(doc.getElementById('titlePage').querySelector('.title-banner').querySelector('img').src, 'https://example.com/banner.jpg');
  const regional = doc.getElementById('titlePage').querySelector('.quick-regional-cover');
  regional.value = 'https://example.com/jp.jpg'; regional.onchange();
  assert.equal(doc.getElementById('titlePage').querySelector('.title-layout').querySelector('img').src, 'https://example.com/jp.jpg');
  const restoredRegion = doc.getElementById('titlePage').querySelector('.quick-regional-cover');
  restoredRegion.value = 'https://example.com/original.jpg'; restoredRegion.onchange();
  assert.equal(doc.getElementById('titlePage').querySelector('.title-layout').querySelector('img').src, 'https://example.com/original.jpg');
  ctx.Catalog.recommendations = async () => Array.from({ length: 14 }, (_, index) => ({ kind: 'game', catalogId: 'igdb:' + (9000 + index), title: 'Recommendation ' + index, image: 'https://example.com/cover.jpg' }));
  await doc.getElementById('titlePage').querySelectorAll('button').find(n => n.textContent === 'carregar recomendações').click();
  assert.equal(doc.getElementById('titlePage').querySelector('.discovery-grid').children.length, 12);
  // Artist -> discography -> album -> song, artist favorites and pagination.
  const artistFixture = { kind:'artist',catalogId:'deezer:74211202',title:'bôa',source:'Deezer',summary:'Biography',image:'https://example.com/artist.jpg',topTracks:[{kind:'music',catalogId:'deezer:201',title:'Duvet',artist:'bôa',artistCatalogId:'deezer:74211202',albumCatalogId:'deezer:200',albumTitle:'Twilight'}],topAlbums:[{kind:'album',catalogId:'deezer:200',title:'Twilight',artist:'bôa',releaseDate:'1998-01-01',albumType:'album'}],discographyNext:20 };
  ctx.fetch = async url => ({ok:true,json:async()=>String(url).includes('/albums?offset=20') ? {items:[{kind:'album',catalogId:'deezer:202',title:'Whiplash',releaseDate:'2024-01-01',albumType:'album'}],next:null} : String(url).includes('/album/200') ? {kind:'album',catalogId:'deezer:200',title:'Twilight',artist:'bôa',artistCatalogId:'deezer:74211202',trackNames:['Duvet'],albumTracks:artistFixture.topTracks} : String(url).includes('/music/201') ? artistFixture.topTracks[0] : artistFixture});
  ctx.location.hash='#titulo/artist/deezer%3A74211202';ctx.CollectionActions.applyRoute();await ctx.TitlePages.route();
  const titleButtons=()=>doc.getElementById('titlePage').querySelectorAll('button');
  titleButtons().find(button=>button.textContent==='☆ favoritar artista').click();
  const favoriteArtist=read().items.find(item=>item.catalogId==='deezer:74211202');
  assert.equal(favoriteArtist.featured,true);assert.equal(favoriteArtist.topAlbums,undefined);
  await titleButtons().find(button=>button.textContent==='carregar mais lançamentos').click();
  assert.ok(doc.getElementById('titlePage').querySelectorAll('strong').some(node=>node.textContent==='Whiplash'));
  await titleButtons().find(button=>button.querySelector('strong')?.textContent==='Twilight').click();
  await doc.getElementById('titlePage').querySelector('.track-link').click();
  assert.equal(doc.getElementById('titlePage').querySelector('h1').textContent,'Duvet');
  assert.ok(titleButtons().some(button=>button.textContent==='ver álbum · Twilight'));
  ctx.Catalog.forCollection=async()=>({items:[{kind:'game',catalogId:'igdb:9999',title:'Discovery',reason:'Porque você favoritou Fixture'}],seeds:1,failures:0});
  ctx.location.hash='#descobrir';ctx.CollectionActions.applyRoute();ctx.DiscoveryPage.render();await ctx.DiscoveryPage.load();
  assert.equal(doc.getElementById('personalizedDiscovery').hidden,false);
  assert.equal(doc.getElementById('personalizedDiscovery').querySelector('.discovery-grid').children.length,1);
  const discoveryPage = doc.getElementById('personalizedDiscovery');
  discoveryPage.querySelector('.discovery-dismiss').click();
  assert.equal(discoveryPage.querySelector('.discover-card'),null);
  assert.equal(JSON.parse(ctx.localStorage.getItem('myspace-discovery-dismissed')).length,1);
  discoveryPage.querySelector('select').value='book'; discoveryPage.querySelector('select').onchange();
  const restoreDismissed = discoveryPage.querySelectorAll('button').find(b => b.textContent === 'rever sugestões descartadas'); restoreDismissed.click();
  assert.equal(discoveryPage.querySelector('.discover-card'),null);
  discoveryPage.querySelector('select').value='all'; discoveryPage.querySelector('select').onchange();
  assert.ok(discoveryPage.querySelector('.discover-card'));
  ctx.Catalog.forCollection=async()=>{throw Error('Offline');};await ctx.DiscoveryPage.load();
  assert.equal(doc.getElementById('personalizedDiscovery').querySelector('.discovery-grid').children.length,1);
  // Import applies the optional title preferences alongside the existing profile backup.
  const restoredPrefs = { 'myspace.titleBannerSettings:igdb:777': JSON.stringify({ image: 'data:image/jpeg;base64,fixture', height: 380, zoom: 1.25, x: 30, y: 60 }), 'myspace.titleCover:igdb:777': 'https://example.com/restored.jpg' };
  const payload = { format: 'myspace-backup', version: 1, profile: JSON.parse(vm.runInContext('JSON.stringify(state)', ctx)), extras: read(), titlePreferences: restoredPrefs };
  payload.profile.theme='paper';
  const importFile = doc.querySelectorAll('input').find(input => input.accept?.includes('.json'));
  importFile.files = [{ size: 1000, text: async () => JSON.stringify(payload) }];
  await importFile.onchange();
  await submitResource({});
  assert.equal(doc.body.dataset.theme,'paper');
  assert.equal(storage.get('myspace.titleCover:igdb:777'), restoredPrefs['myspace.titleCover:igdb:777']);
  assert.equal(JSON.parse(storage.get('myspace.titleBannerSettings:igdb:777')).height, 380);
  // The same import dialog accepts a binary package and restores playable blobs.
  const videoId=read().featuredVideo.localId;
  const archive=await ctx.MediaPackage.create({...payload,extras:read()});
  videoFiles.delete(videoId);
  archive.blob.name='fixture.myspace';importFile.files=[archive.blob];await importFile.onchange();await submitResource({});
  assert.equal(await videoFiles.get(videoId).text(),'fixture');
  assert.ok(read().items.some(item=>item.lists?.includes('Para jogar com amigos')));
  const checkFiles=doc.querySelector('.backup-info').querySelector('button');await checkFiles.click();assert.ok(doc.querySelector('.backup-files').children.length);
  const listShelf=doc.querySelector('.personal-shelf');assert.ok(listShelf);listShelf.click();assert.ok(doc.querySelector('.shelf').children.length);assert.ok(doc.querySelector('.shelf').children.every(card=>card.querySelector('h4')));
  const listChip=doc.querySelector('.active-collection-filters').querySelector('button');assert.ok(listChip.textContent.startsWith('Lista: '));listChip.click();assert.equal(doc.querySelector('.active-collection-filters').hidden,true);
  assert.ok(!doc.querySelector('.shelf').className.split(' ').includes('grouped'));
  const groupingButton=doc.querySelector('.advanced-filters').querySelectorAll('button').find(b=>b.textContent==='separar por mídia');groupingButton.click();assert.ok(doc.querySelector('.shelf').className.split(' ').includes('grouped'));assert.equal(doc.querySelector('.shelf').querySelectorAll('.shelf-card').length,read().items.length);groupingButton.click();assert.ok(!doc.querySelector('.shelf').className.split(' ').includes('grouped'));
  { const collectionSearch=doc.querySelector('.collection-controls').querySelector('input');collectionSearch.value='inexistente-fixture-123';collectionSearch.oninput();assert.equal(doc.querySelector('.shelf').children.length,0);assert.equal(doc.querySelector('.active-collection-filters').hidden,false);doc.querySelector('.active-collection-filters').querySelector('button').click();assert.ok(doc.querySelector('.shelf').children.length); }
  for(const item of read().items)ctx.CollectionActions.updateItem(item.id,{featured:false});
  const favoriteIds=read().items.slice(0,2).map(item=>item.id);for(const id of favoriteIds)ctx.CollectionActions.updateItem(id,{featured:true});
  doc.querySelector('.favorite-arrange').click();
  const orderButtons=doc.querySelector('.favorite-order').querySelectorAll('button');assert.equal(orderButtons[0].disabled,true);orderButtons[1].click();
  assert.deepEqual(read().items.filter(item=>item.featured).map(item=>item.id),favoriteIds.slice().reverse());
  doc.querySelector('.favorite-arrange').click();assert.equal(doc.querySelector('.favorite-order'),null);
  { const toggle=doc.querySelector('.view-toggle');toggle.click();assert.equal(toggle.textContent,'capas');
    const rows=doc.querySelectorAll('.list-entry');assert.equal(rows.length,read().items.length);
    rows[2].click();assert.equal(doc.querySelector('.collection-list-detail').querySelector('h3').textContent,read().items.find(item=>item.id===rows[2].dataset.itemId).title);
    const search=doc.querySelector('.collection-controls').querySelector('input');search.value='sem resultado de teste';search.oninput();assert.equal(doc.querySelectorAll('.list-entry').length,0);assert.equal(doc.querySelector('.collection-list-detail').querySelector('h3'),null);
    search.value='';search.oninput();assert.equal(doc.querySelector('.collection-list-detail').querySelector('h3').textContent,doc.querySelector('.list-entry-text').querySelector('strong').textContent);
    toggle.click();assert.ok(doc.querySelector('.shelf-card')); }
  console.log(
    "Smoke test: busca, páginas de títulos e links diretos, resumos, capas personalizadas, coleção e demais editores OK (DOM simulado).",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
