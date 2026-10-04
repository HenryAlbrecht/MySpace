// Presentation adapter for the pinned official Kawarp API. No playback ownership.
export function createAtmosphere(shell, canvas, reduced) {
  let renderer, loading, revision = 0, image, source = '', renderedSource = '', ready = false, failed = false;
  let playing = false, resizeFrame = 0, enabled = true;
  const active = () => enabled && shell.open && !document.hidden && !reduced.matches;
  const fallback = () => {
    renderer?.dispose(); renderer = null; ready = false; renderedSource = '';
    shell.dataset.atmosphere = 'static';
  };
  function resize() {
    resizeFrame = 0;
    if (!active()) return;
    const rect = shell.getBoundingClientRect(), ratio = Math.min(1, devicePixelRatio || 1);
    const factor = Math.min(ratio, 960 / Math.max(1, rect.width), 540 / Math.max(1, rect.height));
    const width = Math.max(1, Math.round(rect.width * factor)), height = Math.max(1, Math.round(rect.height * factor));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; renderer?.resize(); }
  }
  async function setArtwork(next) {
    const incoming = next?.getAttribute('src') || '';
    if (incoming !== source) failed = false;
    image = next; source = incoming;
    const expected = source, ticket = ++revision;
    if (!source) { fallback(); return; }
    if (!active() || failed) return;
    let bitmap;
    try {
      // Wait for the displayed element too: Artwork has already decoded its candidate.
      await next.decode();
      if (ticket !== revision || !active() || next.getAttribute('src') !== expected) return;
      bitmap = await createImageBitmap(next);
      loading ||= import('./vendor/kawarp/dist/index.js');
      const {Kawarp} = await loading;
      if (ticket !== revision || !active() || next.getAttribute('src') !== expected) return;
      if (!renderer) {
        resize();
        renderer = new Kawarp(canvas, {warpIntensity: 1, blurPasses: 8, animationSpeed: 1,
          transitionDuration: 1000, saturation: 1.5, dithering: .008, scale: 1.25});
      }
      renderer.loadImageElement(bitmap); ready = true; renderedSource = expected;
      if (!playing) renderer.renderFrame(0);
      update(playing); shell.dataset.atmosphere = 'kawarp';
    } catch {
      if (ticket === revision && active() && next.getAttribute('src') === expected) { failed = true; fallback(); }
    } finally { bitmap?.close(); }
  }
  function update(isPlaying) {
    playing = isPlaying;
    if (!renderer || !active()) return;
    if (playing) renderer.start(); else renderer.stop();
  }
  function suspend() { ++revision; renderer?.stop(); cancelAnimationFrame(resizeFrame); resizeFrame = 0; }
  function setEnabled(value) {
    if (enabled === value) return;
    enabled = value;
    if (!enabled) { suspend(); fallback(); }
  }
  function close() { suspend(); fallback(); failed = false; }
  function refresh() {
    if (!active()) { suspend(); if (reduced.matches) fallback(); return; }
    if (ready && renderer && source === renderedSource) { resize(); update(playing); } else if (image && !failed) void setArtwork(image);
  }
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', refresh);
  window.addEventListener('resize', () => { if (active() && !resizeFrame) resizeFrame = requestAnimationFrame(resize); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); failed = true; fallback(); });
  shell.dataset.atmosphere = 'static';
  return {setArtwork, update, close, refresh, setEnabled};
}
