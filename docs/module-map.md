# Onde alterar cada responsabilidade

Todos os caminhos abaixo são relativos à raiz do repositório.

| Quero alterar… | Arquivos principais |
|---|---|
| Boot/perfil e reprodução no host existente | `dist/app.js`, `dist/index.html` |
| Persistência/ações da coleção e composição das seções | `dist/extras.js` |
| Validação, status e filtros da coleção | `dist/collection.js` |
| Capas/lista/seleção e filtros visuais | `dist/collection-view.js`, `dist/interface.css` |
| Fullscreen, seleção e detalhes XMB | `dist/xmb.js`, `dist/xmb.css` |
| Tokens de movimento | `dist/motion.css` |
| Direção espacial e continuidade de apresentação | `dist/motion-design.js` |
| Aparência global e wallpaper XMB | `dist/profile-appearance.js` |
| Editor de itens e busca dentro do modal | `dist/editor-ui.js`, `dist/catalog-ui.js` |
| Busca, cache e detalhes no navegador | `dist/catalog.js` |
| Descoberta da coleção e recomendações na ficha | `dist/catalog-discovery.js`, `dist/discovery-page.js`, `dist/title-pages.js` |
| Fichas de títulos e seções por mídia | `dist/title-pages.js`, `dist/title-pages.css` |
| Galeria ampliada e seleção de banner | `dist/title-gallery.js`, `dist/title-banner.js` |
| Catálogo musical Apple e normalização | `server/music.cjs`, `server/apple-normalize.cjs` |
| Resolução de recomendações/enriquecimento | `server/music-catalog.cjs` |
| Fotos de artistas | `server/artist-artwork.cjs` |
| Last.fm: textos e sugestões | `server/lastfm.cjs` |
| Vínculo de YouTube/áudio/arquivo e lookup | `dist/music-source-link.js`, `server/musicbrainz.cjs` |
| Collection ↔ SPACEAMP | `dist/music-bridge.js`, `dist/music-model.js` |
| Dock compacto/perfil e apresentação capa/vídeo | `dist/spaceamp-global-ui.js`, `dist/spaceamp.css` |
| Estado/controles públicos do player | `dist/spaceamp.js` |
| Seleção/restauração da playlist | `dist/playlist.js` |
| Eventos YouTube e Media Session | `dist/spaceamp-integrations.js` |
| PARTY: shell, rail e coordenação | `dist/spacevoice.js`, `dist/spacevoice.css` |
| Chat: DOM/render/unread | `dist/party-chat-ui.js` |
| Chat: estado, draft e mensagens | `dist/voice/chat.js` |
| Sala, presence e lifecycle | `dist/voice/room.js`, `dist/voice/room-metadata.js`, `dist/voice/presence.js` |
| Peers, streams e signaling | `dist/voice/session.js`, `dist/voice/peer.js`, `dist/voice/signaling-*.js` |
| Microfone/devices/levels | `dist/voice/media.js`, `dist/voice/devices.js`, `dist/voice/levels.js` |
| ICE/TURN no front e servidor | `dist/voice/ice-config.js`, `server/ice-config.cjs`, `server/coturn/README.md` |
| Continuidade visual de imagens (decode/revision) | `dist/artwork.js` |
| Parser MP3/FLAC | `dist/audio-tags.js` |
| Blobs e pacote de backup | `dist/media-storage.js`, `dist/media-package.js` |
| Validação do conteúdo importado | `dist/backup-validation.js` |
| Confirmação/importação/rollback | `dist/extras.js`, `dist/title-preferences.js` |
| Evidências geradas | `artifacts/` — local e ignorado |
| Categorias/comandos de testes | `tests/README.md` |

`server/deezer.cjs` é um adapter histórico testado, não o catálogo vigente. Consultar [apple-canonical-catalog.md](music/apple-canonical-catalog.md) antes de alterar identidade musical. Regras e APIs antigas de backup não devem ser removidas apenas porque novos itens usam Apple.
