/* Uma apresentação da coleção; não mantém cópias dos dados nem grava filtros. */
function createXmb({ getData, getProfile, getFilters, openItem, navigate, openPhoto, el, button, imageNode }) {
  const categories = [['profile', 'Perfil'], ...Object.entries(Collection.kinds), ['photos', 'Fotos']];
  const remembered = new Map();
  const scrolling = new Map();
  let category = 'game', active = false, trigger, background = [], session = 0, ownsFullscreen = false;
  let detailsLevel = false, previewScroll = 0;
  let clockTimer;
  const root = el('section', 'xmb');
  root.hidden = true;
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Coleção — modo XMB');
  const header = el('header', 'xmb-header');
  const backButton = button('[ sair · Esc ]', back, 'xmb-exit');
  const system = el('div', 'xmb-system'), clock = el('time', 'xmb-clock');
  const clockDate = el('span', 'xmb-clock-date'), clockIcon = el('span', 'xmb-clock-icon', '◷'), clockHour = el('span', 'xmb-clock-hour');
  clockIcon.setAttribute('aria-hidden', 'true');
  clock.append(clockDate, clockIcon, clockHour);
  const locale = window.navigator?.languages;
  const clockFormat = new Intl.DateTimeFormat(locale, { hour:'2-digit', minute:'2-digit' });
  const dateFormat = new Intl.DateTimeFormat(locale, { day:'numeric', month:'short', year:'numeric' });
  system.append(clock, backButton);
  header.append(el('span', '', 'XMB v0.4'), system);

  function stopClock() {
    if (clockTimer !== undefined) window.clearTimeout?.(clockTimer);
    clockTimer = undefined;
  }
  function updateClock() {
    stopClock();
    if (!active) return;
    const now = new Date();
    clockDate.textContent = dateFormat.format(now);
    clockHour.textContent = clockFormat.format(now);
    clock.setAttribute('aria-label', clockDate.textContent + ' · ' + clockHour.textContent);
    clock.setAttribute('datetime', now.toISOString());
    clock.setAttribute('title', dateFormat.format(now));
    // Próxima virada de minuto, sem timers rodando fora do XMB.
    clockTimer = window.setTimeout?.(updateClock, 60000 - now.getSeconds()*1000 - now.getMilliseconds());
  }
  const nav = el('nav', 'xmb-categories');
  nav.setAttribute('aria-label', 'Categorias');
  const categoryButtons = new Map();
  for (const [key, label] of categories) {
    const control = button(label, () => selectCategory(key), 'xmb-category');
    control.dataset.category = key;
    categoryButtons.set(key, control);
    nav.append(control);
  }
  const body = el('div', 'xmb-body'), list = el('div', 'xmb-items'), detail = el('aside', 'xmb-detail');
  list.setAttribute('aria-label', 'Itens da categoria');
  detail.setAttribute('aria-label', 'Detalhes do item selecionado');
  const announcement = el('span', 'xmb-announcement');
  announcement.setAttribute('role', 'status');
  const rootHelp = '← → categorias · ↑ ↓ navegar · Enter detalhes · O página completa · Esc sair';
  const help = el('footer', 'xmb-help', rootHelp);
  body.append(list, detail);
  root.append(header, nav, body, help, announcement);
  const backdrop = el('div', 'xmb-backdrop');
  backdrop.setAttribute('aria-hidden', 'true');
  root.append(backdrop);

  function entries() {
    if (category === 'profile') return [getProfile()];
    if (category === 'photos') return getData().photos || [];
    return Collection.filterItems(getData().items, { ...getFilters(), kind: category });
  }
  const identity = (item, index) => item.id ?? index;
  const title = item => category === 'profile' ? item.name : category === 'photos' ? (item.caption || 'Foto sem legenda') : item.title;
  function selection(rows = entries()) {
    const index = rows.findIndex((item, i) => identity(item, i) === remembered.get(category));
    return Math.max(0, index);
  }
  // Presentation-only priority. Future item adapters can supply a dedicated
  // horizontal backdrop or custom background without changing rendering.
  function artworkSource({ horizontalBackdrop, customBackground, cover }) {
    return horizontalBackdrop || customBackground || cover || null;
  }
  // Retain the last decoded artwork even while an empty category hides it.
  let detailCover, atmosphericImage, identityImage;
  let artworkGap = true;
  function prepareArtworkAfterGap(image, source) {
    if (!artworkGap || !window.Artwork) return;
    const sameReadySource = image.dataset.artworkState === 'ready'
      && image.dataset.artworkSource === source;
    if (!sameReadySource && image.dataset.artworkReady === 'true') Artwork.clear(image);
  }
  function renderDetail(item) {
    const previousCover = detailCover;
    detail.replaceChildren();
    if (!item) { artworkGap = true; backdrop.hidden = true; return; }
    const heading = el('h2', '', title(item));
    detail.append(heading);
    const image = category === 'profile' ? item.avatar : item.image;
    if (image) {
      const cover = previousCover || imageNode(image, title(item));
      detailCover = cover;
      cover.alt = title(item);
      if (previousCover) prepareArtworkAfterGap(cover, image);
      if (previousCover && window.Artwork) Artwork.set(cover, image, { error: () => { cover.hidden = true; } });
      else if (previousCover) cover.src = image;
      cover.hidden = false;
      detail.append(cover);
    }
    const atmosphere = artworkSource({ cover: image });
    if (atmosphere) {
      backdrop.hidden = false;
      const atmosphereNode = atmosphericImage || imageNode(atmosphere, '');
      atmosphereNode.loading = 'eager';
      // A failed decorative source falls back to the theme, without error text.
      const identityNode = identityImage || imageNode(atmosphere, '');
      atmosphericImage = atmosphereNode;
      identityImage = identityNode;
      identityNode.className = 'xmb-artwork-identity';
      identityNode.loading = 'eager';
      for (const image of [atmosphereNode, identityNode]) {
        prepareArtworkAfterGap(image, atmosphere);
        if (window.Artwork) Artwork.set(image, atmosphere, { error: () => { image.hidden = true; } });
        else image.src = atmosphere;
        image.hidden = false;
        if (!image.parentElement) backdrop.append(image);
      }
    } else backdrop.hidden = true;
    artworkGap = !image;
    const facts = el('dl', 'xmb-facts');
    function fact(label, value) {
      if (Array.isArray(value)) value = value.join(', ');
      if (value == null || value === '') return;
      facts.append(el('dt', '', label), el('dd', '', String(value)));
    }
    if (category === 'profile') {
      fact('Local', item.location); fact('Mood', item.mood); fact('Interesses', item.interests);
    } else if (category !== 'photos') {
      fact('Tipo', Collection.kinds[item.kind]); fact('Status', Collection.statuses[item.status]);
      if (item.progress || item.total) fact('Progresso', `${item.progress || 0}${item.total ? ' / ' + item.total : ''}${item.unit ? ' ' + item.unit : ''}`);
      fact('Nota pessoal', item.score);
      for (const [key, label] of Object.entries({ artist:'Artista', authors:'Autores', author:'Autor', platform:'Plataforma', platforms:'Plataformas', releaseDate:'Lançamento', year:'Ano', genres:'Gêneros', tags:'Tags', developers:'Desenvolvedores', publishers:'Publicadoras', lists:'Listas', startedAt:'Início', finishedAt:'Conclusão', albumTitle:'Álbum' })) fact(label, item[key]);
    }
    detail.append(facts);
    if (item.kind === 'music' && item.playbackSource && window.MusicModel && window.SPACEAMP) {
      detail.append(button('[ tocar agora ]', () => {
        Promise.resolve(window.SPACEAMP.play(MusicModel.queueTrack(item)))
          .then(() => window.SpaceAmpNowPlaying?.open(document.activeElement))
          .catch(error => window.toast?.(error.message));
      }, 'xmb-open xmb-play'));
    }
    const summary = category === 'profile' ? item.bio : item.summary || item.description;
    if (summary) detail.append(el('p', 'xmb-summary', String(summary).replace(/<[^>]*>/g, ' ').trim()));
    if (item.notes) detail.append(el('p', 'xmb-notes', item.notes));
    if (!detailsLevel) detail.append(button('[ detalhes · Enter ]', activate, 'xmb-open'));
    detail.append(button('[ página completa · O ]', openPage, 'xmb-open xmb-page'));
  }
  // Reuse thumbnails already visited; this does not preload other categories.
  const thumbnails = new Map();
  function thumbnail(item, index, source) {
    const key = category + ':' + identity(item, index);
    let image = thumbnails.get(key);
    if (!image) {
      image = imageNode(source, '');
      thumbnails.set(key, image);
      if (thumbnails.size > 64) thumbnails.delete(thumbnails.keys().next().value);
    } else if (window.Artwork) {
      Artwork.set(image, source, {
        ready: () => { image.hidden = false; },
        error: () => { image.hidden = true; },
      });
    } else image.src = source;
    return image;
  }
  function render({ focus = false } = {}) {
    const rows = entries(), selected = selection(rows);
    if (rows.length) remembered.set(category, identity(rows[selected], selected));
    for (const [key, control] of categoryButtons) {
      control.setAttribute('aria-pressed', String(key === category));
      control.tabIndex = key === category ? 0 : -1;
    }
    updateHorizontalAxis();
    list.replaceChildren();
    rows.forEach((item, index) => {
      const row = button(title(item), () => selectItem(index), 'xmb-item');
      const cover = category === 'profile' ? item.avatar : item.image;
      if (cover) row.append(thumbnail(item, index, cover));
      row.dataset.index = String(index);
      row.setAttribute('aria-pressed', String(index === selected));
      row.tabIndex = index === selected ? 0 : -1;
      row.ondblclick = activate;
      list.append(row);
    });
    if (!rows.length) list.append(el('p', 'xmb-empty', 'Nenhum item nesta categoria com os filtros atuais.'));
    renderDetail(rows[selected]);
    announcement.textContent = `${categoryButtons.get(category).textContent} · ${rows.length ? title(rows[selected]) : 'sem itens'}`;
    if (focus) (list.children[selected]?.tagName === 'BUTTON' ? list.children[selected] : categoryButtons.get(category)).focus({ preventScroll: true });
    revealSelection(false);
  }
  // A rolagem lê duração e curva dos tokens existentes; cada eixo cancela o movimento anterior.
  function stopScroll(node) {
    const frame = scrolling.get(node);
    if (frame != null) window.cancelAnimationFrame?.(frame);
    scrolling.delete(node);
  }
  function moveScroll(node, top, left, smooth = true) {
    stopScroll(node);
    if (!smooth || !window.requestAnimationFrame || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      node.scrollTop = top; node.scrollLeft = left; return;
    }
    const style = window.getComputedStyle(node), token = style.getPropertyValue('--motion-focus').trim();
    const duration = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    const curve = style.getPropertyValue('--ease-xmb').match(/[\d.]+/g)?.map(Number);
    if (!(duration > 0) || curve?.length !== 4) { node.scrollTop = top; node.scrollLeft = left; return; }
    const fromTop = node.scrollTop, fromLeft = node.scrollLeft;
    if (fromTop === top && fromLeft === left) return;
    const bezier = (t, a, b) => 3 * (1-t) * (1-t) * t * a + 3 * (1-t) * t * t * b + t*t*t;
    const ease = progress => {
      let low = 0, high = 1;
      for (let i = 0; i < 14; i++) { const mid = (low+high)/2; if (bezier(mid, curve[0], curve[2]) < progress) low = mid; else high = mid; }
      return bezier((low+high)/2, curve[1], curve[3]);
    };
    let start;
    const tick = now => {
      if (!active) { scrolling.delete(node); return; }
      start ??= now;
      const progress = Math.min(1, (now-start)/duration), amount = ease(progress);
      node.scrollTop = fromTop + (top-fromTop)*amount;
      node.scrollLeft = fromLeft + (left-fromLeft)*amount;
      if (progress < 1) scrolling.set(node, window.requestAnimationFrame(tick));
      else { node.scrollTop = top; node.scrollLeft = left; scrolling.delete(node); }
    };
    scrolling.set(node, window.requestAnimationFrame(tick));
  }
  function updateHorizontalAxis() {
    const control = categoryButtons.get(category);
    if (!nav.style?.setProperty || !control.offsetWidth) return;
    const index = categories.findIndex(([key]) => key === category);
    const shift = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : Math.max(-12, Math.min(12, ((categories.length-1)/2-index)*3));
    nav.style.setProperty('--xmb-axis-shift', shift + 'px');
    nav.style.setProperty('--xmb-indicator-x', (control.offsetLeft + control.offsetWidth*.54 + shift + 3 - 9) + 'px');
  }
  function revealSelection(smooth = true) {
    const row = list.querySelector('[aria-pressed="true"]');
    if (!row) return;
    // Apenas o scroller interno; não movimenta a página que ficará por baixo.
    // Uma margem curta acomoda a escala e mantém vizinhos próximos do foco.
    const top = Math.max(0, row.offsetTop - 12), bottom = row.offsetTop + row.offsetHeight + 12;
    const target = top < list.scrollTop ? top : bottom > list.scrollTop + list.clientHeight ? bottom - list.clientHeight : list.scrollTop;
    moveScroll(list, Math.max(0, Math.min(target, Math.max(0, (list.scrollHeight || list.clientHeight)-list.clientHeight))), list.scrollLeft || 0, smooth);
  }
  function selectItem(index) {
    const rows = entries();
    if (!rows.length) return;
    index = Math.max(0, Math.min(rows.length - 1, index));
    if (index === selection(rows)) return;
    remembered.set(category, identity(rows[index], index));
    // Mantém os nós das linhas para a transição de seleção funcionar.
    for (const row of list.querySelectorAll('.xmb-item')) {
      const selected = Number(row.dataset.index) === index;
      row.setAttribute('aria-pressed', String(selected)); row.tabIndex = selected ? 0 : -1;
      if (selected) row.focus({ preventScroll: true });
    }
    renderDetail(rows[index]);
    announcement.textContent = title(rows[index]);
    revealSelection();
  }
  function selectCategory(key) {
    category = key; render({ focus: true });
    const control = categoryButtons.get(key);
    if (!nav.clientWidth) return;
    const left = Math.max(0, control.offsetLeft - 20), right = control.offsetLeft + control.offsetWidth + 24;
    const target = left < nav.scrollLeft ? left : right > nav.scrollLeft + nav.clientWidth ? right-nav.clientWidth : nav.scrollLeft;
    moveScroll(nav, nav.scrollTop || 0, Math.max(0, Math.min(target, Math.max(0, (nav.scrollWidth || nav.clientWidth)-nav.clientWidth))));
  }
  function activate() {
    if (detailsLevel) return;
    const rows = entries(), item = rows[selection(rows)];
    if (!item) return;
    detailsLevel = true;
    stopScroll(list); stopScroll(nav);
    previewScroll = detail.scrollTop;
    root.dataset.level = 'details';
    // Conserva as linhas, seleção e posições dos scrollers do nível anterior.
    nav.inert = true; list.inert = true;
    backButton.textContent = '[ voltar · Esc ]';
    help.textContent = '↑ ↓ rolar detalhes · O página completa · Esc / Backspace voltar';
    renderDetail(item); detail.scrollTop = 0; detail.tabIndex = 0;
    detail.focus({ preventScroll: true });
    announcement.textContent = 'Detalhes · ' + title(item);
  }
  function back() {
    if (!detailsLevel) { close(); return; }
    detailsLevel = false; root.dataset.level = 'root';
    nav.inert = false; list.inert = false; detail.tabIndex = -1;
    backButton.textContent = '[ sair · Esc ]'; help.textContent = rootHelp;
    const rows = entries();
    renderDetail(rows[selection(rows)]); detail.scrollTop = previewScroll;
    (list.querySelector('[aria-pressed="true"]') || categoryButtons.get(category)).focus({ preventScroll: true });
    announcement.textContent = `${categoryButtons.get(category).textContent} · ${rows.length ? title(rows[selection(rows)]) : 'sem itens'}`;
  }
  function openPage() {
    const rows = entries(), item = rows[selection(rows)], key = category;
    if (!item) return;
    close();
    if (key === 'profile') navigate('perfil');
    else if (key === 'photos') { navigate('fotos'); openPhoto(item); }
    else openItem(item);
  }
  function releaseFullscreen() {
    if (ownsFullscreen && document.fullscreenElement === document.documentElement) {
      ownsFullscreen = false;
      try { Promise.resolve(document.exitFullscreen()).catch(() => {}); } catch {}
    }
  }
  function close() {
    if (!active) return;
    active = false; session++;
    stopClock();
    stopScroll(list); stopScroll(nav);
    root.hidden = true;
    for (const [node, inert] of background) node.inert = inert;
    background = [];
    document.body.classList.remove('xmb-active');
    releaseFullscreen();
    trigger?.focus({ preventScroll: true });
  }
  function enter(source) {
    if (active) return;
    if (!root.isConnected) document.body.append(root);
    trigger = source || document.activeElement;
    active = true;
    updateClock();
    detailsLevel = false; root.dataset.level = 'root';
    nav.inert = false; list.inert = false; detail.tabIndex = -1;
    backButton.textContent = '[ sair · Esc ]'; help.textContent = rootHelp;
    const token = ++session;
    category = Object.hasOwn(Collection.kinds, getFilters().kind) ? getFilters().kind : category;
    background = [...document.body.children].filter(node => node !== root).map(node => [node, node.inert]);
    for (const [node] of background) node.inert = true;
    document.body.classList.add('xmb-active'); root.hidden = false;
    render({ focus: true });
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        Promise.resolve(document.documentElement.requestFullscreen()).then(() => {
          ownsFullscreen = document.fullscreenElement === document.documentElement;
          if (!active || token !== session) releaseFullscreen();
        }).catch(() => {}); // A interface continua funcionando na viewport.
      } catch {}
    }
  }
  document.addEventListener('fullscreenchange', () => {
    if (ownsFullscreen && !document.fullscreenElement) {
      ownsFullscreen = false;
      if (window.SpaceAmpNowPlaying?.isOpen()) { window.SpaceAmpNowPlaying.close(); return; }
      // Alguns navegadores interceptam Esc para sair do fullscreen nativo.
      // Nesse caso, conserva o shell na viewport e volta apenas um nível.
      if (detailsLevel) back(); else close();
    }
  });
  window.addEventListener('hashchange', () => close());
  document.addEventListener('visibilitychange', () => { if (active) updateClock(); });
  document.addEventListener('keydown', event => {
    if (window.SpaceAmpNowPlaying?.isOpen()) return;
    if (!active || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target?.isContentEditable || event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Backspace', 'Tab', 'o', 'O'].includes(event.key)) return;
    if (event.key === 'Enter' && (event.target.closest?.('.xmb-exit') || event.target.closest?.('.xmb-page') || event.target.closest?.('.xmb-play'))) return;
    event.preventDefault(); event.stopPropagation();
    if (event.repeat && ['Enter', 'Escape', 'Backspace', 'o', 'O'].includes(event.key)) return;
    if (event.key === 'Escape') back();
    else if (event.key === 'Backspace' && detailsLevel) back();
    else if (event.key.toLowerCase() === 'o') openPage();
    else if (event.key === 'Enter') activate();
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (detailsLevel) return;
      const index = categories.findIndex(([key]) => key === category);
      selectCategory(categories[Math.max(0, Math.min(categories.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))][0]);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (detailsLevel) detail.scrollTop += event.key === 'ArrowDown' ? 40 : -40;
      else selectItem(selection() + (event.key === 'ArrowDown' ? 1 : -1));
    }
    else if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button')].filter(node => node.tabIndex >= 0 && (!detailsLevel || (!nav.contains(node) && !list.contains(node))));
      const index = controls.indexOf(document.activeElement);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    }
    // Na raiz, Backspace evita voltar o histórico; nos detalhes, volta um nível.
  }, true);
  return { enter, close, isActive: () => active };
}
