# Inventário de validação

`validate.ps1` continua source of truth do aceite. Quick/smoke certificam contratos vigentes e adapters legacy explicitamente suportados. Comandos e critérios estão no [README](README.md); evolução em [histórico](../docs/history/test-harness-consolidation-2026-10-07.md). Não executar wildcard. Browser manual significa revisar fixture e requisitos antes de usar. Este inventário cobre todos os harnesses e documentos atuais na raiz de tests; fixtures de dados não são testes executáveis.

| Arquivo | Categoria |
|---|---|
| `README.md` | Documentacao de testes |
| `apple-canonical-live.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-legacy-apple.test.cjs` | Quick — adapter Apple legacy explícito |
| `apple-discography.test.cjs` | Quick — adapter Apple legacy suportado, acesso explícito |
| `artist-artwork-smoke.cjs` | Smoke — fluxo local/fixture |
| `artist-discography-browser.cjs` | Browser/integracao adicional — CORE/FULL HTTP local, seções e continuidade com fixtures |
| `artist-discography-window-browser.cjs` | Browser/integracao adicional — 65 releases, janela desktop/mobile, foco e paginação legacy local |
| `artist-search-photos.test.cjs` | Quick — adapter Apple legacy suportado, acesso explícito |
| `artwork.test.cjs` | Quick — fixture determinística |
| `audio-tags.test.cjs` | Quick — fixture determinística |
| `backup-roundtrip-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `boot-performance-browser.cjs` | Browser/diagnostico local — cold routes, render/init counts, dirty/reuso e reload 304 |
| `profile-extras-browser.cjs` | Browser/integracao adicional — edição de top 8/badges/blocos/vídeo local, visibilidade/ordem e reload |
| `catalog-session-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `catalog.test.cjs` | Quick — fixture determinística |
| `collection-title-return-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `collection.test.cjs` | Quick — fixture determinística |
| `deezer-catalog-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-smoke.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `deezer-unified-live.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-unified-search.test.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `flac-smoke.cjs` | Smoke — fluxo local/fixture |
| `front-cohesion-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `health-pass-2-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-2.test.cjs` | Quick — fixture determinística |
| `health-pass-3-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `igdb-relations-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `igdb-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `inspect-release-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `isrc-edition.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `keyboard-navigation-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `lastfm-enrichment-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `lastfm-recommendation-seed.test.cjs` | Quick — fixture determinística |
| `lastfm-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `launcher-occupied-port.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `launcher.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `media-details-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `media-embeds-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `media-metadata-smoke.cjs` | Smoke — fluxo local/fixture |
| `media-package-smoke.cjs` | Smoke — fluxo local/fixture |
| `motion-design-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `motion-stability-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-artwork.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-auto-source-browser.cjs` | Alias fino → `music-playback-browser.cjs full`; cobertura canônica no grupo source: resolução/override/not-found/choose de itens importados |
| `music-auto-source.test.cjs` | Quick — fixture determinística |
| `music-catalog-consistency.test.cjs` | Quick — fixture determinística |
| `music-collection-genres-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-collection-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-collection-polish-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music-collection-polish.test.cjs` | Quick — fixture determinística |
| `music-compact-visibility-browser.cjs` | Alias fino → `music-playback-browser.cjs full`; cobertura canônica no grupo compact |
| `music-core-hydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-core-hydration.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-discovery-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music-duration-memory-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-duration-memory.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-editorial.test.cjs` | Quick — fixture determinística |
| `music-final-recommendations-browser.cjs` | Browser/integracao local — recomendações da ficha: reserva/rotação, tipos, retenção, fontes esgotadas e force; rede externa bloqueada |
| `music-final-recommendations.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-first-paint-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-first-paint-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-flow-http-smoke.cjs` | Smoke — fluxo local/fixture |
| `music-isrc-resolution.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-local-rotation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-local-rotation.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-monotonic-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-navigation-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-navigation-polish-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-pages-evolution-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-pages-evolution.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-playback-browser.cjs` | Suíte browser canônica — 12 cenários isolados, grupos/full; playback/routes/compact/preferences/preview/source/controls; fixtures locais |
| `music-playback-collection-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-playback-matcher.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-playback-resolver.test.cjs` | Quick — contrato YouTube vigente, fixtures locais |
| `music-polish-browser.cjs` | Alias fino → `music-playback-browser.cjs full`; cobertura canônica nos grupos routes/compact |
| `music-preferences-browser.cjs` | Alias fino → `music-playback-browser.cjs full`; cobertura canônica preferences/preview |
| `music-real-controls-browser.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recommendation-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recommendations-check.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recovery-check.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-services-browser.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-recommendation-browser.cjs` | Browser/integracao local — descoberta da Collection: seis mídias, partial/final, descarte/restauração/filtro e falha; rede externa bloqueada |
| `music-search-pagination-browser.cjs` | Browser/integracao local — continuation de Search, append/dedupe, foco/scroll/imagem, stale/retry, homônimos, limites e picker; sem rede externa |
| `music-recommendation-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-recommendation-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-recommendation-recovery.test.cjs` | Quick — fixture determinística |
| `music-recommendation-resolution.test.cjs` | Quick — fixture determinística |
| `music-recommendation-retry-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music-recommendation-strategy.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-release-polish.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-routes-browser.cjs` | Alias fino → `music-playback-browser.cjs full`; cobertura canônica nos grupos routes/playback |
| `music-search-live-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-search-quality.test.cjs` | Quick — fixture determinística |
| `music-search-reserve-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music-search-reserve.test.cjs` | Quick — fixture determinística |
| `music-search-review.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `music-source-link.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-tag-http.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-unified-search-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `music-unified-search.test.cjs` | Quick — fixture determinística |
| `music-ux-backfill-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-ux-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-ux-genres-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-ux-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-ux-motion-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-v16-browser.cjs` | Alias fino → `music-playback-browser.cjs full`; cobertura canônica nos grupos playback/routes/source |
| `music-v16.test.cjs` | Quick — fixture determinística |
| `music-views-browser.cjs` | Alias fino → `music-playback-browser.cjs full`; cobertura canônica em controls:profile/compact/routes |
| `music-weirdo-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-weirdo-integrated.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `musicbrainz-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `navigation-camera-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `navigation-native-probe.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `navigation-smoke.cjs` | Smoke — fluxo local/fixture |
| `organization-visual.cjs` | Visual — fixtures locais |
| `organization.test.cjs` | Quick — ownership, ordem de scripts e fachadas |
| `page-legacy-manual.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `page-smoke.cjs` | Smoke — fluxo local/fixture |
| `party-chat-cold-start.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `party-chat-layout-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-context-rail-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-ice-server.test.cjs` | Aceite selecionado — party |
| `party-media-settings-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered.test.cjs` | Quick — fixture determinística |
| `party-network.test.cjs` | Quick — fixture determinística |
| `party-polish-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-presence-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `party-presence.test.cjs` | Quick — fixture determinística |
| `party-rename-inline.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `party-room-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-ui.test.cjs` | Quick — fixture determinística |
| `party-room.test.cjs` | Aceite selecionado — party |
| `party-v11-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v13-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v15-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v151-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `personal-controls-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `personalized-discovery-smoke.cjs` | Smoke — fluxo local/fixture |
| `playback-suggestions-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `playback-suggestions.test.cjs` | Quick — fixture determinística |
| `premerge-audit.cjs` | syntax/static — auditoria do validate.ps1 |
| `premerge-visual.cjs` | Visual — fixtures locais |
| `project-audit-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `route-visibility-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `screen-audio-stats.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `scroll-continuity-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `search-quality-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `spaceamp-browser.cjs` | Suíte browser canônica — 15 cenários isolados, grupos/full; XMB/controller/menu/video/lyrics/handoff/presentation; fixtures locais |
| `spaceamp-artwork-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `spaceamp-integrations.test.cjs` | Quick — fixture determinística |
| `spaceamp-isrc-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-isrc.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `spaceamp-lyrics-clock-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-lyrics-motion-browser.cjs` | Browser focado — perfil visual/scroll/seek, autoscroll upstream e ausência de drift |
| `spaceamp-navigation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-now-playing-browser.cjs` | Alias fino — presentation, mesma seleção cenário/grupo/full |
| `spaceamp-presentation-browser.cjs` | Browser canônico — 14 cenários isolados; shell/lyrics/visualizer/palette/atmosphere/timeline/responsive/failure/preferences; runtime e fixture em diretório próprio |
| `spaceamp-now-playing.test.cjs` | Quick — fixture determinística |
| `spaceamp-regressions-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-timeline-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-video-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-youtube-browser.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `spaceamp.test.cjs` | Quick — fixture determinística |
| `spacevoice-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `spacevoice.test.cjs` | Quick — fixture determinística |
| `steam-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `title-banner-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `title-detail-continuity-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `title-preferences-smoke.cjs` | Smoke — fluxo local/fixture |
| `translation-smoke.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `validate.ps1` | Runner canônico — quick e quick-music/quick-spaceamp/quick-party-ui, smoke/syntax, party/legacy e visual |
| `visual-preview.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `../docs/history/visual-review-2026-09-27.md` | Revisão visual histórica |
| `visual-state-continuity.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `voice-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-audio.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-chat-server.test.cjs` | Aceite selecionado — party |
| `voice-chat-transport.test.cjs` | Aceite selecionado — party |
| `voice-chat.test.cjs` | Quick — fixture determinística |
| `voice-media-settings.test.cjs` | Quick — fixture determinística |
| `voice-mesh.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-peer.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-screen-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen-audio.test.cjs` | Quick — fixture determinística |
| `voice-screen-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen.test.cjs` | Adicional/manual — revisar fixture antes de usar como aceite |
| `voice-ui.test.cjs` | Quick — fixture determinística |
| `voice-ws.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `xmb-handoff-browser.cjs` | Alias fino → `spaceamp-browser.cjs full`; aceita cenário/grupo/full |
| `xmb-input.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `xmb.test.cjs` | Quick — fixture determinística |
| `youtube-music-catalog-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `youtube-music-catalog.test.cjs` | Quick — contrato YouTube vigente, fixtures locais |
| `youtube-music.test.cjs` | Quick — contrato YouTube vigente, fixtures locais |
| `ytmusic-isrc-rehydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
