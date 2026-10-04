/* Apresentação e filtros da coleção. Regras e validação ficam em collection.js. */
function createCollectionView({
  container,
  getData,
  filters,
  navigate,
  editItem,
  storeItem,
  bulkUpdate,
  el,
  button,
  link,
  imageNode,
  getProfile,
  openPhoto,
}) {
  const { kinds, statuses, filterItems } = Collection;
  const collection = container;
  let listView = false;
  let selectedListItemId = null;
  let separateMedia = false;
  const selected = new Set(); let selecting = false;
  try { listView = localStorage.getItem("myspace-collection-view") === "list"; } catch {}
  window.addEventListener("myspace:preferences-restored", () => {
    try {
      listView = localStorage.getItem("myspace-collection-view") === "list";
    } catch {}
    view.textContent = listView ? "capas" : "lista";
    renderCollection();
  });
  try { separateMedia=localStorage.getItem('myspace-collection-grouping')==='media'; } catch {}
  // Filtros permanecem montados enquanto a coleção é editada.
  const summary = el("div", "collection-summary"),
    tabs = el("div", "collection-tabs"),
    controls = el("div", "collection-controls"),
    shelf = el("div", "shelf"),
    collectionEmpty = el("p", "empty");
  const listShell=el('div','collection-list-shell'),listPanel=el('div','collection-list-panel'),listDetail=el('aside','collection-list-detail'),listHelp=el('div','collection-list-help');
  listDetail.setAttribute('aria-label','Detalhes do título selecionado');
  listHelp.textContent='↑ ↓ navegar   Enter abrir   E editar   F favoritar   Esc capas   ← → categorias';
  listPanel.append(listDetail,listHelp);
  listShell.append(shelf,listPanel);
  function openTitle(item) {
    if (!window.TitlePages) return editItem(item);
    window.Navigation?.rememberCollectionOrigin(item.id, itemId => {
      const current = getData().items.find(row => row.id === itemId);
      if (!current) return;
      if (listView) {
        keyboardListNavigation = true;
        selectListItem(current);
      }
      const selector = listView ? '.list-entry' : '.shelf-cover';
      return [...shelf.querySelectorAll(selector)].find(row => row.dataset.itemId === itemId);
    });
    TitlePages.open(item);
  }
  let xmb;
  const xmbButton = button('[ modo XMB ]', () => {
    xmb ||= createXmb({ getData, getProfile, getFilters: () => filters, openItem: openTitle, navigate, openPhoto, el, button, imageNode });
    xmb.enter(xmbButton);
  }, 'text-action');
  const editorialCache=new Map(),editorialPending=new Map();
  function renderListDetail(item){
    listDetail.replaceChildren();
    if(!item){listDetail.append(el('p','empty','Selecione um título para ver os detalhes.'));return;}
    const lead=el('div','collection-list-lead'),cover=el('div','collection-list-cover'),info=el('div','collection-list-info');
    cover.dataset.kind = item.kind;
    cover.dataset.layout = item.coverLayout || 'vertical';
    if(item.image)cover.append(imageNode(item.image,item.title));else cover.append(el('span','',kinds[item.kind]));
    info.append(el('h3','',item.title));
    const facts=el('dl','collection-list-facts');
    const fact=(label,value)=>{if(value==null||value==='')return;facts.append(el('dt','',label),el('dd','',String(value)));};
    fact('Tipo',kinds[item.kind]);fact('Status',statuses[item.status]);
    fact('Artista',item.artist);fact('Autor',Array.isArray(item.authors)?item.authors.join(', '):item.author);
    fact('Plataforma',item.platform);fact('Nota pessoal',item.score==null?'':item.score+'/10');
    if(item.addedAt||item.createdAt){const date=new Date(item.addedAt||item.createdAt);if(!Number.isNaN(date.getTime()))fact('Adicionado',date.toLocaleDateString('pt-BR'));}
    info.append(facts);
    const actions=el('div','collection-list-actions');
    actions.append(button('[ abrir ]',()=>openTitle(item),'text-action'),button('[ editar ]',()=>editItem(item),'text-action'));
    actions.append(button(item.featured?'[ desfavoritar ]':'[ favoritar ]',()=>toggleListFavorite(item),'text-action'));
    if(item.kind==='music')info.append(window.MusicBridge.actions(item));
    info.append(actions);lead.append(cover,info);listDetail.append(lead);
    const musical=['music','album','artist'].includes(item.kind),editorialKey=JSON.stringify([item.kind,item.artist,item.title]);
    const cached=editorialCache.get(editorialKey),editorial=cached&&Date.now()-cached.at<300000?cached:null;
    const summary=String(item.summary||editorial?.summary||(!musical?item.description:'')||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if (summary) {
      const section = el("section", "collection-list-section");
      section.append(
        el("h4", "", "// sobre"),
        el("p", "", summary.slice(0, 500) + (summary.length > 500 ? "…" : "")),
      );
      listDetail.append(section);
    } else if (musical) {
      const section = el("section", "collection-list-section");
      section.append(
        el("h4", "", "// sobre"),
        el(
          "p",
          "",
          editorial
            ? editorial.failed
              ? "Não foi possível consultar a descrição no Last.fm agora."
              : "O Last.fm não disponibilizou uma descrição para este título."
            : "Carregando descrição do Last.fm…",
        ),
      );
      listDetail.append(section);
    }
    if(musical&&editorial?.failed){listDetail.lastChild.append(button('tentar novamente',()=>{editorialCache.delete(editorialKey);renderListDetail(item);},'text-action'));}
    if(musical&&!item.summary&&!editorial&&!editorialPending.has(editorialKey)){
      const task = fetch(
        "/api/music/summary?" +
          new URLSearchParams({
            kind: item.kind,
            artist: item.kind === "artist" ? item.title : item.artist || "",
            title: item.title,
          }),
      )
        .then(async (response) => {
          if (!response.ok) throw Error("indisponível");
          return response.json();
        })
        .then((value) => editorialCache.set(editorialKey, { at: Date.now(), summary: value.summary || "" }))
        .catch(() => editorialCache.set(editorialKey, { at: Date.now(), failed: true }))
        .finally(() => {
          editorialPending.delete(editorialKey);
          if (editorialCache.size > 40) editorialCache.delete(editorialCache.keys().next().value);
          if (selectedListItemId === item.id) {
            const current = getData().items.find((row) => row.id === item.id);
            if (current) renderListDetail(current);
          }
        });
      editorialPending.set(editorialKey, task);
    }
    const genres=Array.isArray(item.genres)?item.genres:Array.isArray(item.tags)?item.tags:[];
    if (genres.length) {
      const section = el("section", "collection-list-section");
      section.append(el("h4", "", "// categorias"));
      const tags = el("div", "collection-list-tags");
      for (const genre of genres.slice(0, 10)) tags.append(el("span", "", String(genre)));
      section.append(tags);
      listDetail.append(section);
    }
    if(item.notes){const section=el('section','collection-list-section');section.append(el('h4','','// nota pessoal'),el('p','',item.notes));listDetail.append(section);}
  }
  let keyboardListNavigation = false;
  function selectListItem(item,{scroll=false,focus=false}={}){
    selectedListItemId=item?.id||null;
    for(const row of shelf.querySelectorAll('.list-entry')){
      const active=row.dataset.itemId===selectedListItemId;
      row.setAttribute('aria-pressed',String(active));row.classList.toggle('is-selected',active);
      if(active&&scroll)row.scrollIntoView?.({block:'nearest',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      if(active&&focus)row.focus?.({preventScroll:true});
    }
    renderListDetail(item);
  }
  function toggleListFavorite(item){
    try{window.CollectionActions.updateItem(item.id,{featured:!item.featured});}
    catch(error){toast(error.message||'Não consegui atualizar os favoritos.');}
  }
  for (const [value, name] of Object.entries({ all: "Tudo", ...kinds })) {
    const b = button(
      name,
      () => {
        navigate("colecao", value);
      },
      "",
    );
    b.dataset.kind = value;
    tabs.append(b);
  }
  const search = el("input");
  search.type = "search";
  search.placeholder = "buscar na coleção";
  search.setAttribute("aria-label", "Buscar na coleção");
  search.oninput = () => {
    filters.query = search.value;
    renderCollection();
  };
  const statusSelect = el("select");
  statusSelect.setAttribute("aria-label", "Filtrar por status");
  for (const [value, name] of Object.entries({
    all: "Todos os status",
    ...statuses,
  }))
    statusSelect.append(new Option(name, value));
  statusSelect.onchange = () => {
    filters.status = statusSelect.value;
    renderCollection();
  };
  const sortSelect = el("select");
  sortSelect.setAttribute("aria-label", "Ordenar coleção");
  for (const [value, name] of Object.entries({
    recent: "Atualizados",
    title: "Título A–Z",
    score: "Maior nota",
  }))
    sortSelect.append(new Option(name, value));
  sortSelect.onchange = () => {
    filters.sort = sortSelect.value;
    renderCollection();
  };
  const view = button(listView ? "capas" : "lista", () => {
    listView = !listView;
    try { localStorage.setItem("myspace-collection-view", listView ? "list" : "covers"); } catch {}
    view.textContent = listView ? "capas" : "lista";
    renderCollection();
    if(listView)shelf.querySelector('.list-entry.is-selected')?.focus?.();
  });
  const favorites = button('☆ só favoritos', () => { filters.featured = !filters.featured; favorites.setAttribute('aria-pressed', String(filters.featured)); renderCollection(); });
  favorites.setAttribute('aria-pressed','false');
  view.classList.add('view-toggle');view.setAttribute('aria-label','Alternar entre capas e lista');
  controls.append(search, statusSelect, view);
  controls.append(xmbButton);
  const advanced = el('div','collection-controls advanced-filters');
  const activeFilters = el('div','active-collection-filters');
  function clearFilters(){Object.assign(filters,{kind:'all',status:'all',query:'',genre:'',platform:'',year:'',list:'',featured:false,sort:'recent'});navigate('colecao','all');renderCollection();}
  advanced.id='collectionFilters';advanced.hidden=true;
  const filterButton=button('filtros',()=>{advanced.hidden=!advanced.hidden;filterButton.setAttribute('aria-expanded',String(!advanced.hidden));},'filter-toggle');
  filterButton.setAttribute('aria-expanded','false');filterButton.setAttribute('aria-controls',advanced.id);controls.append(filterButton);
  advanced.append(sortSelect,favorites);
  const grouping=button('separar por mídia',()=>{separateMedia=!separateMedia;try{localStorage.setItem('myspace-collection-grouping',separateMedia?'media':'mixed');}catch{}renderCollection();});
  grouping.setAttribute('aria-pressed',String(separateMedia));advanced.append(grouping);
  const filterSelects = {};
  for (const [key,name] of Object.entries({genre:'Todos os gêneros',platform:'Todas as plataformas',year:'Todos os anos',list:'Todas as listas'})) {
    const select = el("select");
    select.setAttribute("aria-label", name);
    select.dataset.filter = key;
    select.onchange = () => {
      filters[key] = select.value;
      renderCollection();
    };
    filterSelects[key] = select;
    advanced.append(select);
  }
  advanced.append(button('limpar filtros',clearFilters));
  const bulk = el('div','collection-bulk'); bulk.hidden = true;
  const count = el('span','bulk-count','0 selecionados');
  const bulkStatus = el("select");
  bulkStatus.setAttribute("aria-label", "Status em lote");
  bulkStatus.append(new Option("Escolha um status", ""));
  for (const [key, name] of Object.entries(statuses)) bulkStatus.append(new Option(name, key));
  const listName = el('input'); listName.placeholder='Nome da lista pessoal'; listName.maxLength=60;listName.setAttribute('aria-label','Lista para os selecionados');
  function apply(patch) {
    if (!selected.size) return toast("Selecione pelo menos um título.");
    try {
      bulkUpdate([...selected], patch);
      selected.clear();
      renderCollection();
    } catch (error) {
      toast(error.message);
    }
  }
  const selectionTools = el("div", "selection-tools");
  selectionTools.append(
    count,
    button(
      "selecionar visíveis",
      () => {
        for (const item of filterItems(getData().items, filters)) selected.add(item.id);
        renderCollection();
      },
      "text-action",
    ),
    button(
      "limpar seleção",
      () => {
        selected.clear();
        renderCollection();
      },
      "text-action",
    ),
  );
  const bulkAction=el('select');bulkAction.setAttribute('aria-label','Ação para os selecionados');bulkAction.className='bulk-action';
  for (const [key, label] of Object.entries({
    status: "Alterar status",
    favorite: "Favoritar",
    unfavorite: "Remover dos favoritos",
    addList: "Adicionar a uma lista",
    removeList: "Remover de uma lista",
  }))
    bulkAction.append(new Option(label, key));
  bulkAction.value = "status";
  function updateBulkAction(){bulkStatus.hidden=bulkAction.value!=='status';listName.hidden=!['addList','removeList'].includes(bulkAction.value);}
  bulkAction.onchange=updateBulkAction;updateBulkAction();
  const applyBulk = button(
    "aplicar aos selecionados",
    () => {
      const action = bulkAction.value;
      if (action === "status") {
        if (!bulkStatus.value) {
          toast("Escolha o status para os títulos selecionados.");
          bulkStatus.focus();
          return;
        }
        apply({ status: bulkStatus.value });
      } else if (action === "favorite" || action === "unfavorite") apply({ featured: action === "favorite" });
      else if (["addList", "removeList"].includes(action)) {
        if (!listName.value.trim()) {
          toast("Informe o nome da lista pessoal.");
          listName.focus();
          return;
        }
        apply({ [action]: listName.value.trim() });
      }
    },
    "primary bulk-apply",
  );
  const bulkFields=el('div','bulk-fields');bulkFields.append(bulkAction,bulkStatus,listName,applyBulk);bulk.append(selectionTools,bulkFields);
  const bulkToggle = button(
    "selecionar títulos",
    () => {
      selecting = !selecting;
      bulk.hidden = !selecting;
      bulkToggle.textContent = selecting ? "encerrar seleção" : "selecionar títulos";
      bulkToggle.setAttribute("aria-pressed", String(selecting));
      if (!selecting) selected.clear();
      renderCollection();
    },
    "bulk-toggle",
  );
  bulkToggle.setAttribute("aria-pressed", "false");
  controls.append(bulkToggle);
  const history = el('details','collection-history');history.append(el('summary','','histórico de acompanhamento'));const historyRows=el('div','history-rows');history.append(historyRows);
  const personalSummary = el("details", "personal-summary");
  personalSummary.append(el("summary", "", "meu acompanhamento"));
  const personalStats = el("div", "personal-stats");
  personalSummary.append(personalStats);
  const shelves = el('details','personal-shelves'); const shelvesTitle = el('summary'); const shelvesBody = el('div','personal-shelves-body'); shelves.append(shelvesTitle,shelvesBody);
  const emptyReset=button('limpar filtros',clearFilters,'text-action');
  collection.body.append(summary, tabs, controls, advanced, activeFilters, bulk, shelves, listShell, collectionEmpty, emptyReset, history);
  function renderCollection() {
    if (window.Navigation?.preserveViewport) {
      return window.Navigation.preserveViewport(collection.body, renderCollectionContents);
    }
    return renderCollectionContents();
  }
  function renderCollectionContents() {
    search.value = filters.query || ""; statusSelect.value = filters.status || "all"; sortSelect.value = filters.sort || "recent";
    favorites.setAttribute("aria-pressed", String(!!filters.featured));
    const all = getData().items;
    const listNames=[...new Set(all.flatMap(item=>item.lists || []))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    shelves.hidden=!listNames.length; shelvesTitle.textContent='listas pessoais · '+listNames.length;shelvesBody.replaceChildren();
    for(const name of listNames) {
      const entries = all.filter((item) => item.lists?.includes(name));
      const row = button(
        "",
        () => {
          Object.assign(filters, {
            kind: "all",
            status: "all",
            query: "",
            genre: "",
            platform: "",
            year: "",
            featured: false,
            list: name,
          });
          navigate("colecao", "all");
          renderCollection();
        },
        "personal-shelf",
      );
      row.setAttribute('aria-label','Ver lista '+name+' · '+entries.length+' títulos');row.setAttribute('aria-pressed',String(filters.list===name));
      const covers=el('span','personal-shelf-covers');
      for(const item of entries.slice(0,4))if(item.image)covers.append(imageNode(item.image,''));
      row.append(covers,el('strong','',name),el('small','',entries.length+' títulos'));shelvesBody.append(row);
    }
    for (const id of selected) if (!all.some(item=>item.id===id)) selected.delete(id);
    count.textContent = selected.size + ' selecionados';
    applyBulk.disabled=!selected.size;
    const filterCount =
      ["genre", "platform", "year", "list"].filter((key) => filters[key]).length +
      Number(!!filters.featured) +
      Number(filters.sort !== "recent");
    filterButton.textContent = "filtros" + (filterCount ? " · " + filterCount : "");
    for (const [key,select] of Object.entries(filterSelects)) {
      const values = [
        ...new Set(
          all.flatMap((item) =>
            key === "genre"
              ? item.genres || []
              : key === "list"
                ? item.lists || []
                : key === "platform"
                  ? [item.platform, ...(item.platforms || [])].filter(Boolean)
                  : [String(item.releaseDate || item.year || item.seasonYear || "").slice(0, 4)].filter(
                      Boolean,
                    ),
          ),
        ),
      ].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
      const labels = {genre:'Todos os gêneros',platform:'Todas as plataformas',year:'Todos os anos',list:'Todas as listas'};
      select.replaceChildren(new Option(labels[key],''),...values.map(value=>new Option(value,value)));
      if (filters[key] && !values.includes(filters[key])) filters[key]='';select.value=filters[key] || '';
    }
    historyRows.replaceChildren();
    const labels = {status:'status',score:'nota',progress:'progresso',total:'total',featured:'favorito',startedAt:'início',finishedAt:'conclusão',notes:'notas',lists:'listas'};
    for (const entry of (getData().history || []).slice().reverse()) {
      const row=el('div','history-row'); const item=all.find(item=>item.id===entry.id);
      const titleButton=button(entry.title,()=>{if(item)window.TitlePages ? TitlePages.open(item) : editItem(item);},'history-title');titleButton.disabled=!item;
      row.append(titleButton,el('small','',new Date(entry.at).toLocaleString('pt-BR')+' · '+entry.fields.map(key=>labels[key] || key).join(', ')));
      if (entry.before && entry.after)
        row.append(
          el(
            "small",
            "",
            [
              entry.fields.includes("status")
                ? (statuses[entry.before.status] || entry.before.status) +
                  " → " +
                  (statuses[entry.after.status] || entry.after.status)
                : "",
              entry.fields.includes("score")
                ? "Nota " + (entry.before.score ?? "—") + " → " + (entry.after.score ?? "—")
                : "",
              entry.fields.includes("progress")
                ? "Progresso " + entry.before.progress + " → " + entry.after.progress
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        );
      historyRows.append(row);
    }
    if (!historyRows.children.length) historyRows.append(el('p','empty','As próximas alterações de acompanhamento aparecerão aqui.'));
    summary.replaceChildren();
    for (const [key, label] of Object.entries({
      all: "itens",
      active: "em andamento",
      done: "concluídos",
    })) {
      const n = button(
        "",
        () => {
          filters.status = key === "all" ? "all" : key;
          filters.featured = false;
          filters.query = "";
          for (const field of ["genre", "platform", "year", "list"]) filters[field] = "";
          search.value = "";
          statusSelect.value = filters.status;
          favorites.setAttribute("aria-pressed", "false");
          navigate("colecao", "all");
          renderCollection();
        },
        "summary-stat",
      );
      n.append(
        el(
          "b",
          "",
          String(
            key === "all"
              ? getData().items.length
              : getData().items.filter((i) => i.status === key).length,
          ),
        ),
        document.createTextNode(" " + label),
      );
      summary.append(n);
    }
    const items = getData().items;
    const rated = items.filter(i => i.score != null);
    personalStats.replaceChildren(
      el("span", "", items.filter((i) => i.featured).length + " favoritos"),
      el("span", "", items.filter((i) => i.status === "planned").length + " na fila"),
      el(
        "span",
        "",
        rated.length
          ? "Média pessoal: " + (rated.reduce((sum, i) => sum + i.score, 0) / rated.length).toFixed(1) + "/10"
          : "Sem avaliações ainda",
      ),
    );
    summary.append(personalSummary);
    const ongoing = items.filter(i => i.status === 'active' && i.total > 0);
    if (ongoing.length) personalStats.append(el('span', '', 'Progresso médio em andamento: ' + Math.round(ongoing.reduce((sum,i) => sum + i.progress/i.total,0) / ongoing.length * 100) + '%'));
    for (const b of tabs.querySelectorAll('button'))
      b.setAttribute("aria-pressed", String(b.dataset.kind === filters.kind));
    const visible = filterItems(getData().items, filters);
    activeFilters.replaceChildren();
    const filterLabels = {
      kind: kinds[filters.kind],
      status: statuses[filters.status],
      query: filters.query ? "Busca: " + filters.query : "",
      genre: filters.genre,
      platform: filters.platform,
      year: filters.year,
      list: filters.list ? "Lista: " + filters.list : "",
      featured: filters.featured ? "Favoritos" : "",
    };
    for (const [key, label] of Object.entries(filterLabels))
      if (label) {
        const chip = button(
          label + " ×",
          () => {
            filters[key] = key === "kind" || key === "status" ? "all" : key === "featured" ? false : "";
            if (key === "kind") navigate("colecao", "all");
            renderCollection();
          },
          "filter-chip",
        );
        chip.setAttribute("aria-label", "Remover filtro: " + label);
        activeFilters.append(chip);
      }
    activeFilters.hidden=!activeFilters.children.length;
    emptyReset.hidden=!!visible.length||!all.length||activeFilters.hidden;
    shelf.classList.toggle("list", listView);
    listShell.classList.toggle('active',listView);listPanel.hidden=!listView;listDetail.hidden=!listView;listHelp.hidden=!listView;
    const mixedKinds=new Set(visible.map(item=>item.kind)).size>1;
    const grouped=!listView&&separateMedia&&mixedKinds;
    grouping.setAttribute('aria-pressed',String(separateMedia));
    shelf.classList.toggle('grouped',grouped);
    shelf.replaceChildren();
    const mediaShelves=new Map();
    if(grouped)for(const [kind,name] of Object.entries(kinds)){
      const entries=visible.filter(item=>item.kind===kind);if(!entries.length)continue;
      const section=el('section','shelf-media');const title=el('h4','shelf-media-heading',name);title.append(el('small','',String(entries.length)));
      const grid=el('div','shelf-media-grid');section.append(title,grid);shelf.append(section);mediaShelves.set(kind,grid);
    }
    collectionEmpty.hidden = !!visible.length;
    collectionEmpty.textContent = getData().items.length
      ? "Nenhum item corresponde aos filtros."
      : "Sua coleção está vazia. Adicione um jogo, anime, mangá ou outra coisa que quer acompanhar.";
    if(listView){
      const current=visible.find(item=>item.id===selectedListItemId)||visible[0]||null;
      selectedListItemId=current?.id||null;
      for(const item of visible){
        const row = button(
          " ",
          () => {
            if (selecting) {
              selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
              renderCollection();
            } else selectListItem(item);
          },
          "list-entry",
        );
        row.dataset.itemId = item.id;
        row.setAttribute('aria-label',(selecting?'Marcar ':'Selecionar ')+item.title);row.setAttribute('aria-pressed',String(item.id===selectedListItemId));
        if(item.id===selectedListItemId)row.classList.add('is-selected');
        row.dataset.marked=String(selecting&&selected.has(item.id));
        row.ondblclick=()=>{if(!selecting)openTitle(item);};row.onmouseenter=()=>{if(!keyboardListNavigation&&selectedListItemId!==item.id)selectListItem(item);};
        const thumb=el('span','list-entry-thumb');if(item.image)thumb.append(imageNode(item.image,item.title));else thumb.textContent=kinds[item.kind];
        const text=el('span','list-entry-text');text.append(el('strong','',item.title),el('small','',kinds[item.kind]));
        row.append(thumb,text,el('span','list-entry-status',statuses[item.status]));shelf.append(row);
      }
      renderListDetail(current);return;
    }
    for (const item of visible) {
      const card = el("article", "shelf-card"),
        cover = button(
          "",
          () => {
            if (selecting) {
              selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
              renderCollection();
            } else openTitle(item);
          },
          "shelf-cover",
        );
      cover.setAttribute("aria-label", (selecting?'Selecionar ':'Ver ') + item.title);
      card.dataset.layout = item.coverLayout || "vertical";
      card.dataset.kind = item.kind;
      card.dataset.selected=String(selecting&&selected.has(item.id));
      if (selecting) {
        const label = el("label", "bulk-check");
        const check = el("input");
        check.type = "checkbox";
        check.checked = selected.has(item.id);
        check.setAttribute("aria-label", "Selecionar " + item.title);
        check.onchange = () => {
          check.checked ? selected.add(item.id) : selected.delete(item.id);
          count.textContent = selected.size + " selecionados";
          applyBulk.disabled = !selected.size;
          card.dataset.selected = String(check.checked);
        };
        label.prepend(check);
        card.append(label);
      }
      cover.append(
        item.image
          ? imageNode(item.image, item.title)
          : el("span", "", kinds[item.kind]),
      );
      const detail = el("div", "shelf-detail");
      const heading=el('h4','',item.title);heading.title=item.title;
      const context=el('span','shelf-context',[grouped?'':kinds[item.kind],['music','album'].includes(item.kind)?item.artist:''].filter(Boolean).join(' · '));
      context.hidden=!context.textContent;
      detail.append(
        heading,
        context,
        el("span", "status-pill", statuses[item.status]),
      );
      if(item.kind==='music')detail.append(window.MusicBridge.actions(item));
      cover.dataset.itemId = item.id;
      card.append(cover, detail);
      (mediaShelves.get(item.kind)||shelf).append(card);
    }
  }

  // Scrolling rows under a stationary pointer must not steal keyboard selection.
  document.addEventListener('pointermove', event => {
    if (!keyboardListNavigation || (!event.movementX && !event.movementY)) return;
    keyboardListNavigation = false;
    const row = event.target?.closest?.('.list-entry');
    const item = row && getData().items.find(item => item.id === row.dataset.itemId);
    if (item && item.id !== selectedListItemId) selectListItem(item);
  });
  document.addEventListener('keydown',event=>{
    if(xmb?.isActive()||!listView||!location.hash.startsWith('#colecao')||event.ctrlKey||event.altKey||event.metaKey||document.querySelector('dialog[open]'))return;
    const target=event.target;
    if(target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    if(target?.closest?.('button,a,[role="button"]')&&!target.closest('.list-entry'))return;
    const visible=filterItems(getData().items,filters);
    const current=visible.findIndex(item=>item.id===selectedListItemId);
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      if(!visible.length)return;event.preventDefault();
      keyboardListNavigation = true;
      const step=event.key==='ArrowDown'?1:-1;
      const next = Math.max(0, Math.min(visible.length - 1, current + step));
      const returningToStart = event.key === 'ArrowUp' && next === 0;
      if (next !== current) {
        if (!returningToStart) window.Navigation?.cancelCamera();
        selectListItem(visible[next], {scroll: !returningToStart, focus: true});
      }
      if (returningToStart) window.Navigation?.toTop();
      return;
    }
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      const values=['all',...Object.keys(kinds)],index=values.indexOf(filters.kind);
      const next=values[Math.max(0,Math.min(values.length-1,index+(event.key==='ArrowRight'?1:-1)))];
      if(next!==filters.kind){event.preventDefault();navigate('colecao',next);renderCollection();}return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      listView = false;
      try {
        localStorage.setItem("myspace-collection-view", "covers");
      } catch {}
      view.textContent = "lista";
      renderCollection();
      view.focus?.();
      return;
    }
    const item=visible[current];if(!item||selecting)return;
    if(event.key==='Enter'||event.key.toLowerCase()==='e'||event.key.toLowerCase()==='f'){
      event.preventDefault();if(event.key==='Enter')openTitle(item);else if(event.key.toLowerCase()==='e')editItem(item);else toggleListFavorite(item);
    }
  });
  return { render: renderCollection, search, statusSelect };
}
