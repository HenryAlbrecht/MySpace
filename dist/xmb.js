/* Uma apresentação da coleção; não mantém cópias dos dados nem grava filtros. */
function createXmb({ getData, getProfile, getFilters, openItem, navigate, openPhoto, el, button, imageNode }) {
  const categories = [['profile', 'Perfil'], ...Object.entries(Collection.kinds), ['photos', 'Fotos']];
  const remembered = new Map();
  let category = 'game', active = false, trigger, background = [], session = 0, ownsFullscreen = false;
  let detailsLevel = false, previewScroll = 0;
  const root = el('section', 'xmb');
  root.hidden = true;
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Coleção — modo XMB');
  const header = el('header', 'xmb-header');
  const backButton = button('[ sair · Esc ]', back, 'xmb-exit');
  header.append(el('span', '', 'Halourt / XMB v0.3'), backButton);
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
  function renderDetail(item) {
    detail.replaceChildren();
    backdrop.replaceChildren();
    if (!item) return;
    const heading = el('h2', '', title(item));
    detail.append(heading);
    const image = category === 'profile' ? item.avatar : item.image;
    if (image) {
      detail.append(imageNode(image, title(item)));
      // Camada decorativa; reutiliza a mesma imagem validada, sem novos dados.
      backdrop.append(imageNode(image, ''));
    }
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
    const summary = category === 'profile' ? item.bio : item.summary || item.description;
    if (summary) detail.append(el('p', 'xmb-summary', String(summary).replace(/<[^>]*>/g, ' ').trim()));
    if (item.notes) detail.append(el('p', 'xmb-notes', item.notes));
    if (!detailsLevel) detail.append(button('[ detalhes · Enter ]', activate, 'xmb-open'));
    detail.append(button('[ página completa · O ]', openPage, 'xmb-open xmb-page'));
  }
  function render({ focus = false } = {}) {
    const rows = entries(), selected = selection(rows);
    if (rows.length) remembered.set(category, identity(rows[selected], selected));
    for (const [key, control] of categoryButtons) {
      control.setAttribute('aria-pressed', String(key === category));
      control.tabIndex = key === category ? 0 : -1;
    }
    list.replaceChildren();
    rows.forEach((item, index) => {
      const row = button(title(item), () => selectItem(index), 'xmb-item');
      const cover = category === 'profile' ? item.avatar : item.image;
      if (cover) row.append(imageNode(cover, ''));
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
    revealSelection();
  }
  function revealSelection() {
    const row = list.querySelector('[aria-pressed="true"]');
    if (!row) return;
    // Apenas o scroller interno; não movimenta a página que ficará por baixo.
    const top = row.offsetTop, bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }
  function selectItem(index) {
    const rows = entries();
    if (!rows.length) return;
    index = Math.max(0, Math.min(rows.length - 1, index));
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
    categoryButtons.get(key).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
  function activate() {
    if (detailsLevel) return;
    const rows = entries(), item = rows[selection(rows)];
    if (!item) return;
    detailsLevel = true;
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
      // Alguns navegadores interceptam Esc para sair do fullscreen nativo.
      // Nesse caso, conserva o shell na viewport e volta apenas um nível.
      if (detailsLevel) back(); else close();
    }
  });
  window.addEventListener('hashchange', () => close());
  document.addEventListener('keydown', event => {
    if (!active || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target?.isContentEditable || event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Backspace', 'Tab', 'o', 'O'].includes(event.key)) return;
    if (event.key === 'Enter' && (event.target.closest?.('.xmb-exit') || event.target.closest?.('.xmb-page'))) return;
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
