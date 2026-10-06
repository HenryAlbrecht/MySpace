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

## Organization Pass V2.3

Base: branch `refactor/organization-v2`, HEAD `d860ae38b4e2238676cac63c646561361d45e268`, working tree inicial limpo com Acceptance Baseline V2.2 incorporado. AGENTS, relatório atualizado, README/INVENTORY, arquitetura/mapa, contratos e arquitetura musical consultados antes de editar. Baseline V2.2 aceito como referência; nenhuma fixture foi relaxada.

### Auditoria e lote escolhido

Os candidatos explícitos continuam TitlePages (78.027 bytes), extras (53.390 bytes) e Now Playing (36.499 bytes antes). TitlePages mistura rendering musical com CORE/enrichment, rota e contexto de álbum; uma extração completa exigiria uma interface maior para reconciliação. Extras mantém storeItem/save/validação/editores e renderização compartilhados: mover apenas a fachada CollectionActions deixaria o ownership de mutações dividido. Artwork/palette compartilha revisions, decodes e atmosphere lifecycle. Esses candidatos permanecem para lotes próprios com contratos completos, sem movimentação cosmética nesta rodada.

Um único lote foi escolhido: perfil visual de lyrics no Shadow DOM. Tem responsabilidade independente, observers próprios e ciclo explícito de montagem/desconexão; a separação remove conhecimento dos detalhes do vendor do shell sem mover clock, seek, importação ou playback.

### Ownership e dependências

- Novo `dist/spaceamp-lyrics-profile.js`: factory `createSpaceampLyricsProfile({isCurrent})`, métodos `apply(component)` e `clear()`. Possui o CSS de paint e MutationObservers de linhas/layout; usa document/customElements/MutationObserver do ambiente. Não possui providers, importação, tempo, scroll, persistência ou controles de playback.
- `dist/spaceamp-now-playing.js`: cria o adapter com callback de validade (`shell.open` e componente atual); chama apply na criação e clear na troca/fechamento. Mantém componente, importação am-lyrics, metadata, clock/interpolação/seek, modal, foco, preferências, artwork/palette e atmosphere lifecycle. Reduzido para 470 linhas/33.314 bytes neste checkout.
- `dist/index.html`: carrega o novo script uma vez antes do shell. Harnesses de browser e page-smoke leem essa ordem; nenhuma lista isolada atual precisou ser alterada.
- `tests/organization.test.cjs`: mesma quantidade de testes, incluindo a nova dependência na verificação de ordem e na proibição de playback/storage em owners visuais.

O corpo movido é equivalente após normalizar somente o guard de lifecycle para o callback; CSS injetado preservado byte a byte. Evidência local: `artifacts/organization-v23/equivalence.json` e bloco anterior preservado. A formatação se limitou ao módulo novo; não houve source hygiene amplo. Nenhuma folha CSS, provider, ranking, busca, identidade, formato persistido, backup, API pública ou política de playback foi alterada. AGENTS não mudou: não há regra arquitetural nova.

### Validação e limites

- Antes/depois: lyrics-motion PASS nos dois estados, três transições, drift horizontal menor que 0,5 px, geometria de glyphs, scroll upstream, seek, pause/resume e troca de faixa. Mesmo harness, sem omitir assertions.
- Focados: organization, spaceamp-now-playing e spaceamp-integrations, 13 testes PASS antes de prosseguir.
- Baseline final: quick PASS (37 arquivos/186 testes); smoke PASS (9 arquivos); syntax/static PASS; git diff --check PASS.
- Browsers críticos: lyrics-clock, lyrics-motion, Now Playing integral e xmb-handoff PASS. Now Playing inclui controles, clock, artwork/atmosphere, resume, import/WebGL/CORS, XMB, responsivo e reduced motion. Clock/seek e foco usam os mesmos contratos do V2.2.
- Logs locais em `artifacts/organization-v23/`, sem criar dependência deles no clone. Testes usam fixtures locais; nenhum provider de rede real foi certificado.

Permanecem grandes: TitlePages e extras pelos acoplamentos descritos; Now Playing ainda coordena shell e lifecycle; CollectionView (31.588 bytes) compartilha seleção/filtros/capas/lista; Catalog (29.589 bytes) mantém cache/CORE/pending; app (24.596 bytes) possui host/adapters do player único; music-catalog (18.187 bytes) coordena providers/resolução; interface.css mantém cascata/refinamentos. Não foram divididos por tamanho. Risco principal da extração é ordem de carregamento/lifecycle async, coberto por organization, boot smoke e browsers. Autoplay/provider real, WebRTC/TURN e stress não foram recertificados por esta alteração visual interna.

Documentação vigente atualizada: architecture, module-map, contracts e tests/README/INVENTORY. Arquivos de produção alterados: index.html e spaceamp-now-playing.js; novo spaceamp-lyrics-profile.js. Sem commit/push.

## Source Readability / Hygiene V2.4

Branch `refactor/organization-v2`, HEAD/base `c00f20de97587283ee6d24da8c9a5d6bc6faaa86`, working tree inicial limpo. AGENTS, arquitetura, contratos, mapa, histórico, tests/README/validate e configuração Prettier lidos antes de editar. V2.2/V2.3 são a referência; somente layout/control-flow equivalente, sem ownership novo.

### Inventário registrado antes da primeira alteração

60 arquivos JavaScript próprios em dist, excluindo dist/vendor. Linhas contam linhas físicas sem a linha vazia final; comprimento em caracteres UTF-16, bytes UTF-8. Statements comprimidos: linhas com mais de um statement irmão em Program/Block/SwitchCase, via parser Babel. Callbacks comprimidos: FunctionExpression/Arrow/ObjectMethod com pelo menos dois statements e corpo em até três linhas. São indicadores, não avaliação de comportamento.

Classificação: HIGH se pelo menos 10 linhas multi-statement, cinco callbacks comprimidos ou 10 linhas >200; MEDIUM se pelo menos três linhas multi-statement, dois callbacks comprimidos ou 10 linhas >120; demais OK. Resultado: 25 HIGH, 11 MEDIUM, 24 OK. Somente os sete arquivos selecionados explicitamente nos lotes A–D serão editados; voice/chat é OK e permanece intacto.

| Arquivo | Classe | Linhas | Bytes | Maior linha | >120 | >200 | Linhas multi-statement | Callbacks comprimidos |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| dist/app.js | HIGH | 596 | 24596 | 250 | 19 | 7 | 12 | 7 |
| dist/artwork.js | OK | 48 | 2080 | 225 | 1 | 1 | 1 | 0 |
| dist/audio-tags.js | OK | 264 | 9333 | 107 | 0 | 0 | 0 | 0 |
| dist/backup-restoration.js | OK | 30 | 995 | 84 | 0 | 0 | 0 | 0 |
| dist/backup-validation.js | OK | 181 | 7408 | 110 | 0 | 0 | 0 | 0 |
| dist/catalog-discovery.js | MEDIUM | 280 | 12750 | 195 | 7 | 0 | 3 | 0 |
| dist/catalog-ui.js | OK | 20 | 953 | 112 | 0 | 0 | 1 | 0 |
| dist/catalog.js | HIGH | 522 | 29589 | 449 | 36 | 9 | 21 | 1 |
| dist/collection-view.js | HIGH | 656 | 31588 | 196 | 43 | 0 | 49 | 5 |
| dist/collection.js | OK | 109 | 4482 | 201 | 6 | 1 | 0 | 0 |
| dist/discovery-page.js | OK | 224 | 9066 | 108 | 0 | 0 | 0 | 0 |
| dist/editor-ui.js | HIGH | 601 | 24927 | 239 | 19 | 4 | 17 | 5 |
| dist/extras.js | HIGH | 1202 | 53390 | 815 | 51 | 19 | 31 | 3 |
| dist/keyboard-navigation.js | OK | 34 | 2315 | 149 | 4 | 0 | 0 | 0 |
| dist/media-embeds.js | MEDIUM | 79 | 4443 | 206 | 9 | 1 | 6 | 0 |
| dist/media-package.js | MEDIUM | 49 | 3579 | 362 | 4 | 3 | 6 | 0 |
| dist/media-storage.js | OK | 53 | 2104 | 134 | 1 | 0 | 0 | 0 |
| dist/motion-design.js | OK | 236 | 10279 | 165 | 7 | 0 | 0 | 0 |
| dist/music-bridge.js | MEDIUM | 127 | 5649 | 209 | 8 | 2 | 3 | 1 |
| dist/music-collection-matches.js | OK | 124 | 4178 | 80 | 0 | 0 | 0 | 0 |
| dist/music-discovery-view.js | OK | 333 | 11273 | 94 | 0 | 0 | 0 | 0 |
| dist/music-model.js | HIGH | 41 | 5416 | 557 | 19 | 6 | 12 | 0 |
| dist/music-page-ui.js | HIGH | 93 | 7743 | 335 | 22 | 3 | 17 | 4 |
| dist/music-source-link.js | MEDIUM | 208 | 9727 | 232 | 10 | 1 | 5 | 0 |
| dist/navigation.js | OK | 169 | 7466 | 131 | 5 | 0 | 2 | 0 |
| dist/party-chat-ui.js | OK | 114 | 5002 | 96 | 0 | 0 | 0 | 0 |
| dist/playlist.js | HIGH | 396 | 18013 | 419 | 20 | 4 | 32 | 5 |
| dist/profile-appearance.js | OK | 343 | 14343 | 110 | 0 | 0 | 0 | 0 |
| dist/spaceamp-atmosphere.js | HIGH | 69 | 3676 | 137 | 3 | 0 | 13 | 1 |
| dist/spaceamp-global-ui.js | MEDIUM | 345 | 15877 | 198 | 10 | 0 | 7 | 3 |
| dist/spaceamp-integrations.js | OK | 166 | 5382 | 108 | 0 | 0 | 0 | 0 |
| dist/spaceamp-lyrics-profile.js | OK | 80 | 3588 | 142 | 2 | 0 | 0 | 0 |
| dist/spaceamp-now-playing.js | HIGH | 470 | 33314 | 357 | 65 | 11 | 98 | 17 |
| dist/spaceamp-visualizer.js | OK | 127 | 4063 | 85 | 0 | 0 | 0 | 0 |
| dist/spaceamp.js | OK | 142 | 4828 | 109 | 0 | 0 | 0 | 0 |
| dist/spacevoice.js | HIGH | 842 | 50394 | 209 | 83 | 1 | 135 | 23 |
| dist/tag-page.js | HIGH | 30 | 4841 | 1204 | 12 | 7 | 18 | 4 |
| dist/title-banner.js | HIGH | 51 | 5319 | 314 | 20 | 7 | 25 | 6 |
| dist/title-gallery.js | OK | 124 | 5076 | 110 | 0 | 0 | 0 | 0 |
| dist/title-pages.js | HIGH | 1191 | 78027 | 645 | 153 | 31 | 146 | 14 |
| dist/title-preferences.js | MEDIUM | 35 | 2855 | 504 | 11 | 1 | 4 | 1 |
| dist/undo.js | HIGH | 50 | 3802 | 298 | 8 | 3 | 18 | 3 |
| dist/voice/chat.js | OK | 227 | 7553 | 109 | 0 | 0 | 0 | 0 |
| dist/voice/devices.js | HIGH | 70 | 4831 | 242 | 9 | 3 | 10 | 4 |
| dist/voice/ice-config.js | MEDIUM | 38 | 1997 | 170 | 2 | 0 | 4 | 0 |
| dist/voice/levels.js | HIGH | 68 | 3596 | 241 | 6 | 1 | 11 | 0 |
| dist/voice/media-settings.js | OK | 26 | 1851 | 144 | 4 | 0 | 0 | 0 |
| dist/voice/media.js | OK | 50 | 3184 | 188 | 5 | 0 | 0 | 0 |
| dist/voice/network.js | HIGH | 53 | 3850 | 404 | 6 | 2 | 14 | 5 |
| dist/voice/peer.js | HIGH | 224 | 14084 | 202 | 20 | 1 | 23 | 3 |
| dist/voice/presence.js | MEDIUM | 13 | 1225 | 328 | 4 | 1 | 3 | 2 |
| dist/voice/room-metadata.js | OK | 204 | 7260 | 109 | 0 | 0 | 0 | 0 |
| dist/voice/room.js | HIGH | 84 | 5339 | 191 | 10 | 0 | 25 | 6 |
| dist/voice/session.js | HIGH | 146 | 9656 | 300 | 18 | 3 | 28 | 2 |
| dist/voice/signaling-local.js | HIGH | 59 | 5119 | 333 | 13 | 5 | 17 | 1 |
| dist/voice/signaling-ws.js | MEDIUM | 71 | 3728 | 244 | 6 | 1 | 6 | 0 |
| dist/voice/state.js | HIGH | 152 | 9139 | 483 | 10 | 4 | 22 | 3 |
| dist/xmb-handoff.js | MEDIUM | 56 | 4332 | 297 | 10 | 4 | 8 | 1 |
| dist/xmb-input.js | HIGH | 36 | 2420 | 171 | 6 | 0 | 11 | 1 |
| dist/xmb.js | HIGH | 479 | 27870 | 383 | 31 | 4 | 46 | 2 |

Lotes autorizados: A room/session/peer; B xmb/collection-view; C catalog; D app. Cada lote só avança depois de equivalência e validação focada. Inventário detalhado e fontes originais ficam localmente em artifacts/readability-v24. Arquitetura/mapa/contratos, AGENTS, testes, CSS e vendor permanecem fora da edição.

### Lotes executados e neutralidade

Prettier 3.6.2 já disponível localmente foi aplicado apenas à seleção de cada lote, com .prettierrc existente e embeddedLanguageFormatting=off. Não foi executado formatter no dist inteiro. Inserções orientadas pelo parser adicionaram braces a if/else/loops sem bloco e separaram declarações irmãs (nunca o init de for); nomes, bindings, defaults e ordem de inicialização preservados. Else-if, ternários e funções existentes não foram reestruturados. Nenhuma extração, rename ou função/helper de produção novo.

Para cada arquivo, parser Babel comparou AST completa antes/depois, ignorando somente posições/raw de representação e normalizando declarações irmãs e blocos equivalentes de um statement. Chamadas, argumentos, condições, operadores, properties, ordem e valores permanecem na comparação. Adicionalmente, comentários e todos os literais, inclusive TemplateElement raw/cooked, foram comparados e preservados. Nenhuma alteração de CSS/string embedded; documentos arquiteturais e fixtures/assertions intactos. Evidências: JSONs por lote e metrics-final.json em artifacts/readability-v24.

| FILE | LINES BEFORE | LINES AFTER | MAX LINE BEFORE | MAX LINE AFTER | >120 BEFORE | >120 AFTER | >200 BEFORE | >200 AFTER |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| dist/voice/room.js | 84 | 275 | 191 | 86 | 10 | 0 | 0 | 0 |
| dist/voice/session.js | 146 | 433 | 300 | 96 | 18 | 0 | 3 | 0 |
| dist/voice/peer.js | 224 | 550 | 202 | 92 | 20 | 0 | 1 | 0 |
| dist/xmb.js | 479 | 1089 | 383 | 140 | 31 | 2 | 4 | 0 |
| dist/collection-view.js | 656 | 1145 | 196 | 101 | 43 | 0 | 0 | 0 |
| dist/catalog.js | 522 | 1036 | 449 | 164 | 36 | 3 | 9 | 0 |
| dist/app.js | 596 | 872 | 250 | 161 | 19 | 4 | 7 | 0 |

Todos os sete passaram de HIGH a OK pelo mesmo critério do inventário. Linhas multi-statement e callbacks comprimidos passaram a zero em todos eles. Arquivos restantes não foram editados: 53 próprios (18 HIGH, 11 MEDIUM, 24 OK), incluindo voice/chat e os demais OK; outros HIGH/MEDIUM ficam para lotes explicitamente autorizados, sem formatter global. Vendor foi excluído integralmente. As nove linhas restantes >120 pertencem a strings/templates/URLs/comentários preservados; não foram fracionados literais apenas por largura.

### Validação por lote

- Referência antes de produção: quick integral PASS, 37 arquivos/186 testes; xmb-handoff e music-collection-genres browsers PASS antes do lote B.
- A: 52 testes atuais em spacevoice, party-room-ui, party-presence/network/metered, voice-chat/media-settings/screen-audio/ui PASS; exercitam room/call, peer/session, ICE/cache, negotiation/recovery e mídia. validate party PASS nos quatro harnesses locais; syntax/static PASS antes de avançar.
- B: 19 testes Collection/polish/genres e XMB/input PASS; navigation smoke PASS; syntax/static PASS antes de avançar. Collection browser produz relatório JSON idêntico antes/depois (Music/Artist/Album, preview/expanded, enrichment tardio e edição). XMB browser passou antes e depois, cobrindo keyboard/gamepad, context/scroll/focus/handoff e reduced motion em 390/820/1440.
- C: 103 testes catalog, YouTube, Apple legacy/discografia/fotos, identidade, recomendações/recovery/resolution/search/reserve, final-recommendations, CORE/hydration e local-rotation PASS. Preload guard bloqueia fetch externo; zero tentativas registradas. Catalog.names foi somente formatado, preservando os valores iTunes legacy.
- D: page smoke PASS; 17 testes SPACEAMP/core/integrations/Now Playing/organization PASS. Browser integral do host e baseline final registrados abaixo após conclusão.

### Debt found during V2.4 — não corrigida

- voice-peer.test.cjs já classificado histórico no inventário falha antes e depois nos mesmos dois testes: signaling expected received.length=1/actual=0; descoberta de sessões expected offer de a/actual=[]. O teste isolado de buffer ICE/answer/remote tracks/close passa antes e depois. É diagnóstico adicional, não aceite current; nenhuma assertion nem provider/lifecycle foi adaptado para ele. Logs before-voice-peer/after-voice-peer preservados.
- Primeiro xmb-handoff após B expirou esperando entrada por pulso gamepad inicial de 70 ms. Repetição do mesmo harness/código passou integralmente, sem aumentar pulse/timeouts ou ignorar assertions. AST equivalente e referência antes verde; registrado como instabilidade observada do browser check, sem atribuir bug comprovado de produção nem esconder a execução falha.
- Preferências diretas em CollectionView e fallback Catalog.names iTunes permanecem dívida/compatibilidade documentada anteriormente. Nenhuma mudança de storage/source nesta rodada.
- Longas strings de UI, templates, URLs e comentários permanecem sem fracionar os valores. Nenhum bug novo de produção foi comprovado; oportunidades de ownership continuam fora do escopo.

### Resultado final

Quick final PASS integral (37 arquivos/186 testes), depois smoke PASS (9 arquivos), depois syntax/static PASS. Auditoria: 68 assets HTML, 59 scripts, 138 links Markdown, 363 requires locais. git diff --check PASS. Quick final também executado com preload guard de fetch externo: nenhum acesso externo registrado.

Browsers finais PASS: spaceamp-now-playing integral (host, controles/clock/artwork/atmosphere/pause-resume/fallbacks/XMB/responsivo/reduced-motion), lyrics-clock, lyrics-motion, xmb-handoff novamente após app/Catalog, music-final-recommendations (Music/Artist/Album/EP/Single/reserve/request counts) e title-detail-continuity. Music-collection-genres PASS após B, com relatório idêntico à referência anterior. Todos usam fixtures locais; nenhum provider real ou mídia WebRTC real recertificado.

Formatação idempotente nos sete arquivos, equivalência AST normalizada e preservação de comentários/literais PASS. Escopo final: apenas dist/voice/room.js, session.js, peer.js, dist/xmb.js, collection-view.js, catalog.js, app.js e este adendo. Nenhum módulo de produção criado; nenhum teste, AGENTS, arquitetura, mapa, contrato, CSS ou vendor alterado. Outras 53 fontes próprias permaneceram intactas. Sem commit/push.

**Nenhuma mudança comportamental deliberada foi feita.**
