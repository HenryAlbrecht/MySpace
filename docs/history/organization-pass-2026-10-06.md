# Organization / architecture pass V2 — 2026-10-06

## Estado inicial e documentação stale

Working tree inicial limpo, usado como fonte de verdade. Antes de qualquer edição de produção foram lidos código, README, architecture/module-map, relatório 2026-10-03 e tests/README/validate. Stale: README e mapas anunciavam Apple vigente; history/README apontava contrato Apple; docs/music Apple e vínculo anterior não marcavam legado; inventário omitia novos harnesses; tests/README contagem default antiga. `music-page-ui.js` já existe. Preferências diretas em views existentes são dívida, não serão redesenhadas.

## Sequência A/B

AGENTS criado; README, arquitetura/mapa/history index atualizados, contracts e music/architecture criados; docs Apple/vínculo marcadas legacy/historical. AGENTS relido antes de C/produção.

## Inventário antes da extração

### dist/title-pages.js

1282 linhas; 88364 bytes.

- Responsabilidades: Lifecycle/rota, busca, fichas genéricas, fases async e UI musical.
- Estado: controller/revision/rota/activeItem; entries/returnRoutes/albumContexts.
- Globals lidos/dependências: CollectionActions, Catalog, MusicModel, MusicPageUI, Navigation, Artwork, MusicBridge, TitlePreferences, SPACEAMP, helpers app.
- Globals escritos/side effects: TitlePages; hash/DOM/capa legacy; observers/motion/fetch.
- Fronteira segura: discovery musical e reconciliação por gêneros.

### dist/extras.js

1214 linhas; 54125 bytes.

- Responsabilidades: Composição perfil/Collection/playlist/PARTY, editores, mutações e backup.
- Estado: data, filtros, localVideo, playlistController.
- Globals lidos/dependências: state/persist/render/defaults do app; Collection, MediaPackage, TitlePreferences, MusicBridge, Catalog, views.
- Globals escritos/side effects: CollectionActions; storage/save/history, DOM/eventos, blobs/importação.
- Fronteira segura: transação apply/rollback de backup; mutations ainda dependem de editores/save compartilhados.

### dist/spaceamp-now-playing.js

581 linhas; 39673 bytes.

- Responsabilidades: Shell modal, lyrics adapter, artwork/palette, atmosphere, visualizer.
- Estado: preferências, modal/foco/inert, lyrics clock, artwork revision/cache, analyser.
- Globals lidos/dependências: SPACEAMP, Artwork, XmbHandoff, am-lyrics, atmosphere, DOM/media APIs.
- Globals escritos/side effects: SpaceAmpNowPlaying; DOM, preferências storage, listeners, frames, captura do áudio existente.
- Fronteira segura: visualizer com seu analyser; lyrics/artwork compartilham lifecycle e ficam para próxima rodada.

### dist/interface.css

512 linhas; 36391 bytes.

- Responsabilidades: Refinamentos comuns e overrides visuais.
- Estado: nenhum estado JS.
- Globals lidos/dependências: selectors das views/tokens/cascata.
- Globals escritos/side effects: estilos responsivos/motion/focus.
- Fronteira segura: não extrair CSS neste pass.

### dist/collection-view.js

657 linhas; 31588 bytes.

- Responsabilidades: Capas/lista/seleção/filtros e conexão XMB.
- Estado: listView/selected/grouping/filtros.
- Globals lidos/dependências: Collection, Navigation, TitlePages, XMB, callbacks compositor.
- Globals escritos/side effects: DOM/foco/scroll; preferências diretas existentes.
- Fronteira segura: manter coeso: modos compartilham seleção e filtros.

### dist/catalog.js

523 linhas; 29589 bytes.

- Responsabilidades: Fachada requests/normalização/cache/CORE/enrichment.
- Estado: detailCache/times/pending e caches de busca/recommendations.
- Globals lidos/dependências: MusicModel, fetch/local server, endpoints providers.
- Globals escritos/side effects: Catalog/CommonJS; requests e cache, leitura de capa legacy.
- Fronteira segura: não dividir cache nem normalização de providers neste pass.

### dist/app.js

597 linhas; 24596 bytes.

- Responsabilidades: Boot/perfil, host e adapters áudio/YouTube.
- Estado: state/pending/source/objectUrl/yt epoch/amp bindings.
- Globals lidos/dependências: SpaceAmp, SpaceAmpIntegrations, MediaEmbeds, MediaStorage, DOM.
- Globals escritos/side effects: SPACEAMP único; helpers globais, storage perfil, playback/media session.
- Fronteira segura: manter host/adapters para não alterar playback.

### server/music-catalog.cjs

298 linhas; 18187 bytes.

- Responsabilidades: Coordenação catálogo musical/providers e resolução/recommendations.
- Estado: recommendationStates/pending; lookups por resolução.
- Globals lidos/dependências: YouTubeMusic, iTunes legacy, artistArtwork, Lastfm, MusicBrainz, isrcEdition, ranking, MusicModel.
- Globals escritos/side effects: CommonJS createMusicCatalog; requests/cache de providers.
- Fronteira segura: manter coeso; ranking/provider não são escopo.

## Plano registrado antes de editar produção

1. Extrair recommendation presentation/reconciliation para music-discovery-view.js, preservando pool/reserve/motion/requests existentes e passando node/button/cover/open explicitamente.
2. Extrair relação Collection por gêneros para music-collection-matches.js com getActiveItem callback. Matching permanece MusicPageUI; sem store/cache novo.
3. Extrair visualizer/analyser para spaceamp-visualizer.js, recebendo amp/shell/canvas/preferences/reduced. Não criar playback; captureStream do elemento existente permanece.
4. Extrair somente apply/rollback de backup para backup-restoration.js recebendo persist/save; pós-aplicação UI/playback fica no compositor. CollectionActions continua owner central; separar toda mutation agora exigiria carregar editores/UI junto.
5. Preservar CSS integralmente. Atualizar scripts/harnesses e testes estruturais, inventário e docs. Executar quick/smoke/syntax e browsers afetados antes/depois.

## Resultado e ownership depois

| Responsabilidade | Owner depois / coordenador |
|---|---|
| Rota, lifecycle, busca, generic titles e fases async | title-pages.js mantém controller/revision/activeItem/entries/returnRoutes/albumContexts |
| Presentation/reconciliation de recommendations | music-discovery-view.js mantém pool/visible/seen/rotation/partial/reserve por seção; recebe node/button/cover/open e Catalog/MusicPageUI/CollectionActions/MusicModel |
| Relação Collection por gêneros | music-collection-matches.js reconcilia nós/expansão/foco; getActiveItem lê estado do coordenador; matching permanece MusicPageUI |
| Now Playing shell | spaceamp-now-playing.js mantém modal, clock de lyrics, preferences, artwork/palette e atmosphere lifecycle |
| Analyser/presentation visualizer | spaceamp-visualizer.js mantém context/analyser/bins/audioTap/sourceNode/pending; recebe amp/shell/canvas/preferences/reduced; lê áudio existente |
| Collection mutations | CollectionActions continua composto por extras.js; Collection valida o modelo, views delegam ações |
| Backup apply/rollback | backup-restoration.js executa a transação original com persist/save; extras mantém confirmação e pós-aplicação de UI/playlist |

Novos globals de integração: createMusicDiscoveryView, createMusicCollectionMatches, createSpaceampVisualizer e restoreProfileBackup (scripts clássicos). Nenhuma fachada pública removida. Collection, CollectionActions, Catalog, TitlePages, MusicBridge, SPACEAMP, SpaceAmpNowPlaying e PARTY_ROOM permanecem; helpers globais do app e factories anteriores continuam. Não houve framework DI/service locator.

As extrações receberam contratos explícitos. DOM/window/matchMedia/performance/AudioContext continuam APIs do ambiente; backup usa MediaPackage/TitlePreferences/localStorage existentes, sem store novo. SPACEAMP único continua criado por app.js. Visualizer captura somente áudio existente; não cria player/fila/storage.

Não houve redução planejada de redraw/requests: a reconciliação e limites/pending/caches existentes foram preservados. AST dos quatro blocos movidos foi comparada: discovery, visualizer e backup idênticos; gêneros idêntico após normalizar somente activeItem para getActiveItem(). Evidência local: artifacts/organization-v2/ast-equivalence.json. CSS permaneceu integralmente igual (comparação normalizando apenas CRLF/LF do checkout); cascata não foi movida. Não houve remoção de código morto: nenhum candidato apresentou evidência suficiente.

## Tamanhos depois e limites de coesão

| Arquivo | Linhas / bytes | Motivo de permanecer / próximo candidato |
|---|---|
| dist/title-pages.js | 1192 / 78027 | Mantém generic titles, rota e fases; UI de album/artist/editorial ainda mistura responsabilidades. Próximo candidato: music title rendering, preservando patch CORE/enrichment. |
| dist/extras.js | 1203 / 53390 | Compositor/editores/save ainda compartilham dados; CollectionActions não foi extraído artificialmente junto com editores. Próxima fronteira: mutations com contrato de save/render/patch definido. |
| dist/spaceamp-now-playing.js | 529 / 36499 | Shell/lyrics/artwork compartilham lifecycle e revisions. Próximos candidatos: lyrics adapter e artwork/palette/crossfade, sem mover playback. |
| dist/interface.css | 512 / 36391 | Refinamentos comuns/cascata; sem fragmentação visual nesta rodada. |
| dist/collection-view.js | 657 / 31588 | Coeso em torno de seleção/filtros/lista/capas; preferências diretas são dívida existente. |
| dist/catalog.js | 523 / 29589 | Fachada/cache/CORE; mantido para não duplicar cache ou alterar requests. |
| dist/app.js | 597 / 24596 | Host/adapters compartilham playback; mudança seria trabalho separado. |
| server/music-catalog.cjs | 298 / 18187 | Coordenação de providers e resolução; sem alteração de providers/ranking. |

Novos módulos: music-discovery-view.js (334 linhas), music-collection-matches.js (125 linhas), spaceamp-visualizer.js (128 linhas), backup-restoration.js (31 linhas). Linhas não são a métrica principal: ownership e fronteiras reais motivaram as extrações.

## Documentação e testes atualizados

AGENTS, README, architecture/module-map, contracts, music/architecture e history index agora descrevem YouTube Music vigente e Apple legacy. Documentos antigos mantidos e marcados. tests/INVENTORY foi reconciliado com todos os 192 harnesses/documentos atuais da raiz de tests; 34 quick e 9 smoke continuam selecionados pelo validate.ps1, sem certificar automaticamente harnesses antigos. tests/README corrigiu a contagem e documentou contratos.

organization.test adiciona ordem/ausência de duplicação, fachadas, SPACEAMP único, ausência de playback/storage em views e paths vigentes, além de falhas transacionais de backup. Sua fixture de source lookup antiga esperava apenas uma escrita; baseline reproduziu duas, incluindo cleanup do status transient após edição. Fixture atualizada para exigir cleanup e preservar título editado/ausência de fonte. Produção não alterada.

Now Playing browser tinha igualdade exata de lyrics durante reprodução; baseline retornou ~12.694 ms para amostra de 12.500 ms devido à interpolação já vigente. As duas assertions de clock do shell agora aceitam janela de 600 ms; clock/seek são verificados precisamente pelo harness dedicado. Nenhuma lógica do clock de produção foi alterada.

## Validação

- quick executado; parou em apple-canonical.test.cjs (2 falhas: fixtures esperam Apple como busca vigente). Providers/catálogo/teste não foram alterados; não remover o teste do aceite para esconder falha.
- smoke executado: sandbox inicialmente bloqueou loopback com EACCES; repetido fora dela. Oito smokes passaram; music-flow-http parou por fixture de busca Apple.
- syntax passou, incluindo auditoria de assets/requires/links. git diff --check passou.
- 54 testes focados passaram: organization, music-final-recommendations, collection-genres, core-hydration, local-rotation, music-pages-evolution, SPACEAMP/core/integrations do Now Playing.
- Browsers antes/depois passaram: music-collection-genres (Music/Artist/Album e releases mistos), music-final-recommendations (Music/Artist/Album/EP/Single, reserve/request counts), title-detail-continuity (CORE/artwork/recommendations/Back), backup-roundtrip (Collection, legacy, playlist, bytes, perfil e preferências).
- organization-visual antes/depois: 14 estados em 390/820/1440, Collection/Search/Profile/SPACEAMP/PARTY/chat/galeria. Mesmo relatório de layouts/ações, nenhum overflow/pageerror, um áudio por estado; capturas de Collection antes/depois e PARTY chat inspecionadas. Evidências locais em artifacts/organization-v2/visual-before e visual-after.
- lyrics-clock e lyrics-motion passaram: seek async, last-click-wins, pausa, clock grosseiro, continuidade de artwork e geometria. xmb-handoff passou: keyboard/gamepad, foco/contexto, clones, playback singleton e reduced-motion em 390/820/1440.
- Now Playing browser com clock corrigido passou controles/lyrics/scroll/responsivo/reduced-motion/analyser local até a assertion de foco xmb-play (linha 121). Essa assertion falhou igualmente antes/depois; não foi removida do aceite. Diagnóstico posterior separado omite somente essa assertion e não conta como aceite integral.

O diagnóstico Now Playing antes/depois confirmou artwork switch com safe image antes do front decode, uma texture upload, mesma instância e blend nativo de 1400 ms. Em ambos parou depois na expectativa atmosphere `uniform` (linha 246, observado null). Não se certifica o harness integral nem os cenários posteriores de fallback. Não houve tentativa de corrigir produção para satisfazer essas fixtures.

## Limites e próximos trabalhos

Nenhuma mudança comportamental deliberada. Não houve commit/push. Não foram certificados providers de rede real, autoplay YouTube, WebRTC/TURN/mesh, captura real ou stress. Guards e snapshots preservam playback/queue/storage/motion, mas não equivalem à cobertura de todas as combinações.

Próximos candidatos, não implementados: music title rendering; lyrics adapter/presentation e artwork/palette; CollectionActions mutations com save/patch callbacks; correção das fixtures Apple e expectativas XMB/atmosphere em tarefa separada de testes. CSS continua grande por cascata e refinamentos compartilhados; CollectionView continua grande e coeso; Catalog/servidor mantêm cache/provider coordination. TitlePages, Now Playing e extras diminuíram responsabilidades, mas não são apresentados como totalmente decompostos.

Check final: page-smoke também exige os métodos públicos originais de TitlePages, CollectionActions e SpaceAmpNowPlaying; passou. A lista de scripts do page-legacy-manual recebeu dependências movidas, mas continua histórica e não certificada. Auditoria final: 67 assets HTML, 58 scripts, 137 links Markdown e 360 requires locais; syntax e diff whitespace passaram.
