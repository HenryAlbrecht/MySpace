# Arquitetura atual

HTML/CSS/JavaScript clássico no navegador e Node/CommonJS no servidor. Sem build, bundler ou framework. `dist/` contém o código servido e editável, apesar do nome. Este mapa descreve o estado atual; os relatórios datados registram etapas anteriores.

## Boot e dependências

`server.cjs` serve `dist/` e os endpoints locais. O signaling PARTY possui servidor próprio em `server/party/signaling-server.cjs`. `iniciar.cmd`/`launcher.bat` coordenam os dois processos.

`dist/index.html` declara a ordem de scripts. `app.js` cria o perfil e **uma** instância `SPACEAMP`; `extras.js` compõe Collection, playlist e PARTY. Catalog e TitlePages carregam depois dessa composição. Callbacks de catálogo são usados após o boot, não durante sua definição.

Collection mantém dirty/primeiro render em `collection/collection-view.js`; `extras.js` invalida por mudanças de items e ativa a view pela rota. `profile-extras-view.js` possui o único dirty flag da Gallery: primeira entrada renderiza photos atuais, e mudanças invalidam por callback do compositor. PARTY mantém scripts disponíveis, mas sua instância é criada por `extras.js` somente na primeira rota `#spacevoice` (incluindo `?party`) e reutilizada nas próximas entradas. Assets estáticos usam ETag de metadata e `no-cache` para revalidar sem corpo em 304; APIs mantêm `no-store`.

Os módulos internos carregam antes das fachadas que os usam:

| Módulo interno | Consumidor |
|---|---|
| `music/music-source-link.js`, `spaceamp/spaceamp-global-ui.js` | `music/music-bridge.js` |
| `profile-appearance.js`, `backup-validation.js` | `extras.js` |
| `profile-extras-view.js` | `extras.js` |
| `party-chat-ui.js` | `spacevoice.js` |
| `title/title-gallery.js` | `title-pages.js` |
| `music/title-artist-view.js` | `title-pages.js` |
| `music/music-discovery-view.js`, `music/music-collection-matches.js` | `title-pages.js` |
| `xmb/xmb-quick-menu.js` | `spaceamp/spaceamp-now-playing.js` |
| `spaceamp/spaceamp-visualizer.js` | `spaceamp/spaceamp-now-playing.js` |
| `spaceamp/spaceamp-lyrics-navigation.js`, `spaceamp/spaceamp-now-playing-input.js` | `spaceamp/spaceamp-now-playing.js` |
| `spaceamp/spaceamp-lyrics-profile.js` | `spaceamp/spaceamp-now-playing.js` |
| `backup-restoration.js` | `extras.js` |

## Collection, catálogo e títulos

`collection/collection.js` valida o modelo e aplica filtros. `collection/collection-view.js` apresenta capas/lista e conecta o XMB pelos callbacks existentes. `CollectionActions`, composto por `extras.js`, mantém gravação, edição e integração musical. Não há um segundo armazenamento da coleção nos módulos visuais.

`catalog.js` mantém busca/detalhes e seus caches no navegador; `catalog/catalog-discovery.js` trata sugestões. `catalog/catalog-ui.js` apresenta agrupamentos. `editor-ui.js` organiza os formulários, enquanto `title-pages.js` coordena busca e fichas. `title/title-gallery.js` possui o diálogo da galeria, navegação e seleção de banner, sem possuir o estado do título.

`music/music-discovery-view.js` possui pool/visible/seen/rotation e reconciliação da apresentação das recomendações; recebe Catalog, MusicPageUI, CollectionActions, MusicModel e callbacks de DOM/navegação. `music/music-collection-matches.js` possui reconciliação local da seção por gêneros, lendo o item ativo por callback. Matching e seleção permanecem em `music/music-page-ui.js`; TitlePages mantém rota, item ativo e fases async. Nenhum store ou cache de provider foi duplicado.

`createArtistTitleView` em `music/title-artist-view.js` apresenta músicas populares, similares e discografia, incluindo filtros/sort, janela progressiva, card map, contador, expansão/recolhimento e paginação legacy. Recebe sete dependências explícitas e expõe `append`/`patch`; o patch recebe o item já reconciliado e atualiza a seção existente sem criar uma discografia temporária. Retry chama `onRetryDiscography`; rota, revision/abort, CORE/FULL e `activeItem` continuam em TitlePages.

`createProfileExtrasView` em `profile-extras-view.js` possui UI/edição de vídeo, top 8, selinhos, fotos, featured collection e blocos, mais visibilidade/ordem. Recebe `getData`, callbacks de mutação, atividade da Gallery, primitivas DOM e o contrato coeso do editor compartilhado. Callbacks de arquivos de vídeo são fornecidos por `extras.js`; a view possui URLs/validade visual, sem gravar storage diretamente. O compositor mantém dados/save/histórico, CollectionActions, CRUD, rotas, Collection, playlist, PARTY e backup. Nenhuma nova fachada, store ou cache foi criado.

Música: YouTube Music fornece catálogo, identidade, artwork, discografia e playback identity via `server/music/youtube-music.cjs`. Last.fm fornece editorial/tags/discovery signal; `server/music/music-catalog.cjs` coordena resolução e providers existentes. MusicBrainz/lrc.red auxiliam identifiers quando aplicável. Apple/iTunes e Deezer permanecem somente nos caminhos legacy ainda suportados. Veja [arquitetura musical](music/architecture.md) e [contratos](contracts.md).

Detalhes de artista mantêm CORE rápido com previews. FULL resolve Albums e Singles & EPs pelos handles oficiais YouTube Music, em paralelo ao editorial, e amplia a seção existente por ID canônico. Falhas preservam o CORE; parser, client e UI mantêm ownership existente, sem endpoint público, cache ou persistência paralelos.

## Música e SPACEAMP

`spaceamp/spaceamp.js` contém o estado/controlador público. `app.js` mantém o host de reprodução e adapters existentes; `playlist.js` mantém a seleção/fila e restauração local. `spaceamp/spaceamp-integrations.js` integra YouTube e Media Session.

`spaceamp/spaceamp-now-playing.js` mantém modal, preferências, componente/importação de lyrics, clock/seek, artwork/palette e lifecycle. `spaceamp/spaceamp-lyrics-profile.js` possui exclusivamente o perfil de paint no Shadow DOM e seus observers; recebe `isCurrent(component)` e expõe `apply`/`clear`, chamados pelo shell ao montar/trocar/fechar. Não consulta providers nem controla tempo, scroll ou playback. `spaceamp/spaceamp-visualizer.js` possui analyser/context/bins e apresentação do canvas, recebendo o SPACEAMP existente e o shell. Captura o elemento áudio existente sem rerotear saída audível; não controla playback. `spaceamp/spaceamp-atmosphere.js` continua independente. `spaceamp/spaceamp-now-playing-input.js` coordena ações semânticas, grupos/ranges, foco e entrada/retorno do pane lyrics por callbacks explícitos. `spaceamp/spaceamp-lyrics-navigation.js` concentra acesso ao Shadow DOM para seleção, ativação nativa e scroll manual; não possui clock, seek, autoscroll ou providers. O perfil visual continua separado. Artwork/palette permanece no shell: decode, handoff, motion e lifecycle ainda compartilham estado.

`music/music-bridge.js` preserva a fachada `MusicBridge` e coordena Collection → player e player → Collection. `music/music-source-link.js` possui lookup, tarefas em andamento, `autoLink()` confiante de YouTube, candidatos `choose` e diálogo de vínculo/override manual; identidade de catálogo permanece separada da fonte, e resultados stale são descartados. `spaceamp/spaceamp-global-ui.js` possui dock/perfil, preferências de apresentação, posicionamento e controles; lê o mesmo `SPACEAMP`. Não cria audio, YT.Player, fila ou volume próprios.

## PARTY e voz

`spacevoice.js` compõe a UI e coordena a sala/chamada. `party-chat-ui.js` possui DOM das mensagens, composição visual e unread; `voice/chat.js` mantém draft, deduplicação, typing e protocolo. O compositor mantém a escolha do rail de contexto e a conexão do chat com a sala.

`voice/room.js` possui sala/presença/chat; `voice/session.js` coordena peers; `voice/peer.js` cuida das conexões. Media, devices, levels, signaling e ICE permanecem nos seus módulos existentes. ROOM e CALL têm ciclos diferentes: sair da voz não equivale a sair da sala. Interfaces internas novas não possuem streams, sockets ou timers de transporte.

## Aparência, motion e persistência

`profile-appearance.js` edita/aplica preferências globais e XMB, recebendo leitura/gravação de `extras.js`. `motion.css` mantém os tokens comuns; `xmb/xmb.js`/`xmb.css` controlam a apresentação fullscreen. Não duplicar regras de mídia no XMB.

CSS: `style.css` é a base; `extras.css` cobre perfil, seções e editores; `title-pages.css` contém o trecho de fichas/galerias e compatibilidade responsiva extraído; `interface.css` aplica os refinamentos comuns; SPACEAMP/PARTY/XMB têm folhas próprias. A ordem dos links é parte da cascata e deve ser preservada.

Perfil/extras/preferências ficam em localStorage; áudios/vídeos locais ficam no IndexedDB via `media-storage.js`. `media-package.js` possui o pacote binário. `backup-validation.js` valida sem gravar; `backup-restoration.js` executa a transação de aplicação/rollback existente com callbacks persist/save. Confirmação e atualização pós-restauração de UI/playlist permanecem em `extras.js`. Formatos e chaves existentes foram preservados. Views antigas ainda gravam preferências diretamente; novas extrações não ampliam essa dívida.

## Globals e limites

Fachadas compartilhadas: `Collection`, `CollectionActions`, `Catalog`, `TitlePages`, `MusicBridge`, `SPACEAMP`, `PARTY_ROOM`. Funções de composição recebem callbacks explícitos, sem registro de serviços. Os helpers de perfil `safeUrl`, `image`, `$` e `toast` ainda vêm de `app.js`; devem carregar antes das views. `MusicModel`, `MediaEmbeds` e `TitlePreferences` são dependências dos fluxos de mídia/backup.

Não mover scripts de ordem sem atualizar também os harnesses VM e HTML isolado. Não transformar módulos visuais em donos de persistência ou reprodução. Para localizar alterações específicas, veja [module-map.md](module-map.md); para executar validações, veja [../tests/README.md](../tests/README.md).

## XMB e Quick Menu

`xmb/xmb-quick-menu.js` é o shell de comandos do sistema, montado uma vez e sob demanda; possui rail, foco e lifecycle do dialog. Música é composta pelo Now Playing com getters/commands explícitos para o SPACEAMP e suas preferências existentes; Sistema recebe callbacks de fullscreen/saída do XMB. As duas seções são compostas diretamente, sem registry/framework. O menu não possui playback, fila, storage ou preferências.

XMB fornece o callback da apresentação/handoff e conserva fullscreen/exit; input do Now Playing fornece retorno player/lyrics. O adapter de lyrics descobre e ativa somente controles públicos nativos. Atalhos de face buttons pertencem aos controllers atuais e usam transport/range existentes. O dialog modal fica no top layer, com prioridade sobre input das superfícies atrás dele. A quick bar permanece para mouse/teclado, fora da malha principal do gamepad. Eventos de trackchange atualizam o dialog em lugar; só uma promoção real de vídeo pede reordenação no top layer.
