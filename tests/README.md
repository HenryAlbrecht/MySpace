# Validação atual

Execute na raiz, com Node 24 neste ambiente. Não use wildcard para executar todos os `.cjs` ou `.test.cjs`: existem diagnósticos externos, fixtures históricas e regressões de mídia. A classificação de cada harness está no [inventário](INVENTORY.md).

## Escolha rápida

| Domínio | Validação focada |
|---|---|
| Music playback / source / compact | `node tests/music/music-playback-browser.cjs <grupo ou cenário>` |
| XMB / Quick Menu / controller | `node tests/spaceamp/spaceamp-browser.cjs <grupo ou cenário>` |
| Now Playing / lyrics / presentation | `node tests/spaceamp/spaceamp-presentation-browser.cjs lyrics` (ou grupo/cenário/full) |
| Search musical / continuation | `node tests/music/music-search-pagination-browser.cjs` |
| Artist / discografia | `node tests/music/artist-discography-browser.cjs`; `node tests/music/artist-discography-window-browser.cjs` |
| Profile extras | `node tests/profile/profile-extras-browser.cjs` |
| Backup / restore | `node tests/backup/backup-roundtrip-browser.cjs` |
| Boot / performance | `node tests/boot-performance-browser.cjs after` |
| PARTY servidor/transportes | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 party` |
| Quick / smoke / syntax global | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick` (ou `smoke` / `syntax`) |

Substitua `<grupo ou cenário>` por uma seleção das tabelas abaixo. Escolha a menor validação suficiente para a mudança; browser/visual não integram automaticamente o default.

## Comandos canônicos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick-music
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick-spaceamp
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick-party-ui
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 smoke
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 syntax
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 visual
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 party
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 legacy
```

`default` roda quick + smoke + syntax. `quick` seleciona os unitários determinísticos; `smoke` executa fluxos locais, incluindo boot DOM; `syntax` executa `node --check` e `premerge-audit.cjs`. A seleção vigente está em [validate.ps1](validate.ps1) e segue os [contratos](../docs/contracts.md). Interrompe no primeiro erro; não ignora falhas. Cada arquivo roda em processo próprio, evitando vazamento de globals entre fixtures, com isolamento interno desabilitado para compatibilidade com a sandbox. Não instala dependências ou tooling.

`party` contém quatro harnesses de servidor/transportes locais, sem captura ou negociação de mídia real. `legacy` valida o adapter Deezer retido; não autoriza Deezer como catálogo de produção. `visual` usa um único browser/context e três capturas de Profile/SPACEAMP, Collection e PARTY, com providers locais simulados.

Focado em um arquivo:

```powershell
node --test --experimental-test-isolation=none tests/music/music-editorial.test.cjs
node tests/page-smoke.cjs
```

Quicks por domínio são subconjuntos sem duplicação da seleção global existente:

| Grupo | Contratos / seleção |
|---|---|
| `quick-music` | 20 arquivos: catálogo/identidade, tags, resolver/source, adapters suportados, busca/recomendação e bridge musical |
| `quick-spaceamp` | 5 arquivos: artwork, SPACEAMP, integrations, Now Playing e XMB |
| `quick-party-ui` | 9 arquivos: ROOM/presence/network/metered, chat, settings, screen audio e UI determinística; sem mídia física |

Para mudança média de um domínio, use focused + quick apropriado + syntax.
Use quick global para ausência de grupo apropriado, cross-domain, merge/release
ou risco concreto entre domínios. Collection/health/organization permanecem na
seleção global. `party` conserva a seleção própria de servidor/transportes.

Focused unitário por nome, verificado no Node atual:

```powershell
node --test --experimental-test-isolation=none --test-name-pattern="search continuation uses one official request" tests/music/youtube-music-catalog.test.cjs
```

O padrão seleciona o teste existente “search continuation uses one official request,
independent bounded cache/pending and rejects invalid tokens”. Não exige dividir
o arquivo nem executar os demais testes.

## Suítes browser canônicas

### Suíte browser Music Playback

`tests/music/music-playback-browser.cjs` seleciona cenário, grupo ou `full` (default). Argumento inválido falha antes do boot e lista cenários/grupos válidos.

```text
node tests/music/music-playback-browser.cjs source:auto
node tests/music/music-playback-browser.cjs preview
node tests/music/music-playback-browser.cjs compact
node tests/music/music-playback-browser.cjs routes
node tests/music/music-playback-browser.cjs full
```

O runner usa um server e um processo Edge por execução, com contexto/page,
storage e mock YouTube limpos por cenário. `fixture.cjs` concentra WAV real,
importação de registros legacy, Media Session, rotas e precondições de playback;
`runtime.cjs` possui boot/cleanup. O mock confirma playback explicitamente,
eliminando a corrida entre criação do iframe, onReady e PLAYING. Rede externa é
bloqueada; source lookup e metadata são respostas locais. A suíte não gera
screenshots, logs ou artifacts permanentes e não usa sleeps de sincronização.

| Cenário | Contrato canônico |
|---|---|
| `playback:local` | WAV, metadata/Media Session, privacy/share, controles compactos, queue/library dedupe, volume, stop e reduced motion |
| `playback:youtube` | Vínculo manual de item importado, confirmação real de PLAYING, pausa do áudio local, Media Session/volume, dedupe, previous/next, destroy, ended e persistência/reload |
| `routes:continuity` | Full ancorado no perfil, compacto fora, geometria local/YouTube igual, áudio/queue/volume/clock e iframe/player/src preservados entre rotas |
| `compact:local` | Close/reopen sem parar/recriar áudio, clock/volume/queue/Now Playing e sincronização de controles |
| `compact:youtube` | Close/reopen com iframe/player/src/clock/volume retidos, viewport >=200x200 e retorno ao perfil |
| `preferences:visibility` | Rota pausada não abre compacto; preferência oculta compacto/launcher sem parar playback |
| `preview:queue` | Prévia sem mutar queue atual ou persistida, nem avançar em ended |
| `source:auto` | Resolução automática de item importado sem perder metadata/identidade |
| `source:manual` | Override manual após resolução automática |
| `source:not-found` | Sem fonte fabricada quando lookup não encontra resultado |
| `source:choose` | Ambiguidade sem source automática; candidato preenche URL e só save vincula |
| `controls:profile` | Controles full local/YouTube, sincronização com compacto, previous/next/play/pause/volume no mesmo owner |

Grupos: `playback`, `routes`, `compact`, `preferences`, `preview`, `source`,
`controls`. Cada cenário começa das próprias precondições; nenhum executa
assertions de outro cenário. Source resolution trata itens importados sem fonte,
enquanto novas identidades musicais seguem o catálogo YouTube Music vigente.


### Suíte browser SPACEAMP/XMB

`tests/spaceamp/spaceamp-browser.cjs` seleciona um cenário, um grupo ou `full` (default).
Argumento desconhecido falha antes de iniciar Edge/server e lista as opções.
Use `node tests/spaceamp/spaceamp-browser.cjs full` para a suíte completa.

```text
node tests/spaceamp/spaceamp-browser.cjs video:track-change
node tests/spaceamp/spaceamp-browser.cjs video
node tests/spaceamp/spaceamp-browser.cjs quick-menu
node tests/spaceamp/spaceamp-browser.cjs handoff
node tests/spaceamp/spaceamp-browser.cjs full
```

O runner compartilha um server e um processo Edge por execução. Cada cenário
recebe um contexto/page novo e fixtures determinísticas, inclusive storage,
Gamepad API, clock e componente de lyrics. `prepare.cjs` estabelece precondições
sem executar assertions de outro cenário. `fixture.cjs` concentra setup e ações
semânticas; `runtime.cjs` possui boot/cleanup. Capturas e amostras de frames são
temporárias e removidas no cleanup, inclusive em falha.

Grupos: `handoff`, `controller`, `quick-menu`, `video`, `lyrics` e `presentation`.

| Cenário | Contrato canônico |
|---|---|
| `handoff:entry` | Entrada por teclado/gamepad, fullscreen indisponível, details, clone/singleton |
| `controller:topology` | Transport/ranges, shortcuts, edge-trigger, fallback hidden/disabled/inert |
| `quick-menu:commands` | Clock/timer, artwork/decode/stale, rail, comandos e preferences |
| `video:presentation` | Vídeo: readiness, promoção, top layer, singleton, geometry e reduced motion |
| `video:track-change` | Vídeo A → B → C, stale readiness, pending/ready/failed, lyrics/foco/menu |
| `lyrics:navigation` | Lyrics: cursor/seek, opções/anchor, replacement, loading/unsynced, retorno |
| `quick-menu:xmb-origin` | Menu no XMB: origem, contexto, dimensões, reduced motion, entrada sem restart |
| `handoff:entry-artwork` | Identidade da artwork por categoria/item, frames de mesma capa |
| `controller:gamepad-entry` | Confirm mantido, nowEntry sem clone e controle direcional |
| `handoff:decode` | Nova capa com decode deliberadamente atrasado |
| `handoff:reverse` | Reverse: revision, invalidation, decode limite, callbacks stale, clone órfão |
| `controller:axes-repeat` | Gamepad: deadzone, eixos, repeat e hints |
| `presentation:responsive` | Outras mídias/details, viewports, geometry estável, seleção após insert |
| `quick-menu:system` | Fullscreen/exit através dos owners, ordem de fechamento |
| `presentation:return-preferences` | Reveal cancelado, retorno single selection e preferences após reload |

Checks comuns certificam CSS, page errors e cleanup de timer. Waits de readiness/geometry/clone e carregamento das opções nativas preferem
condições observáveis. Sleeps mantidos documentam observação negativa, botão
mantido/repeat, checkpoint antes do decode atrasado, estabilidade entre frames
ou settle de scroll/foco sem evento público.

Sobreposição deliberada: `spaceamp-presentation-browser.cjs` certifica o shell com
o vendor oficial e fixtures TTML, palette/atmosphere, clock/idle e fallback.
`spaceamp-video-browser.cjs` certifica o adapter YouTube simulado e áudio WAV,
preservando player/contentWindow, chamadas, relógio, volume, auto-next e áudio
local. Esta suíte certifica os contratos XMB/controller/menu com lyrics
determinísticas; as outras duas são independentes e ficam fora de seu `full`.

### Suíte browser SPACEAMP presentation

`spaceamp-presentation-browser.cjs` é o runner canônico do shell Now Playing.
Módulos em `tests/spaceamp/spaceamp-presentation-browser/`: runtime compartilhado (server/Edge),
fixture e cenários. Cada cenário usa context/page novos, sem depender de storage,
GPU, media, focus ou component lifecycle de outro cenário. Cleanup fecha owners,
certifica parada do draw loop e ausência de page errors, libera context, browser,
server e diretório temporário de capturas/métricas; falhas também passam por finally.
O vendor oficial am-lyrics 1.7.4 recebe TTML local antes da conexão do componente.
Rede externa é bloqueada; playback é fixture local.

```powershell
node tests/spaceamp/spaceamp-presentation-browser.cjs lyrics:vendor
node tests/spaceamp/spaceamp-presentation-browser.cjs lyrics
node tests/spaceamp/spaceamp-presentation-browser.cjs palette
node tests/spaceamp/spaceamp-presentation-browser.cjs atmosphere
node tests/spaceamp/spaceamp-presentation-browser.cjs timeline
node tests/spaceamp/spaceamp-presentation-browser.cjs full
```

Seleção aceita cenário, grupo ou `full` (default). Argumento inválido falha antes
do boot e lista opções. Grupos: shell, lyrics, visualizer, palette, atmosphere,
timeline, responsive, failure e preferences.

| Cenário | Contrato |
|---|---|
| `shell:idle` | Open/close, controles, idle/engaged, foco e scroll |
| `shell:xmb` | XMB com reprodução, opener/nós/seleção preservados e retorno |
| `lyrics:vendor` | Vendor oficial, ms/seek/pause, seleção/controller e romanização/tradução |
| `lyrics:visibility` | Lyrics/clock continuam com UI auto-hidden |
| `visualizer:modes` | Auto/audio/ambient/off, fallback remoto e analyser do áudio local único |
| `palette:artwork` | Paleta por artwork, clamp/contraste, navegação/auto-next e fallback |
| `atmosphere:decode` | Decode/transition, CORS e fallback remoto sem empobrecer artwork |
| `atmosphere:temporal` | Amostras WebGL 0/2/5/10s, drift/identidade de cor, pause/resume |
| `atmosphere:lifecycle` | Static/dynamic, hide/close/reopen, GPU ownership e foco |
| `timeline:transport` | Loading, clock/seek/transport, buffering, navigation intent e falha |
| `responsive:layout` | Geometria desktop/mobile, artwork e reduced motion |
| `failure:lyrics` | Vendor indisponível preserva controles e fallback |
| `preferences:reload` | Preferências validadas/defaults, reload e ausência de playback salvo |
| `failure:atmosphere` | WebGL/vendor indisponível mantém fallback estático |

Readiness usa estado/atributo/evento: palette/decode, transição, loading, idle e
animações finitas. Janelas negativas de idle/draw/reduced-motion e amostras GPU
mantêm waits temporais necessários ao contrato; não são thresholds de desempenho.

Fronteiras preservadas: `spaceamp-browser.cjs` continua XMB/controller/Quick Menu/handoff.
`spaceamp-video-browser.cjs` mantém adapter/iframe/clock/auto-next e WAV reais;
`spaceamp-regressions-browser.cjs` mantém snapshots do adapter e entrega restrita
de artwork. `spaceamp-lyrics-clock-browser.cjs` e `spaceamp-lyrics-motion-browser.cjs`
mantêm TTML/provider clock, interpolação/seek/freeze e movimento upstream.
`spaceamp-timeline-browser.cjs` mantém seek sincronizado perfil/compact e WAV.
Essas fixtures têm contratos distintos e não integram presentation full.

## Escrever e refatorar harnesses

Um teste focado deve ser focado também em execução.

Prefira suites por domínio com:

- poucos fixtures/helpers compartilhados e coesos;
- cenários pequenos com nomes semânticos;
- execução isolada por cenário ou grupo;
- um runner completo para integração/merge.

Se um harness já cobre múltiplos fluxos ou owners independentes, não continue
acrescentando todos os contratos ao mesmo fluxo sequencial. Extraia cenários
executáveis isoladamente e componha-os no runner completo da mesma suite.

Os runners canônicos permitem selecionar cenário ou grupo para validação focada e `full` para integração. Exemplo: `node tests/spaceamp/spaceamp-browser.cjs video:track-change`; integração: `node tests/spaceamp/spaceamp-browser.cjs full`.

O runner completo pode compartilhar server/browser/context para evitar boots
repetidos, desde que cada cenário tenha reset determinístico e não dependa de
efeitos colaterais de outro cenário.

Prefira waits por estado, evento, atributo ou condição observável.
Evite `waitForTimeout()` como sincronização quando houver condição determinística
equivalente.

Helpers devem reduzir setup, seletores e mecânica repetitiva sem esconder o
contrato certificado pelo cenário.

Prefira a suite existente do domínio, mas não aumente indefinidamente um cenário
monolítico.

Evite:

- um `.cjs` autocontido novo para cada bug;
- setup de browser/server/player duplicado;
- mega-harnesses sequenciais que precisam rodar tudo para validar uma parte;
- abstrações criadas apenas para reduzir LOC.

## Contratos e fixtures

`node tests/music/music-search-pagination-browser.cjs` usa client YouTube/Catalog/HTTP reais com respostas guest locais e imagens locais: uma request inicial/+uma por continuation, append/dedupe/contador/fim, retry, stale busca/rota, foco/scroll/card/imagem retidos, homônimos entre páginas, ciclos, 10 páginas/400 itens e picker first-page. Rede externa bloqueada. `youtube-music-catalog.test.cjs` cobre parser/page/cache/pending/token e legacy; `catalog/catalog.test.cjs` cobre cache compartilhado search Array/searchPage; `music-flow-http-smoke.cjs` cobre cursor/end/400 e caching HTTP preservado. Fixture mínima em `tests/music/fixtures/youtube-music-search-continuation.json`, baseada na estrutura de shelf/continuation.

- `page-smoke.cjs` lê a ordem de scripts de `dist/index.html`, verifica fachadas, boot e um único áudio. O DOM é simulado; eventos/observers são stubs, sem certificar comportamento visual.
- `voice-ui.test.cjs` entra na ROOM antes da chamada, recebe chat pelo transporte da sala e verifica que sair da CALL mantém a ROOM. `party-room-ui.test.cjs` também cobre chat sem captura.
- `youtube-music-catalog.test.cjs` e `youtube-music.test.cjs` certificam catálogo vigente: search, identidade/source, relações artista/álbum, detalhes, Collection e ausência de fallback Apple implícito. `music-playback-resolver.test.cjs` cobre matched/choose, fallback e indisponibilidade.
- `music-editorial.test.cjs` cobre resolução canônica YouTube de sinais Last.fm, reserva progressiva e detalhes Apple legacy. `music-legacy-apple.test.cjs` certifica acesso explícito `provider=itunes`, detalhes/normalização e Collection legacy. `apple-discography` e `artist-search-photos` mantêm contratos de adapters legacy suportados no quick; não exigem Apple como catálogo principal.
- `music-search-quality/reserve/unified-search` e `music-recommendation-recovery/resolution` misturam contratos atuais de resolução com unidades de adapters Apple explicitamente descritas como legacy. Apple/Deezer IDs em matching/backup são compatibilidade, não preferência de provider.
- `music-flow-http-smoke.cjs` usa servidor HTTP real em loopback, sem providers reais: search dos três kinds, details CORE/full, identifiers, editorial, rádio/playback, erros/status e rota de leitura Apple legacy explícita.
- `deezer-smoke.cjs` e `deezer-unified-search.test.cjs` cobrem o adapter histórico ainda existente, com mocks. Não chamam rotas de catálogo Deezer removidas.
- `premerge-audit.cjs` verifica paths HTML/CSS, requires relativos e links Markdown. Os módulos internos devem carregar antes dos consumidores.
- `project/organization.test.cjs` verifica ordem/duplicação de scripts, fachadas, SPACEAMP único, ausência de player/storage nas views extraídas, caminhos canônicos e transação/rollback de backup. Sua fixture source lookup considera a limpeza do status transient stale já presente no código.

## Manual, live e histórico

`page-legacy-manual.cjs` preserva integralmente o antigo harness de interações, com aviso histórico. Não é aceite atual; parte de seus seletores e contratos de navegação exige revisão.

`music-search-review.test.cjs` registra ranking MusicBrainz anterior; `voice-peer`, `voice-mesh`, `voice-ws` e `voice-audio` contêm fixtures históricas de transportes/constraints e não estão certificados como suite atual. O inventário marca explicitamente esses arquivos. Não adaptar produção aos mocks antigos. Revisá-los é um trabalho separado de testes de mídia.

Arquivos `*-live`, `*-diagnostic`, avaliações e `music-real-*` são diagnósticos manuais: podem consultar serviços e requerer `.env`. Não são unitários. Browser harnesses antigos/versionados e os demais smokes fora da lista default são validações adicionais, exigem revisão de fixture e requisitos antes de usar como aceite.

Full WebRTC, mesh 3/4 peers, TURN real, screen share, screen audio e stress permanecem manuais; não fazem parte de nenhum comando default. Antes de executar, revise a fixture e os requisitos em [voz](../dist/voice/README.md) e [TURN](../server/coturn/README.md).

Browser/devices, mídia/WebRTC e TURN reais podem exigir processos locais, permissões, devices, `.env` e rede real. A evolução dos harnesses está em [consolidação histórica](../docs/history/test-harness-consolidation-2026-10-07.md).

## Ambiente, visual e artifacts

`node tests/navigation/route-visibility-visual.cjs after` verifica uma superfície principal
por frame nas transições e em respostas tardias de Search/Discover. Usa um
browser/context local; grava `artifacts/route-visibility/after/frames.json`.
`before` registra a reprodução sem assertions de atomicidade. É manual.

`node tests/navigation/scroll-continuity-visual.cjs after` mede scrollY em frames consecutivos
nas categorias Collection, header, categoria vazia, retorno de ficha e reduced
motion. Um browser/context com fixtures locais; saída em
`artifacts/scroll-continuity/after/frames.json`. `before` registra a reprodução
sem exigir as assertions finais. Usa o runtime portátil abaixo; é manual.

`node tests/motion-design-visual.cjs` verifica o motion de apresentação com um
browser/context: direção de navegação, ficha sem reentrada no enriquecimento,
categorias Collection sem animação do root e com indicador compartilhado,
FLIP de avatars PARTY, dialogs e reduced-motion. Gera sequência de frames
0/80/200 ms e screenshots em `artifacts/motion-design/`. Usa fixtures locais,
sem providers ou captura, com o runtime portátil descrito abaixo. É manual.

`node tests/motion-stability-visual.cjs after` é o harness manual de estabilidade:
um browser/context, 390/820/1440 px, áudio local e YouTube simulado. Mede geometria
em frames consecutivos nas transições do SPACEAMP, decode de artwork, fallback
de banner, rail PARTY e reduced-motion. Não captura mídia nem consulta providers.
Gera `artifacts/motion-stability/after/frames.json` e uma screenshot final.
Os argumentos `before`/`audit` registram comparações sem exigir as assertions finais.
Não faz parte do default; usa o mesmo runtime portátil dos harnesses abaixo.

`node tests/front-cohesion-visual.cjs after` é a verificação visual leve de coesão:
um browser/context, fixtures locais, 390/820/1440 px, estados de busca, temas,
aparência, SPACEAMP, PARTY/chat e XMB. Gera sete screenshots em
`artifacts/front-polish/after/`. O layout de compartilhamento é apenas uma fixture
de DOM: não solicita microfone/tela nem negocia peers. Não faz parte do default.
O argumento `before` desativa apenas as assertions específicas do polimento para
comparação com a base, mantendo os checks de boot/layout.

O browser usa o Playwright portátil no perfil do usuário e Edge no caminho declarado em `premerge-visual.cjs`. Em outro ambiente, ajuste esse caminho local. A sandbox pode exigir autorização para iniciar o browser. Servidor e browser são encerrados em `finally`.

`artifacts/` contém somente saídas locais ignoradas. Testes default criam seus dados ou diretórios; não dependem de uma captura antiga. Links históricos de evidências são apresentados como caminhos locais, sem exigir esses arquivos em clones novos. Veja [arquitetura vigente](../docs/architecture.md) e [histórico](../docs/history/README.md).

`node tests/visual-state-continuity.cjs` valida PARTY pending/ready e falha/retry,
limites do XMB, retorno de categoria vazia e navegação rápida com decode atrasado. Usa um browser/context,
transporte local e fixtures, sem captura, peers ou providers reais. Gera
`artifacts/visual-state/report.json` e duas screenshots. `media/artwork.test.cjs`
verifica reserva, revision e cancelamento de decode sem navegador.

`node tests/navigation/navigation-camera-visual.cjs` verifica cabeçalhos, entry/return,
Back/Forward e teclado da Collection em um browser/context local. Usa posições
antigas salvas e fixtures, sem providers/captura, e gera
`artifacts/navigation-camera/after/report.json`.
`node tests/navigation/navigation-native-probe.cjs auto` (ou `manual`) isola chamadas do
app para comparar a restauração nativa. A política também é testada pelo smoke
Navigation, incluindo abertura de ficha no topo e reduced motion.

`node tests/collection/collection-title-return-visual.cjs` cobre a exceção de retorno da
ficha à Collection de origem: scroll anterior, foco em Capas/Lista e seleção
da Lista. Verifica Back, botão voltar e isolamento de entradas pelo cabeçalho
e pela Busca, em um browser/context com fixtures locais. Gera
`artifacts/collection-title-return/after/report.json`.

`node tests/spaceamp/spaceamp-presentation-browser.cjs full` certifica o shell e seus
contratos de apresentação conforme os cenários acima. Capturas/métricas são
temporárias e removidas no cleanup.

Now Playing verifica foco no opener real do XMB e nós/seleção/scroll preservados; clock e metadata podem mudar. O perfil lyrics não impõe `line-motion`. `spaceamp-lyrics-clock-browser.cjs` e `spaceamp-lyrics-motion-browser.cjs` certificam seek, interpolação, pause freeze, autoscroll upstream e ausência de drift. `project/organization.test.cjs` verifica ordem de carregamento e ausência de playback/storage no owner do perfil visual.

`node tests/music/artist-discography-browser.cjs` usa servidor/Catalog/client reais com respostas guest locais: CORE 3 → FULL 7, mesmos nós/cards, foco/scroll/filtro/ordenação e nenhum browse de release durante enrichment. Interações de intenção continuam com prefetch existente. Fixture em `tests/music/fixtures/youtube-music-artist-sections.json`; evidência em `artifacts/artist-sections/`. `youtube-music-catalog.test.cjs` cobre handles, params/continuations, dedupe por ID, Singles/EPs, cache/pending/force, limites, falhas e preservação do CORE, sem rede externa.

`node tests/music/artist-discography-window-browser.cjs` certifica apresentação progressiva com CORE 20/FULL 65: 18 cards desktop, 8 mobile, imagens somente para cards criados, expansão local sem requests, filtro sobre todos os dados, sort sem reset, foco/scroll, preview previamente expandido, partial/unknown e paginação legacy separada. Usa respostas HTTP locais e gera `artifacts/artist-window/after.json`; `--measure` apenas registra a apresentação atual. Tempos são diagnósticos, sem threshold instável.

Owners: UI de artista tem owner `dist/title-artist-view.js` (focados `artist-discography-window-browser.cjs` e `artist-discography-browser.cjs`); TitlePages só participa de CORE/FULL/rota. Profile extras têm owner `dist/profile-extras-view.js`: `node tests/profile/profile-extras-browser.cjs` cobre edição/reordenação de top 8, badges, blocos, vídeo local, visibilidade/ordem e reload. `boot-performance-browser.cjs` cobre Gallery oculta/dirty/reentrada, Collection e PARTY; sua instrumentação acompanha esses owners. `project/organization.test.cjs` certifica ordem e limites de ownership dos dois módulos.

`node tests/music/music-final-recommendations-browser.cjs` certifica recomendações da ficha (“ver outras recomendações”): rotação local/reserva, tipos, retenção, fonte esgotada e force. `node tests/music/music-recommendation-browser.cjs` certifica descoberta da Collection: equilíbrio de seis mídias, ordem partial/final, descarte/restauração, filtro e preservação das sugestões em falha. Ambos usam fixtures locais e rede externa do browser bloqueada; ficam fora do quick/smoke.

`node tests/boot-performance-browser.cjs after` mede cold routes perfil/colecao/buscar/spacevoice e `?party`, usando 100 livros/24 fotos locais, instrumentação de renders/factories e recursos. Certifica ausência de render oculto, render único da Collection, mutações dirty, criação/reuso de PARTY e browser reload 304. Relatórios em `artifacts/performance/`; timings/long tasks são diagnósticos sem thresholds. `before` apenas registra a implementação corrente. `project/organization.test.cjs` certifica ETag/HEAD, arquivo alterado e APIs sem cache condicional.

### Controller, lyrics e Quick Menu

`spaceamp-browser.cjs` certifica XMB/controller/menu com Gamepad API simulada e linhas determinísticas no Shadow DOM. `spaceamp-presentation-browser.cjs lyrics:vendor` também verifica seleção/ativação e flags no vendor oficial; `preferences:reload` cobre restauração/defaults. `xmb/xmb-input.test.cjs` e `spaceamp-now-playing.test.cjs` cobrem input e preferências; clock/motion têm os harnesses dedicados citados acima. Rede externa bloqueada; controle físico/TV permanece manual.

Controller certifica transport/ranges antes da borda, ausência de wrap, quick bar fora da malha principal (disponível para mouse/teclado), lyrics desligadas, Volume e fallback hidden/disabled/inert. Lyrics certifica seleção ativa, navegação sem seek, line-click, retorno player/XMB, troca de componente, loading, unsynced e auto-next fechado. Now Playing acessa as linhas do vendor pela borda de transport.

Quick Menu certifica Options/B, origem XMB/player/lyrics, linhas permitidas por origem, copy PT-BR, comandos/preferências reais e abertura sem restart. Inclui ocultação ao desativar Letras, retorno ao player, persistência/herança no novo componente, foco/scroll durante loading e timestamp/offset preservados após redraw nativo. Vídeo mantém top layer/singleton, fallback/retorno e atualização durante trackchange; cursor explícito e native focus permanecem distintos fora do XMB.

Rail Música/Sistema, fullscreen/saída pela ordem dos owners, Triangle/Square contextual e retorno player/lyrics após Volume/troca de componente são certificados. `xmb/xmb-input.test.cjs` cobre LB/RB e face buttons edge-trigger, preservando repeat direcional. O browser espera amostragem e release real por frame. O menu conserva foco enquanto o clock real avança sem eventos/interação e encerra timer no fechamento; normal/adjustment, LEFT de Volume/enums para rail, B encerrando ajuste, última linha e labels nativas lowercase de Romanização/Tradução são verificados.

Reverse handoff força URLs diferentes e decode pendente: clone legítimo no render de retorno, cleanup por seleção/categoria/detalhes/root/saída antes e após animação, navegação após settle, limite de decode, clone órfão e callbacks de revisão cancelada. Quick Menu → Now Playing cobre faixa atual (clone permitido), duas outras músicas e Artistas/Álbuns/Jogos com artworks distintas (sem clone), artwork/title reais do SPACEAMP sem restart, cleanup de prepare incompatível, retorno de seleção/scroll/foco e nowEntry sem origem visual indevida. Capturas do handoff são temporárias e removidas no cleanup.
