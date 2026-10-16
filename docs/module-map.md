# Onde alterar cada responsabilidade

Todos os caminhos abaixo são relativos à raiz do repositório.

| Quero alterar… | Arquivos principais |
|---|---|
| Boot/perfil e reprodução no host existente | `dist/app.js`, `dist/index.html` |
| Desktop Tauri 2, grants e descoberta Steam/música local | registro/guards e abertura de arquivos `src-tauri/src/folder_access.rs`, comandos `src-tauri/src/main.rs`, Steam `src-tauri/src/steam_discovery.rs`, MP3/FLAC limitado `src-tauri/src/music_discovery.rs`, diagnóstico `dist/desktop/desktop-poc.js`/CSS e espelho de IDs `dist/desktop/desktop-folders.js`; testes `tests/project/desktop-folders.test.cjs`, `tests/project/desktop-poc.test.cjs` e testes Rust; contrato em `docs/desktop-tauri.md` |
| Steam local no XMB sem importar Collection | projeção `dist/desktop/desktop-game-library.js`, composição `desktop-poc.js`/`desktop-folders.js`, callback de jogos em `dist/collection/collection-view.js`, apresentação existente `dist/xmb/xmb.js`; focados `tests/project/desktop-game-library.test.cjs` e `tests/project/desktop-games-browser.cjs` |
| Iniciar jogo Steam pelo XMB Desktop | ação em `dist/xmb/xmb.js` via `desktop-game-library.js`/`desktop-poc.js`; comando `launch_steam` em `src-tauri/src/main.rs`, índice/dispatch `src-tauri/src/game_launch.rs`, validação compartilhada `steam_discovery.rs`; testes Rust `game_launch`, browser `desktop-games-browser.cjs` e nativo `run-native-playback.ps1 -Scenario game-launch` (dispatch simulado) |
| Músicas locais na Biblioteca e playback SPACEAMP | snapshot/handles `dist/desktop/desktop-music-library.js`, composição `desktop-poc.js`/`desktop-folders.js`, resolução `dist/music/music-bridge.js`, apresentação/lifecycle/fila existente `dist/music/playlist.js`, host `dist/app.js`; índice e Range nativo `src-tauri/src/music_stream.rs`; testes `tests/project/desktop-music-library.test.cjs`, `tests/project/desktop-music-browser.cjs` e `tests/project/run-native-playback.ps1` |
| Primeiro render/dirty Collection | `dist/collection/collection-view.js`; `dist/extras.js` somente para invalidação por dados/rota. Focado: `tests/boot-performance-browser.cjs` |
| Profile extras / gallery: vídeo, top 8, selinhos, blocos, favoritos, visibilidade e ordem | `dist/profile/profile-extras-view.js`; `dist/extras.js` somente para persistência/rotas/editor compartilhado. Focados: `tests/profile/profile-extras-browser.cjs`, `tests/boot-performance-browser.cjs` |
| Primeira criação PARTY e cache estático | `dist/extras.js` (mount único pela rota), `server.cjs` (ETag/304) |
| Persistência/ações da coleção e composição das seções | `dist/extras.js` |
| Validação, status e filtros da coleção | `dist/collection/collection.js` |
| Capas/lista/seleção e filtros visuais | `dist/collection/collection-view.js`, `dist/interface.css` |
| Quick Menu do sistema/XMB e composição explícita Música/Sistema | `dist/xmb/xmb-quick-menu.js`, `dist/xmb-quick-menu.css`. Focado: `node tests/spaceamp/spaceamp-browser.cjs quick-menu` |
| Áreas/pastas, seleção de faixas em playlists virtuais, fullscreen e detalhes XMB | `dist/xmb/xmb.js`, `dist/xmb.css`; playlists e playback delegam a `MusicBridge`. Focados: `node tests/spaceamp/spaceamp-browser.cjs navigation`, `xmb:playlists` e `handoff`; unitário `tests/xmb/xmb.test.cjs` |
| Atalhos PS Vita sobre o XMB: bolhas, páginas, edição e LiveArea | `dist/xmb/xmb-vita.js`, `dist/xmb-vita.css`; composição/input em `dist/xmb/xmb.js`; gravação por `CollectionActions.setVitaShortcuts` em `dist/extras.js`. Focados: `node --test tests/xmb/vita.test.cjs`, `node tests/spaceamp/spaceamp-browser.cjs vita`. Referência: `docs/xmb-vita.md` |
| Editor de arte e mídias do XMB; busca de arte SteamGridDB → IGDB, trilhas YouTube Music, vídeos pela busca própria do YouTube e downloads autorizados com intervalo configurável | `dist/xmb/xmb.js`, `dist/music/music-source-link.js`, `dist/music/music-bridge.js`, `dist/profile/profile-appearance.js`, `dist/media/media-download.js`, `dist/media/media-storage.js`, `dist/xmb/xmb-artwork-storage.js`, `dist/spaceamp/spaceamp.js`, `dist/app.js`, `server/media/game-art-search.cjs`, `server/media/xmb-game-media.cjs`, `server/media/youtube-search.cjs`, `server/media/authorized-media-download.cjs`, `server/media/steamgriddb.cjs`, `server/media/igdb.cjs`, `server.cjs` |
| Tokens/cores/base visual global | `dist/style.css` |
| Sons do sistema XMB/Vita/Quick Menu | `dist/spaceamp/system-sounds.js`, composto por `dist/app.js` e exposto via SPACEAMP; preferência em `dist/profile/profile-appearance.js`. Focados: `node --test tests/spaceamp/system-sounds.test.cjs`, `node tests/spaceamp/spaceamp-browser.cjs system-sounds`. Mapeamento: `docs/xmb-system-sounds.md` |
| Motion compartilhado e tokens de movimento | `dist/motion.css` |
| Direção espacial e continuidade de apresentação | `dist/motion-design.js` |
| Aparência global, CRT/Dim e wallpaper imagem/vídeo no desktop/XMB | `dist/profile/profile-appearance.js`, `dist/xmb/xmb-artwork-storage.js`, `dist/media/media-storage.js`, `dist/xmb.css` |
| Editor de itens e busca dentro do modal | `dist/editor-ui.js`, `dist/catalog/catalog-ui.js` |
| Busca, cache e detalhes no navegador | `dist/catalog/catalog.js` |
| Search musical / carregar mais | `server/music/youtube-music-parser.cjs` (renderer/next), `server/music/youtube-music.cjs` (request/token/cache/pending), `server/music/music-catalog.cjs` (coordenação), `server.cjs` (cursor HTTP), `dist/catalog/catalog.js` (searchPage/compatibility), `dist/title/title-pages.js` (lifecycle/append), `dist/catalog/catalog-ui.js` (homônimos incrementais). Focado: `tests/music/music-search-pagination-browser.cjs` |
| Descoberta da coleção e recomendações na ficha | `dist/catalog/catalog-discovery.js`, `dist/catalog/discovery-page.js`, `dist/title/title-pages.js` |
| Apresentação/reconciliação de recomendações musicais | `dist/music/music-discovery-view.js`, `dist/music/music-page-ui.js` |
| Relação da Collection por gêneros | `dist/music/music-collection-matches.js`, `dist/music/music-page-ui.js` |
| Fichas de títulos e seções por mídia | `dist/title/title-pages.js`, `dist/title-pages.css` |
| Artist Page / discografia: UI, filtros, ordenação e janela progressiva | `dist/music/title-artist-view.js`; `dist/music/music-page-ui.js` para controles musicais compartilhados. `dist/title/title-pages.js` somente para CORE/FULL/lifecycle. Focados: `tests/music/artist-discography-window-browser.cjs`, `tests/music/artist-discography-browser.cjs` |
| Galeria ampliada e seleção de banner | `dist/title/title-gallery.js`, `dist/title/title-banner.js` |
| Catálogo musical YouTube Music | `server/music/youtube-music.cjs`, `server/music/youtube-music-parser.cjs` |
| Identidade canônica e matching de músicas YouTube Music | `dist/music/music-model.js`, `dist/catalog/catalog.js` |
| Resolução de recomendações/enriquecimento | `server/music/music-catalog.cjs` |
| Fotos de artistas | Metadata do YouTube Music em `server/music/youtube-music-parser.cjs`, `server/music/music-catalog.cjs` |
| Last.fm: textos e sugestões | `server/music/lastfm.cjs` |
| Vínculo de YouTube/áudio/arquivo e resolução automática/manual | `dist/music/music-source-link.js`, `server/music/music-catalog.cjs`, `server/music/youtube-music.cjs`. Focados: `node tests/music/music-playback-browser.cjs source`, `node tests/music/music-audio-version-browser.cjs` |
| Separação áudio/vídeo, OMV de álbum → fonte ATV, rádio com capas | `server/music/youtube-music-parser.cjs`, `server/music/youtube-music.cjs`, `dist/catalog/catalog-discovery.js`. Focado: `tests/music/music-media-kind.test.cjs` |
| Associação busca ↔ faixa de álbum, número/metadata e dedupe conservador | `dist/music/music-model.js`, `server/music/music-catalog.cjs`, `dist/extras.js`, `dist/music/music-source-link.js`. Focados: `tests/music/music-release-track.test.cjs`, `tests/music/music-release-track-browser.cjs` |
| Collection ↔ SPACEAMP e preparação central de fontes | `dist/music/music-bridge.js` (`prepareTrack`), `dist/music/music-model.js`; Catalog fornece cache/pending compartilhados |
| Contexto da sessão/fila transitória: origem, posição, histórico, shuffle/repeat, play-next e stale guard | `dist/music/playback-context.js`, `dist/music/queue-manager.js`; integração SPACEAMP em `dist/music/playlist.js`. Focado: `node --test --experimental-test-isolation=none tests/music/playback-context.test.cjs` |
| Biblioteca musical (playlists, busca, artwork e fila) e música destacada do perfil | `dist/extras.js` (persistência), `dist/music/playlist.js` (CRUD/busca/capas e janelas Biblioteca/Fila), `dist/music/music-bridge.js` (preparação, enfileiramento e capa para XMB), `dist/xmb/xmb-artwork-storage.js`/`dist/media/media-storage.js` (blobs), `dist/profile/profile-extras-view.js` (destaque), `dist/backup/backup-validation.js`, `dist/backup/media-package.js`. Focados: `node tests/music/music-playback-browser.cjs library:windows`, `node tests/spaceamp/spaceamp-browser.cjs xmb:playlists`, `node tests/backup/backup-roundtrip-browser.cjs`, `tests/profile/profile-extras-browser.cjs` |
| Ouvir álbum em contexto e download sequencial offline | `dist/music/music-album-actions.js`, `dist/music/music-bridge.js`, `dist/music/playlist.js`, `dist/music/music-source-link.js`, `dist/media/media-download.js`. Focado: `node tests/music/music-album-actions-browser.cjs` |
| Progresso/cancelamento central de downloads de áudio/vídeo | `dist/media/media-download.js`, `server/media/authorized-media-download.cjs`, `server.cjs`. Focados: `tests/music/music-download-lifecycle.test.cjs`, `tests/music/music-download-progress-browser.cjs` |
| Dock compacto/perfil, player, links de faixa/artista e atalhos para Biblioteca/Fila | `dist/spaceamp/spaceamp-global-ui.js`, `dist/spaceamp.css`; links compartilhados em `dist/music/music-page-ui.js`; janelas via `dist/music/playlist.js`. Focados: `node tests/music/music-playback-browser.cjs compact` e `library:windows` |
| Estado/controles públicos do player | `dist/spaceamp/spaceamp.js`. Focado: `node tests/music/music-playback-browser.cjs playback` |
| Resolução de lyrics, matching conservador, TTML, cache, IndexedDB, retenção e cancelamento | `dist/music/lyrics-repository.js` consulta lrc.red e mantém TTML válido no banco local `myspace-lyrics`, com busca indexada e ledger de capacidade; Now Playing o chama sem expor identidade de playback ao serviço. Focados: `node tests/spaceamp/spaceamp-presentation-browser.cjs lyrics:privacy`, `lyrics:offline` e `lyrics:retention` |
| Shell Now Playing, renderização lyrics/clock/seek e artwork/palette | `dist/spaceamp/spaceamp-now-playing.js`; fonte am-lyrics 1.7.4 e build reprodutível em `vendor/am-lyrics-1.7.4/`. Focado: `node tests/spaceamp/spaceamp-presentation-browser.cjs lyrics` (ou shell/palette/atmosphere/timeline/visualizer/responsive/failure/preferences; aceita cenário/full). Video, lyrics clock/motion e timeline perfil/compact mantêm harnesses próprios |
| Input semântico/foco do Now Playing e transição player/lyrics | `dist/spaceamp/spaceamp-now-playing-input.js`. Focado: `node tests/spaceamp/spaceamp-browser.cjs controller` |
| Seleção/ativação nativa de linhas, opções públicas Romanization/Translation e scroll manual no Shadow DOM | `dist/spaceamp/spaceamp-lyrics-navigation.js` |
| Perfil visual de lyrics no Shadow DOM e observers | `dist/spaceamp/spaceamp-lyrics-profile.js` |
| Visualizer/analyser do áudio existente | `dist/spaceamp/spaceamp-visualizer.js` |
| Atmosphere dinâmica independente | `dist/spaceamp/spaceamp-atmosphere.js` |
| Faixa atual/seleção contextual e fila de SPACEAMP | `dist/music/playlist.js`, `dist/music/queue-manager.js`, `dist/music/playback-context.js` |
| Eventos YouTube e Media Session | `dist/spaceamp/spaceamp-integrations.js` |
| PARTY: shell, rail e coordenação | `dist/party/spacevoice.js`, `dist/spacevoice.css` |
| Chat: DOM/render/unread | `dist/party/party-chat-ui.js` |
| Chat: estado, draft e mensagens | `dist/voice/chat.js` |
| Sala, presence e lifecycle | `dist/voice/room.js`, `dist/voice/room-metadata.js`, `dist/voice/presence.js` |
| Peers, streams e signaling | `dist/voice/session.js`, `dist/voice/peer.js`, `dist/voice/signaling-*.js` |
| Microfone/devices/levels | `dist/voice/media.js`, `dist/voice/devices.js`, `dist/voice/levels.js` |
| ICE/TURN no front e servidor | `dist/voice/ice-config.js`, `server/party/ice-config.cjs`, `server/coturn/README.md` |
| Continuidade visual de imagens (decode/revision) | `dist/artwork.js` |
| Parser MP3/FLAC | `dist/media/audio-tags.js` |
| Blobs locais (áudio, vídeo e imagens de XMB/aparência) e pacote de backup | `dist/media/media-storage.js`, `dist/xmb/xmb-artwork-storage.js`, `dist/backup/media-package.js` |
| Validação do conteúdo importado | `dist/backup/backup-validation.js` |
| Confirmação e UI após importação | `dist/extras.js`, `dist/title/title-preferences.js` |
| Transação de aplicação/rollback do backup | `dist/backup/backup-restoration.js` |
| Evidências geradas | `artifacts/` — local e ignorado |
| Categorias/comandos de testes | `tests/README.md` |

YouTube Music é a identidade canônica do catálogo musical atual. Apple Music/iTunes e Deezer não são providers suportados, e seus IDs não fazem parte do modelo atual. Consultar [arquitetura musical](music/architecture.md) e [contratos](contracts.md) antes de alterar identidade musical.

Seções de artista: `server/music/youtube-music-parser.cjs` extrai handles, renderers e tipos individuais; `server/music/youtube-music.cjs` possui `artistSection`/`artistDiscography`, paginação limitada e cache/pending; `server/music/music-catalog.cjs` integra discografia ao FULL existente. `dist/catalog/catalog.js` propaga releases; `dist/title/title-pages.js` funde o modelo CORE/FULL e entrega o item reconciliado a `dist/music/title-artist-view.js`, que mantém cards e controles da seção existente. `dist/collection/collection.js` exclui metadata transitória da gravação.

Artwork local MP3/FLAC: src-tauri/src/music_artwork.rs; lookup/cache/guards e
protocolo em music_stream.rs; image/album na projeção desktop-music-library.js e
render existente playlist.js/Artwork. Testes Rust music_artwork/music_stream e
runner tests/project/run-native-playback.ps1; limites em docs/desktop-tauri.md.

Edição explícita Steam descoberto: editor/contextmenu em dist/xmb/xmb.js;
persistência de um jogo por CollectionActions.customizeSteamGame em dist/extras.js.
Teste tests/project/desktop-games-browser.cjs; limites/futuras artes em docs/desktop-tauri.md.

Steam Artwork offline: src-tauri/src/steam_artwork.rs; validador music_artwork.rs,
índice game_launch.rs e protocolo main.rs. Grants/picker desktop-folders.js e
desktop-poc.js; projeção desktop-game-library.js e Artwork/XMB existentes.
Testes Rust steam_artwork, desktop-game-library/desktop-folders, browser
desktop-games-browser.cjs e run-native-playback.ps1 -Scenario game-launch.
