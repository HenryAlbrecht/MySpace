(() => {
  const node = (tag, text = '', cls = '') => { const element = document.createElement(tag); element.textContent = text; element.className = cls; return element; };
  const page = node('section', '', 'page-view panel personalized-discovery'); page.id = 'personalizedDiscovery'; page.hidden = true;
  const head = node('div', '', 'section-head'); head.append(node('h2', 'para descobrir'));
  const intro = node('p', 'Sugestões a partir dos seus favoritos, gêneros e títulos da coleção.', 'title-notice');
  const loadButton = node('button', 'carregar sugestões', 'small'); loadButton.type = 'button';
  const status = node('p', '', 'title-notice'); status.setAttribute('role','status');
  const grid = node('div', '', 'media-related-grid discovery-grid');
  let suggestions = [], dismissed = new Set();
  let rotation = 0, loadGeneration = 0;
  try { rotation = Number(sessionStorage.getItem('myspace-discovery-rotation')) || 0; } catch {}
  try { const stored = JSON.parse(localStorage.getItem('myspace-discovery-dismissed') || '[]'); if (Array.isArray(stored)) dismissed = new Set(stored.filter(key => typeof key === 'string').slice(0,2000)); } catch {}
  const identity = item => item.kind + ':' + item.catalogId;
  const filter = node('select', '', 'discography-filter'); filter.setAttribute('aria-label','Tipo de sugestão');
  for (const [key,label] of Object.entries({ all: 'Todas as mídias', ...Collection.kinds })) filter.append(new Option(label,key));
  filter.value = 'all'; filter.onchange = () => { renderCards(); load(); };
  const restore = node('button','rever sugestões descartadas','small'); restore.type = 'button';
  restore.onclick = () => { try { localStorage.removeItem('myspace-discovery-dismissed'); dismissed.clear(); renderCards(); } catch { status.textContent = 'Não consegui salvar sua preferência.'; } };
  const body = node('div', '', 'title-about'); body.append(intro, loadButton, filter, restore, status, grid); page.append(head, body);
  function renderCards() {
    grid.replaceChildren();
    for (const item of suggestions.filter(item => !dismissed.has(identity(item)) && (filter.value === 'all' || item.kind === filter.value))) {
      const wrapper = node('article','','discovery-choice');
      const card = node('button', '', 'discover-card'); card.type = 'button'; card.onclick = () => TitlePages.open(item);
      const frame = node('div', '', 'title-cover'); frame.dataset.kind = item.kind;
      const placeholder = node('span','sem capa'); frame.append(placeholder);
      if (safeUrl(item.image,true)) { const image = node('img'); image.src = item.image; image.alt = item.title; image.loading = 'lazy'; placeholder.hidden = true; image.onerror = () => { image.hidden = true; placeholder.hidden = false; }; frame.append(image); }
      card.append(frame, node('strong',item.title), node('small',item.reason));
      const dismiss = node('button','não tenho interesse','discovery-dismiss'); dismiss.type = 'button'; dismiss.setAttribute('aria-label','Não tenho interesse em ' + item.title);
      dismiss.onclick = () => { const next = new Set(dismissed); next.add(identity(item)); try { localStorage.setItem('myspace-discovery-dismissed',JSON.stringify([...next].slice(-2000))); dismissed = next; renderCards(); } catch { status.textContent = 'Não consegui salvar sua preferência.'; } };
      wrapper.append(card,dismiss); grid.append(wrapper);
    }
    restore.hidden = !dismissed.size;
    if (suggestions.length && !grid.children.length) grid.append(node('p','Nenhuma sugestão com este filtro. Escolha outra mídia ou reveja as descartadas.','title-notice'));
  }
  document.querySelector('main').insertBefore(page, document.querySelector('footer'));
  async function load() {
    const generation=++loadGeneration;
    loadButton.disabled = true; grid.setAttribute('aria-busy','true'); status.textContent = 'Preparando sugestões…';
    try {
      const requestedKind=filter.value;
      const result = await Catalog.forCollection(CollectionActions.getItems(), { rotation, kind:requestedKind, progress: (done,total) => { if(generation===loadGeneration)status.textContent = 'Consultando títulos: ' + done + ' / ' + total; } });
      if(generation!==loadGeneration)return;
      if (!result.items.length && result.failures && grid.children.length) { status.textContent = 'As fontes estão indisponíveis. Suas sugestões anteriores foram mantidas.'; return; }
      const previous = suggestions;
      suggestions = [...result.items.filter(item=>!previous.some(old=>identity(old)===identity(item))), ...result.items.filter(item=>previous.some(old=>identity(old)===identity(item)))]; renderCards();
      rotation++; try { sessionStorage.setItem('myspace-discovery-rotation',String(rotation)); } catch {}
      status.textContent = !result.seeds ? (requestedKind==='all'?'Adicione títulos à coleção e marque seus favoritos para começar.':'Adicione títulos deste tipo à coleção para receber sugestões.') : !result.items.length ? 'Não há sugestões novas agora. Tente novamente ou adicione outros favoritos.' : result.failures ? 'Algumas fontes não responderam; as demais sugestões estão disponíveis.' : 'Títulos da sua coleção foram omitidos.';
    } catch (error) { if(generation===loadGeneration)status.textContent = 'Não consegui atualizar. As sugestões já carregadas foram mantidas. ' + error.message; }
    finally { if(generation===loadGeneration){loadButton.disabled = false; loadButton.textContent = grid.children.length ? 'atualizar sugestões' : 'tentar carregar sugestões'; grid.setAttribute('aria-busy','false');} }
  }
  function render() { page.hidden = !location.hash.startsWith('#descobrir'); }
  restore.hidden = !dismissed.size;
  loadButton.onclick = load; window.addEventListener('hashchange',render); render();
  window.DiscoveryPage = { load, render };
})();
