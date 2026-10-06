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

## Acceptance Baseline V2.2

Rodada exclusiva de testes/documentação em `refactor/organization-v2`, sobre HEAD/base `bbad43b65ca61d55e09f6d6a04a34a4d77fd851f` (organizacao v2.1). Working tree inicial limpo, usado como fonte de verdade. AGENTS, README, arquitetura, contratos, mapa, arquitetura musical, tests/README/INVENTORY/validate e este histórico foram lidos antes das alterações. O pass V2 aprovado não foi refeito.

Antes de editar, quick falhou em apple-canonical; smoke passou oito arquivos e falhou em music-flow-http; syntax passou. Como o runner é fail-fast, os 34 arquivos quick também foram executados individualmente para identificar todas as falhas: oito arquivos, 14 testes falhando. Logs integrais de arquivo/assertion/expected/actual estão em `artifacts/acceptance-v22/before-*.log`; não são dependências do clone.

Os oito arquivos falhos foram também executados sobre snapshot de `fa8583a` (base anterior ao Organization V2), sem checkout ou alteração de branch: todos falharam. O smoke HTTP reproduziu a mesma falha nesse snapshot. Os oito testes, smoke e providers/matching relevantes eram byte a byte idênticos entre fa8583a e bbad43b. Evidências: `previous-results.json`, `previous-comparison.json` e `previous-*.log` na mesma pasta de artifacts. O browser XMB também reproduziu a falha no HEAD antes da edição; o V2 já a reproduzira antes/depois das extrações.

### Falhas exatas capturadas

Linhas abaixo referem-se aos arquivos do baseline, antes da formatação/rename.

| Arquivo / teste / linha | Expected | Actual | Contrato relevante / causa |
|---|---|---|---|
| apple-canonical, searches, 6 | item `itunes:1`, source iTunes | `items[0]` undefined; TypeError em catalogId | Busca auto usa YouTube; mock YouTube vazio não força fallback Apple |
| apple-canonical, honest fallback, 19 | artista `itunes:1` | `items[0]` undefined | Mesmo acesso implícito Apple stale; enriquecimento legacy deve usar provider explícito |
| artist-search-photos, photos, 20 | IDs itunes:1/2/3 | [] | Mock Apple não participa de auto search |
| artist-search-photos, outage, 30 | rejection /offline/ | fulfilled, sem rejection | Outage foi injetado no provider que não é chamado |
| recommendation-recovery, retry, 6 | uma resolução inicial e retry só do failed | 503/unavailable, failures=3,total=3 | Resolução vigente usa youtubeMusic.search; mock itunes.resolveRecommendation não interceptava requests |
| recommendation-resolution, edition, 9 | zero sugestões secundárias | 503/unavailable, failures=1,total=1 | Mock não interceptava o resolver YouTube |
| recommendation-resolution, mixed, 14 | partial: failures=1,unmatched=1,total=2 | 503/unavailable, failures=2,total=2 | Falha/vazio devem ser injetados em YouTube search; unidades Apple continuam separadas |
| music-search-quality, photo recovery, 9 | primeiro artista com imagem vazia | TypeError em image, item undefined | Mock Apple não resolve recomendações atuais |
| music-search-quality, track evidence, 15 | artista com foto e três consultas legacy de evidência | TypeError em image, item undefined | Search explícito Apple e recommendations YouTube têm evidências/IDs próprios |
| music-search-quality, homonyms, 44 | dois artistas/IDs distintos | 0 | Search auto não consulta os dois IDs Apple mockados |
| music-search-reserve, incremental, 18 | pool vazio, seis resoluções e reserveAvailable=true | 503/unavailable, failures=6,total=6 | Mock Apple deixava o resolver YouTube sem fixture |
| music-unified-search, categories, 8 | uma chamada ao mock Apple | 0 | Busca vigente deve chamar YouTube uma vez; vazio não autoriza fallback implícito |
| playback-suggestions, matched, 6 | source=null/status=choose | fonte YouTube normalizada com videoId dQw4w9WgXcQ | Resultado confiante matched pode ser vinculado; expectativa de confirmação universal era stale |
| playback-suggestions, outage, 10 | rejection /offline/ | fulfilled | Catálogo transforma indisponibilidade em not-found/unavailable; adapter MusicBrainz isolado ainda pode rejeitar |
| music-flow-http, 3:934 | artista HTTP itunes:1 | TypeError em catalogId, item undefined | Mock HTTP não representava o catálogo vigente |
| Now Playing XMB, 121 | foco com classe xmb-play=true | false | Primeiro Enter já abre Now Playing pelo item; a tentativa seguinte de focar botão oculto não muda o opener |
| Now Playing lyrics, antigo 246 | `am-lyrics.line-motion=uniform` | null, como verificado pelos harnesses dedicados e diagnóstico V2 | O shell mantém autoscroll/interpolate e perfil visual; não impõe line-motion |

Correção do relato V2: a expectativa `uniform` era de **line-motion no am-lyrics**, não de data-atmosphere. O texto original acima foi mantido como registro histórico; esta seção corrige sua interpretação.

### Classificação e mudanças de fixture

- CURRENT: catálogo YouTube, relações artista/álbum, CORE/full, identifiers, resolução de sinais Last.fm para entidades YouTube, reserve/retry/cache, playback matched/choose/not-found, foco e lyrics atuais.
- LEGACY SUPPORTED: createMusicClient/normalização/discografia Apple; `provider=itunes` explícito, leitura de detalhes numéricos, fotos Deezer auxiliares, IDs antigos em Collection/backup/matching. Essas ocorrências não foram convertidas em YouTube por search/replace. Units Apple em arquivos mistos permanecem no quick como adapters suportados com mocks; descrições distinguem legacy.
- STALE: exigir Apple no provider auto, mockar itunes.resolveRecommendation para resolver atual, exigir confirmação universal/rejection no catálogo de playback, focus xmb-play independente do opener e line-motion uniform. Somente essas expectativas foram alinhadas; nenhum teste saiu do quick por falhar.

`apple-canonical.test.cjs` foi renomeado semanticamente para `music-legacy-apple.test.cjs`; as seis unidades anteriores foram preservadas com acesso explícito e acrescentada validação da Collection legacy sem conversão/fusão insegura. Referências históricas ao nome antigo registram a época; runner/README/INVENTORY agora apontam ao nome atual. Não houve exclusão de cobertura Apple útil nem alteração do grupo legacy Deezer.

O quick promoveu cobertura já existente em youtube-music-catalog, youtube-music e music-playback-resolver. O catálogo ganhou uma assertion de integração search/details/Collection com source/relações/IDs preservados; não há nova suíte duplicada. Passou de 34 para 37 arquivos. Recommendation recovery/resolution/reserve usam mocks do provider atual e mantêm limites, concorrência, retry e ausência de identidade secundária. Unidades específicas Apple continuam testando seu adapter.

Music-flow-http permanece um smoke de servidor/fetch HTTP real em loopback: search dos três kinds, detalhes CORE/full, identifiers MusicBrainz, editorial, rádio e playback, 400/404/405/410/503, JSON error, ausência de chamadas Apple no fluxo atual e leitura legacy explícita. Todos os providers são fixtures; não há consulta real.

Playback-suggestions agora distingue matched confiante, choose/áudio direto e not-found/unavailable. O contrato foi corroborado por music-playback-resolver e music-auto-source existentes; não se alterou matching ou política de vinculação de produção.

### Decisões de foco, lyrics e fallback de source

Ao retornar de Now Playing, o controle que abriu a apresentação deve receber foco se ainda existir. No XMB, saveContext/closed restaura opener, categoria, seleção e scroll; há fallback à entrada/seleção quando o opener saiu do DOM. `.xmb-play` só é esperado quando foi o opener efetivo. O browser agora certifica item + Backspace e entrada Now Playing + Escape, incluindo identidade dos nós/seleção/scroll. Igualdade de innerHTML inteiro foi substituída por contratos de continuidade: relógio e texto da faixa podem mudar, sem permitir remount/redraw global.

`line-motion=uniform` não pertence ao perfil vigente. Mantêm-se autoscroll/interpolate upstream, ausência de no-blur imposto, perfil Shadow DOM, active/pre-active/inactive, blur, geometria sem drift, click-to-seek e reduced motion. Clock aproximado continua na janela de 600 ms; precisão/ack/pausa são certificados por lyrics-clock. Os dois browsers dedicados continuam sem relaxamento.

Now Playing também tinha uma fixture de falha de import que interceptava o antigo CDN. O motor atual é `dist/vendor/am-lyrics-1.7.4.js`; com a fixture antiga, a expectativa de aviso de falha expirava em 30 s. O harness agora usa módulo vendorizado/TTML determinístico e intercepta a importação local para testar a falha real. Nenhum timeout foi aumentado nem assertion comentada/skipped.

`Catalog.names` ainda contém defaults iTunes. Auditado: normalize usa `i.source || names[kind]`; os parsers YouTube de search/browse/radio fornecem source YouTube Music. O payload real normalizado é certificado pelo teste canônico; esses defaults não vencem uma entidade vigente válida. Podem aparecer em entrada incompleta/legacy sem source; ficam documentados e preservados. Não se alterou catalog.js por aparência de string stale. A mensagem textual Apple da rota removida 410 também permanece histórica; o smoke certifica status/error sem tratar a rota como provider vigente.

### Antes/depois final

| TESTE | ANTES | CAUSA | AÇÃO | DEPOIS |
|---|---|---|---|---|
| apple-canonical → music-legacy-apple | FAIL (2) | Apple implícito em auto | Rename, provider legacy explícito, Collection legacy | PASS |
| artist-search-photos | FAIL (2) | Provider errado no mock | Acesso explícito legacy, cobertura de foto/erro mantida | PASS |
| recommendation-recovery/resolution | FAIL (1/2) | Resolver Apple mockado no fluxo YouTube | Fixtures YouTube, adapters Apple mantidos | PASS |
| music-search-quality | FAIL (3) | Search/recommendation mockados em Apple | Separar evidência legacy e identidade YouTube | PASS |
| music-search-reserve | FAIL (1) | Resolver atual sem fixture | Search YouTube com pool incremental; limites preservados | PASS |
| music-unified-search | FAIL (1) | Esperava Apple no auto | Certificar chamadas/vazio/outage YouTube sem fallback | PASS |
| playback-suggestions | FAIL (2) | Confirmação universal e rejection antigas | Certificar matched/choose/nonfatal unavailable | PASS |
| music-flow-http | FAIL | HTTP exigia Apple | YouTube CORE/full/identifiers/rádio/playback/errors e legacy explícito | PASS |
| XMB focus | FAIL | Tentativa de focar xmb-play já oculto | Opener real + nós/seleção/scroll; Backspace/Escape | PASS |
| Lyrics line-motion | FAIL no diagnóstico V2 | Atributo removido deliberadamente | Perfil vigente + dedicated clock/motion mantidos | PASS |
| Lyrics import failure | Fixture stale, timeout após destravar casos anteriores | Interceptava CDN antigo | Bloquear import local vendorizada | PASS |
| quick | FAIL | Oito arquivos inconsistentes | Mocks/contratos alinhados, cobertura canônica promovida | PASS integral, 37 arquivos |
| smoke | FAIL | Último smoke Apple | HTTP vigente mantendo cobertura | PASS integral, 9 arquivos |
| syntax/static | PASS | — | Reexecutar após mudanças | PASS integral |

Browsers executados: spaceamp-lyrics-clock, spaceamp-lyrics-motion, xmb-handoff e spaceamp-now-playing, todos PASS. Now Playing integral inclui analyser local, raw temporal 0/2/5/10 s, artwork/mesma instância/upload, pause/resume, import/WebGL/CORS, responsivo e reduced-motion. Não se usaram probes com assertions omitidas nesta rodada.

Auditoria adicional quick com fetch externo bloqueado: 37 arquivos passaram, zero tentativas de rede externa (`network-audit.json`). O smoke usa apenas loopback/providers injetados. Artefatos baseline/final ficam locais em `artifacts/acceptance-v22/`, sem depender deles em clones novos.

Arquivos alterados: AGENTS.md (uma regra curta de baseline), docs/contracts.md, este adendo, tests/README.md, tests/INVENTORY.md, validate.ps1, rename apple-canonical→music-legacy-apple, apple-discography (descrição legacy), artist-search-photos, music-recommendation-recovery/resolution, music-search-quality/reserve/unified-search, playback-suggestions, music-flow-http-smoke, youtube-music-catalog e spaceamp-now-playing-browser. Nenhum arquivo de produção/CSS/provider/ranking/playback foi alterado. Nenhum módulo de produção criado; nenhuma extração/formatting de produção. Nenhum bug real de produção foi encontrado nesses conflitos; nenhum foi escondido por skip/catch/timeouts.

**Nenhuma produção foi alterada para satisfazer mock stale.** Sem commit/push.
