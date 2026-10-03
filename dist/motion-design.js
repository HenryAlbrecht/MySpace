/* Presentation only: route direction, focus continuity and contextual movement.
   Never changes visibility, routing, media ownership or layout dimensions. */
(() => {
  if (!window.MutationObserver || !window.Element?.prototype.animate) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const order = ['perfil', 'colecao', 'fotos', 'spacevoice', 'buscar', 'descobrir'];
  const selectors = {
    perfil: '.columns',
    colecao: '#collectionPage',
    fotos: '#photosPage',
    spacevoice: '#spaceVoicePage',
    buscar: '#discoverPage',
    descobrir: '#personalizedDiscovery',
    titulo: '#titlePage',
  };
  const active = new Map();
  const seenTitles = new WeakSet();
  let previous = location.hash || '#perfil';
  let direction = 1;
  let origin = null;
  const nav = document.querySelector('.nav > div');
  const indicator = document.createElement('span');
  indicator.className = 'motion-nav-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  nav?.append(indicator);
  let indicatorBox = null;

  function updateIndicator() {
    const selected = nav?.querySelector('a[aria-current="page"]');
    if (!selected) return;
    const box = selected.getBoundingClientRect();
    const parent = nav.getBoundingClientRect();
    const next = { left: box.left - parent.left, top: box.bottom - parent.top, width: box.width };
    Object.assign(indicator.style, { left: next.left + 'px', top: next.top + 'px', width: next.width + 'px' });
    if (indicatorBox) {
      move(indicator, [
        { transform: `translate(${indicatorBox.left - next.left}px, ${indicatorBox.top - next.top}px) scaleX(${indicatorBox.width / next.width})` },
        { transform: 'translate(0,0) scaleX(1)' },
      ], '--motion-focus');
    }
    indicatorBox = next;
  }

  function timing(token = '--motion-standard') {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token)) || 200;
  }

  function move(element, frames, token, delay = 0) {
    if (!element || reduced.matches) return;
    active.get(element)?.cancel();
    const animation = element.animate(frames, {
      duration: timing(token),
      delay,
      easing: getComputedStyle(document.documentElement).getPropertyValue('--ease-xmb').trim(),
      fill: 'none',
    });
    active.set(element, animation);
    animation.finished.catch(() => {}).finally(() => {
      if (active.get(element) === animation) active.delete(element);
    });
  }

  function enter(element, distance = 12, delay = 0) {
    move(element, [
      { opacity: .45, transform: `translateX(${direction * distance}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], '--motion-standard', delay);
  }

  function titleEntrance() {
    const layout = document.querySelector('#titlePage:not([hidden]) .title-layout');
    if (!layout || seenTitles.has(layout)) return;
    seenTitles.add(layout);
    const cover = layout.querySelector('.title-cover');
    // A click-origin translation, without rescaling or waiting for image decode.
    const box = cover?.getBoundingClientRect();
    const offset = origin && box ? Math.max(-48, Math.min(48, origin.left - box.left)) : direction * 16;
    move(cover, [
      { opacity: .6, transform: `translateX(${offset}px) scale(.97)` },
      { opacity: 1, transform: 'translateX(0) scale(1)' },
    ], '--motion-standard');
    enter(layout.querySelector('.title-information'), 8);
    origin = null;
    return true;
  }

  function routeEntrance() {
    const hash = location.hash || '#perfil';
    if (hash === previous) return;
    const from = previous.slice(1).split('/')[0];
    const to = hash.slice(1).split('/')[0];
    direction = from === 'titulo' ? -1 : to === 'titulo' ? 1 : Math.sign(order.indexOf(to) - order.indexOf(from)) || 1;
    previous = hash;
    enteredRoutes.clear();
    updateIndicator();
    const page = document.querySelector(selectors[to] || selectors.perfil);
    if (!page || page.hidden) return;
    if (to === 'perfil') {
      // Do not transform the column that owns the persistent SPACEAMP.
      enter(page.querySelector('aside'), 12);
      page.querySelectorAll('.panel').forEach(panel => {
        if (!panel.querySelector('#globalSpaceAmp') && !panel.closest('#globalSpaceAmp')) enter(panel, 6);
      });
    } else if (to !== 'titulo') {
      enter(page, 14);
    }
    if (titleEntrance()) enteredRoutes.add(hash);
  }

  document.addEventListener('click', event => {
    const card = event.target.closest('.discover-card, .catalog-result, .shelf-cover, .list-entry');
    origin = card?.getBoundingClientRect() || null;
    if (card) move(card, [{ opacity: 1 }, { opacity: .7 }], '--motion-fast');
  }, true);

  window.addEventListener('hashchange', routeEntrance);
  // Details arrive asynchronously; animate only the first layout for this route.
  const enteredRoutes = new Set();
  new MutationObserver(() => {
    if (previous.startsWith('#titulo/') && !enteredRoutes.has(previous)) {
      const layout = document.querySelector('#titlePage:not([hidden]) .title-layout');
      if (layout) {
        titleEntrance();
        enteredRoutes.add(previous);
      }
    }
  }).observe(document.querySelector('#titlePage'), { childList: true, subtree: true });

  document.addEventListener('toggle', event => {
    if (event.target instanceof HTMLDetailsElement && event.target.open) {
      Array.from(event.target.children).filter(node => node.tagName !== 'SUMMARY').slice(0, 2)
        .forEach(node => enter(node, 6));
    }
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('.view-toggle')) {
      enter(document.querySelector('.collection-list-panel:not([hidden])') || document.querySelector('#collectionPage .shelf'), 10);
    }
  });

  const party = document.querySelector('.spacevoice');
  if (party) {
    let avatarPositions = new Map();
    function captureAvatars() {
      avatarPositions = new Map(Array.from(party.querySelectorAll('.spacevoice-avatar'), avatar => [avatar, avatar.getBoundingClientRect()]));
    }
    captureAvatars();
    new MutationObserver(() => {
      const finalPositions = new Map();
      party.querySelectorAll('.spacevoice-avatar').forEach(avatar => {
        const before = avatarPositions.get(avatar);
        active.get(avatar)?.cancel();
        const after = avatar.getBoundingClientRect();
        finalPositions.set(avatar, after);
        if (before?.width && after.width && (Math.abs(before.left - after.left) > 1 || Math.abs(before.top - after.top) > 1)) {
          move(avatar, [
            { transformOrigin: 'top left', transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width})` },
            { transformOrigin: 'top left', transform: 'translate(0,0) scale(1)' },
          ], '--motion-standard');
        }
      });
      avatarPositions = finalPositions;
      enter(party.querySelector('.party-context-rail:not([hidden])'), 12);
    }).observe(party, { attributes: true, attributeFilter: ['data-mode', 'data-context', 'data-chat-open', 'data-joined'] });
    party.addEventListener('click', captureAvatars, true);
  }

  reduced.addEventListener('change', () => {
    if (reduced.matches) active.forEach(animation => animation.cancel());
  });
  updateIndicator();
  window.addEventListener('resize', () => {
    indicatorBox = null;
    updateIndicator();
  });
  // First Profile visit gets a quiet column entrance; the media host stays untouched.
  if (previous === '#perfil') enter(document.querySelector('.columns > aside'), 8);
})();
