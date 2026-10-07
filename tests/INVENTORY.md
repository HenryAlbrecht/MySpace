# Inventário de validação

`validate.ps1` continua source of truth do aceite. Quick/smoke certificam contratos vigentes e adapters legacy explicitamente suportados. Comandos e critérios estão no [README](README.md); evolução em [histórico](../docs/history/test-harness-consolidation-2026-10-07.md). Não executar wildcard. Browser manual significa revisar fixture e requisitos antes de usar. Este inventário cobre todos os harnesses e documentos atuais na raiz de tests; fixtures de dados não são testes executáveis.

| Arquivo | Categoria |
|---|---|
| `README.md` | Documentacao de testes |
| `music/music-legacy-apple.test.cjs` | Quick — adapter Apple legacy explícito |
| `music/apple-discography.test.cjs` | Quick — adapter Apple legacy suportado, acesso explícito |
| `music/artist-artwork-smoke.cjs` | Smoke — fluxo local/fixture |
| `music/artist-discography-browser.cjs` | Browser/integracao adicional — CORE/FULL HTTP local, seções e continuidade com fixtures |
| `music/artist-discography-window-browser.cjs` | Browser/integracao adicional — 65 releases, janela desktop/mobile, foco e paginação legacy local |
| `music/artist-search-photos.test.cjs` | Quick — adapter Apple legacy suportado, acesso explícito |
| `media/artwork.test.cjs` | Quick — fixture determinística |
| `music/audio-tags.test.cjs` | Quick — fixture determinística |
| `backup/backup-roundtrip-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `boot-performance-browser.cjs` | Browser/diagnostico local — cold routes, render/init counts, dirty/reuso e reload 304 |
| `profile/profile-extras-browser.cjs` | Browser/integracao adicional — edição de top 8/badges/blocos/vídeo local, visibilidade/ordem e reload |
| `catalog/catalog-session-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `catalog/catalog.test.cjs` | Quick — fixture determinística |
| `collection/collection-title-return-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `collection/collection.test.cjs` | Quick — fixture determinística |
| `music/deezer-smoke.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `music/deezer-unified-search.test.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `media/flac-smoke.cjs` | Smoke — fluxo local/fixture |
| `front-cohesion-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `health-pass-2-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-2.test.cjs` | Quick — fixture determinística |
| `health-pass-3-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `media/igdb-relations-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `media/igdb-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music/isrc-edition.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `navigation/keyboard-navigation-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music/lastfm-enrichment-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `music/lastfm-recommendation-seed.test.cjs` | Quick — fixture determinística |
| `music/lastfm-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `project/launcher-occupied-port.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `project/launcher.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `media/media-details-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `media/media-embeds-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `media/media-metadata-smoke.cjs` | Smoke — fluxo local/fixture |
| `media/media-package-smoke.cjs` | Smoke — fluxo local/fixture |
| `motion-design-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `motion-stability-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-artwork.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-auto-source.test.cjs` | Quick — fixture determinística |
| `music/music-catalog-consistency.test.cjs` | Quick — fixture determinística |
| `music/music-collection-genres-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-collection-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-collection-polish-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music/music-collection-polish.test.cjs` | Quick — fixture determinística |
| `music/music-core-hydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-core-hydration.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `catalog/music-discovery-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music/music-duration-memory-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-duration-memory.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-editorial.test.cjs` | Quick — fixture determinística |
| `music/music-final-recommendations-browser.cjs` | Browser/integracao local — recomendações da ficha: reserva/rotação, tipos, retenção, fontes esgotadas e force; rede externa bloqueada |
| `music/music-final-recommendations.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-first-paint-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-flow-http-smoke.cjs` | Smoke — fluxo local/fixture |
| `music/music-isrc-resolution.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-local-rotation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-local-rotation.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-navigation-polish-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-pages-evolution-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-pages-evolution.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-playback-browser.cjs` | Suíte browser canônica — 12 cenários isolados, grupos/full; playback/routes/compact/preferences/preview/source/controls; fixtures locais |
| `music/music-playback-collection-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-playback-matcher.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-playback-resolver.test.cjs` | Quick — contrato YouTube vigente, fixtures locais |
| `music/music-real-services-browser.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music/music-recommendation-browser.cjs` | Browser/integracao local — descoberta da Collection: seis mídias, partial/final, descarte/restauração/filtro e falha; rede externa bloqueada |
| `music/music-search-pagination-browser.cjs` | Browser/integracao local — continuation de Search, append/dedupe, foco/scroll/imagem, stale/retry, homônimos, limites e picker; sem rede externa |
| `music/music-recommendation-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music/music-recommendation-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music/music-recommendation-recovery.test.cjs` | Quick — fixture determinística |
| `music/music-recommendation-resolution.test.cjs` | Quick — fixture determinística |
| `music/music-recommendation-retry-browser.cjs` | Browser adicional/manual — YouTube Music, discovery automática, retry/partial/final e retenção de nó |
| `music/music-recommendation-strategy.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-release-polish.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-search-quality.test.cjs` | Quick — fixture determinística |
| `music/music-search-reserve.test.cjs` | Quick — fixture determinística |
| `music/music-search-review.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `music/music-source-link.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-tag-http.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-unified-search-browser.cjs` | Browser adicional/manual — Catalog YouTube Music/editorial, save, override manual para áudio direto e playback real; identidade preservada |
| `music/music-unified-search.test.cjs` | Quick — fixture determinística |
| `music/music-ux-backfill-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-ux-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-ux-genres-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music/music-ux-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music/music-ux-motion-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/music-v16.test.cjs` | Quick — fixture determinística |
| `music/musicbrainz-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `navigation/navigation-camera-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `navigation/navigation-native-probe.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `navigation/navigation-smoke.cjs` | Smoke — fluxo local/fixture |
| `project/organization.test.cjs` | Quick — ownership, ordem de scripts e fachadas |
| `page-legacy-manual.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `page-smoke.cjs` | Smoke — fluxo local/fixture |
| `party/party-chat-cold-start.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `party/party-chat-layout-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-context-rail-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-ice-server.test.cjs` | Aceite selecionado — party |
| `party/party-media-settings-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-metered-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-metered.test.cjs` | Quick — fixture determinística |
| `party/party-network.test.cjs` | Quick — fixture determinística |
| `party/party-polish-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-presence-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `party/party-presence.test.cjs` | Quick — fixture determinística |
| `party/party-rename-inline.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `party/party-room-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-room-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-room-ui.test.cjs` | Quick — fixture determinística |
| `party/party-room.test.cjs` | Aceite selecionado — party |
| `party/party-v11-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-v13-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-v15-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-v151-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/party-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `collection/personal-controls-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `catalog/personalized-discovery-smoke.cjs` | Smoke — fluxo local/fixture |
| `music/playback-suggestions-browser.cjs` | Browser adicional/manual — sugestões para registros legacy, escolha sem persistência antes do save, not-found, arquivo ausente e reload; lookup com fixtures locais |
| `music/playback-suggestions.test.cjs` | Quick — fixture determinística |
| `premerge-audit.cjs` | syntax/static — auditoria do validate.ps1 |
| `premerge-visual.cjs` | Visual — fixtures locais |
| `navigation/route-visibility-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `party/screen-audio-stats.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `navigation/scroll-continuity-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `catalog/search-quality-smoke.cjs` | Adicional/manual — ordem do provider, dedupe, identidades/edições distintas e cache/force de details; fetcher mockado |
| `spaceamp/spaceamp-browser.cjs` | Suíte browser canônica — 15 cenários isolados, grupos/full; XMB/controller/menu/video/lyrics/handoff/presentation; fixtures locais |
| `spaceamp/spaceamp-artwork-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `spaceamp/spaceamp-integrations.test.cjs` | Quick — fixture determinística |
| `spaceamp/spaceamp-isrc-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp/spaceamp-isrc.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `spaceamp/spaceamp-lyrics-clock-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp/spaceamp-lyrics-motion-browser.cjs` | Browser focado — perfil visual/scroll/seek, autoscroll upstream e ausência de drift |
| `spaceamp/spaceamp-navigation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp/spaceamp-presentation-browser.cjs` | Browser canônico — 14 cenários isolados; shell/lyrics/visualizer/palette/atmosphere/timeline/responsive/failure/preferences; runtime e fixture em diretório próprio |
| `spaceamp/spaceamp-now-playing.test.cjs` | Quick — fixture determinística |
| `spaceamp/spaceamp-regressions-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp/spaceamp-timeline-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp/spaceamp-video-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp/spaceamp-youtube-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `spaceamp/spaceamp.test.cjs` | Quick — fixture determinística |
| `party/spacevoice-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/spacevoice.test.cjs` | Quick — fixture determinística |
| `media/steam-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `catalog/title-banner-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `navigation/title-detail-continuity-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `catalog/title-preferences-smoke.cjs` | Smoke — fluxo local/fixture |
| `catalog/translation-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `validate.ps1` | Runner canônico — quick e quick-music/quick-spaceamp/quick-party-ui, smoke/syntax, party/legacy e visual |
| `visual-preview.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `../docs/history/visual-review-2026-09-27.md` | Revisão visual histórica |
| `visual-state-continuity.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `party/voice-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/voice-audio.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `party/voice-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/voice-chat-server.test.cjs` | Aceite selecionado — party |
| `party/voice-chat-transport.test.cjs` | Aceite selecionado — party |
| `party/voice-chat.test.cjs` | Quick — fixture determinística |
| `party/voice-media-settings.test.cjs` | Quick — fixture determinística |
| `party/voice-mesh.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `party/voice-peer.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `party/voice-screen-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/voice-screen-audio.test.cjs` | Quick — fixture determinística |
| `party/voice-screen-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party/voice-screen.test.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `party/voice-ui.test.cjs` | Quick — fixture determinística |
| `party/voice-ws.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `xmb/xmb-input.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `xmb/xmb.test.cjs` | Quick — fixture determinística |
| `music/youtube-music-catalog-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music/youtube-music-catalog.test.cjs` | Quick — contrato YouTube vigente, fixtures locais |
| `music/youtube-music.test.cjs` | Quick — contrato YouTube vigente, fixtures locais |
| `music/ytmusic-isrc-rehydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
