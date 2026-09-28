const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Collection = require('../dist/collection.js');

function setup({ fullscreen = 'reject' } = {}) {
  const listeners = {}, windowListeners = {};
  let doc;
  class Node {
    constructor(tag, className = '', text = '') {
      this.tagName = tag.toUpperCase(); this.className = className; this.textContent = text;
      this.children = []; this.attributes = {}; this.dataset = {}; this.tabIndex = 0;
      this.inert = false; this.hidden = false; this.scrollTop = 0; this.clientHeight = 400;
      this.offsetTop = 0; this.offsetHeight = 40;
      this.classList = { add() {}, remove() {} };
    }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    get isConnected() { return this === doc.body || !!this.parent?.isConnected; }
    setAttribute(key, value) { this.attributes[key] = value; }
    focus() { doc.activeElement = this; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    scrollIntoView() {}
    querySelectorAll(selector) {
      const match = node => selector === 'button' ? node.tagName === 'BUTTON'
        : selector === '.xmb-item' ? node.className === 'xmb-item'
        : selector === '[aria-pressed="true"]' && node.attributes['aria-pressed'] === 'true';
      return this.children.flatMap(node => [...(match(node) ? [node] : []), ...node.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
    closest(selector) {
      if (selector === '.xmb-exit' || selector === '.xmb-page') return this.className.split(' ').includes(selector.slice(1)) ? this : this.parent?.closest(selector);
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName) || this.isContentEditable ? this : null;
    }
  }
  doc = { body: new Node('body'), documentElement: new Node('html'), addEventListener: (key, fn) => { listeners[key] = fn; } };
  doc.documentElement.requestFullscreen = () => fullscreen === 'reject' ? Promise.reject(Error('denied')) : Promise.resolve().then(() => { doc.fullscreenElement = doc.documentElement; listeners.fullscreenchange(); });
  doc.exitFullscreen = () => { doc.fullscreenElement = null; listeners.fullscreenchange(); return Promise.resolve(); };
  const normal = new Node('main'), trigger = new Node('button'); normal.append(trigger); doc.body.append(normal);
  const data = { items: [
    { id:'a', kind:'game', title:'Persona', status:'active', progress:2, total:12, score:0 },
    { id:'b', kind:'game', title:'Burnout', status:'planned' },
    { id:'c', kind:'music', title:'Duvet', status:'done' },
  ], photos: [{ id:'photo', caption:'Foto real', image:'photo.png' }] };
  const filters = { kind:'game', sort:'title' }, opened = [];
  const ctx = vm.createContext({ Collection, document:doc, window:{ addEventListener:(key, fn) => { windowListeners[key] = fn; } } });
  vm.runInContext(fs.readFileSync('dist/xmb.js', 'utf8'), ctx);
  const xmb = ctx.createXmb({ getData:() => data, getProfile:() => ({ name:'Halourt', bio:'Bio real' }), getFilters:() => filters,
    openItem:item => opened.push(item), navigate:page => opened.push(page), openPhoto:item => opened.push(item),
    el:(...args) => new Node(...args), button:(text, onclick, className) => { const node = new Node('button', className, text); node.onclick = onclick; return node; }, imageNode:(src, alt) => new Node('img', '', alt) });
  const root = () => doc.body.children.find(node => node.className === 'xmb');
  function key(key, extras = {}) {
    const event = { key, target:doc.activeElement || root(), preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extras };
    listeners.keydown(event); return event;
  }
  const selected = () => root().querySelectorAll('.xmb-item').find(node => node.attributes['aria-pressed'] === 'true')?.textContent;
  return { xmb, doc, data, filters, trigger, normal, root, key, selected, opened, listeners, windowListeners };
}

test('categorias, seleção lembrada, filtros reais, estados vazios e abertura existente', async () => {
  const h = setup(); h.xmb.enter(h.trigger); await Promise.resolve();
  assert.equal(h.selected(), 'Burnout'); assert.equal(h.normal.inert, true);
  h.key('ArrowDown'); assert.equal(h.selected(), 'Persona');
  h.key('ArrowRight'); assert.equal(h.selected(), undefined); assert.equal(h.xmb.isActive(), true);
  h.key('ArrowDown'); h.key('ArrowLeft'); assert.equal(h.selected(), 'Persona');
  assert.equal(h.key('ArrowUp', { ctrlKey:true }).prevented, undefined); assert.equal(h.selected(), 'Persona');
  assert.equal(h.key('Escape', { target:{ isContentEditable:true } }).prevented, undefined); assert.equal(h.xmb.isActive(), true);
  assert.equal(h.key('ArrowDown', { target:{ closest:() => ({}) } }).prevented, undefined);
  h.key('Enter'); assert.equal(h.opened.length, 0); assert.equal(h.xmb.isActive(), true);
  assert.equal(h.root().dataset.level, 'details');
  h.key('Escape'); assert.equal(h.selected(), 'Persona'); assert.equal(h.root().dataset.level, 'root');
  h.key('o'); assert.equal(h.opened[0], h.data.items[0]);
  assert.equal(h.normal.inert, false); assert.equal(h.doc.activeElement, h.trigger);
  assert.equal(h.filters.kind, 'game');
  h.filters.query = 'inexistente'; h.xmb.enter(h.trigger); assert.equal(h.selected(), undefined);
  h.key('Escape'); assert.equal(h.root().hidden, true);
});

test('fullscreen aceito, saída pelo navegador e Escape restauram a interface', async () => {
  const h = setup({ fullscreen:'accept' }); h.xmb.enter(h.trigger);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  h.doc.fullscreenElement = null; h.listeners.fullscreenchange();
  assert.equal(h.xmb.isActive(), false); assert.equal(h.normal.inert, false);
  h.xmb.enter(h.trigger); await new Promise(resolve => setImmediate(resolve)); h.key('Escape');
  assert.equal(h.doc.fullscreenElement, null); assert.equal(h.doc.activeElement, h.trigger);
});

test('Perfil, Fotos, Tab e mudança externa de rota', async () => {
  const h = setup(); h.xmb.enter(h.trigger); h.key('ArrowLeft'); assert.equal(h.selected(), 'Halourt');
  h.key('Tab'); assert.ok(h.doc.activeElement.isConnected); h.key('Enter'); h.key('O'); assert.equal(h.opened[0], 'perfil');
  h.xmb.enter(h.trigger);
  for (let i = 0; i < 20; i++) h.key('ArrowRight');
  assert.equal(h.selected(), 'Foto real'); h.key('Enter'); h.key('o'); assert.equal(h.opened[1], 'fotos'); assert.equal(h.opened[2], h.data.photos[0]);
  h.xmb.enter(h.trigger); h.windowListeners.hashchange(); assert.equal(h.xmb.isActive(), false);
  await Promise.resolve();
});

test('sair antes da promessa de fullscreen resolver não deixa fullscreen pendente', async () => {
  const h = setup({ fullscreen:'accept' });
  h.xmb.enter(h.trigger); h.xmb.close();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.xmb.isActive(), false);
  assert.equal(h.doc.fullscreenElement, null);
  assert.equal(h.normal.inert, false);
});

test('detalhes preservam fullscreen, seleção, rolagem e foco até o segundo Escape', async () => {
  const h = setup({ fullscreen:'accept' }); h.xmb.enter(h.trigger);
  await new Promise(resolve => setImmediate(resolve));
  h.key('ArrowDown');
  const body = h.root().children[2], list = body.children[0], detail = body.children[1];
  const row = h.doc.activeElement;
  list.scrollTop = 73; detail.scrollTop = 19;
  h.key('Enter');
  assert.equal(h.opened.length, 0); assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  assert.equal(h.root().dataset.level, 'details'); assert.equal(h.doc.activeElement, detail);
  h.key('ArrowRight'); h.key('ArrowDown'); h.key('Tab');
  assert.equal(h.selected(), 'Persona'); assert.equal(h.doc.activeElement.className, 'xmb-exit');
  h.key('Backspace');
  assert.equal(h.doc.activeElement, row); assert.equal(list.scrollTop, 73); assert.equal(detail.scrollTop, 19);
  assert.equal(h.doc.fullscreenElement, h.doc.documentElement);
  h.key('Enter'); h.key('Escape');
  assert.equal(h.root().dataset.level, 'root'); assert.equal(h.xmb.isActive(), true);
  h.key('Escape', { repeat:true }); assert.equal(h.xmb.isActive(), true);
  h.key('Escape'); assert.equal(h.xmb.isActive(), false); assert.equal(h.doc.fullscreenElement, null);
});

test('Escape interceptado pelo navegador nos detalhes conserva a raiz na viewport', async () => {
  const h = setup({ fullscreen:'accept' }); h.xmb.enter(h.trigger);
  await new Promise(resolve => setImmediate(resolve)); h.key('Enter');
  h.doc.fullscreenElement = null; h.listeners.fullscreenchange();
  assert.equal(h.xmb.isActive(), true); assert.equal(h.root().dataset.level, 'root');
  assert.equal(h.selected(), 'Burnout'); h.key('Escape'); assert.equal(h.xmb.isActive(), false);
});
