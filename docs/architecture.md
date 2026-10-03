# Arquitetura atual

HTML/CSS/JavaScript clássico no navegador e Node/CommonJS no servidor. Sem build, bundler ou framework. `dist/` contém o código servido e editável, apesar do nome. Este mapa descreve o estado atual; os relatórios datados registram etapas anteriores.

## Boot e dependências

`server.cjs` serve `dist/` e os endpoints locais. O signaling PARTY possui servidor próprio em `server/signaling-server.cjs`. `iniciar.cmd`/`launcher.bat` coordenam os dois processos.

`dist/index.html` declara a ordem de scripts. `app.js` cria o perfil e **uma** instância `SPACEAMP`; `extras.js` compõe Collection, playlist e PARTY. Catalog e TitlePages carregam depois dessa composição. Callbacks de catálogo são usados após o boot, não durante sua definição.

Os novos módulos internos carregam antes das fachadas que os usam:

| Módulo interno | Consumidor |
|---|---|
| `music-source-link.js`, `spaceamp-global-ui.js` | `music-bridge.js` |
| `profile-appearance.js`, `backup-validation.js` | `extras.js` |
| `party-chat-ui.js` | `spacevoice.js` |
| `title-gallery.js` | `title-pages.js` |

## Collection, catálogo e títulos

`collection.js` valida o modelo e aplica filtros. `collection-view.js` apresenta capas/lista e conecta o XMB pelos callbacks existentes. `CollectionActions`, composto por `extras.js`, mantém gravação, edição e integração musical. Não há um segundo armazenamento da coleção nos módulos visuais.

`catalog.js` mantém busca/detalhes e seus caches no navegador; `catalog-discovery.js` trata sugestões. `catalog-ui.js` apresenta agrupamentos. `editor-ui.js` organiza os formulários, enquanto `title-pages.js` coordena busca e fichas. `title-gallery.js` possui o diálogo da galeria, navegação e seleção de banner, sem possuir o estado do título.

Música: Apple/iTunes fornece catálogo, IDs e capas; `apple-normalize.cjs` converte o resultado. `artist-artwork.cjs` usa Deezer somente para foto. Last.fm fornece texto/recomendações; `music-catalog.cjs` resolve as sugestões para Apple. MusicBrainz fornece sugestões de links de reprodução, que exigem confirmação. `deezer.cjs`/`deezer-normalize.cjs` continuam disponíveis para ferramentas históricas, sem voltar a ser catálogo de produção.

## Música e SPACEAMP

`spaceamp.js` contém o estado/controlador público. `app.js` mantém o host de reprodução e adapters existentes; `playlist.js` mantém a seleção/fila e restauração local. `spaceamp-integrations.js` integra YouTube e Media Session.

`music-bridge.js` preserva a fachada `MusicBridge` e coordena Collection → player e player → Collection. `music-source-link.js` possui lookup, tarefas em andamento, resultados sugeridos e diálogo de vínculo. `spaceamp-global-ui.js` possui dock/perfil, preferências de apresentação, posicionamento e controles; lê o mesmo `SPACEAMP`. Não cria audio, YT.Player, fila ou volume próprios.

## PARTY e voz

`spacevoice.js` compõe a UI e coordena a sala/chamada. `party-chat-ui.js` possui DOM das mensagens, composição visual e unread; `voice/chat.js` mantém draft, deduplicação, typing e protocolo. O compositor mantém a escolha do rail de contexto e a conexão do chat com a sala.

`voice/room.js` possui sala/presença/chat; `voice/session.js` coordena peers; `voice/peer.js` cuida das conexões. Media, devices, levels, signaling e ICE permanecem nos seus módulos existentes. ROOM e CALL têm ciclos diferentes: sair da voz não equivale a sair da sala. Interfaces internas novas não possuem streams, sockets ou timers de transporte.

## Aparência, motion e persistência

`profile-appearance.js` edita/aplica preferências globais e XMB, recebendo leitura/gravação de `extras.js`. `motion.css` mantém os tokens comuns; `xmb.js`/`xmb.css` controlam a apresentação fullscreen. Não duplicar regras de mídia no XMB.

CSS: `style.css` é a base; `extras.css` cobre perfil, seções e editores; `title-pages.css` contém o trecho de fichas/galerias e compatibilidade responsiva extraído; `interface.css` aplica os refinamentos comuns; SPACEAMP/PARTY/XMB têm folhas próprias. A ordem dos links é parte da cascata e deve ser preservada.

Perfil/extras/preferências ficam em localStorage; áudios/vídeos locais ficam no IndexedDB via `media-storage.js`. `media-package.js` possui o pacote binário. `backup-validation.js` valida a importação sem gravar armazenamento; confirmação, aplicação e rollback permanecem em `extras.js`. Formatos e chaves existentes foram preservados.

## Globals e limites

Fachadas compartilhadas: `Collection`, `CollectionActions`, `Catalog`, `TitlePages`, `MusicBridge`, `SPACEAMP`, `PARTY_ROOM`. Funções de composição recebem callbacks explícitos, sem registro de serviços. Os helpers de perfil `safeUrl`, `image`, `$` e `toast` ainda vêm de `app.js`; devem carregar antes das views. `MusicModel`, `MediaEmbeds` e `TitlePreferences` são dependências dos fluxos de mídia/backup.

Não mover scripts de ordem sem atualizar também os harnesses VM e HTML isolado. Não transformar módulos visuais em donos de persistência ou reprodução. Para localizar alterações específicas, veja [module-map.md](module-map.md); para executar validações, veja [../tests/README.md](../tests/README.md).
