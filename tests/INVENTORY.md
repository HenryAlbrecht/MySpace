# Inventário de validação

`validate.ps1` continua source of truth do aceite. Inclusão em quick/smoke descreve seleção, não certifica sucesso: há fixtures Apple stale após a migração YouTube Music. Veja [relatório V2](../docs/history/organization-pass-2026-10-06.md). Não executar wildcard. Browser manual significa revisar fixture e requisitos antes de usar. Este inventário cobre todos os harnesses e documentos atuais na raiz de tests; fixtures de dados não são testes executáveis.

| Arquivo | Categoria |
|---|---|
| `README.md` | Documentacao de testes |
| `apple-canonical-live.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `apple-canonical.test.cjs` | Aceite selecionado — quick |
| `apple-discography.test.cjs` | Aceite selecionado — quick |
| `artist-artwork-smoke.cjs` | Aceite selecionado — smoke |
| `artist-search-photos.test.cjs` | Aceite selecionado — quick |
| `artwork.test.cjs` | Aceite selecionado — quick |
| `audio-tags.test.cjs` | Aceite selecionado — quick |
| `backup-roundtrip-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `catalog-session-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `catalog.test.cjs` | Aceite selecionado — quick |
| `collection-title-return-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `collection.test.cjs` | Aceite selecionado — quick |
| `deezer-catalog-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-smoke.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `deezer-unified-live.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-unified-search.test.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `flac-smoke.cjs` | Aceite selecionado — smoke |
| `front-cohesion-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `health-pass-2-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-2.test.cjs` | Aceite selecionado — quick |
| `health-pass-3-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `igdb-relations-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `igdb-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `inspect-release-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `isrc-edition.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `keyboard-navigation-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `lastfm-enrichment-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `lastfm-recommendation-seed.test.cjs` | Aceite selecionado — quick |
| `lastfm-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `launcher-occupied-port.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `launcher.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `media-details-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `media-embeds-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `media-metadata-smoke.cjs` | Aceite selecionado — smoke |
| `media-package-smoke.cjs` | Aceite selecionado — smoke |
| `motion-design-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `motion-stability-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-artwork.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-auto-source-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-auto-source.test.cjs` | Aceite selecionado — quick |
| `music-catalog-consistency.test.cjs` | Aceite selecionado — quick |
| `music-collection-genres-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-collection-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-collection-polish-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-collection-polish.test.cjs` | Aceite selecionado — quick |
| `music-compact-visibility-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-core-hydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-core-hydration.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-discovery-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-duration-memory-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-duration-memory.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-editorial.test.cjs` | Aceite selecionado — quick |
| `music-final-recommendations-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-final-recommendations.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-first-paint-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-first-paint-live-browser.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-flow-http-smoke.cjs` | Aceite selecionado — smoke |
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
| `music-playback-resolver.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
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
| `music-recommendation-recovery.test.cjs` | Aceite selecionado — quick |
| `music-recommendation-resolution.test.cjs` | Aceite selecionado — quick |
| `music-recommendation-retry-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-recommendation-strategy.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-release-polish.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-routes-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-search-live-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-search-quality.test.cjs` | Aceite selecionado — quick |
| `music-search-reserve-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-search-reserve.test.cjs` | Aceite selecionado — quick |
| `music-search-review.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `music-source-link.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-tag-http.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-unified-search-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-unified-search.test.cjs` | Aceite selecionado — quick |
| `music-ux-backfill-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-ux-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-ux-genres-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `music-ux-genres.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `music-ux-motion-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `music-v16-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-v16.test.cjs` | Aceite selecionado — quick |
| `music-views-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-weirdo-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-weirdo-integrated.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `musicbrainz-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `navigation-camera-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `navigation-native-probe.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `navigation-smoke.cjs` | Aceite selecionado — smoke |
| `organization-visual.cjs` | Visual atual — fixtures locais |
| `organization.test.cjs` | Aceite selecionado — quick |
| `page-legacy-manual.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `page-smoke.cjs` | Aceite selecionado — smoke |
| `party-chat-cold-start.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-chat-layout-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-context-rail-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-ice-server.test.cjs` | Aceite selecionado — party |
| `party-media-settings-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered.test.cjs` | Aceite selecionado — quick |
| `party-network.test.cjs` | Aceite selecionado — quick |
| `party-polish-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-presence-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-presence.test.cjs` | Aceite selecionado — quick |
| `party-rename-inline.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-room-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-ui.test.cjs` | Aceite selecionado — quick |
| `party-room.test.cjs` | Aceite selecionado — party |
| `party-v11-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v13-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v15-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v151-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `personal-controls-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `personalized-discovery-smoke.cjs` | Aceite selecionado — smoke |
| `playback-suggestions-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `playback-suggestions.test.cjs` | Aceite selecionado — quick |
| `premerge-audit.cjs` | Atual — auditoria estática |
| `premerge-visual.cjs` | Visual atual — fixtures locais |
| `project-audit-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `route-visibility-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `screen-audio-stats.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `scroll-continuity-visual.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `search-quality-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `spaceamp-artwork-live.cjs` | Diagnostico manual — pode consultar rede/servicos |
| `spaceamp-integrations.test.cjs` | Aceite selecionado — quick |
| `spaceamp-isrc-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-isrc.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `spaceamp-lyrics-clock-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-lyrics-motion-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-navigation-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-now-playing-browser.cjs` | Focado/manual — um browser/context, fixtures e componente oficial CDN com TTML local |
| `spaceamp-now-playing.test.cjs` | Aceite selecionado — quick |
| `spaceamp-regressions-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-timeline-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-video-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `spaceamp-youtube-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `spaceamp.test.cjs` | Aceite selecionado — quick |
| `spacevoice-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `spacevoice.test.cjs` | Aceite selecionado — quick |
| `steam-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `title-banner-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `title-detail-continuity-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `title-preferences-smoke.cjs` | Aceite selecionado — smoke |
| `translation-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `validate.ps1` | Runner — source of truth |
| `visual-preview.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `visual-review.md` | Documentacao de testes |
| `visual-state-continuity.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `voice-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-audio.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-chat-server.test.cjs` | Aceite selecionado — party |
| `voice-chat-transport.test.cjs` | Aceite selecionado — party |
| `voice-chat.test.cjs` | Aceite selecionado — quick |
| `voice-media-settings.test.cjs` | Aceite selecionado — quick |
| `voice-mesh.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-peer.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-screen-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen-audio.test.cjs` | Aceite selecionado — quick |
| `voice-screen-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen.test.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `voice-ui.test.cjs` | Aceite selecionado — quick |
| `voice-ws.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `xmb-handoff-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `xmb-input.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `xmb.test.cjs` | Aceite selecionado — quick |
| `youtube-music-catalog-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
| `youtube-music-catalog.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `youtube-music.test.cjs` | Focado adicional — fora do aceite; revisar fixture |
| `ytmusic-isrc-rehydration-browser.cjs` | Browser/integracao adicional — manual; revisar fixture |
