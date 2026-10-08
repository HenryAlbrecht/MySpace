# Onde alterar cada responsabilidade

Todos os caminhos abaixo são relativos à raiz do repositório.

| Quero alterar… | Arquivos principais |
|---|---|
| Boot/perfil e reprodução no host existente | `dist/app.js`, `dist/index.html` |
| Primeiro render/dirty Collection | `dist/collection/collection-view.js`; `dist/extras.js` somente para invalidação por dados/rota. Focado: `tests/boot-performance-browser.cjs` |
| Profile extras / gallery: vídeo, top 8, selinhos, blocos, favoritos, visibilidade e ordem | `dist/profile-extras-view.js`; `dist/extras.js` somente para persistência/rotas/editor compartilhado. Focados: `tests/profile/profile-extras-browser.cjs`, `tests/boot-performance-browser.cjs` |
| Primeira criação PARTY e cache estático | `dist/extras.js` (mount único pela rota), `server.cjs` (ETag/304) |
| Persistência/ações da coleção e composição das seções | `dist/extras.js` |
| Validação, status e filtros da coleção | `dist/collection/collection.js` |
| Capas/lista/seleção e filtros visuais | `dist/collection/collection-view.js`, `dist/interface.css` |
| Quick Menu do sistema/XMB e composição explícita Música/Sistema | `dist/xmb/xmb-quick-menu.js`, `dist/xmb-quick-menu.css`. Focado: `node tests/spaceamp/spaceamp-browser.cjs quick-menu` |
| Fullscreen, seleção e detalhes XMB | `dist/xmb/xmb.js`, `dist/xmb.css`. Focado: `node tests/spaceamp/spaceamp-browser.cjs handoff` |
| Tokens/cores/base visual global | `dist/style.css` |
| Motion compartilhado e tokens de movimento | `dist/motion.css` |
| Direção espacial e continuidade de apresentação | `dist/motion-design.js` |
| Aparência global e wallpaper XMB | `dist/profile-appearance.js` |
| Editor de itens e busca dentro do modal | `dist/editor-ui.js`, `dist/catalog/catalog-ui.js` |
| Busca, cache e detalhes no navegador | `dist/catalog.js` |
| Search musical / carregar mais | `server/music/youtube-music-parser.cjs` (renderer/next), `server/music/youtube-music.cjs` (request/token/cache/pending), `server/music/music-catalog.cjs` (coordenação), `server.cjs` (cursor HTTP), `dist/catalog.js` (searchPage/compatibility), `dist/title-pages.js` (lifecycle/append), `dist/catalog/catalog-ui.js` (homônimos incrementais). Focado: `tests/music/music-search-pagination-browser.cjs` |
| Descoberta da coleção e recomendações na ficha | `dist/catalog/catalog-discovery.js`, `dist/catalog/discovery-page.js`, `dist/title-pages.js` |
| Apresentação/reconciliação de recomendações musicais | `dist/music/music-discovery-view.js`, `dist/music/music-page-ui.js` |
| Relação da Collection por gêneros | `dist/music/music-collection-matches.js`, `dist/music/music-page-ui.js` |
| Fichas de títulos e seções por mídia | `dist/title-pages.js`, `dist/title-pages.css` |
| Artist Page / discografia: UI, filtros, ordenação e janela progressiva | `dist/music/title-artist-view.js`; `dist/music/music-page-ui.js` para controles musicais compartilhados. `dist/title-pages.js` somente para CORE/FULL/lifecycle. Focados: `tests/music/artist-discography-window-browser.cjs`, `tests/music/artist-discography-browser.cjs` |
| Galeria ampliada e seleção de banner | `dist/title/title-gallery.js`, `dist/title/title-banner.js` |
| Catálogo musical YouTube Music | `server/music/youtube-music.cjs`, `server/music/youtube-music-parser.cjs` |
| Compatibilidade Apple legacy | `server/music/music.cjs`, `server/music/apple-normalize.cjs` |
| Resolução de recomendações/enriquecimento | `server/music/music-catalog.cjs` |
| Fotos de artistas | `server/music/artist-artwork.cjs` |
| Last.fm: textos e sugestões | `server/music/lastfm.cjs` |
| Vínculo de YouTube/áudio/arquivo e resolução automática/manual | `dist/music/music-source-link.js`, `server/music/music-catalog.cjs` (YouTube Music/fallback), `server/music/musicbrainz.cjs`. Focado: `node tests/music/music-playback-browser.cjs source` |
| Collection ↔ SPACEAMP | `dist/music/music-bridge.js`, `dist/music-model.js` |
| Dock compacto/perfil e apresentação capa/vídeo | `dist/spaceamp/spaceamp-global-ui.js`, `dist/spaceamp.css`. Focado: `node tests/music/music-playback-browser.cjs compact` |
| Estado/controles públicos do player | `dist/spaceamp/spaceamp.js`. Focado: `node tests/music/music-playback-browser.cjs playback` |
| Shell Now Playing, componente lyrics/clock/seek e artwork/palette | `dist/spaceamp/spaceamp-now-playing.js`. Focado: `node tests/spaceamp/spaceamp-presentation-browser.cjs lyrics` (ou shell/palette/atmosphere/timeline/visualizer/responsive/failure/preferences; aceita cenário/full). Video, lyrics clock/motion e timeline perfil/compact mantêm harnesses próprios |
| Input semântico/foco do Now Playing e transição player/lyrics | `dist/spaceamp/spaceamp-now-playing-input.js`. Focado: `node tests/spaceamp/spaceamp-browser.cjs controller` |
| Seleção/ativação nativa de linhas, opções públicas Romanization/Translation e scroll manual no Shadow DOM | `dist/spaceamp/spaceamp-lyrics-navigation.js` |
| Perfil visual de lyrics no Shadow DOM e observers | `dist/spaceamp/spaceamp-lyrics-profile.js` |
| Visualizer/analyser do áudio existente | `dist/spaceamp/spaceamp-visualizer.js` |
| Atmosphere dinâmica independente | `dist/spaceamp/spaceamp-atmosphere.js` |
| Seleção/restauração da playlist | `dist/playlist.js` |
| Eventos YouTube e Media Session | `dist/spaceamp/spaceamp-integrations.js` |
| PARTY: shell, rail e coordenação | `dist/spacevoice.js`, `dist/spacevoice.css` |
| Chat: DOM/render/unread | `dist/party-chat-ui.js` |
| Chat: estado, draft e mensagens | `dist/voice/chat.js` |
| Sala, presence e lifecycle | `dist/voice/room.js`, `dist/voice/room-metadata.js`, `dist/voice/presence.js` |
| Peers, streams e signaling | `dist/voice/session.js`, `dist/voice/peer.js`, `dist/voice/signaling-*.js` |
| Microfone/devices/levels | `dist/voice/media.js`, `dist/voice/devices.js`, `dist/voice/levels.js` |
| ICE/TURN no front e servidor | `dist/voice/ice-config.js`, `server/party/ice-config.cjs`, `server/coturn/README.md` |
| Continuidade visual de imagens (decode/revision) | `dist/artwork.js` |
| Parser MP3/FLAC | `dist/audio-tags.js` |
| Blobs e pacote de backup | `dist/media-storage.js`, `dist/media-package.js` |
| Validação do conteúdo importado | `dist/backup-validation.js` |
| Confirmação e UI após importação | `dist/extras.js`, `dist/title/title-preferences.js` |
| Transação de aplicação/rollback do backup | `dist/backup-restoration.js` |
| Evidências geradas | `artifacts/` — local e ignorado |
| Categorias/comandos de testes | `tests/README.md` |

`server/music/deezer.cjs` é um adapter histórico testado, não o catálogo vigente. Consultar [arquitetura musical](music/architecture.md) e [contratos](contracts.md) antes de alterar identidade musical. Adapters legacy ainda consumidos permanecem suportados.

Seções de artista: `server/music/youtube-music-parser.cjs` extrai handles, renderers e tipos individuais; `server/music/youtube-music.cjs` possui `artistSection`/`artistDiscography`, paginação limitada e cache/pending; `server/music/music-catalog.cjs` integra discografia ao FULL existente. `dist/catalog.js` propaga releases; `dist/title-pages.js` funde o modelo CORE/FULL e entrega o item reconciliado a `dist/music/title-artist-view.js`, que mantém cards e controles da seção existente. `dist/collection/collection.js` exclui metadata transitória da gravação.
