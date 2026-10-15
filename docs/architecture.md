# Arquitetura atual

HTML/CSS/JavaScript clássico no navegador e Node/CommonJS no servidor. Sem build, bundler ou framework. `dist/` contém o código servido e editável, apesar do nome. Este mapa descreve o estado atual; os relatórios datados registram etapas anteriores.

## Boot e dependências

DesktopFolders possui as referências de pastas de músicas/jogos no localStorage
do Desktop. A janela de diagnóstico existente compõe o owner e a mesma ponte
Tauri; Rust consulta apenas metadata de diretórios, sem scanner ou leitura de
conteúdo. As referências locais da máquina não integram a Collection ou backup.

PoC desktop: `src-tauri/` carrega `dist/` diretamente com Tauri 2, sem iniciar
Node ou servidor HTTP no release. `desktop/desktop-poc.js` só monta no ambiente
nativo e testa o seletor oficial de arquivos. A migração dos endpoints/providers
permanece pendente; a PoC não substitui o runtime browser atual. Estado, limites,
transferência dos dados e aceite nativo estão em [Desktop Tauri](desktop-tauri.md).

`server.cjs` serve `dist/` e os endpoints locais. O signaling PARTY possui servidor próprio em `server/party/signaling-server.cjs`. `iniciar.cmd`/`launcher.bat` coordenam os dois processos.

MediaDownload centraliza UI de progresso e AbortController para downloads autorizados. A rota POST transmite o arquivo; uma rota GET lê o estado transitório da mesma operação. Desconexão aborta yt-dlp/FFmpeg e limpa temporários; consumidores reutilizam esse fluxo (incluindo a sequência do álbum).

`dist/index.html` declara a ordem de scripts. `app.js` cria o perfil e **uma** instância `SPACEAMP`; `extras.js` compõe Collection, playlist e PARTY. Catalog e TitlePages carregam depois dessa composição. Callbacks de catálogo são usados após o boot, não durante sua definição.

Collection mantém dirty/primeiro render em `collection/collection-view.js`; `extras.js` invalida por mudanças de items e ativa a view pela rota. `profile/profile-extras-view.js` possui o único dirty flag da Gallery: primeira entrada renderiza photos atuais, e mudanças invalidam por callback do compositor. PARTY mantém scripts disponíveis, mas sua instância é criada por `extras.js` somente na primeira rota `#spacevoice` (incluindo `?party`) e reutilizada nas próximas entradas. Assets estáticos usam ETag de metadata e `no-cache` para revalidar sem corpo em 304; APIs mantêm `no-store`.

Os módulos internos carregam antes das fachadas que os usam:

| Módulo interno | Consumidor |
|---|---|
| `music/music-source-link.js`, `spaceamp/spaceamp-global-ui.js` | `music/music-bridge.js` |
| `profile/profile-appearance.js`, `backup/backup-validation.js` | `extras.js` |
| `profile/profile-extras-view.js` | `extras.js` |
| `party/party-chat-ui.js` | `party/spacevoice.js` |
| `title/title-gallery.js` | `title/title-pages.js` |
| `music/title-artist-view.js` | `title/title-pages.js` |
| `music/music-album-actions.js` | `title/title-pages.js`; delega playback à MusicBridge/playlist e downloads à MusicSourceLink |
| `music/music-discovery-view.js`, `music/music-collection-matches.js` | `title/title-pages.js` |
| `xmb/xmb-quick-menu.js` | `spaceamp/spaceamp-now-playing.js` |
| `spaceamp/spaceamp-visualizer.js` | `spaceamp/spaceamp-now-playing.js` |
| `spaceamp/spaceamp-lyrics-navigation.js`, `spaceamp/spaceamp-now-playing-input.js` | `spaceamp/spaceamp-now-playing.js` |
| `spaceamp/spaceamp-lyrics-profile.js` | `spaceamp/spaceamp-now-playing.js` |
| `backup/backup-restoration.js` | `extras.js` |
| `xmb/xmb-artwork-storage.js` | `extras.js`, `artwork.js`, `backup/media-package.js` |

## Collection, catálogo e títulos

`collection/collection.js` valida o modelo e aplica filtros. `collection/collection-view.js` apresenta capas/lista e conecta o XMB pelos callbacks existentes. `CollectionActions`, composto por `extras.js`, mantém gravação, edição e integração musical. Não há um segundo armazenamento da coleção nos módulos visuais.

`catalog/catalog.js` mantém busca/detalhes e seus caches no navegador; `catalog/catalog-discovery.js` trata sugestões. `catalog/catalog-ui.js` apresenta agrupamentos. `editor-ui.js` organiza os formulários, enquanto `title/title-pages.js` coordena busca e fichas. `title/title-gallery.js` possui o diálogo da galeria, navegação e seleção de banner, sem possuir o estado do título.

`music/music-discovery-view.js` possui pool/visible/seen/rotation e reconciliação da apresentação das recomendações; recebe Catalog, MusicPageUI, CollectionActions, MusicModel e callbacks de DOM/navegação. `music/music-collection-matches.js` possui reconciliação local da seção por gêneros, lendo o item ativo por callback. Matching e seleção permanecem em `music/music-page-ui.js`; TitlePages mantém rota, item ativo e fases async. Nenhum store ou cache de provider foi duplicado.

`createArtistTitleView` em `music/title-artist-view.js` apresenta músicas populares, similares e discografia, incluindo filtros/sort, janela progressiva, card map, contador, expansão/recolhimento e paginação legacy. Recebe sete dependências explícitas e expõe `append`/`patch`; o patch recebe o item já reconciliado e atualiza a seção existente sem criar uma discografia temporária. Retry chama `onRetryDiscography`; rota, revision/abort, CORE/FULL e `activeItem` continuam em TitlePages.

`createProfileExtrasView` em `profile/profile-extras-view.js` possui UI/edição de vídeo, música em destaque, top 8, selinhos, fotos, featured collection e blocos, mais visibilidade/ordem. Recebe `getData`, callbacks de mutação, atividade da Gallery, primitivas DOM e o contrato coeso do editor compartilhado. A view lê/grava destaques por `getData`/`save` e delega a reprodução ao MusicBridge; não cria player nem adiciona automaticamente à Collection. Callbacks de arquivos de vídeo são fornecidos por `extras.js`; a view possui URLs/validade visual, sem gravar storage diretamente. O compositor mantém dados/save, CollectionActions, CRUD, rotas, Collection, playlists persistentes, PARTY e backup. Nenhuma nova fachada, store ou cache foi criado.

Música: YouTube Music fornece o catálogo, identidade, artwork, discografia e playback identity via `server/music/youtube-music.cjs`; seu parser classifica áudio/vídeo e compartilha renderers entre busca, watch queue e rádio. Last.fm fornece editorial/tags/discovery signal. `server/music/music-catalog.cjs` coordena esses providers; MusicBrainz/lrc.red permanecem auxiliares de identificadores para lyrics. YouTube Music é a identidade canônica do catálogo; Apple Music/iTunes e Deezer não são suportados. Linhas de álbum vinculadas a clipes resolvem uma fonte ATV no FULL da faixa selecionada, preservando identidade/edição/capa e sem lookup por linha de lista. Catalog/TitlePages propagam essa fonte, e a rádio usa o ID de áudio. Veja [arquitetura musical](music/architecture.md) e [contratos](contracts.md).

Detalhes de artista mantêm CORE rápido com previews. FULL resolve Albums e Singles & EPs pelos handles oficiais YouTube Music, em paralelo ao editorial, e amplia a seção existente por ID canônico. Falhas preservam o CORE; parser, client e UI mantêm ownership existente, sem endpoint público, cache ou persistência paralelos.

## Música e SPACEAMP

`spaceamp/spaceamp.js` contém o estado/controlador público. `app.js` mantém o host de reprodução e adapters existentes; a faixa do SPACEAMP é estado runtime independente da música em destaque do perfil. `music/playback-context.js` normaliza a intenção/origem de uma sessão (`album`, `playlist`, `discovery`, `search`, `collection` ou `single`); `music/queue-manager.js` possui a sequência transitória, índice, histórico, shuffle, repeat e revisões stale. `music/playlist.js` coordena seleção/resolução de faixa, navegação e apresentação da fila, além da UI de playlists salvas; seus CRUDs persistentes usam `extras.js` como owner de dados/save. Fila e contexto não são gravados como playlist nem retomados no reload. `spaceamp/spaceamp-integrations.js` integra YouTube e Media Session.

`extras.js` persiste playlists atuais e `featuredMusic`; não converte formatos antigos nem inicia playback durante o boot. O SPACEAMP publica a fila/contexto ativos por sua API pública; nenhuma view cria player, fila ou storage paralelo.

`spaceamp/spaceamp-now-playing.js` mantém modal, preferências, componente/importação de lyrics, clock/seek, artwork/palette e lifecycle. `spaceamp/spaceamp-lyrics-profile.js` possui exclusivamente o perfil de paint no Shadow DOM e seus observers; recebe `isCurrent(component)` e expõe `apply`/`clear`, chamados pelo shell ao montar/trocar/fechar. Não consulta providers nem controla tempo, scroll ou playback. `spaceamp/spaceamp-visualizer.js` possui analyser/context/bins e apresentação do canvas, recebendo o SPACEAMP existente e o shell. Captura o elemento áudio existente sem rerotear saída audível; não controla playback. `spaceamp/spaceamp-atmosphere.js` continua independente. `spaceamp/spaceamp-now-playing-input.js` coordena ações semânticas, grupos/ranges, foco e entrada/retorno do pane lyrics por callbacks explícitos. `spaceamp/spaceamp-lyrics-navigation.js` concentra acesso ao Shadow DOM para seleção, ativação nativa e scroll manual; não possui clock, seek, autoscroll ou providers. O perfil visual continua separado. Artwork/palette permanece no shell: decode, handoff, motion e lifecycle ainda compartilham estado.

`music/music-bridge.js` preserva a fachada `MusicBridge` e coordena Collection → player e player → Collection. `music/music-source-link.js` possui lookup, tarefas em andamento, `autoLink()` confiante de YouTube, candidatos `choose` e diálogo de vínculo/override manual; identidade de catálogo permanece separada da fonte, e resultados stale são descartados. `spaceamp/spaceamp-global-ui.js` possui dock/perfil, preferências de apresentação, posicionamento e controles; lê o mesmo `SPACEAMP`. Não cria audio, YT.Player, fila ou volume próprios.

## PARTY e voz

`party/spacevoice.js` compõe a UI e coordena a sala/chamada. `party/party-chat-ui.js` possui DOM das mensagens, composição visual e unread; `voice/chat.js` mantém draft, deduplicação, typing e protocolo. O compositor mantém a escolha do rail de contexto e a conexão do chat com a sala.

`voice/room.js` possui sala/presença/chat; `voice/session.js` coordena peers; `voice/peer.js` cuida das conexões. Media, devices, levels, signaling e ICE permanecem nos seus módulos existentes. ROOM e CALL têm ciclos diferentes: sair da voz não equivale a sair da sala. Interfaces internas novas não possuem streams, sockets ou timers de transporte.

## Aparência, motion e persistência

`profile/profile-appearance.js` edita/aplica preferências globais e XMB, recebendo leitura/gravação de `extras.js`. `motion.css` mantém os tokens comuns; `xmb/xmb.js`/`xmb.css` controlam a apresentação fullscreen. Não duplicar regras de mídia no XMB.

CSS: `style.css` é a base; `extras.css` cobre perfil, seções e editores; `title-pages.css` contém o trecho de fichas/galerias e compatibilidade responsiva extraído; `interface.css` aplica os refinamentos comuns; SPACEAMP/PARTY/XMB têm folhas próprias. A ordem dos links é parte da cascata e deve ser preservada.

Perfil/extras/preferências ficam em localStorage; mídia binária local fica no IndexedDB via `media/media-storage.js`. Arte XMB guarda o original e derivados para miniatura (384 px), tela (1280 px) e fundo em tela cheia (até 2560 px); `xmbArt` mantém somente a referência `xmb-art:` na coleção. Wallpapers locais da Aparência usam a mesma preparação e os campos `appearance.background` e `appearance.xmb.customBackground` guardam referências `appearance-art:`. `xmb/xmb-artwork-storage.js` prepara, resolve e remove esses arquivos; `artwork.js` carrega os derivados sem decodificar repetidamente os originais. `backup/media-package.js` empacota os originais e derivados junto das referências. `backup/backup-validation.js` valida sem gravar; `backup/backup-restoration.js` executa a transação de aplicação/rollback existente com callbacks persist/save. Confirmação e atualização pós-restauração de UI/playlist permanecem em `extras.js`. Imagens Base64 antigas do XMB e dos wallpapers da Aparência migram para o IndexedDB ao carregar a Collection; as referências só substituem os valores antigos depois que os arquivos foram armazenados. Views antigas ainda gravam preferências diretamente; novas extrações não ampliam essa dívida.

## Globals e limites

Fachadas compartilhadas: `Collection`, `CollectionActions`, `Catalog`, `TitlePages`, `MusicBridge`, `SPACEAMP`, `PARTY_ROOM`. Funções de composição recebem callbacks explícitos, sem registro de serviços. Os helpers de perfil `safeUrl`, `image`, `$` e `toast` ainda vêm de `app.js`; devem carregar antes das views. `MusicModel`, `MediaEmbeds` e `TitlePreferences` são dependências dos fluxos de mídia/backup.

Não mover scripts de ordem sem atualizar também os harnesses VM e HTML isolado. Não transformar módulos visuais em donos de persistência ou reprodução. Para localizar alterações específicas, veja [module-map.md](module-map.md); para executar validações, veja [../tests/README.md](../tests/README.md).

## XMB e Quick Menu

O XMB resolve a apresentação musical a partir do snapshot/eventos do SPACEAMP:
fundo da faixa, depois fundo do álbum associado por albumCatalogId e depois capa.
A arte de jogo selecionado tem prioridade fora de Música. O owner XMB mantém o
backdrop e o vídeo de ondas em `xmb-media/`, pausando recursos fora da superfície;
CRT/Dim tratam o fundo musical e pop-ups, sem tocar o renderer am-lyrics.
O editor usa CollectionActions para a faixa e a capa compartilhada do álbum.

`xmb/xmb.js` compõe sete áreas do sistema e pastas de tipos da Collection nas áreas
Música, Vídeo e Leitura. A hierarquia, seleção e scroll são estado local de
apresentação; o modelo e os filtros da Collection permanecem nos owners existentes.
Áreas diretas não ganham um nível artificial. O pipeline semântico de input,
fullscreen e handoff continua nos módulos XMB existentes, sem playback paralelo.

`xmb/xmb-vita.js` apresenta atalhos de jogos sobre o XMB, com grade 3–4–3,
paginação vertical e LiveArea. O XMB conserva sua árvore, seleção, scroll e relógio;
o overlay recebe o input sem recriar o owner. `CollectionActions.setVitaShortcuts`
grava a ordem `xmbVitaOrder` em uma operação, sem alterar a ordenação da coleção
ou `xmbPinned`. Ícones reutilizam `xmbArt.bubble` e o armazenamento de artes existente.
Não há biblioteca, fila, player musical ou storage próprios da apresentação Vita.

`spaceamp/system-sounds.js` é o banco limitado de efeitos curtos do shell,
instanciado uma vez por `app.js`. SPACEAMP expõe `systemSound`/`stopSystemSounds`
como comandos sem alterar track, fila, transport ou volume da música. XMB, Vita e
Quick Menu escolhem efeitos conforme seus estados; o engine mantém buffers,
limita vozes, substitui o loop da dobra e interrompe efeitos ao ocultar/mutar.
A preferência continua no owner de Aparência, sem storage no engine.

`xmb/xmb-quick-menu.js` é o shell de comandos do sistema, montado uma vez e sob demanda; possui rail, foco e lifecycle do dialog. Música é composta pelo Now Playing com getters/commands explícitos para o SPACEAMP e suas preferências existentes; Sistema recebe callbacks de fullscreen/saída do XMB. As duas seções são compostas diretamente, sem registry/framework. O menu não possui playback, fila, storage ou preferências.

XMB fornece o callback da apresentação/handoff e conserva fullscreen/exit; input do Now Playing fornece retorno player/lyrics. O adapter de lyrics descobre e ativa somente controles públicos nativos. Atalhos de face buttons pertencem aos controllers atuais e usam transport/range existentes. O dialog modal fica no top layer, com prioridade sobre input das superfícies atrás dele. A quick bar permanece para mouse/teclado, fora da malha principal do gamepad. Eventos de trackchange atualizam o dialog em lugar; só uma promoção real de vídeo pede reordenação no top layer.
