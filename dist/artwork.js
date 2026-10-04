/* Image presentation: reserve the authored box and reveal only decoded pixels.
   Existing ready images remain in place while a replacement loads. */
(() => {
  const revisions = new WeakMap();
  const callbacks = new WeakMap();
  function clear(image) {
    revisions.set(image, (revisions.get(image) || 0) + 1);
    delete image.dataset.artworkSource;
    delete image.dataset.artworkReady;
    image.dataset.artworkState = 'empty';
    image.removeAttribute('src');
    image.style.visibility = 'hidden';
  }
  function set(image, source, { ready = () => {}, error = () => {} } = {}) {
    callbacks.set(image, { ready, error });
    if (image.dataset.artworkSource === source) return;
    image.dataset.artworkSource = source;
    const revision = (revisions.get(image) || 0) + 1;
    revisions.set(image, revision);
    const retained = image.dataset.artworkReady === 'true';
    const candidate = retained ? new Image() : image;
    if (!retained) image.style.visibility = 'hidden';
    image.dataset.artworkState = 'loading';
    const current = () => revisions.get(image) === revision;
    candidate.onload = async () => {
      try { if (candidate.decode) await candidate.decode(); } catch {
        if (!candidate.naturalWidth) return candidate.onerror();
      }
      if (!current()) return;
      if (candidate !== image) image.src = source;
      image.style.visibility = '';
      image.dataset.artworkReady = 'true';
      image.dataset.artworkState = 'ready';
      callbacks.get(image).ready();
    };
    candidate.onerror = () => {
      if (!current()) return;
      image.dataset.artworkState = 'error';
      callbacks.get(image).error();
    };
    candidate.src = source;
  }
  window.Artwork = { set, clear };
})();
