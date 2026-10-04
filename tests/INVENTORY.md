# Inventário de validação

A lista de aceite vigente é explícita em `validate.ps1`. Manual não significa aprovado nem falha esperada: significa fora da suite de aceite, com revisão da fixture antes da execução. Os arquivos permanecem no lugar para preservar imports.

| Arquivo | Categoria |
|---|---|
| `apple-canonical-live.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `apple-canonical.test.cjs` | Atual — quick |
| `apple-discography.test.cjs` | Atual — quick |
| `artist-artwork-smoke.cjs` | Atual — smoke |
| `artist-search-photos.test.cjs` | Atual — quick |
| `audio-tags.test.cjs` | Atual — quick |
| `backup-roundtrip-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `catalog-session-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `catalog.test.cjs` | Atual — quick |
| `collection.test.cjs` | Atual — quick |
| `deezer-catalog-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-smoke.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `deezer-unified-live.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `deezer-unified-search.test.cjs` | Adapter histórico suportado — legacy; passa com mocks |
| `flac-smoke.cjs` | Atual — smoke |
| `health-pass-2-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-2.test.cjs` | Atual — quick |
| `health-pass-3-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `health-pass-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `igdb-relations-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `igdb-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `keyboard-navigation-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `lastfm-enrichment-evaluation.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `lastfm-recommendation-seed.test.cjs` | Atual — quick |
| `lastfm-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `launcher-occupied-port.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `launcher.integration.test.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `media-details-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `media-embeds-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `media-metadata-smoke.cjs` | Atual — smoke |
| `media-package-smoke.cjs` | Atual — smoke |
| `music-auto-source-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-auto-source.test.cjs` | Atual — quick |
| `music-catalog-consistency.test.cjs` | Atual — quick |
| `music-collection-polish-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-collection-polish.test.cjs` | Atual — quick |
| `music-compact-visibility-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-discovery-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-editorial.test.cjs` | Atual — quick |
| `music-flow-http-smoke.cjs` | Atual — smoke |
| `music-polish-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-preferences-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-real-controls-browser.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recommendation-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recommendations-check.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-recovery-check.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-real-services-browser.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-recommendation-recovery.test.cjs` | Atual — quick |
| `music-recommendation-resolution.test.cjs` | Atual — quick |
| `music-recommendation-retry-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-routes-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-search-live-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-search-quality.test.cjs` | Atual — quick |
| `music-search-reserve-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-search-reserve.test.cjs` | Atual — quick |
| `music-search-review.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `music-unified-search-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-unified-search.test.cjs` | Atual — quick |
| `music-v16-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-v16.test.cjs` | Atual — quick |
| `music-views-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `music-weirdo-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `music-weirdo-integrated.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `musicbrainz-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `navigation-smoke.cjs` | Atual — smoke |
| `organization-visual.cjs` | Visual atual — fixtures locais |
| `organization.test.cjs` | Atual — quick |
| `page-legacy-manual.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `page-smoke.cjs` | Atual — smoke |
| `party-chat-cold-start.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-chat-layout-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-context-rail-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-ice-server.test.cjs` | Atual — PARTY local (sem captura) |
| `party-media-settings-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-metered.test.cjs` | Atual — quick |
| `party-network.test.cjs` | Atual — quick |
| `party-polish-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-presence-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-presence.test.cjs` | Atual — quick |
| `party-rename-inline.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `party-room-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-room-ui.test.cjs` | Atual — quick |
| `party-room.test.cjs` | Atual — PARTY local (sem captura) |
| `party-v11-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v13-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v15-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-v151-browser.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `party-visual.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `personal-controls-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `personalized-discovery-smoke.cjs` | Atual — smoke |
| `playback-suggestions-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `playback-suggestions.test.cjs` | Atual — quick |
| `premerge-audit.cjs` | Atual — auditoria estática |
| `premerge-visual.cjs` | Visual atual — fixtures locais |
| `project-audit-diagnostic.cjs` | Diagnóstico manual — rede/serviços, não suite unitária |
| `screen-audio-stats.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `search-quality-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `spaceamp-integrations.test.cjs` | Atual — quick |
| `spaceamp-now-playing.test.cjs` | Atual — quick |
| `spaceamp-now-playing-browser.cjs` | Focado/manual — um browser/context, fixtures e componente oficial CDN com TTML local |
| `spaceamp-youtube-browser.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `spaceamp.test.cjs` | Atual — quick |
| `spacevoice-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `spacevoice.test.cjs` | Atual — quick |
| `steam-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `title-banner-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `title-preferences-smoke.cjs` | Atual — smoke |
| `translation-smoke.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `visual-preview.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-audio.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-chat-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-chat-server.test.cjs` | Atual — PARTY local (sem captura) |
| `voice-chat-transport.test.cjs` | Atual — PARTY local (sem captura) |
| `voice-chat.test.cjs` | Atual — quick |
| `voice-media-settings.test.cjs` | Atual — quick |
| `voice-mesh.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-peer.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `voice-screen-audio-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen-audio.test.cjs` | Atual — quick |
| `voice-screen-integration.cjs` | Manual/pesado/histórico — validar requisitos de mídia, processos ou fixture |
| `voice-screen.test.cjs` | Focado/manual adicional — não certificado neste pass; consultar fixture |
| `voice-ui.test.cjs` | Atual — quick |
| `voice-ws.test.cjs` | Histórico/manual — fixture/contrato antigo; revisar antes de usar como aceite |
| `xmb.test.cjs` | Atual — quick |
