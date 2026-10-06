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
  const plainText = MusicPageUI.plainText;
  let hydratingRoute = '';
  const albumContexts=new Map();
  function appendAlbumContext(parent,item) {
    if(parent.querySelector('.album-context'))return;
    const album={kind:'album',catalogId:item.albumCatalogId,title:item.albumTitle||'álbum',source:item.source};
    if(!MusicModel.validCatalogId('album',album.catalogId))return;
    const host=node('section','game-detail-section album-context');host.hidden=true;parent.append(host);
    const route=location.hash;
    const known=item.albumContext?.catalogId===album.catalogId?item.albumContext:Catalog.peekCore(album);
    function render(detail,immediate=false){
      if((!immediate&&!host.isConnected)||location.hash!==route||!detail.albumTracks?.length)return;
      const tracks=detail.albumTracks;let index=tracks.findIndex(track=>MusicModel.sameItem(track,item));
      if(index<0){const matches=tracks.map((track,index)=>({index,rank:MusicModel.recordingMatch(track,item)})).filter(match=>match.rank>=2);if(matches.length===1)index=matches[0].index;}
      const start=Math.max(0,Math.min(index<0?0:index-2,tracks.length-5));
      host.append(node('h2','','em '+detail.title));const content=node('div','album-context-body');
      content.append(cover(detail.image,detail.title,detail.imageFallback,'horizontal','album'));
      const list=node('ol','music-tracklist');tracks.slice(start,start+5).forEach((track,offset)=>{const row=MusicPageUI.trackRow(track,start+offset,{artwork:false,context:false});if(start+offset===index){row.classList.add('is-current-track');row.setAttribute('aria-current','true');}list.append(row);});
      content.append(list);host.append(content,button('ver todas as faixas',()=>open(detail),'text-action'));host.hidden=false;host.classList.add('music-local-update');
    }
    if(known){render(known,true);return;}
    let task=albumContexts.get(album.catalogId);
    if(!task){task=Catalog.prefetchCore(album);albumContexts.set(album.catalogId,task);if(albumContexts.size>30)albumContexts.delete(albumContexts.keys().next().value);}
    task.then(detail=>{const top=window.scrollY;render(detail);if(host.isConnected)window.scrollTo({top,behavior:'instant'});}).catch(()=>{albumContexts.delete(album.catalogId);host.remove();});
  }
  function cover(src, title, fallback = "", layout = "vertical", kind = "", loading = false) {
    const frame = node("div", "title-cover");
    frame.dataset.layout = layout;
    frame.dataset.kind = kind;
    const placeholder = node("span", "", kind === 'artist' ? 'foto indisponível' : 'sem capa');
    if (loading) placeholder.hidden = true;
    frame.append(placeholder);
    if (safeUrl(src, true)) {
      const img = node("img");
      img.alt = title;
      img.loading = "lazy";
      placeholder.hidden = true;
      let usedFallback = false;
      const failed = () => {
        if (!usedFallback && safeUrl(fallback, true) && fallback !== src) {
          usedFallback = true;
          if (window.Artwork) Artwork.set(img, fallback, { error: failed });
          else img.src = fallback;
          return;
        }
        img.hidden = true; placeholder.hidden = false;
      };
      if (window.Artwork) Artwork.set(img, src, { error: failed });
      else { img.src = src; img.onerror = failed; }
      frame.append(img);
    }
    return frame;
  }
  const { imageGallery } = createTitleGallery({node,button,getDetailPage:()=>detailPage,drawDetail});
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
  const returnRoutes = new Map();

  let controller, revision = 0, lastRoute = "", lastSearch = "#buscar", returnRoute = "#buscar", activeItem, reloadDetail = false;
  const findSaved = (item) => CollectionActions.getItems().find(i =>
    window.MusicModel?.sameItem(i, item) || (item.catalogId ? i.catalogId === item.catalogId && i.kind === item.kind : i.id === item.id));
  function remember(item) {
    const key = item.kind + "/" + (item.catalogId || "local:" + item.id);
    const previous=entries.get(key);
    if(previous)for(const [field,value] of Object.entries(previous))if((item[field]===undefined||item[field]===null||item[field]==='')&&!(field==='releaseDate'&&item.albumCatalogId&&previous.albumCatalogId&&item.albumCatalogId!==previous.albumCatalogId))item[field]=value;
    if (!entries.has(key) && entries.size >= 60) entries.delete(entries.keys().next().value);
    entries.set(key, item);
    return key;
  }
  function go(hash, freshDetail = false) {
    window.Navigation?.capture(window.location.hash || '#perfil');
    if (window.location.hash !== hash) {
      // All surface owners synchronize in the same hashchange task, before paint.
      window.location.hash = hash;
      if (freshDetail) window.Navigation?.restore(hash, { top: true });
      return Promise.resolve();
    }
    if (freshDetail) window.Navigation?.restore(hash, { top: true });
    CollectionActions.applyRoute();
    return Promise.resolve(route()).then(()=>window.Navigation?.restore(hash));
  }
  function open(item) {
    const hash = window.location.hash;
    if (item.catalogId?.startsWith('ytmusic:') && window.MusicModel?.validCatalogId(item.kind,item.catalogId)) {
      const core = Catalog.peekCore(item);
      if (core) item = mergeRichest({ ...item }, core);
      else void Catalog.prefetchCore(item).catch(() => null);
    }
    if (!hash.startsWith("#titulo/")) returnRoute = hash.startsWith("#buscar") ? lastSearch : hash || "#colecao";
    const key = remember(item);
    const target="#titulo/" + item.kind + "/" + encodeURIComponent(key.slice(item.kind.length + 1));
    if(hash!==target){if(returnRoutes.size>=60)returnRoutes.delete(returnRoutes.keys().next().value);returnRoutes.set(target,hash||'#colecao');}
    return go(target, true);
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    if (query.value.trim().length < 2) { status.textContent = "Digite pelo menos 2 caracteres."; return; }
    lastRoute = "";
    const base = '#buscar/' + category.value + '/' + encodeURIComponent(query.value.trim());
    const extra = context.value || (!platform.hidden && platform.value.trim());
    return go(
      base +
        (extra
          ? "/" +
            provider.value +
            "/" +
            encodeURIComponent(context.value) +
            "/" +
            encodeURIComponent(platform.hidden ? "" : platform.value.trim())
          : category.value === "game" && provider.value === "igdb"
            ? "/igdb"
            : ""),
    );
  };
  function collectionActions(item) {
    const actions = node("div", "title-actions");
    const saved=findSaved(item);let chosenCover='';try{chosenCover=localStorage.getItem('myspace.titleCover:'+item.catalogId)||'';}catch{}
    const add = button(saved ? "editar na coleção" : "＋ adicionar à coleção", () => {
      const current = findSaved(item);
      if(!current&&['music','album','artist'].includes(item.kind)){CollectionActions.quickAdd(item);return;}
      CollectionActions.editItem(
        current
          ? { ...current, ...(chosenCover ? { image: chosenCover } : {}) }
          : {
              ...item,
              catalogImage: item.verticalImage || item.image || "",
              status: "planned",
              progress: 0,
              score: null,
            },
      );
    }, "primary");
    add.disabled = !item.title;
    actions.append(add);
    if(item.kind==='music'&&item.playbackSource)actions.append(MusicBridge.playlistButton(item));
    if(['music','album'].includes(item.kind)){
      const complete=button(saved?.status==='done'?'concluído ✓':'concluir ✓',()=>CollectionActions.updateItem(saved.id,{status:'done',progress:saved.total||saved.progress,finishedAt:saved.finishedAt||new Date().toLocaleDateString('sv-SE')}),'small title-complete');
      complete.disabled=!saved||saved.status==='done';complete.style.visibility=saved?'visible':'hidden';actions.append(complete);
    }
    if (saved) {
      if (saved.status !== 'done'&&!['music','album'].includes(item.kind)) actions.append(button('concluir ✓', () => {
        CollectionActions.updateItem(saved.id, { status: 'done', progress: saved.total || saved.progress, finishedAt: saved.finishedAt || new Date().toLocaleDateString('sv-SE') }); patchCollectionState();
      }, 'small title-complete'));
      if (item.kind !== 'artist') actions.append(button(saved.featured ? '★ favorito' : '☆ favoritar', () => {
        try { CollectionActions.updateItem(saved.id, { featured: !saved.featured }); patchCollectionState(); } catch (error) { toast(error.message); }
      }, 'small title-favorite'));
    }
    if(!saved&&['music','album'].includes(item.kind))actions.append(button('☆ favoritar',()=>{try{const value=CollectionActions.quickAdd(item);CollectionActions.updateItem(value.id,{featured:true});}catch(error){toast(error.message);}},'small title-favorite'));
    if (item.kind === 'artist') actions.append(button(saved?.featured ? '★ artista favorito' : '☆ favoritar artista', () => {
      try { CollectionActions.favoriteArtist(item); } catch (error) { toast(error.message); }
    }));
    const personal=node("span","title-personal-status",saved?Collection.statuses[saved.status]:"");personal.setAttribute("aria-label",saved?"Na sua coleção":"");actions.append(personal);
    if (safeUrl(item.url)) {
      const credit = node("a", "catalog-credit", "ver em " + (item.source || "fonte"));
      credit.href = item.url;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      actions.append(credit);
    }
    return actions;
  }
  function patchCollectionState() {
    if(detailPage.hidden||!activeItem)return;
    const top=scrollY,actions=detailPage.querySelector('.title-actions');
    if(actions){const focused=[...actions.children].indexOf(document.activeElement);const next=collectionActions(activeItem);actions.replaceChildren(...next.childNodes);if(focused>=0){const target=actions.children[focused];(target?.disabled?actions.querySelector('button'):target)?.focus({preventScroll:true});}}
    // Personal state is independent of catalog hydration and the playback tree.
    const existing=detailPage.querySelector('[data-personal-tracking]');
    existing?.remove();appendPersonalTracking(detailPage.querySelector('.title-about'),findSaved(activeItem));
    const discovered=detailPage.querySelector('[data-collection-genre-matches]');
    detailPage.querySelector('[data-title-discovery]')?.patchCollectionState?.();
    if(discovered)patchCollectionGenreMatches(discovered,activeItem);
    window.scrollTo({top,behavior:'instant'});
  }
  function appendPersonalTracking(parent,saved) {
    if(!saved||!(saved.notes||saved.score!=null||saved.startedAt||saved.finishedAt||saved.progress>0||saved.lists?.length||saved.status!=='planned'))return;
    const section=node('section','game-detail-section');section.dataset.personalTracking='';section.append(node('h2','','meu acompanhamento'));
    const values=[saved.score!=null?'Minha nota: '+saved.score+'/10':'',saved.startedAt?'Início: '+saved.startedAt:'',saved.finishedAt?'Conclusão: '+saved.finishedAt:''].filter(Boolean);
    if(values.length)section.append(node('p','title-notice',values.join(' · ')));
    if(saved.progress>0)section.append(node('p','title-notice',saved.progress+(saved.total?' / '+saved.total:'')+' '+(saved.unit||'itens')));
    if(saved.lists?.length)section.append(node('p','personal-lists',saved.lists.join(' · ')));
    if(saved.notes)section.append(node('p','title-summary personal-notes',saved.notes));parent.append(section);
  }
  function drawDetail(item, message = "", { hydrating = hydratingRoute === location.hash } = {}) {
    const previousCover=detailPage.querySelector('.title-cover-column > .title-cover');
    const previousIdentity=activeItem?.catalogId || activeItem?.id;
    const sameDetail = previousIdentity && previousIdentity === (item.catalogId || item.id);
    const previousDiscovery = sameDetail ? detailPage.querySelector('[data-title-discovery]') : null;
    const discoveryTop = !hydrating && previousDiscovery?.dataset.started === 'true' ? previousDiscovery.getBoundingClientRect().top : null;
    const savedCover=findSaved(item);if(savedCover?.image&&['music','album'].includes(item.kind))item={...item,image:savedCover.image};
    let chosenCover = ''; try { chosenCover = localStorage.getItem('myspace.titleCover:' + item.catalogId) || ''; } catch {}
    if (safeUrl(chosenCover, true)) item = { ...item, image: chosenCover };
    activeItem = item;
    detailPage.replaceChildren();
    const toolbar = node("div", "section-head");
    toolbar.append(button("← voltar", () => returnRoutes.has(window.location.hash) ? window.history.back() : go(returnRoute)));
    if (!['music','album'].includes(item.kind)) toolbar.append(button('editar banner', () => TitleBanner.edit(item, () => drawDetail(item))));
    if (item.source === 'IGDB') toolbar.append(button('restaurar banner do catálogo', () => { try { TitleBanner.reset(item); } catch {} drawDetail(item); }));
    const layout = node("div", "title-layout");
    const saved = findSaved(item);
    const info = node("div", "title-information");
    const heading = node("h1", "", item.title || "Título");
    detailPage.dataset.kind = item.kind;
    heading.tabIndex = -1;
    info.append(node("span", "title-kind", releaseLabel(item)), heading);
    if (['music','album','artist'].includes(item.kind)) {
      const metadata=node('p','title-metadata title-primary-metadata');
      metadata.dataset.identity=[item.artistCatalogId,item.albumCatalogId].join('|');
      if(item.kind!=='artist'&&item.artist)metadata.append(MusicPageUI.contextLink(item.artist,'artist',item.artistCatalogId));
      if(item.kind==='music'&&item.albumTitle){if(metadata.childNodes.length)metadata.append(document.createTextNode(' · '));metadata.append(MusicPageUI.contextLink(item.albumTitle,'album',item.albumCatalogId));}
      if(item.kind==='artist'&&item.subscriberText)metadata.textContent=item.subscriberText+(/^[\d.,]+\s*[KM]?$/i.test(item.subscriberText)?' inscritos':'');
      if(item.kind==='album'&&item.releaseDate)metadata.append(document.createTextNode((metadata.childNodes.length?' · ':'')+item.releaseDate));
      if(metadata.childNodes.length)info.append(metadata);
      if(item.kind==='music'){const timing=[item.releaseDate,MusicPageUI.clock(item.trackDuration)].filter(Boolean).join(' · ');info.append(node('p','title-metadata title-timing',timing));}
    } else if (item.description) info.append(node("p", "title-metadata", plainText(item.description)));
    if (item.platforms?.length) info.append(node("p", "title-metadata", item.platforms.join(" · ")));
    if (item.genres?.length) {
      const genres = node("div", "title-genres");
      for (const genre of item.genres.slice(0, 8)) genres.append(['music','album','artist'].includes(item.kind)?MusicPageUI.tagLink(genre):node("span", "", plainText(genre)));
      info.append(genres);
    }
    info.append(collectionActions(item));
    if (item.total) info.append(node("p", "title-metadata title-total", item.total + " " + item.unit));
    const coverColumn = node('div', 'title-cover-column');
    const savedBanner = item.kind === 'artist' && /^https:\/\/(?:lh3|yt3)\.googleusercontent\.com\//.test(saved?.image || '') && /\=w(\d+)-h(\d+)/.test(saved.image) && (() => { const [,w,h]=saved.image.match(/=w(\d+)-h(\d+)/); return w!==h && (!saved.catalogImage || saved.catalogImage===saved.image); })();
    const imageSource=chosenCover || (savedBanner ? item.image : saved ? saved.image : item.image);
    const existingImage=previousCover?.querySelector('img');
    coverColumn.append(previousIdentity===(item.catalogId||item.id)&&existingImage&&existingImage.dataset.artworkSource===imageSource&&existingImage.dataset.artworkState!=='error'
      ?previousCover:cover(imageSource, item.title, item.imageFallback, saved?.coverLayout || item.coverLayout, item.kind, message === 'Carregando informações…'));
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
    const editorialHost=musical?node('div','music-editorial'):about;
    if(musical){editorialHost.dataset.summary=String(item.summary||'');about.append(editorialHost);}
    appendEditorial(editorialHost,item,message);
    if (item.kind === "game" && item.source === "Steam") appendGameSections(about, item);
    else appendMediaSections(about, item);
    if (item.kind === 'game' && item.source === 'IGDB') appendIgdbSections(about, item);
    if (!hydrating && ['game','book','music','album','artist'].includes(item.kind)) {
      if (previousDiscovery) about.append(previousDiscovery);
      else appendDiscovery(about, item);
    }
    if (['music','album','artist'].includes(item.kind)) appendMusicDetails(about, item);
    if (item.kind === 'artist') appendArtistSections(about, item);
    appendPersonalTracking(about,saved);
    if(item.kind==='artist') {
      const editorial=node('div','artist-editorial');
      for(const child of [...about.children]) {if(child.tagName==='SECTION')break;editorial.append(child);}
      const facts=[...about.querySelectorAll('section')].find(section=>section.querySelector('h2')?.textContent==='informações');
      if(editorial.querySelector('#titleSynopsis')&&facts){const columns=node('div','artist-editorial-columns');columns.append(editorial,facts);about.prepend(columns);}else if(editorial.childNodes.length)about.prepend(editorial);
    }
    if(!hydrating&&item.kind==='music'&&item.albumCatalogId)appendAlbumContext(about,item);
    organizeSections(about);
    const bannerSettings = TitleBanner.get(item); const customBanner = bannerSettings.image;
    const banner = ['music','album'].includes(item.kind) ? '' : safeUrl(customBanner || item.bannerImage, true);
    detailPage.classList.toggle('has-title-banner',!!banner);
    if (banner) {
      const hero = node('div', 'title-banner');
      hero.dataset.kind = item.kind;
      const image = node('img'); image.src = Artwork.url(banner); image.alt = ''; image.loading = 'lazy';
      TitleBanner.apply(hero, image, bannerSettings);
      image.onload = () => {
        if (!customBanner && item.kind === 'game' && image.naturalWidth <= image.naturalHeight) {
          hero.classList.add('banner-portrait');
        }
      };
      image.onerror = () => {
        detailPage.classList.remove('has-title-banner');if(item.kind==='artist'&&!customBanner){hero.remove();return;}
        image.hidden = true;
        hero.classList.add('banner-unavailable');
        hero.setAttribute('aria-label', 'Banner indisponível');
      };
      hero.append(image);
      detailPage.append(toolbar, hero, layout, about);
    } else detailPage.append(toolbar, layout, about);
    // Keep the section the user is reading anchored as late metadata expands above it.
    if (discoveryTop !== null) window.scrollBy({ top: previousDiscovery.getBoundingClientRect().top - discoveryTop, behavior: 'instant' });
  }
  function appendEditorial(about,item,message=''){
    const musical=['music','album','artist'].includes(item.kind);
    const emptySummary = 'Este catálogo não disponibilizou um resumo para este título.';
    const summaryText = node('p', 'title-summary', plainText(item.summary) || emptySummary);
    const reading = node('div','summary-reading'); const readMore = button('ler mais ↓', () => {
      const expanded = readMore.getAttribute('aria-expanded') !== 'true';
      readMore.setAttribute("aria-expanded", String(expanded));
      reading.classList.toggle("expanded", expanded);
      readMore.textContent = expanded ? "recolher ↑" : "ler mais ↓";
      if (!expanded) reading.scrollIntoView({ block: "start", behavior: "instant" });
    }, 'summary-read-more text-action');
    function updateSummary(text) {
      summaryText.textContent = text;
      readMore.hidden = text.length <= 700;
      reading.classList.toggle("short", readMore.hidden);
      reading.classList.remove("expanded");
      readMore.setAttribute("aria-expanded", "false");
      readMore.textContent = "ler mais ↓";
    }
    summaryText.id='titleSynopsis';readMore.setAttribute('aria-controls',summaryText.id);
    updateSummary(summaryText.textContent);reading.append(summaryText,readMore);
    if (!musical || plainText(item.summary)) about.append(node('h2','',item.kind==='artist'?'biografia':item.kind==='book'?'sinopse':'sobre'),reading);
    if (!message && plainText(item.summary)) {
      const translation = node("details", "translation-options");
      translation.append(node("summary", "", "traduzir descrição"));
      const languages = node("div", "summary-language");
      const progress = node("span", "title-notice");
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
    if (message && !(musical&&item.catalogId?.startsWith('ytmusic:')&&item.title&&message.startsWith('Carregando'))) {
      const notice = node("p", "title-notice", message);
      notice.setAttribute("role", "status");
      about.append(notice);
      if (!message.startsWith('Carregando')) about.append(button('tentar carregar novamente', () => { reloadDetail = true; lastRoute = ''; return route(); }));
    }
  }
  function mergeRichest(current,incoming){
    for(const [field,value] of Object.entries(incoming))if(value!==undefined&&value!==null&&value!==''&&(!Array.isArray(value)||value.length||!current[field]))current[field]=value;
    return current;
  }
  function patchMusicEnrichment(incoming){
    const secondary=new Set(['summary','summarySource','summaryStatus','genres','genresSource','isrc','isrcSource','isrcRecordingId','isrcLookupVersion','listeners','playcount']);
    const top=window.scrollY,item=mergeRichest(activeItem,Object.fromEntries(Object.entries(incoming).filter(([field])=>secondary.has(field))));remember(item);
    const info=detailPage.querySelector('.title-information');
    if(item.genres?.length){
      let genres=info.querySelector('.title-genres');
      if(!genres){genres=node('div','title-genres');info.insertBefore(genres,info.querySelector('.title-actions'));}
      if(genres.textContent!==item.genres.slice(0,8).join(''))genres.replaceChildren(...item.genres.slice(0,8).map(MusicPageUI.tagLink));
    }
    const host=detailPage.querySelector('.music-editorial');
    if(host&&host.dataset.summary!==String(item.summary||'')){
      host.dataset.summary=String(item.summary||'');host.replaceChildren();appendEditorial(host,item);host.classList.add('music-local-update');
    }
    const provenance=detailPage.querySelector('.title-provenance');
    if(provenance)provenance.textContent='Dados do catálogo: '+(item.source||'seu cadastro')+'.'+(plainText(item.summary)&&item.summarySource?' Descrição: '+item.summarySource+'.':'');
    const explore=detailPage.querySelector('[data-music-explore]');if(explore&&item.genres?.length)explore.textContent='buscar por '+item.genres[0];
    if(item.kind==='artist'&&(item.listeners||item.playcount)){
      let section=detailPage.querySelector('[data-music-details]');
      if(!section){const fragment=document.createDocumentFragment();appendMusicDetails(fragment,item);section=fragment.querySelector('[data-music-details]');if(section){const about=detailPage.querySelector('.title-about');about.insertBefore(section,about.querySelector('section'));}}
      if(section){let stats=section.querySelector('.music-stats');if(!stats){stats=node('dl','music-detail-metadata music-stats');section.append(stats);}stats.replaceChildren();for(const [label,value] of [['ouvintes',item.listeners],['reproduções',item.playcount]])if(value)stats.append(node('dt','',label),node('dd','',value));}
      const editorial=detailPage.querySelector('.artist-editorial');
      if(editorial?.querySelector('#titleSynopsis')&&section&&!detailPage.querySelector('.artist-editorial-columns')){const columns=node('div','artist-editorial-columns');editorial.before(columns);columns.append(editorial,section);}
    }
    const collectionSection=detailPage.querySelector('[data-collection-genre-matches]');if(collectionSection)patchCollectionGenreMatches(collectionSection,item);
    window.scrollTo({top,behavior:'instant'});
  }
  function patchMusicalCore(incoming){
    let chosen='';try{chosen=localStorage.getItem('myspace.titleCover:'+activeItem.catalogId)||'';}catch{}
    const previousImage=activeItem.image,keepCover=!!findSaved(activeItem)?.image||!!safeUrl(chosen,true);
    const top=window.scrollY,item=mergeRichest(activeItem,incoming);if(keepCover)item.image=previousImage;remember(item);
    detailPage.querySelector('h1').textContent=item.title;
    const timing=detailPage.querySelector('.title-timing');if(timing)timing.textContent=[item.releaseDate,MusicPageUI.clock(item.trackDuration)].filter(Boolean).join(' · ');
    detailPage.querySelector('.title-kind').textContent=releaseLabel(item);
    const info=detailPage.querySelector('.title-information');
    let metadata=info.querySelector('.title-primary-metadata');
    if(!metadata){metadata=node('p','title-metadata title-primary-metadata');info.querySelector('h1').after(metadata);}
    const expected=item.kind==='artist'?item.subscriberText||'':[item.artist,item.kind==='music'?item.albumTitle:item.releaseDate].filter(Boolean).join(' · ');
    const identity=[item.artistCatalogId,item.albumCatalogId].join('|');
    if(metadata.textContent!==expected||metadata.dataset.identity!==identity){
      metadata.dataset.identity=identity;metadata.replaceChildren();
      if(item.kind==='artist')metadata.textContent=expected;
      else {if(item.artist)metadata.append(MusicPageUI.contextLink(item.artist,'artist',item.artistCatalogId));
      if(item.kind==='music'&&item.albumTitle){if(metadata.childNodes.length)metadata.append(document.createTextNode(' · '));metadata.append(MusicPageUI.contextLink(item.albumTitle,'album',item.albumCatalogId));}
      if(item.kind==='album'&&item.releaseDate)metadata.append(document.createTextNode((metadata.childNodes.length?' · ':'')+item.releaseDate));}
    }
    const img=detailPage.querySelector('.title-cover-column img');if(img&&item.image&&img.dataset.artworkSource!==item.image&&!findSaved(item)?.image)Artwork.set(img,item.image);
    if(!img&&item.image){const frame=detailPage.querySelector('.title-cover-column .title-cover');if(frame){const filled=cover(item.image,item.title,item.imageFallback,item.coverLayout||'vertical',item.kind);frame.replaceChildren(...filled.childNodes);}}
    const section=detailPage.querySelector('[data-music-details]');
    if(section){
      let facts=section.querySelector('.music-detail-metadata');
      if(!facts){facts=node('dl','music-detail-metadata');section.append(facts);}
      let previous;
      for(const [label,value] of [['artista',item.kind==='artist'?'':item.artist],['álbum',item.kind==='music'?item.albumTitle:''],['lançamento',item.releaseDate],['tipo',item.kind==='album'?releaseLabel(item):''],['duração',MusicPageUI.clock(item.trackDuration)],['fonte',item.kind==='artist'?'':item.source]])if(value){
        let term=Array.from(facts.children).find(child=>child.tagName==='DT'&&child.textContent===label);
        if(!term){term=node('dt','',label);const definition=node('dd','',value);const next=previous?previous.nextSibling:facts.firstChild;facts.insertBefore(term,next);facts.insertBefore(definition,next);}
        else if(term.nextElementSibling.textContent!==String(value))term.nextElementSibling.textContent=value;
        previous=term.nextElementSibling;
      }
    }
    const about=detailPage.querySelector('.title-about');
    const fragment=document.createDocumentFragment();appendMusicDetails(fragment,item);
    for(const candidate of [...fragment.children]){
      if(candidate.hasAttribute('data-music-details')){
        const existing=about.querySelector('[data-music-details]');
        if(!existing)about.prepend(candidate);
        else for(const link of [...candidate.querySelectorAll(':scope > button')])if(![...existing.querySelectorAll(':scope > button')].some(b=>b.textContent===link.textContent))existing.insertBefore(link,existing.querySelector('dl'));
      }else if(item.kind==='album'&&candidate.dataset.albumTracklist!==undefined){const existing=about.querySelector('[data-album-tracklist]');if(!existing){candidate.classList.add('music-local-update');about.append(candidate);}else if(existing.dataset.content!==candidate.dataset.content){existing.querySelector('.music-tracklist').replaceWith(candidate.querySelector('.music-tracklist'));existing.dataset.content=candidate.dataset.content;}}
    }
    if(item.total){let total=info.querySelector('.title-total');if(!total){total=node('p','title-metadata title-total');info.append(total);}total.textContent=item.total+' '+(item.unit||'faixas');}
    if(item.kind==='artist'){
      const sections=document.createDocumentFragment();appendArtistSections(sections,item);
      for(const candidate of [...sections.children]){const label=candidate.querySelector('h2')?.textContent;const existing=[...about.querySelectorAll(':scope > section')].find(s=>s.querySelector('h2')?.textContent===label);if(!existing){candidate.classList.add('music-local-update');about.append(candidate);}else if(label==='discografia')existing.updateReleases?.(item.topAlbums,item.discographyNext);else if(label==='músicas populares'&&existing.dataset.content!==candidate.dataset.content){existing.querySelector('.music-tracklist').replaceWith(candidate.querySelector('.music-tracklist'));existing.dataset.content=candidate.dataset.content;}}
      const settings=TitleBanner.get(item),banner=safeUrl(settings.image||item.bannerImage,true);
      if(banner&&!detailPage.querySelector('.title-banner')){const hero=node('div','title-banner music-local-update'),image=node('img');hero.dataset.kind='artist';image.alt='';image.src=Artwork.url(banner);TitleBanner.apply(hero,image,settings);image.onerror=()=>{hero.remove();detailPage.classList.remove('has-title-banner');};hero.append(image);layoutInsert(hero);detailPage.classList.add('has-title-banner');}
    }
    if(!about.querySelector('[data-title-discovery]'))appendDiscovery(about,item);
    if(item.kind==='music'&&item.albumCatalogId)appendAlbumContext(about,item);
    organizeSections(about);detailPage.setAttribute('aria-busy','false');window.scrollTo({top,behavior:'instant'});
  }
  const releaseLabel=item=>item.kind==='album'?({single:'Single',ep:'EP'}[item.albumType]||'Álbum'):Collection.kinds[item.kind];
  function layoutInsert(node){detailPage.querySelector('.title-layout').before(node);}
  function patchMusicCore(incoming){patchMusicalCore(incoming);}
  function patchAlbumCore(incoming){patchMusicalCore(incoming);}
  function patchArtistCore(incoming){patchMusicalCore(incoming);}
  function organizeSections(parent) {
    const folded = new Set([
      "ficha do jogo",
      "ficha da obra",
      "recursos",
      "artworks e key art",
      "screenshots",
      "imagens",
      "trailers e vídeos",
      "conteúdo relacionado",
      "obras relacionadas",
      "personagens",
      "requisitos mínimos",
      "requisitos recomendados",
      "DLCs e expansões",
      "edições e pacotes da loja",
      "explorar mais títulos",
    ]);
    const sections = Array.from(parent.children).filter(child => child.tagName.toLowerCase() === 'section');
    const label = section => section.querySelector('h2')?.textContent || '';
    const rank = section => section.hasAttribute('data-collection-genre-matches') ? 1.5 : label(section).startsWith('para descobrir') || label(section)==='artistas similares' ? 1 : /^(artworks|screenshots|imagens|trailers|requisitos)/.test(label(section)) ? 3 : folded.has(label(section)) ? 2 : 0;
    const ordered=sections.sort((a,b)=>rank(a)-rank(b));
    for (const section of ordered) {
      const title = label(section);
      if ((folded.has(title) || title.startsWith('requisitos'))&&!section.querySelector(':scope > .title-fold')) {
        const heading = section.querySelector('h2');
        const fold = node('details', 'title-fold'); const summary = node('summary');
        const body = node('div', 'title-fold-body');
        for (const child of Array.from(section.children)) if (child !== heading) body.append(child);
        summary.append(heading); fold.append(summary, body); section.replaceChildren(fold);
        fold.ontoggle = () => { if(fold.open) for(const image of body.querySelectorAll('img')) if(image.dataset.deferredSrc) {image.src=image.dataset.deferredSrc;delete image.dataset.deferredSrc;} };
      }
    }
    // Avoid detaching focused controls when the section order is already correct.
    const current=[...parent.children].filter(child=>child.tagName==='SECTION');
    if(current.some((section,index)=>section!==ordered[index])){
      const focused=document.activeElement;
      for(let index=0;index<ordered.length;index++){const siblings=[...parent.children].filter(child=>child.tagName==='SECTION');if(siblings[index]!==ordered[index])parent.insertBefore(ordered[index],siblings[index]||null);}
      if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
    }
  }
  function appendMusicalDiscovery(parent,item) {
    const section=node('section','game-detail-section'),grid=node(item.kind==='music'?'ol':'div',item.kind==='music'?'music-tracklist discovery-grid':'media-related-grid discovery-grid');
    section.dataset.titleDiscovery='';
    const status=node('p','title-notice'),basis=node('p','title-notice',item.kind==='music'?'Rádio da faixa no YouTube Music.':item.kind==='album'?({single:'Singles relacionados.',ep:'EPs relacionados.'}[item.albumType]||'Álbuns relacionados.'):'');
    const key=MusicPageUI.recommendationKey;
    let pool=[],visible=[],seen=new Set(),rotation=0,partial=false;
    const saved=entry=>CollectionActions.getItems().some(row=>MusicModel.sameWork(row,entry)||MusicModel.sameItem(row,entry));
    const patchSaved=(element,entry)=>{
      let badge=element.querySelector('.recommendation-saved');
      if(saved(entry)&&!badge){badge=node('small','recommendation-saved','✓ na coleção');(entry.kind==='music'?element.querySelector('.music-track-title'):element).append(badge);}
      if(badge)badge.hidden=!saved(entry);
    };
    function render(){
      const old=new Map([...grid.children].map(element=>[element.dataset.catalogId,element])),retained=new Set();
      const focused=grid.contains(document.activeElement)?document.activeElement:null;
      visible.forEach((entry,index)=>{
        let element=old.get(entry.catalogId);
        if(!element){
          if(entry.kind==='music')element=MusicPageUI.trackRow(entry,index);
          else {element=button('',()=>open(entry),'discover-card');element.dataset.kind=entry.kind;
            element.append(cover(entry.image,entry.title,entry.imageFallback,entry.coverLayout,entry.kind),node('strong','',entry.title));
            if(entry.kind==='album')element.append(node('small','',[{album:'Álbum',ep:'EP',single:'Single'}[entry.albumType],entry.releaseDate?.slice(0,4)].filter(Boolean).join(' · ')));
            Catalog.intentCore(element,entry);
          }
          element.dataset.catalogId=entry.catalogId;
        }
        patchSaved(element,entry);const number=element.querySelector('.music-track-number');if(number)number.textContent=String(index+1).padStart(2,'0');
        retained.add(element);if(grid.children[index]!==element)grid.insertBefore(element,grid.children[index]||null);
      });
      for(const element of old.values())if(!retained.has(element))element.remove();
      if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});else if(focused&&!focused.isConnected)load.focus({preventScroll:true});
      status.textContent=partial?'Algumas sugestões ainda estão pendentes. Os resultados disponíveis foram mantidos.':visible.length?'':'Não há recomendações disponíveis para este título agora.';
      load.textContent=partial?'tentar novamente':'ver outras recomendações';
    }
    const merge=entries=>{
      const ids=new Set([item.catalogId]);const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().trim();
      let own=0;
      pool=[...pool,...entries].filter(entry=>{
        if(!entry.catalogId||ids.has(entry.catalogId)||entry.kind!==item.kind||item.kind==='album'&&item.albumType&&entry.albumType&&entry.albumType!==item.albumType)return false;
        ids.add(entry.catalogId);
        const same=item.kind!=='artist'&&(item.artistCatalogId&&entry.artistCatalogId?item.artistCatalogId===entry.artistCatalogId:!!item.artist&&normalize(item.artist)===normalize(entry.artist));
        return !same||++own<=2;
      }).slice(0,48);
    };
    const load=button('ver outras recomendações',async()=>{
      const route=location.hash,started=section.dataset.started==='true';section.dataset.started='true';
      load.disabled=true;section.setAttribute('aria-busy','true');
      try {
        // Rotation consumes unseen reserve before consulting deterministic providers again.
        const nextWindow=MusicPageUI.recommendationWindow(pool,{saved:CollectionActions.getItems(),visible,seen,rotate:true,rotation:rotation+1});
        const reserve=nextWindow.filter(entry=>!seen.has(key(entry))).length;
        if(!started||reserve<6){
          status.textContent='Buscando sugestões…';
          const fresh=await Catalog.recommendations(item,{force:started,localPool:true});
          if(!section.isConnected||location.hash!==route)return;
          partial=!!fresh.resolution?.failures;merge(fresh);
        }
        if(started)rotation++;
        visible=MusicPageUI.recommendationWindow(pool,{saved:CollectionActions.getItems(),visible,seen,rotate:started,rotation});
        visible.forEach(entry=>seen.add(key(entry)));render();
      }catch(error){console.warn('Recommendations unavailable',error);status.textContent=pool.length?'Os resultados foram mantidos. Tente novamente.':'Não foi possível carregar recomendações agora.';load.textContent='tentar novamente';}
      finally{load.hidden=false;load.disabled=false;section.setAttribute('aria-busy','false');}
    },'text-action');
    section.patchCollectionState=()=>{for(const entry of visible){const element=[...grid.children].find(row=>row.dataset.catalogId===entry.catalogId);if(element)patchSaved(element,entry);}};
    const heading=node('div','discovery-heading');heading.append(node('h2','',item.kind==='artist'?'artistas similares':'para descobrir'),load);load.hidden=true;section.append(heading,basis,status,grid);parent.append(section);
    if(window.IntersectionObserver){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&section.isConnected&&section.dataset.started!=='true'){observer.disconnect();load.click();}},{rootMargin:'200px'});observer.observe(section);window.addEventListener('hashchange',()=>observer.disconnect(),{once:true});}
    else requestAnimationFrame(()=>{if(section.isConnected&&section.dataset.started!=='true')load.click();});
  }
  function appendDiscovery(parent, item) {
    if(['music','album','artist'].includes(item.kind))return appendMusicalDiscovery(parent,item);
    const section = node('section', 'game-detail-section'); const grid = node(item.kind==='music'?'ol':'div', item.kind==='music'?'music-tracklist':'media-related-grid');
    section.dataset.titleDiscovery = '';
    grid.classList.add('discovery-grid');
    section.append(
      node("h2", "", item.kind==='artist'?'artistas similares':"para descobrir"),
      node(
        "p",
        "title-notice",
        ["music", "album", "artist"].includes(item.kind)
          ? item.kind === "artist"
            ? item.catalogId?.startsWith('ytmusic:artist:') ? "" : "Artistas similares no Last.fm."
            : item.kind === "album"
              ? item.catalogId?.startsWith('ytmusic:album:') ? ({single:'Singles relacionados.',ep:'EPs relacionados.',album:'Álbuns relacionados.'}[item.albumType] || 'Lançamentos relacionados.') : "Álbuns de artistas similares no Last.fm."
              : item.catalogId?.startsWith('ytmusic:video:') || item.playbackSource?.videoId ? "Rádio da faixa no YouTube Music." : "Faixas similares no Last.fm."
          : item.kind === "book"
            ? "Livros do mesmo assunto na Open Library. Títulos da sua coleção são omitidos."
            : "Jogos similares · " + (item.source || "catálogo") + ". Sugestões novas para sua coleção.",
      ),
    );
    const status = node('p', 'title-notice');
    const load = button('atualizar', async () => {
      const force=section.dataset.started==='true';
      section.dataset.started = 'true';
      const route=location.hash;
      load.disabled = true; section.setAttribute('aria-busy','true'); status.textContent = 'Buscando novas sugestões…';
      try {
        let entries = await Catalog.recommendations(item,{force});
        const eligible = (entry) =>
          entry.catalogId !== item.catalogId &&
          !CollectionActions.getItems().some(
            (saved) =>
              window.MusicModel?.sameWork(saved, entry) ||
              (saved.kind === entry.kind && saved.catalogId === entry.catalogId),
          );
        const renderEntries=()=>{
        if(!section.isConnected||location.hash!==route)return;
        const basis = section.querySelector("p.title-notice");
        if (entries.seedTitle)
          basis.textContent =
            "Faixas similares a “" +
            entries.seedTitle +
            "” no Last.fm · a versão masterizada não retornou sugestões.";
        const existingCards=new Map([...grid.children].map(card=>[card.dataset.catalogId,card]));
        const retained=new Set();
        const focused=grid.contains(document.activeElement)?document.activeElement:null;
        const place=card=>{
          const target=grid.children[retained.size-1];
          if(target!==card)grid.insertBefore(card,target||null);
        };
        for (const entry of entries.filter(eligible).slice(0, 12)) {
          if(item.kind==='music'&&entry.kind==='music'){
            const row=existingCards.get(entry.catalogId)||MusicPageUI.trackRow(entry,retained.size);
            row.dataset.catalogId=entry.catalogId;retained.add(row);
            const number=row.querySelector('.music-track-number');if(number)number.textContent=String(retained.size).padStart(2,'0');
            place(row);continue;
          }
          const card=existingCards.get(entry.catalogId)||button('',()=>open(entry),'discover-card');
          if (!existingCards.has(entry.catalogId)) {
            Catalog.intentCore(card,entry);
            card.dataset.catalogId = entry.catalogId;card.dataset.kind=entry.kind;
            card.append(
              cover(entry.image, entry.title, entry.imageFallback, entry.coverLayout, entry.kind),
              node("strong", "", entry.title),
            );
          }
          if (card.dataset.artwork !== (entry.image || "")) {
            card.querySelector(".title-cover")?.remove();
            card.prepend(cover(entry.image, entry.title, entry.imageFallback, entry.coverLayout, entry.kind));
            card.dataset.artwork = entry.image || "";
          }
          retained.add(card);place(card);
        }
        if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
        for(const card of existingCards.values())if(!retained.has(card)&&(!entries.resolution?.failures||findSaved({kind:card.dataset.kind||'music',catalogId:card.dataset.catalogId})))card.remove();
        status.classList.toggle('recommendations-partial',!!entries.resolution?.failures&&!!grid.children.length);
        status.textContent = entries.resolution?.failures
          ? grid.children.length
            ? "Algumas sugestões ainda estão pendentes. Tentar novamente mantém os resultados abaixo."
            : "Parte das sugestões não pôde ser consultada no catálogo. Tente novamente."
          : grid.children.length
            ? ""
            : entries.resolution?.status === "unmatched"
              ? "As sugestões não tiveram correspondência única no catálogo YouTube Music."
              : entries.length
                ? "As sugestões disponíveis já estão na sua coleção."
                : "Não há recomendações disponíveis para este título agora.";
        load.textContent=entries.resolution?.failures?'tentar novamente':entries.reserveAvailable?'carregar mais recomendações':'atualizar recomendações';
        };
        section.patchCollectionState=renderEntries;
        renderEntries();
        for (
          let batch = 0;
          batch < 7 &&
          section.isConnected &&
          location.hash === route &&
          entries.reserveAvailable &&
          !entries.resolution?.failures &&
          entries.filter(eligible).length < 12;
          batch++
        ) {
          status.textContent = grid.children.length
            ? "Carregando mais sugestões…"
            : "Buscando sugestões fora da sua coleção…";
          try {
            entries = await Catalog.recommendations(item, { reserve: true });
            renderEntries();
          } catch (error) {
            status.textContent = grid.children.length
              ? "Os resultados foram mantidos. Tente carregar mais novamente."
              : "Não foi possível carregar mais sugestões agora. Tente novamente.";
            load.textContent = "tentar novamente";
            break;
          }
        }
      } catch (error) { console.warn('Recommendations unavailable',error);status.textContent = 'Não foi possível carregar recomendações agora. Tente novamente.';load.textContent='tentar novamente'; }
      finally { load.hidden=false; load.disabled = false; section.setAttribute('aria-busy','false'); }
    });
    load.hidden=true;load.classList.add('text-action');const heading=section.querySelector('h2');const utilities=node('div','discovery-heading');utilities.append(heading,load);section.prepend(utilities);section.append(status, grid); parent.append(section);
    if (window.IntersectionObserver) {
      const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&section.isConnected&&section.dataset.started!=='true'){observer.disconnect();load.click();}}, {rootMargin:'200px'});
      observer.observe(section);
      window.addEventListener('hashchange',()=>observer.disconnect(),{once:true});
    } else requestAnimationFrame(()=>{if(section.isConnected&&section.dataset.started!=='true')load.click();});
  }
  function appendMusicDetails(parent, item) {
    const section = node('section', 'game-detail-section'); section.dataset.musicDetails='';section.append(node('h2', '', item.kind==='music'?'detalhes':'informações'));
    if (item.kind !== "artist" && item.artist)
      section.append(
        button("ver artista · " + item.artist, () =>
          open({
            kind: "artist",
            catalogId: item.artistCatalogId || "lastfm-artist:" + encodeURIComponent(item.artist),
            title: item.artist,
            source: item.artistCatalogId?.startsWith('ytmusic:') ? 'YouTube Music' : item.artistCatalogId?.startsWith("itunes:")
              ? "iTunes"
              : item.artistCatalogId
                ? "Deezer"
                : "Last.fm",
          }),
        ),
      );
    if (item.kind === "music" && item.albumCatalogId)
      section.append(
        button("ver álbum · " + (item.albumTitle || "álbum"), () =>
          open({
            kind: "album",
            catalogId: item.albumCatalogId,
            title: item.albumTitle,
            source: item.albumCatalogId.startsWith('ytmusic:') ? 'YouTube Music' : item.albumCatalogId.startsWith("itunes:") ? "iTunes" : "Deezer",
          }),
        ),
      );
    const metadata=node('dl','music-detail-metadata');
    for(const [label,value] of [['artista',item.kind==='artist'?'':item.artist],['álbum',item.kind==='music'?item.albumTitle:''],['lançamento',item.releaseDate],['tipo',item.kind==='album'?releaseLabel(item):''],['duração',MusicPageUI.clock(item.trackDuration)],['fonte',item.kind==='artist'?'':item.source]])if(value){metadata.append(node('dt','',label),node('dd','',value));}
    if(metadata.childNodes.length)section.append(metadata);
    if(item.kind==='artist'&&(item.listeners||item.playcount)) {
      const stats=node('dl','music-detail-metadata music-stats');
      for(const [label,value] of [['ouvintes',item.listeners],['reproduções',item.playcount]])if(value)stats.append(node('dt','',label),node('dd','',value));
      section.append(stats);
    } else if (item.listeners || item.playcount)
      section.append(
        node(
          "p",
          "title-notice",
          "Last.fm · " +
            [
              item.listeners ? item.listeners + " ouvintes" : "",
              item.playcount ? item.playcount + " reproduções" : "",
            ]
              .filter(Boolean)
              .join(" · "),
        ),
      );
    if (item.edition) section.append(node('p', 'title-notice', 'Faixas da edição: ' + item.edition));
    if (safeUrl(item.previewUrl))
      section.append(
        button("▶ prévia · não é a faixa completa", () =>
          window.SPACEAMP.preview({
            title: "Prévia · " + item.title,
            artist: item.artist,
            album: item.image,
            url: item.previewUrl,
          }),
        ),
      );
    if (section.childNodes.length > 1) parent.append(section);
    if(item.kind==='music'){const playback=node('section','game-detail-section');playback.append(node('h2','','reprodução'));appendFullVideo(playback,item);parent.append(playback);}
    if(item.kind==='album'&&(item.albumTracks?.length||item.trackNames?.length)){
      const tracks=node('section','game-detail-section');tracks.dataset.albumTracklist='';tracks.dataset.content=JSON.stringify(item.albumTracks||item.trackNames);tracks.append(node('h2','','faixas'),MusicPageUI.tracklist(item.albumTracks?.length?item.albumTracks:item.trackNames.map(title=>({title})),{artwork:false,context:false}));parent.append(tracks);
    }
  }
  function appendArtistSections(parent, item) {
    if (item.discographyUnavailable) {
      const notice = node("section", "game-detail-section");
      notice.append(
        node(
          "p",
          "title-notice",
          "A discografia não respondeu. As demais informações continuam disponíveis.",
        ),
        button("tentar discografia novamente", () => {
          reloadDetail = true;
          lastRoute = "";
          return route();
        }),
      );
      parent.append(notice);
    }
    for (const [label, entries] of [['músicas populares', item.topTracks], ['artistas similares', item.similarArtists]]) {
      if (!entries?.length) continue;
      if(label==='músicas populares'){const section=node('section','game-detail-section');section.dataset.content=JSON.stringify(entries);const list=MusicPageUI.tracklist(entries.slice(0,8));section.append(node('h2','',label),list);parent.append(section);MusicPageUI.supplementArtistDurations(list,item);continue;}
      const section = node('section', 'game-detail-section'); const grid = node('div', 'media-related-grid');
      section.append(node('h2', '', label), grid);
      for (const entry of entries.slice(0, 8)) {
        const card = button('', () => open(entry), 'discover-card');
        Catalog.intentCore(card,entry);
        card.append(cover(entry.image, entry.title, entry.imageFallback, 'horizontal', entry.kind), node('strong', '', entry.title), node('small','',Catalog.describe(entry))); grid.append(card);
      }
      parent.append(section);
    }
    if (item.topAlbums?.length) {
      const section = node('section','game-detail-section artist-discography'), grid = node('div','media-related-grid');
      const notice = node('p','title-notice'); let albums = item.topAlbums.slice(), next = item.discographyNext;
      const filter = node('div','discography-filter'); filter.setAttribute('role','group'); filter.setAttribute('aria-label','Tipo de lançamento');let filterValue='all';const sort=node('select','discography-sort');sort.setAttribute('aria-label','Ordenar lançamentos');for(const [value,label] of [['recent','mais recentes'],['old','mais antigos'],['title','A–Z']])sort.append(new Option(label,value));
      for (const [value,label] of [['all','todos'],['album','álbuns'],['ep','EPs'],['single','singles']]) {const tab=button(label,()=>{filterValue=value;draw();},'text-action');tab.dataset.value=value;filter.append(tab);}
      function draw() {
        grid.replaceChildren();for(const tab of filter.children)tab.setAttribute('aria-pressed',String(tab.dataset.value===filterValue));
        for (const album of MusicPageUI.releases(albums,filterValue,sort.value)) {
          const card = button("", () => open(album), "discover-card");
          Catalog.intentCore(card,album);
          card.append(
            cover(album.image, album.title, album.imageFallback, "horizontal", "album"),
            node("strong", "", album.title),
            node(
              "small",
              "",
              [
                album.releaseDate?.slice(0, 4),
                { album: "Álbum", ep: "EP", single: "Single" }[album.albumType],
              ]
                .filter(Boolean)
                .join(" · "),
            ),
          );
          grid.append(card);
        }
        notice.textContent = grid.children.length
          ? albums.length + " lançamentos" + (next != null ? " · há mais" : "")
          : "Nenhum lançamento deste tipo entre os álbuns carregados.";
      }
      section.updateReleases=(entries,cursor)=>{if(JSON.stringify(albums)===JSON.stringify(entries)&&next===cursor)return;albums=entries.slice();next=cursor;draw();more.hidden=next==null;};
      sort.onchange = draw;
      const more = button('carregar mais lançamentos',async () => {
        more.disabled = true; notice.textContent = 'Carregando lançamentos…';
        try {
          const page = await Catalog.artistAlbums(item, next);
          const seen = new Set(albums.map((row) => row.catalogId));
          albums.push(...page.items.filter((row) => !seen.has(row.catalogId)));
          next = page.next;
          draw();
          more.hidden = next == null;
        } catch (error) {
          notice.textContent = error.message + " Os lançamentos anteriores foram mantidos.";
        } finally {
          more.disabled = false;
        }
      }); more.hidden = next == null;
      const controls=node('div','discography-controls');controls.append(filter,sort);section.append(node('h2','','discografia'),controls,notice,grid,more); parent.append(section); draw();
    }
  }
  function appendIgdbSections(parent, item) {
    function section(title) { const box = node('section', 'game-detail-section'); box.append(node('h2', '', title)); parent.append(box); return box; }
    if (item.criticRating != null) section('avaliações da crítica · IGDB').append(node('p', 'title-summary', item.criticRating + ' / 100 · ' + item.criticRatingCount + ' avaliações'));
    if (item.catalogRating != null) parent.append(node('p', 'title-notice', 'Nota de usuários IGDB · ' + item.ratingCount + ' avaliações.'));
    const timeBox = section('tempo para zerar · IGDB');
    const times = [['História principal', item.timeMain], ['História e extras', item.timeExtras], ['100%', item.timeComplete]];
    for (const [label, seconds] of times) if (Number.isFinite(seconds) && seconds > 0) timeBox.append(node('p', 'title-summary', label + ': ' + Math.round(seconds / 360) / 10 + ' horas'));
    timeBox.append(
      node(
        "p",
        "title-notice",
        times.some(([, value]) => value > 0)
          ? "Médias da comunidade · " + item.timeSubmissions + " registros. Seu tempo pode variar."
          : "O IGDB não informou tempos para este jogo.",
      ),
    );
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
          frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
          frame.setAttribute("allowfullscreen", "");
          frame.style.width = "100%";
          frame.style.aspectRatio = "16 / 9";
          frame.style.border = "0";
          player.replaceChildren(frame);
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
    const statusNames = {
      FINISHED: "Concluído",
      RELEASING: "Em publicação / exibição",
      NOT_YET_RELEASED: "Ainda não lançado",
      CANCELLED: "Cancelado",
      HIATUS: "Em hiato",
      Running: "Em exibição",
      Ended: "Encerrada",
    };
    const relations = {
      SEQUEL: "Continuação",
      PREQUEL: "Anterior",
      ADAPTATION: "Adaptação",
      SIDE_STORY: "História paralela",
      ALTERNATIVE: "Versão alternativa",
      SPIN_OFF: "Spin-off",
      PARENT: "Obra principal",
      SUMMARY: "Resumo",
      OTHER: "Relacionado",
      CHARACTER: "Personagem",
      SOURCE: "Obra original",
      COMPILATION: "Compilação",
      CONTAINS: "Parte da obra",
    };
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
      section.append(
        node("h2", "", "para descobrir · recomendações da comunidade AniList"),
        node(
          "p",
          "title-notice",
          "Sugestões de outros usuários; títulos que já estão na sua coleção são omitidos.",
        ),
        grid,
      );
      item.recommendationIds.forEach((id, index) => {
        const entry = { catalogId: id, kind: item.recommendationKinds[index], title: item.recommendationTitles[index], image: item.recommendationImages[index], source: 'AniList' };
        if (findSaved(entry)) return;
        const card = button('', () => open(entry), 'discover-card'); card.append(cover(entry.image, entry.title), node('strong', '', entry.title)); grid.append(card);
      });
      if (grid.children.length) parent.append(section);
    }
    if(['music','album','artist'].includes(item.kind)){
      const discovered=node('section','game-detail-section');discovered.dataset.collectionGenreMatches='';patchCollectionGenreMatches(discovered,item);parent.append(discovered);
    }
    const discover = node('section', 'game-detail-section');
    discover.append(node('h2', '', 'explorar mais títulos'));
    const explore = button('buscar por ' + (item.genres?.[0] || 'tipo de mídia'), () => {
      if(['music','album','artist'].includes(item.kind)&&item.genres?.[0]){go('#tag/'+encodeURIComponent(item.genres[0]));return;}
      category.value = item.kind; query.value = item.genres?.[0] || ''; go('#buscar/' + item.kind + (query.value ? '/' + encodeURIComponent(query.value) : ''));
    });
    if(['music','album','artist'].includes(item.kind))explore.dataset.musicExplore='';
    discover.append(explore); parent.append(discover);
    const similar = CollectionActions.getItems()
      .filter(
        (entry) =>
          entry.kind === item.kind &&
          entry.catalogId !== item.catalogId &&
          entry.id !== item.id &&
          entry.genres?.some((genre) => item.genres?.includes(genre)),
      )
      .slice(0, 6);
    if (similar.length&&!['music','album','artist'].includes(item.kind)) {
      const section = node('section', 'game-detail-section'); const grid = node('div', 'media-related-grid');
      section.append(node('h2', '', 'na sua coleção · gêneros em comum'), grid);
      for (const entry of similar) { const card = button('', () => open(entry), 'discover-card'); card.append(cover(entry.image, entry.title), node('strong', '', entry.title)); grid.append(card); }
      parent.append(section);
    }
    if (["music", "album", "artist"].includes(item.kind)) {
      if(item.kind==='album'){if(plainText(item.summary)&&item.summarySource)parent.append(node('p','title-notice','Dados: '+item.summarySource+'.'));return;}
      if(item.kind==='artist'&&plainText(item.summary)) {parent.append(node('p','title-notice','Dados: '+(item.summarySource||item.source||'seu cadastro')+'.'));return;}
      parent.append(
        node(
          "p",
          "title-notice title-provenance",
          "Dados do catálogo: " +
            (item.source || "seu cadastro") +
            "." +
            (plainText(item.summary) && item.summarySource ? " Descrição: " + item.summarySource + "." : ""),
        ),
      );
    } else
      parent.append(
        node(
          "p",
          "title-notice",
          "Descrição e informações fornecidas por " +
            (item.summarySource || item.source || "seu cadastro") +
            ". Nem todos os catálogos disponibilizam notas, relações e ficha completa.",
        ),
      );
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
            try {
              const detail = await Catalog.details({
                kind: "game",
                catalogId: "steam:" + ids[index + offset],
              });
              if (detail.title) card.querySelector("span").textContent = detail.title;
            } catch {
              failures++;
            }
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
      for (const [title, value] of [
        ["Mínimos", item.requirementsMinimum],
        ["Recomendados", item.requirementsRecommended],
      ])
        if (value) {
          const group = node("div");
          group.append(node("h3", "", title), node("p", "title-summary", plainText(value)));
          body.append(group);
        }
      section('requisitos · PC', body);
    }
    parent.append(node('p', 'title-notice', 'Dados da edição Steam.'));
  }
  function patchCollectionGenreMatches(section,item) {
    const matches=MusicPageUI.collectionGenreMatches(item,CollectionActions.getItems());
    section.hidden=!matches.length;
    const expanded=section.dataset.expanded==='true',preview=expanded?matches:matches.slice(0,3);
    if(!section.firstChild){section.append(node('h2','','na sua coleção · gêneros em comum'),node(item.kind==='music'?'ol':'div',item.kind==='music'?'music-tracklist':'media-related-grid'));}
    const focused=document.activeElement,focusedRow=focused?.closest('[data-collection-key]'),focusKey=focusedRow?.dataset.collectionKey,focusIndex=focusedRow?[...focusedRow.querySelectorAll('a,button')].indexOf(focused):-1;
    const list=section.children[1],existing=new Map([...list.children].map(row=>[row.dataset.collectionKey,row]));
    const nodes=preview.map((entry,index)=>{
      const key=entry.id||entry.catalogId,signature=JSON.stringify(entry);let row=existing.get(key);
      if(!row||row.dataset.collectionSignature!==signature){
        if(entry.kind==='music')row=MusicPageUI.trackRow(entry,index);
        else {row=button('',()=>open(entry),'discover-card');row.dataset.kind=entry.kind;row.append(cover(entry.image,entry.title,entry.imageFallback,entry.coverLayout,entry.kind),node('strong','',entry.title));if(entry.kind==='album')row.append(node('small','',[{album:'Álbum',ep:'EP',single:'Single'}[entry.albumType],entry.releaseDate?.slice(0,4)].filter(Boolean).join(' · ')));}
        row.dataset.collectionKey=key;row.dataset.collectionSignature=signature;
      }
      const number=row.querySelector('.music-track-number');if(number)number.textContent=String(index+1).padStart(2,'0');
      return row;
    });
    for(const row of [...list.children])if(!nodes.includes(row))row.remove();
    nodes.forEach((row,index)=>{if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);});
    let toggle=section.querySelector('[data-collection-genre-toggle]');
    if(matches.length>3){if(!toggle){toggle=button('',()=>{const top=window.scrollY;section.dataset.expanded=String(section.dataset.expanded!=='true');patchCollectionGenreMatches(section,activeItem);section.querySelector('[data-collection-genre-toggle]')?.focus({preventScroll:true});window.scrollTo({top,behavior:'instant'});},'text-action');toggle.dataset.collectionGenreToggle='';section.append(toggle);}toggle.textContent=expanded?'recolher ↑':'ver todos ('+matches.length+') →';toggle.setAttribute('aria-expanded',String(expanded));}else toggle?.remove();
    if(focusKey&&!focused.isConnected){const replacement=nodes.find(row=>row.dataset.collectionKey===focusKey);(replacement?.querySelectorAll('a,button')[focusIndex]||replacement||toggle)?.focus({preventScroll:true});}
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
          const detailed = await Promise.all(
            items.map(async (item) => {
              try {
                return item.platforms?.length
                  ? item
                  : await Catalog.details(item, { signal: activeController.signal });
              } catch {
                return item;
              }
            }),
          );
          items = detailed.filter(item => item.platforms?.some(value => String(value).toLowerCase().includes(needle)));
        }
        if (token !== revision) return;
        results.replaceChildren();
        status.textContent = items.length ? items.length + " resultados · clique para conhecer um título" : "Nenhum resultado. Tente outro nome.";
        status.dataset.state=items.length?'ready':'empty';
        const resultTarget=CatalogUI.resultTarget(items,results);
        for (const item of items) {
          const resultParent=resultTarget(item);
          remember(item);
          const card = button("", () => open(item), "discover-card");
          Catalog.intentCore(card,item);
          card.append(cover(item.image, item.title, item.imageFallback, item.coverLayout, item.kind), node("strong", "", item.title), node("small", "", plainText(Catalog.describe(item))));
          resultParent.append(card);
        }
      } catch (error) {
        if (token === revision) {
          console.warn("Search unavailable", error);
          status.dataset.state = "error";
          retrySearch.hidden = false;
          status.textContent =
            (error.name === "AbortError"
              ? "A busca demorou demais. Tente novamente."
              : "Não foi possível buscar agora. Tente novamente.") +
            (results.children.length ? " Os resultados anteriores foram mantidos." : "");
        }
      } finally { clearTimeout(timer); if (token === revision) { run.disabled = false; results.setAttribute('aria-busy','false'); } }
    } else if (parts[0] === "titulo") {
      if (!Object.hasOwn(Collection.kinds, parts[1]) || !parts[2]) { detailPage.replaceChildren(node("p", "empty", "Título inválido.")); return; }
      const key = parts[1] + "/" + parts[2];
      const saved = CollectionActions.getItems().find(i => i.kind === parts[1] && (i.catalogId || "local:" + i.id) === parts[2]);
      let item = entries.get(key) || saved || { kind: parts[1], catalogId: parts[2], title: "", total: 0, unit: "itens" };
      if (parts[2].startsWith("local:") && !saved) { detailPage.replaceChildren(node("p", "empty", "Este item não está mais na coleção.")); return; }
      item={...item,...Catalog.peekCore(item)};
      hydratingRoute = location.hash;
      drawDetail(item, item.catalogId ? "Carregando informações…" : "", { hydrating: true });
      detailPage.setAttribute('aria-busy','true');
      const hadTitle=!!item.title;
      const stableMusic=hadTitle&&item.kind==='music'&&item.catalogId?.startsWith('ytmusic:');
      if(hadTitle){if(stableMusic)detailPage.querySelector('h1').focus({preventScroll:true});window.Navigation?.restore();}
      controller = new AbortController();
      const activeController = controller;
      const timer = setTimeout(() => activeController.abort(), 20000);
      try {
        const force = reloadDetail; reloadDetail = false;
        const phased=item.catalogId?.startsWith('ytmusic:');
        const detailed = await (phased?Catalog.prefetchCore(item,{force}):Catalog.details(item, { signal: activeController.signal, force }));
        if (token !== revision) return;
        if (!detailed.title) throw Error("Título não encontrado no catálogo.");
        remember(detailed);
        hydratingRoute = '';
        if(phased&&hadTitle)({music:patchMusicCore,album:patchAlbumCore,artist:patchArtistCore}[item.kind])(detailed);else drawDetail(mergeRichest(item,detailed));
        detailPage.setAttribute('aria-busy','false');
        if (!stableMusic && !detailPage.querySelector('[data-title-discovery][data-started="true"]')) {
          detailPage.querySelector("h1").focus({ preventScroll: true });
          if(!hadTitle)window.Navigation?.restore();
        }
        if(phased)Catalog.enrich(detailed,{force}).then(enriched=>{if(token===revision){
          patchMusicEnrichment(enriched);
        }}).catch(()=>{});
      } catch (error) {
        if (token === revision) {
          hydratingRoute = '';detailPage.setAttribute('aria-busy','false');
          const message="Não consegui carregar todas as informações. " + (item.title ? "Você ainda pode adicionar este título." : "Volte à busca e tente novamente.");
          if(hadTitle&&item.catalogId?.startsWith('ytmusic:')){const notice=node('p','title-notice',message);notice.setAttribute('role','status');detailPage.querySelector('.title-about').append(notice);}
          else drawDetail(item,message);
        }
      } finally { clearTimeout(timer); }
    }
  }
  window.TitlePages = { open, route, patchCollectionState, refresh: () => { if (!detailPage.hidden && activeItem) drawDetail(activeItem); } };
  window.addEventListener("hashchange", route);
  route();
})();
