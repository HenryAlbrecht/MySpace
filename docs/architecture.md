# Arquitetura atual

HTML/CSS/JavaScript clássico no navegador e Node/CommonJS no servidor. Sem build, bundler ou framework. `dist/` contém o código servido e editável, apesar do nome. Este mapa descreve o estado atual; os relatórios datados registram etapas anteriores.

## Boot e dependências

`server.cjs` serve `dist/` e os endpoints locais. O signaling PARTY possui servidor próprio em `server/signaling-server.cjs`. `iniciar.cmd`/`launcher.bat` coordenam os dois processos.

`dist/index.html` declara a ordem de scripts. `app.js` cria o perfil e **uma** instância `SPACEAMP`; `extras.js` compõe Collection, playlist e PARTY. Catalog e TitlePages carregam depois dessa composição. Callbacks de catálogo são usados após o boot, não durante sua definição.

Collection mantém dirty/primeiro render em `collection-view.js`; `extras.js` invalida por mudanças de items e ativa a view pela rota. `profile-extras-view.js` possui o único dirty flag da Gallery: primeira entrada renderiza photos atuais, e mudanças invalidam por callback do compositor. PARTY mantém scripts disponíveis, mas sua instância é criada por `extras.js` somente na primeira rota `#spacevoice` (incluindo `?party`) e reutilizada nas próximas entradas. Assets estáticos usam ETag de metadata e `no-cache` para revalidar sem corpo em 304; APIs mantêm `no-store`.

Os novos módulos internos carregam antes das fachadas que os usam:

| Módulo interno | Consumidor |
|---|---|
| `music-source-link.js`, `spaceamp-global-ui.js` | `music-bridge.js` |
| `profile-appearance.js`, `backup-validation.js` | `extras.js` |
| `profile-extras-view.js` | `extras.js` |
| `party-chat-ui.js` | `spacevoice.js` |
| `title-gallery.js` | `title-pages.js` |
| `title-artist-view.js` | `title-pages.js` |
| `music-discovery-view.js`, `music-collection-matches.js` | `title-pages.js` |
| `spaceamp-visualizer.js` | `spaceamp-now-playing.js` |
| `spaceamp-lyrics-profile.js` | `spaceamp-now-playing.js` |
| `backup-restoration.js` | `extras.js` |

## Collection, catálogo e títulos

`collection.js` valida o modelo e aplica filtros. `collection-view.js` apresenta capas/lista e conecta o XMB pelos callbacks existentes. `CollectionActions`, composto por `extras.js`, mantém gravação, edição e integração musical. Não há um segundo armazenamento da coleção nos módulos visuais.

`catalog.js` mantém busca/detalhes e seus caches no navegador; `catalog-discovery.js` trata sugestões. `catalog-ui.js` apresenta agrupamentos. `editor-ui.js` organiza os formulários, enquanto `title-pages.js` coordena busca e fichas. `title-gallery.js` possui o diálogo da galeria, navegação e seleção de banner, sem possuir o estado do título.

`music-discovery-view.js` possui pool/visible/seen/rotation e reconciliação da apresentação das recomendações; recebe Catalog, MusicPageUI, CollectionActions, MusicModel e callbacks de DOM/navegação. `music-collection-matches.js` possui reconciliação local da seção por gêneros, lendo o item ativo por callback. Matching e seleção permanecem em `music-page-ui.js`; TitlePages mantém rota, item ativo e fases async. Nenhum store ou cache de provider foi duplicado.

`createArtistTitleView` em `title-artist-view.js` apresenta músicas populares, similares e discografia, incluindo filtros/sort, janela progressiva, card map, contador, expansão/recolhimento e paginação legacy. Recebe sete dependências explícitas e expõe `append`/`patch`; o patch recebe o item já reconciliado e atualiza a seção existente sem criar uma discografia temporária. Retry chama `onRetryDiscography`; rota, revision/abort, CORE/FULL e `activeItem` continuam em TitlePages.

`createProfileExtrasView` em `profile-extras-view.js` possui UI/edição de vídeo, top 8, selinhos, fotos, featured collection e blocos, mais visibilidade/ordem. Recebe `getData`, callbacks de mutação, atividade da Gallery, primitivas DOM e o contrato coeso do editor compartilhado. Callbacks de arquivos de vídeo são fornecidos por `extras.js`; a view possui URLs/validade visual, sem gravar storage diretamente. O compositor mantém dados/save/histórico, CollectionActions, CRUD, rotas, Collection, playlist, PARTY e backup. Nenhuma nova fachada, store ou cache foi criado.

Música: YouTube Music fornece catálogo, identidade, artwork, discografia e playback identity via `server/youtube-music.cjs`. Last.fm fornece editorial/tags/discovery signal; `music-catalog.cjs` coordena resolução e providers existentes. MusicBrainz/lrc.red auxiliam identifiers quando aplicável. Apple/iTunes e Deezer permanecem somente nos caminhos legacy ainda suportados. Veja [arquitetura musical](music/architecture.md) e [contratos](contracts.md).

Detalhes de artista mantêm CORE rápido com previews. FULL resolve Albums e Singles & EPs pelos handles oficiais YouTube Music, em paralelo ao editorial, e amplia a seção existente por ID canônico. Falhas preservam o CORE; parser, client e UI mantêm ownership existente, sem endpoint público, cache ou persistência paralelos.

## Música e SPACEAMP

`spaceamp.js` contém o estado/controlador público. `app.js` mantém o host de reprodução e adapters existentes; `playlist.js` mantém a seleção/fila e restauração local. `spaceamp-integrations.js` integra YouTube e Media Session.

`spaceamp-now-playing.js` mantém modal, preferências, componente/importação de lyrics, clock/seek, artwork/palette e lifecycle. `spaceamp-lyrics-profile.js` possui exclusivamente o perfil de paint no Shadow DOM e seus observers; recebe `isCurrent(component)` e expõe `apply`/`clear`, chamados pelo shell ao montar/trocar/fechar. Não consulta providers nem controla tempo, scroll ou playback. `spaceamp-visualizer.js` possui analyser/context/bins e apresentação do canvas, recebendo o SPACEAMP existente e o shell. Captura o elemento áudio existente sem rerotear saída audível; não controla playback. `spaceamp-atmosphere.js` continua independente. Artwork/palette e o restante do adapter lyrics permanecem candidatos futuros.

`music-bridge.js` preserva a fachada `MusicBridge` e coordena Collection → player e player → Collection. `music-source-link.js` possui lookup, tarefas em andamento, resultados sugeridos e diálogo de vínculo. `spaceamp-global-ui.js` possui dock/perfil, preferências de apresentação, posicionamento e controles; lê o mesmo `SPACEAMP`. Não cria audio, YT.Player, fila ou volume próprios.

## PARTY e voz

`spacevoice.js` compõe a UI e coordena a sala/chamada. `party-chat-ui.js` possui DOM das mensagens, composição visual e unread; `voice/chat.js` mantém draft, deduplicação, typing e protocolo. O compositor mantém a escolha do rail de contexto e a conexão do chat com a sala.

`voice/room.js` possui sala/presença/chat; `voice/session.js` coordena peers; `voice/peer.js` cuida das conexões. Media, devices, levels, signaling e ICE permanecem nos seus módulos existentes. ROOM e CALL têm ciclos diferentes: sair da voz não equivale a sair da sala. Interfaces internas novas não possuem streams, sockets ou timers de transporte.

## Aparência, motion e persistência

`profile-appearance.js` edita/aplica preferências globais e XMB, recebendo leitura/gravação de `extras.js`. `motion.css` mantém os tokens comuns; `xmb.js`/`xmb.css` controlam a apresentação fullscreen. Não duplicar regras de mídia no XMB.

CSS: `style.css` é a base; `extras.css` cobre perfil, seções e editores; `title-pages.css` contém o trecho de fichas/galerias e compatibilidade responsiva extraído; `interface.css` aplica os refinamentos comuns; SPACEAMP/PARTY/XMB têm folhas próprias. A ordem dos links é parte da cascata e deve ser preservada.

Perfil/extras/preferências ficam em localStorage; áudios/vídeos locais ficam no IndexedDB via `media-storage.js`. `media-package.js` possui o pacote binário. `backup-validation.js` valida sem gravar; `backup-restoration.js` executa a transação de aplicação/rollback existente com callbacks persist/save. Confirmação e atualização pós-restauração de UI/playlist permanecem em `extras.js`. Formatos e chaves existentes foram preservados. Views antigas ainda gravam preferências diretamente; novas extrações não ampliam essa dívida.

## Globals e limites

Fachadas compartilhadas: `Collection`, `CollectionActions`, `Catalog`, `TitlePages`, `MusicBridge`, `SPACEAMP`, `PARTY_ROOM`. Funções de composição recebem callbacks explícitos, sem registro de serviços. Os helpers de perfil `safeUrl`, `image`, `$` e `toast` ainda vêm de `app.js`; devem carregar antes das views. `MusicModel`, `MediaEmbeds` e `TitlePreferences` são dependências dos fluxos de mídia/backup.

Não mover scripts de ordem sem atualizar também os harnesses VM e HTML isolado. Não transformar módulos visuais em donos de persistência ou reprodução. Para localizar alterações específicas, veja [module-map.md](module-map.md); para executar validações, veja [../tests/README.md](../tests/README.md).
