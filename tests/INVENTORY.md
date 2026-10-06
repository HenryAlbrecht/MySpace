# Inventário de validação

`validate.ps1` continua source of truth do aceite. Quick/smoke certificam contratos vigentes e adapters legacy explicitamente suportados; fixtures stale foram alinhadas no V2.2. Veja [relatório V2](../docs/history/organization-pass-2026-10-06.md). Não executar wildcard. Browser manual significa revisar fixture e requisitos antes de usar. Este inventário cobre todos os harnesses e documentos atuais na raiz de tests; fixtures de dados não são testes executáveis.

| Arquivo | Categoria |
|---|---|
| `README.md` | Documentacao de testes |
| `apple-canonical-live.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-legacy-apple.test.cjs` | quick atual — adapter Apple legacy explícito; antigo nome apple-canonical |
| `apple-discography.test.cjs` | quick atual — adapter Apple legacy suportado, acesso explícito |
| `artist-artwork-smoke.cjs` | smoke atual — fluxo local/fixture |
| `artist-discography-browser.cjs` | Browser/integracao adicional — CORE/FULL HTTP local, seções e continuidade com fixtures |
| `artist-discography-window-browser.cjs` | Browser/integracao adicional — 65 releases, janela desktop/mobile, foco e paginação legacy local |
| `artist-search-photos.test.cjs` | quick atual — adapter Apple legacy suportado, acesso explícito |
| `artwork.test.cjs` | quick atual — fixture determinística |
| `audio-tags.test.cjs` | quick atual — fixture determinística |
| `backup-roundtrip-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `boot-performance-browser.cjs` | Browser/diagnostico local — cold routes, render/init counts, dirty/reuso e reload 304 |
| `catalog-session-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `catalog.test.cjs` | quick atual — fixture determinística |
| `collection-title-return-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `collection.test.cjs` | quick atual — fixture determinística |
| `deezer-catalog-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-smoke.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `deezer-unified-live.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-unified-search.test.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `flac-smoke.cjs` | smoke atual — fluxo local/fixture |
| `front-cohesion-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `health-pass-2-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-2.test.cjs` | quick atual — fixture determinística |
| `health-pass-3-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `igdb-relations-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `igdb-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `inspect-release-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `isrc-edition.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `keyboard-navigation-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `lastfm-enrichment-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `lastfm-recommendation-seed.test.cjs` | quick atual — fixture determinística |
| `lastfm-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `launcher-occupied-port.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `launcher.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `media-details-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `media-embeds-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `media-metadata-smoke.cjs` | smoke atual — fluxo local/fixture |
| `media-package-smoke.cjs` | smoke atual — fluxo local/fixture |
| `motion-design-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `motion-stability-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-artwork.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-auto-source-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-auto-source.test.cjs` | quick atual — fixture determinística |
| `music-catalog-consistency.test.cjs` | quick atual — fixture determinística |
| `music-collection-genres-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-collection-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-collection-polish-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-collection-polish.test.cjs` | quick atual — fixture determinística |
| `music-compact-visibility-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-core-hydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-core-hydration.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-discovery-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-duration-memory-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-duration-memory.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-editorial.test.cjs` | quick atual — fixture determinística |
| `music-final-recommendations-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-final-recommendations.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-first-paint-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-first-paint-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-flow-http-smoke.cjs` | smoke atual — fluxo local/fixture |
| `music-isrc-resolution.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-local-rotation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-local-rotation.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-monotonic-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-navigation-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-navigation-polish-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-pages-evolution-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-pages-evolution.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-playback-collection-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-playback-matcher.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-playback-resolver.test.cjs` | quick atual — contrato YouTube vigente, fixtures locais |
| `music-polish-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-preferences-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-real-controls-browser.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recommendation-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recommendations-check.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recovery-check.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-services-browser.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-recommendation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-recommendation-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-recommendation-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-recommendation-recovery.test.cjs` | quick atual — fixture determinística |
| `music-recommendation-resolution.test.cjs` | quick atual — fixture determinística |
| `music-recommendation-retry-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-recommendation-strategy.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-release-polish.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-routes-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-search-live-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-search-quality.test.cjs` | quick atual — fixture determinística |
| `music-search-reserve-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-search-reserve.test.cjs` | quick atual — fixture determinística |
| `music-search-review.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `music-source-link.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-tag-http.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-unified-search-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-unified-search.test.cjs` | quick atual — fixture determinística |
| `music-ux-backfill-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-ux-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-ux-genres-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-ux-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-ux-motion-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-v16-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-v16.test.cjs` | quick atual — fixture determinística |
| `music-views-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-weirdo-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-weirdo-integrated.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `musicbrainz-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `navigation-camera-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `navigation-native-probe.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `navigation-smoke.cjs` | smoke atual — fluxo local/fixture |
| `organization-visual.cjs` | Visual atual — fixtures locais |
| `organization.test.cjs` | quick atual — ownership, ordem de scripts e fachadas |
| `page-legacy-manual.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `page-smoke.cjs` | smoke atual — fluxo local/fixture |
| `party-chat-cold-start.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-chat-layout-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-context-rail-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-ice-server.test.cjs` | Aceite selecionado — party |
| `party-media-settings-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered.test.cjs` | quick atual — fixture determinística |
| `party-network.test.cjs` | quick atual — fixture determinística |
| `party-polish-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-presence-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-presence.test.cjs` | quick atual — fixture determinística |
| `party-rename-inline.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-room-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-ui.test.cjs` | quick atual — fixture determinística |
| `party-room.test.cjs` | Aceite selecionado — party |
| `party-v11-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v13-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v15-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v151-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `personal-controls-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `personalized-discovery-smoke.cjs` | smoke atual — fluxo local/fixture |
| `playback-suggestions-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `playback-suggestions.test.cjs` | quick atual — fixture determinística |
| `premerge-audit.cjs` | syntax/static — auditoria do validate.ps1 |
| `premerge-visual.cjs` | Visual atual — fixtures locais |
| `project-audit-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `route-visibility-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `screen-audio-stats.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `scroll-continuity-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `search-quality-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `spaceamp-artwork-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `spaceamp-integrations.test.cjs` | quick atual — fixture determinística |
| `spaceamp-isrc-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-isrc.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `spaceamp-lyrics-clock-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-lyrics-motion-browser.cjs` | Browser focado — perfil visual/scroll/seek; PASS antes/depois V2.3 |
| `spaceamp-navigation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-now-playing-browser.cjs` | Browser focado — componente vendorizado/TTML; PASS integral V2.3 |
| `spaceamp-now-playing.test.cjs` | quick atual — fixture determinística |
| `spaceamp-regressions-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-timeline-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-video-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-youtube-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `spaceamp.test.cjs` | quick atual — fixture determinística |
| `spacevoice-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `spacevoice.test.cjs` | quick atual — fixture determinística |
| `steam-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `title-banner-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `title-detail-continuity-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `title-preferences-smoke.cjs` | smoke atual — fluxo local/fixture |
| `translation-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `validate.ps1` | Runner canônico — quick/smoke/syntax, party/legacy e visual |
| `visual-preview.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `visual-review.md` | Documentacao de testes |
| `visual-state-continuity.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `voice-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-audio.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-chat-server.test.cjs` | Aceite selecionado — party |
| `voice-chat-transport.test.cjs` | Aceite selecionado — party |
| `voice-chat.test.cjs` | quick atual — fixture determinística |
| `voice-media-settings.test.cjs` | quick atual — fixture determinística |
| `voice-mesh.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-peer.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-screen-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen-audio.test.cjs` | quick atual — fixture determinística |
| `voice-screen-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen.test.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `voice-ui.test.cjs` | quick atual — fixture determinística |
| `voice-ws.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `xmb-handoff-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `xmb-input.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `xmb.test.cjs` | quick atual — fixture determinística |
| `youtube-music-catalog-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `youtube-music-catalog.test.cjs` | quick atual — contrato YouTube vigente, fixtures locais |
| `youtube-music.test.cjs` | quick atual — contrato YouTube vigente, fixtures locais |
| `ytmusic-isrc-rehydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
