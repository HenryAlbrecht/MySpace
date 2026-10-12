const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const listeners = {},
  frames = [],
  storage = new Map();
const location = { hash: "#colecao/game" };
const context = {
  location,
  sessionStorage: {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
  },
  setTimeout,
  clearTimeout,
};
context.window = {
  scrollY: 840,
  addEventListener: (name, fn) => (listeners[name] = fn),
  requestAnimationFrame: (fn) => frames.push(fn),
  scrollTo: ({ top }) => {
    context.window.scrollY = top;
  },
};
vm.runInNewContext(fs.readFileSync("dist/navigation.js", "utf8"), context);
context.window.Navigation.capture();
location.hash = "#titulo/game/local";
listeners.hashchange();
context.window.scrollY = 640;
listeners.scroll();
context.window.Navigation.restore();
while (frames.length) frames.shift()();
assert.equal(context.window.scrollY, 0);
context.window.scrollY = 320;
listeners.scroll();
location.hash = "#colecao/game";
listeners.hashchange();
frames.shift()();
frames.shift()();
assert.equal(context.window.scrollY, 0);
context.window.Navigation.restore("#titulo/game/local");
assert.equal(frames.length, 0, "Uma página obsoleta não agenda restauração");
assert.equal(context.window.scrollY, 0, "Uma restauração atrasada não deve mover outra página");
listeners.pagehide();
assert.equal(JSON.parse(storage.get("myspace-reading-positions")).length, 2);
location.hash = "#colecao/film";
listeners.hashchange();
assert.equal(frames.length, 0, "Categoria não agenda restauração");
assert.equal(context.window.scrollY, 0);
location.hash = "#collection/series";
listeners.hashchange();
assert.equal(frames.length, 0, "Alias compartilha a superfície");
context.window.Navigation.capture();
location.hash = "#titulo/game/other";
listeners.hashchange();
while (frames.length) frames.shift()();
context.window.scrollY = 0;
location.hash = "#colecao/series";
context.window.Navigation.restore();
listeners.hashchange();
while (frames.length) frames.shift()();
assert.equal(context.window.scrollY, 0, "Hashchange não cancela retorno já pendente");
console.log("Posição por página, retorno e proteção contra restauração atrasada OK.");
// Main-surface entries do not restore stale positions, including history events.
for (const hash of ["#perfil", "#fotos", "#buscar", "#descobrir", "#spacevoice"]) {
  context.window.scrollY = 620;
  context.window.Navigation.capture();
  location.hash = hash;
  listeners.hashchange();
  while (frames.length) frames.shift()();
  assert.equal(context.window.scrollY, 0, "New entry: " + hash);
  location.hash = "#colecao/game";
  listeners.hashchange();
  while (frames.length) frames.shift()();
  assert.equal(context.window.scrollY, 0, "Collection re-entry from " + hash);
}
location.hash = "#buscar";
listeners.hashchange();
while (frames.length) frames.shift()();
context.window.scrollY = 420;
context.window.Navigation.capture();
location.hash = "#titulo/music/fixture";
listeners.hashchange();
while (frames.length) frames.shift()();
location.hash = "#buscar";
listeners.hashchange();
while (frames.length) frames.shift()();
assert.equal(context.window.scrollY, 0, "Title return enters Search at the top");
location.hash = "#titulo/music/fixture";
listeners.hashchange();
while (frames.length) frames.shift()();
location.hash = "#colecao";
listeners.hashchange();
while (frames.length) frames.shift()();
assert.equal(context.window.scrollY, 0, "Unrelated Title does not restore Collection");
context.getComputedStyle = () => ({ getPropertyValue: () => "180ms" });
context.document = { body: {} };
context.window.matchMedia = () => ({ matches: false });
context.window.scrollY = 600;
context.window.Navigation.toTop();
frames.shift()(0);
frames.shift()(90);
frames.shift()(180);
assert.equal(context.window.scrollY, 0, "Token-timed camera reaches the top");
context.window.matchMedia = () => ({ matches: true });
context.window.scrollY = 600;
context.window.Navigation.toTop();
assert.equal(context.window.scrollY, 0, "Reduced motion is immediate");
console.log("Camera entry policy, title return at top and token/reduced-motion checks OK.");
location.hash = "#titulo/game/reopen";
listeners.hashchange();
while (frames.length) frames.shift()();
context.window.scrollY = 400;
context.window.Navigation.capture();
context.window.Navigation.restore(location.hash, { top: true });
context.window.Navigation.restore(location.hash);
while (frames.length) frames.shift()();
assert.equal(
  context.window.scrollY,
  0,
  "Explicit reopening of the same title clears its saved scroll",
);
// A cached detail may resolve in the same task as hashchange, before entry paints.
location.hash = "#colecao";
listeners.hashchange();
while (frames.length) frames.shift()();
location.hash = "#titulo/game/reopen";
listeners.hashchange();
context.window.scrollY = 400;
context.window.Navigation.restore(location.hash);
while (frames.length) frames.shift()();
assert.equal(
  context.window.scrollY,
  0,
  "Duplicate cached-detail restore cannot cancel the pending entry at top",
);
location.hash = "#colecao/film";
listeners.hashchange();
while (frames.length) frames.shift()();
context.window.scrollY = 900;
let focusedOrigin = 0;
context.window.Navigation.rememberCollectionOrigin("film-origin", (id) => {
  assert.equal(id, "film-origin");
  return {
    focus(options) {
      assert.equal(options.preventScroll, true);
      assert.equal(context.window.scrollY, 900, "Camera restores before focus");
      focusedOrigin++;
    },
  };
});
location.hash = "#titulo/film/origin";
listeners.hashchange();
while (frames.length) frames.shift()();
assert.equal(context.window.scrollY, 0);
location.hash = "#colecao/film";
listeners.hashchange();
while (frames.length) frames.shift()();
assert.equal(
  context.window.scrollY,
  900,
  "Only an explicit Collection detail origin restores the camera",
);
assert.equal(focusedOrigin, 1);
location.hash = "#spacevoice";
listeners.hashchange();
while (frames.length) frames.shift()();
location.hash = "#colecao/film";
listeners.hashchange();
while (frames.length) frames.shift()();
assert.equal(context.window.scrollY, 0, "Consumed origin cannot affect future entries");
assert.equal(focusedOrigin, 1);
