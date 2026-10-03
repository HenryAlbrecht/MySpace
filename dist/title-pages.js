/* Busca e páginas de títulos. Não dependem do formulário da coleção. */
(() => {
  const node = (tag, cls = "", text = "") => {
    const n = document.createElement(tag);
    n.className = cls;
    n.textContent = text;
    return n;
  };
  const button = (text, fn, cls = "small") => {
    const b = node("button", cls, text);
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  const plainText = (value) => String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity])
    .replace(/&#(\d+);/g, (_, code) => Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : "")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .trim().slice(0, 30000);
  function cover(src, title, fallback = "", layout = "vertical", kind = "") {
    const frame = node("div", "title-cover");
    frame.dataset.layout = layout;
    frame.dataset.kind = kind;
    const placeholder = node("span", "", "sem capa");
    frame.append(placeholder);
    if (safeUrl(src, true)) {
      const img = node("img");
      img.src = src;
      img.alt = title;
      img.loading = "lazy";
      placeholder.hidden = true;
      let usedFallback = false;
      img.onerror = () => {
        if (!usedFallback && safeUrl(fallback, true) && fallback !== src) {
          usedFallback = true;
          img.src = fallback;
          return;
        }
        img.hidden = true; placeholder.hidden = false;
      };
      frame.append(img);
    }
    return frame;
  }
  const galleryDialog = node('dialog', 'gallery-viewer');
  galleryDialog.setAttribute('aria-label', 'Galeria de imagens');
  const galleryTitle = node('h2'), galleryImage = node('img'), galleryStatus = node('p', 'title-notice');
  const galleryTools = node('div', 'gallery-viewer-tools');
  let galleryEntries = [], galleryIndex = 0, galleryItem = null, galleryOrigin = null;
  function drawGallery() {
    const src = galleryEntries[galleryIndex];
    galleryImage.src = src; galleryImage.alt = galleryItem.title + ' · imagem ' + (galleryIndex + 1);
    galleryTitle.textContent = galleryItem.title + ' · ' + (galleryIndex + 1) + ' / ' + galleryEntries.length;
    const selected = TitleBanner.get(galleryItem).image === src;
    gallerySet.textContent = selected ? '✓ banner selecionado' : 'definir como banner';
    gallerySet.disabled = selected; galleryStatus.textContent = '';
    galleryPrevious.disabled = galleryNext.disabled = galleryEntries.length < 2;
  }
  function setGalleryBanner(item,src) {
    const folds=Array.from(detailPage.querySelectorAll('.title-fold')).filter(fold=>fold.open).map(fold=>fold.querySelector('summary')?.textContent);
    const y=window.scrollY || 0, hash=location.hash;
    TitleBanner.setImage(item,src);drawDetail(item);
    for(const fold of detailPage.querySelectorAll('.title-fold'))if(folds.includes(fold.querySelector('summary')?.textContent)){fold.open=true;fold.ontoggle?.();}
    window.requestAnimationFrame?.(()=>{if(location.hash===hash)window.scrollTo?.({top:y,behavior:'instant'});});
  }
  function moveGallery(delta) { galleryIndex = (galleryIndex + delta + galleryEntries.length) % galleryEntries.length; drawGallery(); }
  const galleryPrevious = button('← anterior', () => moveGallery(-1), 'gallery-previous');
  const galleryNext = button('próxima →', () => moveGallery(1), 'gallery-next');
  const gallerySet = button('definir como banner', () => {
    try { setGalleryBanner(galleryItem, galleryEntries[galleryIndex]); drawGallery(); galleryClose.focus({preventScroll:true}); }
    catch (error) { galleryStatus.textContent = error.message; }
  }, 'primary gallery-set-banner');
  const galleryClose = button('fechar ×', () => galleryDialog.close(), 'gallery-close');
  galleryImage.onerror = () => { galleryStatus.textContent = 'Não foi possível carregar esta imagem.'; };
  galleryTools.append(galleryPrevious, galleryNext, gallerySet, galleryClose);
  galleryDialog.append(galleryTitle, galleryImage, galleryTools, galleryStatus); document.body.append(galleryDialog);
  galleryDialog.onkeydown = event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveGallery(event.key === 'ArrowLeft' ? -1 : 1); } };
  galleryDialog.onclose = () => { if (galleryOrigin?.isConnected) galleryOrigin.focus({preventScroll:true}); else detailPage.querySelector('h1')?.focus({preventScroll:true}); };
  function imageGallery(item, images, label) {
    const entries = images.filter(src => safeUrl(src)).slice(0,30), grid = node('div', 'game-screenshots');
    entries.forEach((src,index) => {
      const card = node('div','game-gallery-card');
      const preview = button('', () => { galleryEntries=entries; galleryIndex=index; galleryItem=item; galleryOrigin=preview; drawGallery(); galleryDialog.showModal(); }, 'gallery-preview');
      preview.setAttribute('aria-label','Ampliar ' + label + ' ' + (index+1) + ' de ' + item.title);
      const image=node('img'); image.dataset.deferredSrc=src; image.alt=label + ' · ' + item.title + ' · ' + (index+1); image.loading='lazy'; preview.append(image);
      const selected=TitleBanner.get(item).image===src;
      const choose=button(selected ? '✓' : '▧', () => { try { setGalleryBanner(item,src); } catch(error) { toast(error.message); } }, 'gallery-banner-action');
      choose.setAttribute('aria-label', selected ? 'Imagem selecionada como banner' : 'Usar imagem ' + (index+1) + ' como banner'); choose.setAttribute('aria-pressed',String(selected)); choose.title=selected?'Banner selecionado':'Definir como banner';
      card.append(preview,choose);grid.append(card);
    }); return grid;
  }
  const pageRoot = document.querySelector("main");
  const searchPage = node("section", "page-view panel discover-page");
  searchPage.id = "discoverPage";
  const detailPage = node("section", "page-view panel title-page");
  detailPage.id = "titlePage";
  searchPage.hidden = detailPage.hidden = true;
  pageRoot.insertBefore(searchPage, document.querySelector("footer"));
  pageRoot.insertBefore(detailPage, document.querySelector("footer"));
  const head = node("div", "section-head");
  head.append(node("h2", "", "// buscar títulos"));
  const form = node("form", "discover-search");
  const category = node("select");
  category.setAttribute("aria-label", "Tipo de mídia");
  for (const [value, label] of Object.entries(Collection.kinds)) category.append(new Option(label, value));
  category.value = "game";
  const provider = node("select");
  provider.setAttribute("aria-label", "Catálogo de jogos");
  provider.append(new Option("Steam", "steam"), new Option("IGDB (opcional)", "igdb"));
  provider.value = "steam";
  const context = node('select'); context.setAttribute('aria-label','Buscar por');
  const platform = node('input'); platform.placeholder = 'Plataforma (opcional)'; platform.maxLength = 80; platform.setAttribute('aria-label','Filtrar jogos por plataforma');
  function updateContext() {
    context.replaceChildren(new Option('Nome do título / artista',''));
    if (category.value === 'artist') context.append(new Option('Música conhecida','song'));
    if (category.value === 'book') context.append(new Option('Autor','author'));
    context.value = ''; context.hidden = !['artist','book'].includes(category.value); platform.hidden = category.value !== 'game';
  }
  category.onchange = () => { provider.hidden = category.value !== 'game'; updateContext(); platform.value = ''; }; updateContext();
  const query = node("input");
  query.type = "search";
  query.maxLength = 120;
  query.placeholder = "Nome do jogo, anime, mangá, livro…";
  query.setAttribute("aria-label", "Buscar título");
  const run = node("button", "primary", "buscar");
  run.type = "submit";
  form.append(category, provider, context, query, platform, run);
  const status = node("p", "discover-status");
  status.setAttribute("role", "status");
  const retrySearch=button('tentar novamente',()=>{lastRoute='';return route();},'text-action');retrySearch.hidden=true;
  const results = node("div", "discover-results");
  searchPage.append(head, form, status, retrySearch, results);
  const entries = new Map();
  let controller, revision = 0, lastRoute = "", lastSearch = "#buscar", returnRoute = "#buscar", activeItem, reloadDetail = false;
  const findSaved = (item) => CollectionActions.getItems().find(i =>
    window.MusicModel?.sameItem(i, item) || (item.catalogId ? i.catalogId === item.catalogId && i.kind === item.kind : i.id === item.id));
  function remember(item) {
    const key = item.kind + "/" + (item.catalogId || "local:" + item.id);
    if (entries.size >= 60) entries.delete(entries.keys().next().value);
    entries.set(key, item);
    return key;
  }
  function go(hash) {
    window.Navigation?.capture(window.location.hash || '#perfil');
    window.location.hash = hash;
    CollectionActions.applyRoute();
    return Promise.resolve(route()).then(()=>window.Navigation?.restore(hash));
  }
  function open(item) {
    const hash = window.location.hash;
    if (!hash.startsWith("#titulo/")) returnRoute = hash.startsWith("#buscar") ? lastSearch : hash || "#colecao";
    const key = remember(item);
    return go("#titulo/" + item.kind + "/" + encodeURIComponent(key.slice(item.kind.length + 1)));
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    if (query.value.trim().length < 2) { status.textContent = "Digite pelo menos 2 caracteres."; return; }
    lastRoute = "";
    const base = '#buscar/' + category.value + '/' + encodeURIComponent(query.value.trim());
    const extra = context.value || (!platform.hidden && platform.value.trim());
    return go(base + (extra ? '/' + provider.value + '/' + encodeURIComponent(context.value) + '/' + encodeURIComponent(platform.hidden ? '' : platform.value.trim()) : category.value === 'game' && provider.value === 'igdb' ? '/igdb' : ''));
  };
  function drawDetail(item, message = "") {
    const savedCover=findSaved(item);if(savedCover?.image&&['music','album','artist'].includes(item.kind))item={...item,image:savedCover.image};
    let chosenCover = ''; try { chosenCover = localStorage.getItem('myspace.titleCover:' + item.catalogId) || ''; } catch {}
    if (safeUrl(chosenCover, true)) item = { ...item, image: chosenCover };
    activeItem = item;
    detailPage.replaceChildren();
    const toolbar = node("div", "section-head");
    toolbar.append(button("← voltar", () => go(returnRoute)));
    toolbar.append(button('editar banner', () => TitleBanner.edit(item, () => drawDetail(item))));
    if (item.source === 'IGDB') toolbar.append(button('restaurar banner do catálogo', () => { try { TitleBanner.reset(item); } catch {} drawDetail(item); }));
    const layout = node("div", "title-layout");
    const saved = findSaved(item);
    const info = node("div", "title-information");
    const heading = node("h1", "", item.title || "Título");
    detailPage.dataset.kind = item.kind;
    heading.tabIndex = -1;
    info.append(node("span", "title-kind", Collection.kinds[item.kind]), heading);
    if (item.description) info.append(node("p", "title-metadata", plainText(item.description)));
    if (item.platforms?.length) info.append(node("p", "title-metadata", item.platforms.join(" · ")));
    if (item.genres?.length) {
      const genres = node("div", "title-genres");
      for (const genre of item.genres.slice(0, 8)) genres.append(node("span", "", plainText(genre)));
      info.append(genres);
    }
    const actions = node("div", "title-actions");
    const add = button(saved ? "editar na coleção" : "＋ adicionar à coleção", () => {
      const current = findSaved(item);
      CollectionActions.editItem(current ? { ...current, ...(chosenCover ? { image: chosenCover } : {}) } : { ...item, catalogImage: item.verticalImage || item.image || "", status: "planned", progress: 0, score: null });
    }, "primary");
    add.disabled = !item.title;
    actions.append(add);
    if (saved) {
      if (saved.status !== 'done') actions.append(button('concluir ✓', () => {
        CollectionActions.updateItem(saved.id, { status: 'done', progress: saved.total || saved.progress, finishedAt: saved.finishedAt || new Date().toLocaleDateString('sv-SE') }); drawDetail(item);
      }, 'small title-complete'));
      if (item.kind !== 'artist') actions.append(button(saved.featured ? '★ favorito' : '☆ favoritar', () => {
        try { CollectionActions.updateItem(saved.id, { featured: !saved.featured }); drawDetail(item); } catch (error) { toast(error.message); }
      }, 'small title-favorite'));
    }
    if (item.kind === 'artist') actions.append(button(saved?.featured ? '★ artista favorito' : '☆ favoritar artista', () => {
      try { CollectionActions.favoriteArtist(item); } catch (error) { toast(error.message); }
    }));
    if (saved) info.append(node("p", "title-personal-status", "Na sua coleção · " + Collection.statuses[saved.status]));
    if (safeUrl(item.url)) {
      const credit = node("a", "catalog-credit", "ver em " + (item.source || "fonte"));
      credit.href = item.url;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      actions.append(credit);
    }
    info.append(actions);
    if (item.total) info.append(node("p", "title-metadata", item.total + " " + item.unit));
    const coverColumn = node('div', 'title-cover-column');
    coverColumn.append(cover(chosenCover || (saved ? saved.image : item.image), item.title, item.imageFallback, saved?.coverLayout || item.coverLayout, item.kind));
    if (item.source === 'IGDB' && item.localizedCoverImages?.length) {
      const region = node('select', 'quick-regional-cover'); region.setAttribute('aria-label', 'Trocar capa por região');
      const original = item.verticalImage || item.catalogImage || item.image;
      region.append(new Option('Capa original', original));
      item.localizedCoverImages.forEach((src, index) => region.append(new Option(item.localizedCoverLabels[index] || 'Capa regional', src)));
      region.value = chosenCover || original;
      region.onchange = () => { if (!safeUrl(region.value)) return; try { localStorage.setItem('myspace.titleCover:' + item.catalogId, region.value); drawDetail(item); } catch {} };
      coverColumn.append(node('label', 'title-notice', 'capa por região'), region);
    }
    layout.append(coverColumn, info);
    const about = node("div", "title-about");
    const musical = ['music','album','artist'].includes(item.kind);
    const emptySummary = musical ? (item.summaryStatus === 'unavailable' ? 'Não foi possível consultar a descrição no Last.fm agora.' : item.kind === 'artist' ? 'O Last.fm não disponibilizou uma biografia para este artista.' : 'O Last.fm não disponibilizou uma descrição para esta versão.') : 'Este catálogo não disponibilizou um resumo para este título.';
    const summaryText = node('p', 'title-summary', plainText(item.summary) || emptySummary);
    const reading = node('div','summary-reading'); const readMore = button('ler mais ↓', () => {
      const expanded = readMore.getAttribute('aria-expanded') !== 'true';
      readMore.setAttribute('aria-expanded',String(expanded));reading.classList.toggle('expanded',expanded);readMore.textContent=expanded?'recolher ↑':'ler mais ↓';if(!expanded)reading.scrollIntoView({block:'start',behavior:'instant'});
    }, 'summary-read-more text-action');
    function updateSummary(text) { summaryText.textContent=text; readMore.hidden=text.length<=700; reading.classList.toggle('short',readMore.hidden);reading.classList.remove('expanded');readMore.setAttribute('aria-expanded','false');readMore.textContent='ler mais ↓'; }
    summaryText.id='titleSynopsis';readMore.setAttribute('aria-controls',summaryText.id);
    updateSummary(summaryText.textContent);reading.append(summaryText,readMore);
    about.append(node('h2','',item.kind==='artist'?'biografia':item.kind==='book'?'sinopse':'sobre'),reading);
    if (!message && item.summary) {
      const translation = node('details', 'translation-options'); translation.append(node('summary', '', 'traduzir descrição')); const languages = node('div', 'summary-language'); const progress = node('span', 'title-notice');
      const source = node('select'); source.setAttribute('aria-label', 'Idioma original da descrição');
      for (const [value,label] of [['en','Inglês'],['ja','Japonês'],['es','Espanhol'],['fr','Francês'],['de','Alemão'],['it','Italiano']]) source.append(new Option(label,value)); source.value = 'en';
      const originalText = plainText(item.summary);
      const translate = button('traduzir para português', async () => {
        translate.disabled = true; progress.textContent = 'Traduzindo o texto do catálogo…';
        try { updateSummary(plainText(await Catalog.translateSummary(originalText, source.value))); progress.textContent = 'Tradução automática · MyMemory. Fonte: ' + item.source + '.'; }
        catch (error) { progress.textContent = error.message + ' O texto original foi mantido.'; }
        finally { translate.disabled = false; }
      });
      const restore = button('ver original', () => { updateSummary(originalText); progress.textContent = ''; });
      languages.append(source, translate, restore, progress); translation.append(languages); about.append(translation);
    }
    if (message) {
      const notice = node("p", "title-notice", message);
      notice.setAttribute("role", "status");
      about.append(notice);
      if (!message.startsWith('Carregando')) about.append(button('tentar carregar novamente', () => { reloadDetail = true; lastRoute = ''; return route(); }));
    }
    if (item.kind === "game" && item.source === "Steam") appendGameSections(about, item);
    else appendMediaSections(about, item);
    if (item.kind === 'game' && item.source === 'IGDB') appendIgdbSections(about, item);
    if (['game','book','music','album','artist'].includes(item.kind)) appendDiscovery(about, item);
    if (['music','album','artist'].includes(item.kind)) appendMusicDetails(about, item);
    if (item.kind === 'artist') appendArtistSections(about, item);
    if (saved && (saved.notes || saved.score != null || saved.startedAt || saved.finishedAt || saved.progress || saved.total || saved.lists?.length)) {
      about.append(node('h2', '', 'meu acompanhamento'));
      about.append(node('p', 'title-notice', [saved.score != null ? 'Minha nota: ' + saved.score + '/10' : '', saved.startedAt ? 'Início: ' + saved.startedAt.split('-').reverse().join('/') : '', saved.finishedAt ? 'Conclusão: ' + saved.finishedAt.split('-').reverse().join('/') : ''].filter(Boolean).join(' · ')));
      if (saved.total || saved.progress) about.append(node('p', 'title-notice', saved.progress + (saved.total ? ' / ' + saved.total : '') + ' ' + (saved.unit || 'itens')));
      if (saved.lists?.length) about.append(node('p', 'personal-lists', saved.lists.join(' · ')));
      if (saved.notes) about.append(node('p', 'title-summary personal-notes', saved.notes));
    }
    organizeSections(about);
    const bannerSettings = TitleBanner.get(item); const customBanner = bannerSettings.image;
    const banner = safeUrl(customBanner || item.bannerImage, true);
    if (banner) {
      const hero = node('div', 'title-banner');
      hero.dataset.kind = item.kind;
      const image = node('img'); image.src = banner; image.alt = ''; image.loading = 'lazy';
      TitleBanner.apply(hero, image, bannerSettings);
      image.onload = () => { if (!customBanner && item.kind === 'game' && image.naturalWidth <= image.naturalHeight) hero.hidden = true; };
      image.onerror = () => { hero.hidden = true; }; hero.append(image);
      detailPage.append(toolbar, hero, layout, about);
    } else detailPage.append(toolbar, layout, about);
  }
  function organizeSections(parent) {
    const folded = new Set(['ficha do jogo', 'ficha da obra', 'recursos', 'artworks e key art', 'screenshots', 'imagens', 'trailers e vídeos', 'conteúdo relacionado', 'obras relacionadas', 'personagens', 'requisitos mínimos', 'requisitos recomendados', 'DLCs e expansões', 'edições e pacotes da loja', 'explorar mais títulos']);
    const sections = Array.from(parent.children).filter(child => child.tagName.toLowerCase() === 'section');
    const label = section => section.querySelector('h2')?.textContent || '';
    const rank = section => label(section).startsWith('para descobrir') ? 1 : /^(artworks|screenshots|imagens|trailers|requisitos)/.test(label(section)) ? 3 : folded.has(label(section)) ? 2 : 0;
    for (const section of sections.sort((a, b) => rank(a) - rank(b))) {
      const title = label(section);
      if (folded.has(title) || title.startsWith('requisitos')) {
        const heading = section.querySelector('h2');
        const fold = node('details', 'title-fold'); const summary = node('summary');
        const body = node('div', 'title-fold-body');
        for (const child of Array.from(section.children)) if (child !== heading) body.append(child);
        summary.append(heading); fold.append(summary, body); section.replaceChildren(fold);
        fold.ontoggle = () => { if(fold.open) for(const image of body.querySelectorAll('img')) if(image.dataset.deferredSrc) {image.src=image.dataset.deferredSrc;delete image.dataset.deferredSrc;} };
      }
      parent.append(section);
    }
  }
  function appendDiscovery(parent, item) {
    const section = node('section', 'game-detail-section'); const grid = node('div', 'media-related-grid');
    grid.classList.add('discovery-grid');
    section.append(node('h2', '', 'para descobrir'), node('p', 'title-notice', ['music','album','artist'].includes(item.kind) ? (item.kind === 'artist' ? 'Artistas similares no Last.fm.' : item.kind === 'album' ? 'Álbuns de artistas similares no Last.fm.' : 'Faixas similares no Last.fm.') : item.kind === 'book' ? 'Livros do mesmo assunto na Open Library. Títulos da sua coleção são omitidos.' : 'Jogos similares · ' + (item.source || 'catálogo') + '. Sugestões novas para sua coleção.'));
    const status = node('p', 'title-notice');
    const load = button('carregar recomendações', async () => {
      const route=location.hash;
      load.disabled = true; section.setAttribute('aria-busy','true'); status.textContent = 'Buscando novas sugestões…';
      try {
        let entries = await Catalog.recommendations(item);
        const eligible=entry=>entry.catalogId!==item.catalogId&&!CollectionActions.getItems().some(saved=>window.MusicModel?.sameWork(saved,entry)||saved.kind===entry.kind&&saved.catalogId===entry.catalogId);
        const renderEntries=()=>{
        if(!section.isConnected||location.hash!==route)return;
        const basis=section.querySelector('p.title-notice');if(entries.seedTitle)basis.textContent='Faixas similares a “'+entries.seedTitle+'” no Last.fm · a versão masterizada não retornou sugestões.';
        const existingCards=new Map([...grid.children].map(card=>[card.dataset.catalogId,card]));
        const retained=new Set();
        for (const entry of entries.filter(eligible).slice(0, 12)) {
          const card=existingCards.get(entry.catalogId)||button('',()=>open(entry),'discover-card');
          if(!existingCards.has(entry.catalogId)){card.dataset.catalogId=entry.catalogId;card.append(cover(entry.image,entry.title,entry.imageFallback,entry.coverLayout,entry.kind),node('strong','',entry.title));}
          retained.add(card);if(!existingCards.has(entry.catalogId))grid.append(card);
        }
        for(const card of existingCards.values())if(!retained.has(card))card.remove();
        status.classList.toggle('recommendations-partial',!!entries.resolution?.failures&&!!grid.children.length);
        status.textContent = entries.resolution?.failures ? (grid.children.length?'Algumas sugestões ainda estão pendentes. Tentar novamente mantém os resultados abaixo.':'Parte das sugestões não pôde ser consultada na Apple. Tente novamente.') : grid.children.length ? '' : entries.resolution?.status==='unmatched' ? 'As sugestões do Last.fm não tiveram correspondência exata no catálogo Apple.' : entries.length ? 'As sugestões disponíveis já estão na sua coleção.' : 'Não há recomendações disponíveis para este título agora.';
        load.textContent=entries.resolution?.failures?'tentar novamente':entries.reserveAvailable?'carregar mais recomendações':'atualizar recomendações';
        };
        renderEntries();
        for(let batch=0;batch<7&&section.isConnected&&location.hash===route&&entries.reserveAvailable&&!entries.resolution?.failures&&entries.filter(eligible).length<12;batch++){
          status.textContent=grid.children.length?'Carregando mais sugestões…':'Buscando sugestões fora da sua coleção…';
          try{entries=await Catalog.recommendations(item,{reserve:true});renderEntries();}catch(error){status.textContent=grid.children.length?'Os resultados foram mantidos. Tente carregar mais novamente.':error.message;load.textContent='tentar novamente';break;}
        }
      } catch (error) { status.textContent = error.message;load.textContent='tentar novamente'; }
      finally { load.disabled = false; section.setAttribute('aria-busy','false'); }
    });
    section.append(load, status, grid); parent.append(section);
  }
  function appendMusicDetails(parent, item) {
    const section = node('section', 'game-detail-section'); section.append(node('h2', '', 'ficha musical'));
    if (item.kind !== 'artist' && item.artist) section.append(button('ver artista · ' + item.artist, () => open({ kind: 'artist', catalogId: item.artistCatalogId || 'lastfm-artist:' + encodeURIComponent(item.artist), title: item.artist, source: item.artistCatalogId?.startsWith('itunes:') ? 'iTunes' : item.artistCatalogId ? 'Deezer' : 'Last.fm' })));
    if (item.kind === 'music' && item.albumCatalogId) section.append(button('ver álbum · ' + (item.albumTitle || 'álbum'), () => open({ kind: 'album', catalogId: item.albumCatalogId, title: item.albumTitle, source: item.albumCatalogId.startsWith('itunes:')?'iTunes':'Deezer' })));
    if (item.summarySource) section.append(node('p', 'title-notice', 'Biografia / descrição: ' + item.summarySource));
    if (item.kind === 'music') appendFullVideo(section, item);
    section.append(node('p', 'title-summary', [item.artist, item.releaseDate, item.trackDuration ? Math.floor(item.trackDuration / 60) + ':' + String(item.trackDuration % 60).padStart(2,'0') : ''].filter(Boolean).join(' · ')));
    if (item.listeners || item.playcount) section.append(node('p', 'title-notice', 'Last.fm · ' + [item.listeners ? item.listeners + ' ouvintes' : '', item.playcount ? item.playcount + ' reproduções' : ''].filter(Boolean).join(' · ')));
    if (item.edition) section.append(node('p', 'title-notice', 'Faixas da edição: ' + item.edition));
    if (item.trackNames?.length) { const list = node('ol', 'album-tracklist'); item.trackNames.forEach((name,index) => { const line = node('li'); const track = item.albumTracks?.[index]; line.append(track ? button(name, () => open(track), 'track-link') : node('span','',name)); list.append(line); }); section.append(list); }
    if (safeUrl(item.previewUrl)) section.append(button('▶ prévia · não é a faixa completa',()=>window.SPACEAMP.preview({title:'Prévia · '+item.title,artist:item.artist,album:item.image,url:item.previewUrl})));
    parent.append(section);
  }
  function appendArtistSections(parent, item) {
    if (item.discographyUnavailable) {
      const notice = node('section','game-detail-section'); notice.append(node('p','title-notice','A discografia não respondeu. As demais informações continuam disponíveis.'),button('tentar discografia novamente',()=>{reloadDetail=true;lastRoute='';return route();})); parent.append(notice);
    }
    for (const [label, entries] of [['músicas populares', item.topTracks], ['artistas similares', item.similarArtists]]) {
      if (!entries?.length) continue;
      const section = node('section', 'game-detail-section'); const grid = node('div', 'media-related-grid');
      section.append(node('h2', '', label), grid);
      for (const entry of entries.slice(0, 8)) {
        const card = button('', () => open(entry), 'discover-card');
        card.append(cover(entry.image, entry.title, entry.imageFallback, 'horizontal', entry.kind), node('strong', '', entry.title), node('small','',Catalog.describe(entry))); grid.append(card);
      }
      parent.append(section);
    }
    if (item.topAlbums?.length) {
      const section = node('section','game-detail-section'), grid = node('div','media-related-grid');
      const notice = node('p','title-notice'); let albums = item.topAlbums.slice(), next = item.discographyNext;
      const filter = node('select','discography-filter'); filter.setAttribute('aria-label','Tipo de lançamento');
      for (const [value,label] of [['all','Todos os lançamentos'],['album','Álbuns'],['ep','EPs'],['single','Singles']]) filter.append(new Option(label,value)); filter.value = 'all';
      function draw() {
        grid.replaceChildren();
        for (const album of albums.filter(row => filter.value === 'all' || row.albumType === filter.value).sort((a,b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))) {
          const card = button('',() => open(album),'discover-card'); card.append(cover(album.image,album.title,album.imageFallback,'horizontal','album'),node('strong','',album.title),node('small','',[album.releaseDate?.slice(0,4),{ album:'Álbum',ep:'EP',single:'Single' }[album.albumType]].filter(Boolean).join(' · '))); grid.append(card);
        }
        notice.textContent = grid.children.length ? albums.length + ' lançamentos carregados' + (next != null ? ' · há mais no catálogo.' : '.') : 'Nenhum lançamento deste tipo entre os álbuns carregados.';
      }
      filter.onchange = draw;
      const more = button('carregar mais lançamentos',async () => {
        more.disabled = true; notice.textContent = 'Carregando lançamentos…';
        try { const page = await Catalog.artistAlbums(item,next); const seen = new Set(albums.map(row=>row.catalogId)); albums.push(...page.items.filter(row=>!seen.has(row.catalogId))); next = page.next; draw(); more.hidden = next == null; }
        catch (error) { notice.textContent = error.message + ' Os lançamentos anteriores foram mantidos.'; }
        finally { more.disabled = false; }
      }); more.hidden = next == null;
      section.append(node('h2','','discografia'),filter,notice,grid,more); parent.append(section); draw();
    }
  }
  function appendIgdbSections(parent, item) {
    function section(title) { const box = node('section', 'game-detail-section'); box.append(node('h2', '', title)); parent.append(box); return box; }
    if (item.criticRating != null) section('avaliações da crítica · IGDB').append(node('p', 'title-summary', item.criticRating + ' / 100 · ' + item.criticRatingCount + ' avaliações'));
    if (item.catalogRating != null) parent.append(node('p', 'title-notice', 'Nota de usuários IGDB · ' + item.ratingCount + ' avaliações.'));
    const timeBox = section('tempo para zerar · IGDB');
    const times = [['História principal', item.timeMain], ['História e extras', item.timeExtras], ['100%', item.timeComplete]];
    for (const [label, seconds] of times) if (Number.isFinite(seconds) && seconds > 0) timeBox.append(node('p', 'title-summary', label + ': ' + Math.round(seconds / 360) / 10 + ' horas'));
    timeBox.append(node('p', 'title-notice', times.some(([, value]) => value > 0) ? 'Médias da comunidade · ' + item.timeSubmissions + ' registros. Seu tempo pode variar.' : 'O IGDB não informou tempos para este jogo.'));
    for (const [label, images] of [['artworks e key art', item.artworks], ['screenshots', item.screenshots]]) {
      if (!images?.length) continue;
      section(label).append(imageGallery(item,images,label));
    }
    if (item.videoIds?.length) {
      const box = section('trailers e vídeos'); const player = node('div');
      item.videoIds.forEach((id, index) => {
        if (!/^[\w-]{11}$/.test(id)) return;
        box.append(button('▶ ' + (item.videoTitles[index] || 'Vídeo'), () => {
          const frame = node('iframe'); frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1'; frame.title = item.videoTitles[index] || item.title;
          frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'; frame.setAttribute('allowfullscreen', ''); frame.style.width = '100%'; frame.style.aspectRatio = '16 / 9'; frame.style.border = '0'; player.replaceChildren(frame);
        }));
      }); box.append(player);
    }
    if (item.relatedGameIds?.length) {
      const box = section('conteúdo relacionado');
      const groups = [
        ['Jogo base / original', ['Jogo original','Jogo base']], ['Expansões', ['Expansão','Expansão independente']],
        ['DLCs', ['DLC']], ['Pacotes', ['Pacote','Bundle']], ['Mods', ['Mod']], ['Edições', ['Edição']],
        ['Remakes', ['Remake']], ['Remasters', ['Remaster']], ['Versões expandidas', ['Versão expandida']],
        ['Ports', ['Port']], ['Outros conteúdos', ['Derivado','Fork','Atualização']]
      ];
      for (const [title, types] of groups) {
        const indices = item.relatedGameIds.map((id, index) => index).filter(index => item.relatedGameIds[index] !== item.catalogId && types.includes(item.relatedGameTypes[index]));
        const unique = indices.filter((index, position) => indices.findIndex(other => item.relatedGameIds[other] === item.relatedGameIds[index]) === position);
        if (!unique.length) continue;
        const group = node('div', 'game-relation-group'); const grid = node('div', 'game-relation-grid');
        group.append(node('h3', '', title + ' (' + unique.length + ')'), grid);
        for (const index of unique) {
          const related = { kind: 'game', catalogId: item.relatedGameIds[index], title: item.relatedGameTitles[index], image: item.relatedGameImages[index], source: 'IGDB' };
          const card = button('', () => open(related), 'discover-card'); card.append(cover(related.image, related.title), node('strong', '', related.title));
          if (item.relatedGameYears?.[index]) card.append(node('small', '', item.relatedGameYears[index])); grid.append(card);
        }
        box.append(group);
      }
    }
  }
  function appendFullVideo(parent, item) {
    parent.append(window.MusicBridge.actions(item));
  }

  function appendMediaSections(parent, item) {
    const statusNames = { FINISHED: 'Concluído', RELEASING: 'Em publicação / exibição', NOT_YET_RELEASED: 'Ainda não lançado', CANCELLED: 'Cancelado', HIATUS: 'Em hiato', Running: 'Em exibição', Ended: 'Encerrada' };
    const relations = { SEQUEL: 'Continuação', PREQUEL: 'Anterior', ADAPTATION: 'Adaptação', SIDE_STORY: 'História paralela', ALTERNATIVE: 'Versão alternativa', SPIN_OFF: 'Spin-off', PARENT: 'Obra principal', SUMMARY: 'Resumo', OTHER: 'Relacionado', CHARACTER: 'Personagem', SOURCE: 'Obra original', COMPILATION: 'Compilação', CONTAINS: 'Parte da obra' };
    const facts = node('dl', 'game-facts');
    const rows = [
      ['Nota · ' + item.source, item.catalogRating != null ? item.catalogRating + ' / ' + (item.ratingScale || 100) : ''],
      ['Status da obra', statusNames[item.mediaStatus] || item.mediaStatus],
      ['Formato', item.format?.replaceAll('_', ' ')], ['Início / publicação', item.startDate], ['Fim', item.endDate],
      ['Estúdio', item.studios?.join(' · ')], ['Emissora / plataforma', item.network],
      ['Volumes', item.volumes], ['Duração por episódio', item.episodeDuration ? item.episodeDuration + ' min' : ''],
      ['Idioma original', item.languages], ['Origem', item.origin], ['Material original', item.adaptationSource?.replaceAll('_', ' ')],
      ['Outros nomes', item.synonyms?.join(' · ')], ['Lugares', item.subjectPlaces?.join(' · ')],
      ['Pessoas / personagens', item.subjectPeople?.join(' · ')], ['Períodos', item.subjectTimes?.join(' · ')],
    ];
    for (const [label, value] of rows) if (value) facts.append(node('dt', '', label), node('dd', '', String(value)));
    if (facts.children.length) { const section = node('section', 'game-detail-section'); section.append(node('h2', '', 'ficha da obra'), facts); parent.append(section); }
    if (item.relationIds?.length) {
      const section = node('section', 'game-detail-section'); const grid = node('div', 'media-related-grid');
      section.append(node('h2', '', 'obras relacionadas'), grid);
      item.relationIds.forEach((id, index) => {
        const related = { catalogId: id, kind: item.relationKinds[index], title: item.relationTitles[index], image: item.relationImages[index], source: 'AniList' };
        const card = button('', () => open(related), 'discover-card');
        card.append(cover(related.image, related.title), node('strong', '', related.title), node('small', '', relations[item.relationTypes[index]] || 'Relacionado'));
        grid.append(card);
      });
      parent.append(section);
    }
    if (item.characterNames?.length) {
      const section = node('section', 'game-detail-section'); const grid = node('div', 'character-grid');
      section.append(node('h2', '', 'personagens'), grid);
      item.characterNames.forEach((name, index) => {
        const card = node('a', 'character-card'); card.href = safeUrl(item.characterUrls[index]); card.target = '_blank'; card.rel = 'noopener noreferrer';
        if (safeUrl(item.characterImages[index])) { const image = node('img'); image.src = item.characterImages[index]; image.alt = name; image.loading = 'lazy'; card.append(image); }
        card.append(node('strong', '', name), node('small', '', { MAIN: 'Principal', SUPPORTING: 'Coadjuvante', BACKGROUND: 'Participação' }[item.characterRoles[index]] || '')); grid.append(card);
      }); parent.append(section);
    }
    if (item.source === 'AniList' && item.recommendationIds?.length) {
      const section = node('section', 'game-detail-section'); const grid = node('div', 'media-related-grid');
      section.append(node('h2', '', 'para descobrir · recomendações da comunidade AniList'), node('p', 'title-notice', 'Sugestões de outros usuários; títulos que já estão na sua coleção são omitidos.'), grid);
      item.recommendationIds.forEach((id, index) => {
        const entry = { catalogId: id, kind: item.recommendationKinds[index], title: item.recommendationTitles[index], image: item.recommendationImages[index], source: 'AniList' };
        if (findSaved(entry)) return;
        const card = button('', () => open(entry), 'discover-card'); card.append(cover(entry.image, entry.title), node('strong', '', entry.title)); grid.append(card);
      });
      if (grid.children.length) parent.append(section);
    }
    const discover = node('section', 'game-detail-section');
    discover.append(node('h2', '', 'explorar mais títulos'));
    const explore = button('buscar por ' + (item.genres?.[0] || 'tipo de mídia'), () => {
      category.value = item.kind; query.value = item.genres?.[0] || ''; go('#buscar/' + item.kind + (query.value ? '/' + encodeURIComponent(query.value) : ''));
    });
    discover.append(explore); parent.append(discover);
    const similar = CollectionActions.getItems().filter(entry => entry.kind === item.kind && entry.catalogId !== item.catalogId && entry.id !== item.id && entry.genres?.some(genre => item.genres?.includes(genre))).slice(0, 6);
    if (similar.length) {
      const section = node('section', 'game-detail-section'); const grid = node('div', 'media-related-grid');
      section.append(node('h2', '', 'na sua coleção · gêneros em comum'), grid);
      for (const entry of similar) { const card = button('', () => open(entry), 'discover-card'); card.append(cover(entry.image, entry.title), node('strong', '', entry.title)); grid.append(card); }
      parent.append(section);
    }
    if (['music','album','artist'].includes(item.kind)) {
      parent.append(node('p', 'title-notice', 'Dados do catálogo: ' + (item.source || 'seu cadastro') + '.' + (plainText(item.summary) && item.summarySource ? ' Descrição: ' + item.summarySource + '.' : '')));
    } else parent.append(node('p', 'title-notice', 'Descrição e informações fornecidas por ' + (item.summarySource || item.source || 'seu cadastro') + '. Nem todos os catálogos disponibilizam notas, relações e ficha completa.'));
  }
  function appendGameSections(parent, item) {
    function section(title, content) {
      const box = node('section', 'game-detail-section');
      box.append(node('h2', '', title), content); parent.append(box); return box;
    }
    function external(url, text) {
      const link = node('a', 'catalog-credit', text); link.href = safeUrl(url); link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
    }
    const facts = node('dl', 'game-facts');
    const rows = [
      ['Desenvolvimento', item.developers?.join(' · ')], ['Publicação', item.publishers?.join(' · ')],
      ['Metacritic', item.metacriticScore === null || item.metacriticScore === undefined ? 'Não informado pela Steam' : item.metacriticScore + ' / 100'],
      ['DRM de terceiros', plainText(item.drm) || 'Não informado na consulta. Isso não confirma ausência de DRM.'],
      ['Idiomas', plainText(item.languages) || 'Não informados pelo catálogo'],
    ];
    for (const [label, value] of rows) if (value) { facts.append(node('dt', '', label), node('dd', '', value)); }
    section('ficha do jogo', facts);
    if (safeUrl(item.metacriticUrl)) facts.append(node('dt', '', 'Fonte da nota'), external(item.metacriticUrl, 'ver no Metacritic'));
    if (item.categories?.length) section('recursos', node('p', 'title-summary', item.categories.join(' · ')));
    if (item.screenshots?.length) {
      section('imagens', imageGallery(item,item.screenshots,'Imagem'));
    }
    for (const [title, ids] of [['DLCs e expansões', item.dlcIds], ['mais como este · Steam', item.relatedIds]]) {
      if (!ids?.length) continue;
      const list = node('div', 'game-related-grid');
      for (const id of ids.slice(0, 8)) {
        const entry = { kind: 'game', catalogId: 'steam:' + id, title: '', source: 'Steam' };
        const card = button('', () => open(entry), 'game-related-card');
        const image = node('img'); image.src = 'https://cdn.akamai.steamstatic.com/steam/apps/' + id + '/header.jpg'; image.alt = ''; image.loading = 'lazy';
        const name = node('span', '', (title.startsWith('DLC') ? 'DLC' : 'Jogo') + ' · Steam #' + id);
        card.append(image, name); list.append(card);
      }
      const box = section(title, list);
      if (ids.length > 8) box.append(external(item.url, 'ver todos na Steam (' + ids.length + ')'));
      const load = button('carregar nomes', async () => {
        load.disabled = true; load.textContent = 'carregando…';
        let failures = 0;
        for (let index = 0; index < list.children.length; index += 3) {
          await Promise.all(Array.from(list.children).slice(index, index + 3).map(async (card, offset) => {
            try { const detail = await Catalog.details({ kind: 'game', catalogId: 'steam:' + ids[index + offset] }); if (detail.title) card.querySelector('span').textContent = detail.title; } catch { failures++; }
          }));
        }
        load.textContent = failures ? 'tentar nomes novamente' : 'nomes carregados'; load.disabled = !failures;
      });
      box.append(load);
    }
    if (!item.dlcIds?.length) section('DLCs e expansões', node('p', 'title-notice', 'A consulta não retornou DLCs para este título.'));
    if (item.packages?.length) {
      const list = node('ul', 'game-packages');
      for (const name of item.packages) list.append(node('li', '', plainText(name)));
      const box = section('edições e pacotes da loja', list); box.append(external(item.url, 'consultar disponibilidade e preços na Steam'));
    }
    if (item.requirementsMinimum || item.requirementsRecommended) {
      const body = node('div', 'game-requirements');
      for (const [title, value] of [['Mínimos', item.requirementsMinimum], ['Recomendados', item.requirementsRecommended]]) if (value) { const group = node('div'); group.append(node('h3', '', title), node('p', 'title-summary', plainText(value))); body.append(group); }
      section('requisitos · PC', body);
    }
    parent.append(node('p', 'title-notice', 'Dados da edição Steam.'));
  }
  async function route() {
    const hash = window.location.hash || "#perfil";
    searchPage.hidden = !hash.startsWith("#buscar");
    detailPage.hidden = !hash.startsWith("#titulo/");
    if (hash === lastRoute) return;
    lastRoute = hash;
    controller?.abort();
    const token = ++revision;
    run.disabled = false;
    let parts;
    try { parts = hash.slice(1).split("/").map(decodeURIComponent); }
    catch { detailPage.replaceChildren(node("p", "empty", "Endereço inválido.")); return; }
    if (parts[0] === "buscar") {
      retrySearch.hidden=true;status.dataset.state='idle';
      lastSearch = hash;
      const kind = Object.hasOwn(Collection.kinds, parts[1]) ? parts[1] : category.value;
      category.value = kind;
      updateContext(); context.value = ['song','author'].includes(parts[4]) ? parts[4] : ''; platform.value = (parts[5] || '').slice(0,80);
      provider.hidden = kind !== "game";
      provider.value = parts[3] === "igdb" ? "igdb" : "steam";
      if (!parts[2]) {
        status.textContent = "Busque um título e abra a página dele para ver mais informações.";
        return;
      }
      query.value = parts[2].slice(0, 120);
      results.setAttribute('aria-busy','true');
      status.dataset.state='loading';
      status.textContent = "Buscando em " + (kind === "game" && provider.value === "igdb" ? "IGDB" : Catalog.names[kind]) + "…";
      controller = new AbortController();
      const activeController = controller;
      const timer = setTimeout(() => activeController.abort(), 20000);
      run.disabled = true;
      try {
        let items = await Catalog.search(kind, query.value, { signal: activeController.signal, provider: provider.value, context: context.value });
        if (kind === 'game' && platform.value.trim()) {
          const needle = platform.value.trim().toLowerCase();
          const detailed = await Promise.all(items.map(async item => { try { return item.platforms?.length ? item : await Catalog.details(item,{ signal: activeController.signal }); } catch { return item; } }));
          items = detailed.filter(item => item.platforms?.some(value => String(value).toLowerCase().includes(needle)));
        }
        if (token !== revision) return;
        results.replaceChildren();
        status.textContent = items.length ? items.length + " resultados · clique para conhecer um título" : "Nenhum resultado. Tente outro nome.";
        status.dataset.state=items.length?'ready':'empty';
        const artistGroups=new Map();
        for (const item of items) {
          let resultParent=results;
          if(item.kind==='artist'){
            const key=item.title.normalize('NFKC').toLowerCase().trim();
            if(items.filter(row=>row.kind==='artist'&&row.title.normalize('NFKC').toLowerCase().trim()===key).length>1){
              if(!artistGroups.has(key)){const group=node('details','artist-result-group'),heading=node('summary','',item.title+' · artistas com este nome');group.append(heading);results.append(group);artistGroups.set(key,group);}
              resultParent=artistGroups.get(key);
            }
          }
          remember(item);
          const card = button("", () => open(item), "discover-card");
          card.append(cover(item.image, item.title, item.imageFallback, item.coverLayout, item.kind), node("strong", "", item.title), node("small", "", plainText(Catalog.describe(item))));
          resultParent.append(card);
        }
      } catch (error) {
        if (token === revision) {status.dataset.state='error';retrySearch.hidden=false;status.textContent = (error.name === "AbortError" ? "A busca demorou demais. Tente novamente." : error.message) + (results.children.length ? ' Os resultados anteriores foram mantidos.' : '');}
      } finally { clearTimeout(timer); if (token === revision) { run.disabled = false; results.setAttribute('aria-busy','false'); } }
    } else if (parts[0] === "titulo") {
      if (!Object.hasOwn(Collection.kinds, parts[1]) || !parts[2]) { detailPage.replaceChildren(node("p", "empty", "Título inválido.")); return; }
      const key = parts[1] + "/" + parts[2];
      const saved = CollectionActions.getItems().find(i => i.kind === parts[1] && (i.catalogId || "local:" + i.id) === parts[2]);
      const item = entries.get(key) || saved || { kind: parts[1], catalogId: parts[2], title: "", total: 0, unit: "itens" };
      if (parts[2].startsWith("local:") && !saved) { detailPage.replaceChildren(node("p", "empty", "Este item não está mais na coleção.")); return; }
      drawDetail(item, item.catalogId ? "Carregando informações…" : "");
      controller = new AbortController();
      const activeController = controller;
      const timer = setTimeout(() => activeController.abort(), 20000);
      try {
        const force = reloadDetail; reloadDetail = false;
        const detailed = await Catalog.details(item, { signal: activeController.signal, force });
        if (token !== revision) return;
        if (!detailed.title) throw Error("Título não encontrado no catálogo.");
        remember(detailed);
        drawDetail(detailed);
        detailPage.querySelector("h1").focus({ preventScroll: true });
        window.Navigation?.restore();
      } catch (error) {
        if (token === revision) drawDetail(item, "Não consegui carregar todas as informações. " + (item.title ? "Você ainda pode adicionar este título." : "Volte à busca e tente novamente."));
      } finally { clearTimeout(timer); }
    }
  }
  window.TitlePages = { open, route, refresh: () => { if (!detailPage.hidden && activeItem) drawDetail(activeItem); } };
  window.addEventListener("hashchange", route);
  route();
})();
