/* Reading positions belong to surfaces; Collection categories share one viewport. */
(() => {
  const positions = new Map();
  let current = location.hash || '#perfil';
  let restoring = false;
  let revision = 0;
  let saveTimer = null;
  let reservation = null;
  const frame = window.requestAnimationFrame || (callback => setTimeout(callback, 0));

  function readingKey(hash) {
    return /^#(?:colecao|collection)(?:\/|$)/.test(hash) ? '#colecao' : hash;
  }

  try {
    const rows = JSON.parse(sessionStorage.getItem('myspace-reading-positions') || '[]');
    if (Array.isArray(rows)) {
      for (const [key, value] of rows.slice(-30)) {
        if (typeof key === 'string' && Number.isFinite(value) && value >= 0 && value <= 1000000) {
          positions.set(readingKey(key), value);
        }
      }
    }
  } catch {}

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { sessionStorage.setItem('myspace-reading-positions', JSON.stringify([...positions])); } catch {}
  }

  function capture(hash = current, save = true) {
    positions.set(readingKey(hash), Math.max(0, Number(window.scrollY || 0)));
    if (positions.size > 30) positions.delete(positions.keys().next().value);
    if (save) persist();
    else if (saveTimer === null) saveTimer = setTimeout(persist, 150);
  }

  function restore(hash = location.hash || '#perfil') {
    if ((location.hash || '#perfil') !== hash) return;
    const sameCollection = readingKey(current) === '#colecao' && readingKey(hash) === '#colecao';
    current = hash;
    if (sameCollection) {
      // A go()/hashchange pair must not cancel the pending return from a Title.
      if (restoring) return;
      ++revision;
      capture(hash);
      return;
    }
    const token = ++revision;
    reservation?.release();
    const value = positions.get(readingKey(hash)) || 0;
    restoring = true;
    frame(() => {
      if (token !== revision) return;
      if (readingKey(location.hash || '#perfil') === readingKey(hash)) window.scrollTo?.({ top: value, behavior: 'instant' });
      frame(() => { if (token === revision) restoring = false; });
    });
  }

  function preserveViewport(container, render) {
    if (!container?.getBoundingClientRect || restoring || readingKey(current) !== '#colecao'
      || readingKey(location.hash || '#perfil') !== '#colecao') return render();
    const originalHeight = reservation?.originalHeight ?? container.style.minHeight;
    reservation?.release(false);
    const anchor = document.documentElement.style.overflowAnchor;
    container.style.minHeight = container.getBoundingClientRect().height + 'px';
    document.documentElement.style.overflowAnchor = 'none';
    let released = false;
    const hold = {
      originalHeight,
      release(removeHeight = true) {
        if (released) return;
        released = true;
        if (removeHeight) container.style.minHeight = originalHeight;
        document.documentElement.style.overflowAnchor = anchor;
        for (const event of ['wheel', 'touchstart', 'keydown', 'resize']) window.removeEventListener(event, interrupt);
        if (reservation === hold) reservation = null;
      },
    };
    function interrupt() { hold.release(); }
    reservation = hold;
    try { render(); } catch (error) { hold.release(); throw error; }

    // Measure natural content while the outer box still protects document height.
    const top = container.getBoundingClientRect().top;
    const style = getComputedStyle(container);
    let bottom = top;
    for (const child of container.children) {
      if (child.getClientRects().length) {
        bottom = Math.max(bottom, child.getBoundingClientRect().bottom + parseFloat(getComputedStyle(child).marginBottom || 0));
      }
    }
    const naturalHeight = bottom - top + parseFloat(style.paddingBottom || 0) + parseFloat(style.borderBottomWidth || 0);
    const maximum = Math.max(0, document.documentElement.scrollHeight
      - Math.max(0, container.getBoundingClientRect().height - naturalHeight) - window.innerHeight);
    if (window.scrollY <= maximum + 1) {
      hold.release();
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: maximum, behavior: reduced ? 'instant' : 'smooth' });
    for (const event of ['wheel', 'touchstart', 'keydown', 'resize']) window.addEventListener(event, interrupt, { passive: true });
    function settle() {
      if (released) return;
      if (Math.abs(window.scrollY - maximum) <= 1) {
        hold.release();
        capture();
      } else frame(settle);
    }
    frame(settle);
  }

  window.addEventListener('scroll', () => {
    if (!restoring && (location.hash || '#perfil') === current) capture(current, false);
  }, { passive: true });
  window.addEventListener('pagehide', persist);
  window.addEventListener('hashchange', () => restore());
  window.Navigation = { capture, restore, preserveViewport };
})();
