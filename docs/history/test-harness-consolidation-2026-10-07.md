# Consolidação dos harnesses — 2026-10-07

Registro histórico das consolidações e observações de migração. Comandos e contratos operacionais vigentes estão em [tests/README.md](../../tests/README.md); a classificação está no [inventário](../../tests/INVENTORY.md). Timings abaixo são medições locais da rodada, não requisitos de aceite.

## SPACEAMP/XMB — Pass 1

Mapa dos blocos do antigo `xmb-handoff-browser.cjs`:

| Bloco anterior | Cenário atual |
|---|---|
| Entrada por teclado/gamepad, fullscreen indisponível, details, clone/singleton | `handoff:entry` |
| Transport/ranges, shortcuts, edge-trigger, fallback hidden/disabled/inert | `controller:topology` |
| Clock/timer, artwork/decode/stale, rail, comandos e preferences | `quick-menu:commands` |
| Vídeo: readiness, promoção, top layer, singleton, geometry e reduced motion | `video:presentation` |
| Vídeo A → B → C, stale readiness, pending/ready/failed, lyrics/foco/menu | `video:track-change` |
| Lyrics: cursor/seek, opções/anchor, replacement, loading/unsynced, retorno | `lyrics:navigation` |
| Menu no XMB: origem, contexto, dimensões, reduced motion, entrada sem restart | `quick-menu:xmb-origin` |
| Identidade da artwork por categoria/item, frames de mesma capa | `handoff:entry-artwork` |
| Confirm mantido, nowEntry sem clone e controle direcional | `controller:gamepad-entry` |
| Nova capa com decode deliberadamente atrasado | `handoff:decode` |
| Reverse: revision, invalidation, decode limite, callbacks stale, clone órfão | `handoff:reverse` |
| Gamepad: deadzone, eixos, repeat e hints | `controller:axes-repeat` |
| Outras mídias/details, viewports, geometry estável, seleção após insert | `presentation:responsive` |
| Fullscreen/exit através dos owners, ordem de fechamento | `quick-menu:system` |
| Reveal cancelado, retorno single selection e preferences após reload | `presentation:return-preferences` |

As 290 assertions antigas foram distribuídas entre os cenários e os checks
comuns de CSS, page errors e cleanup de timer; nenhum contrato foi removido.
Waits de readiness/geometry/clone e carregamento das opções nativas preferem
condições observáveis. Sleeps mantidos documentam observação negativa, botão
mantido/repeat, checkpoint antes do decode atrasado, estabilidade entre frames
ou settle de scroll/foco sem evento público.

Medição do Pass 1 (Windows/Edge local, aproximada): baseline antigo PASS em
52,9 s; `video:track-change` PASS em 3,0 s; grupo `video` em 6,2 s;
`quick-menu` em 9,8 s; `handoff` em 28,4 s; `full` em 61,8 s.
O full paga cerca de 9 s adicionais pelo isolamento em contextos novos, mas
preserva um único boot de server/Edge. Uma regressão localizada de track change
não precisa mais executar os outros domínios. Pass 2 pode modularizar os dois
harnesses de shell/adapter e avaliar compartilhamento seguro de contexto;
este pass não muda seus comandos, fixtures ou cobertura.

## Music Playback — Pass 2

Linhagem e fontes de cobertura (a sequência ancestral não é contrato):

| Harness absorvido | Estado antigo / fonte de cobertura | Cenários canônicos |
|---|---|---|
| `music-v16-browser.cjs` | Ancestral stale: usa compacto no perfil. Integralmente superseded pelos descendentes e pelos cenários novos; só alias | `playback`, `routes`, `source:manual` |
| `music-routes-browser.cjs` | Primeiro descendente alinhado a full no perfil/compacto fora; baseline passou esse trecho e falhou depois ao criar novo Last.fm | `routes:continuity`, `playback` |
| `music-compact-visibility-browser.cjs` | Descendente de routes com close/reopen; superseded pela cobertura mais recente de auto-source | `compact` |
| `music-preferences-browser.cjs` | Descendente com visibilidade/launcher e preview; superseded pela cobertura mais recente de auto-source | `preferences:visibility`, `preview:queue` |
| `music-auto-source-browser.cjs` | Fonte mais recente alinhada para routes/compact/preferences/preview/source; criação nova Deezer/Last.fm no setup era stale | `playback`, `routes`, `compact`, `preferences`, `preview`, `source` |
| `music-polish-browser.cjs` | Ramo ancestral stale no perfil/minimize; deltas de continuidade retidos, superseded por views | `routes`, `compact` |
| `music-views-browser.cjs` | Fonte mais recente dos deltas de controles full/sincronização; sequência compact no perfil/minimize era stale | `controls:profile`, `compact`, `routes` |

O baseline funcional de full/compact foi o trecho local/rotas/geometria de
`music-routes`, não o FAIL ancestral do v16. Nenhum harness antigo completo
forneceu baseline verde: routes/compact/preferences/auto-source falharam mais
tarde tentando criar `lastfm:old`. A fixture canônica importa esse registro
antes de testar edição/vínculo, conforme a compatibilidade vigente. Auto source
importa o registro Deezer pré-existente e chama o owner de resolução; não cria
um novo catálogo legacy. Minimize/expand no perfil foi substituído pelo contrato
vigente de navegação entre full e compacto, sem mudança de produção.

Medições locais aproximadas (2026-10-07):

| Execução antiga | Resultado / tempo |
|---|---|
| v16 | FAIL stale compact no perfil, 33,0 s (não é baseline funcional) |
| routes | Trecho full/compact vigente passou; FAIL stale criação Last.fm, 3,7 s |
| compact-visibility | FAIL stale criação Last.fm, 3,9 s |
| preferences | FAIL stale criação Last.fm, 4,5 s |
| auto-source | FAIL stale criação Last.fm, 4,5 s |
| polish | FAIL stale compact no perfil, 32,3 s |
| views | FAIL stale compact no perfil, 32,1 s |

Novo: `source:auto` PASS em 1,6 s; `routes` PASS em 4,4 s; `full` PASS,
12 cenários, 18,0 s. Grupos playback/compact/preferences/preview/source/controls
passaram. Os sete baselines antigos exigiram sete boots server/Edge; o full
canônico exige um. Os tempos de FAIL históricos não são comparação com uma
suíte funcional verde. Aliases e rejeição de argumento inválido foram verificados;
`node --check` passou nos 18 executáveis/fixtures tocados.

Não houve fusão com a suíte SPACEAMP/XMB nem alterações em produção.
`music-ux-browser.cjs`, search-pagination, pages-evolution, recommendations e
PARTY/voice permanecem independentes e fora deste pass. Eventual Pass 3 pode
auditar esses domínios; eles não integram este `full`.

## Outras observações de migração e UI

Closure: `node tests/music-final-recommendations-browser.cjs` certifica recomendações atuais da ficha (“ver outras recomendações”): rotação local/reserva, tipos, retenção, fonte esgotada e force. `node tests/music-recommendation-browser.cjs` foi atualizado para manter somente seu contrato distinto de descoberta da Collection: equilíbrio de seis mídias, ordem partial/final, descarte/restauração, filtro e preservação das sugestões em falha. O refresh/reorder antigo da ficha foi removido; trocar o label não preservaria esse contrato obsoleto. Ambos são focados locais, com rede externa do browser bloqueada; não são live/diagnostic nem entram automaticamente no quick/smoke.

Console UX pass 2: o mesmo handoff verifica rail Música/Sistema, fullscreen/saída com ordem de owners, Triangle/Square contextual, retorno player/lyrics após Volume e troca de componente, opções nativas e dialog continuamente aberto durante trackchange. O sampler certifica face buttons edge-trigger; o componente oficial e clock/motion preservam o aceite anterior. Controle físico/TV continua sendo verificação manual.

Follow-up Quick Menu: o handoff cobre avanço do clock real sem eventos/interação, foco conservado e timer encerrado ao fechar; normal vs adjustment, LEFT de Volume/enums para rail, B encerrando ajuste, retorno à última row e labels nativas lowercase para Romanização/Tradução. Sem harness adicional.

## Baselines de organização

V2.2 e V2.3 já estão registrados no [baseline V2.2](organization-pass-2026-10-06.md#acceptance-baseline-v22) e na [extração V2.3](organization-pass-2026-10-06.md#organization-pass-v23), incluindo atualização das fixtures, tolerância do clock no shell, extração do perfil visual de lyrics e resultados antes/depois.


## Pass 3 — finalização dos hot paths

Extraído somente o mega-harness Now Playing para
`spaceamp-presentation-browser.cjs`: 14 cenários, nove grupos (shell, lyrics,
visualizer, palette, atmosphere, timeline, responsive, failure, preferences).
Runtime/fixture/cenários ficam em diretório próprio. Server/Edge compartilhados;
context/page novos por cenário. O full agora verifica os contratos com isolamento,
sem depender da sequência anterior. O runner XMB/controller/Quick Menu/handoff
permaneceu independente.

Responsabilidades migradas: open/close/foco/scroll/idle e retorno XMB; vendor
oficial/TTML, seleção e controller, clock/seek e UI hidden; visualizer/analyser;
artwork/palette/navegação/auto-next; decode/CORS/WebGL, amostras temporais e
lifecycle; loading/buffering/transport intent; fallbacks; reload/defaults;
responsive/reduced-motion. Nenhuma produção foi alterada.

Readiness sleeps passaram a observar scroll, idle, palette/cover ready,
transition, draw, loading e animações finitas. Mantidas janelas negativas de
idle/GPU/off/reduced-motion, checkpoint dentro do blend 1400ms e amostras GPU
0/2/5/10s, pause/resume de 3s: tempo é parte do contrato, sem threshold de
performance. Capturas/métricas passaram ao diretório temporário exclusivo,
removido com verificação do alvo. Cleanup normal e falha injetada certificaram
context, draw loop, browser, servidor e diretório; inválido não executa boot.

Fixtures independentes precisaram iniciar cada novo componente oficial com TTML
antes de connect e fechar o shell antes do trecho de analyser local.
`xmb.test.cjs` tinha um mock sem addEventListener, incompatível com o listener
focusin vigente; somente esse mock foi corrigido (nove testes passaram).

| Auditoria mantida independente | Contrato/razão |
|---|---|
| video | Adapter/iframe/contentWindow, clock, volume, auto-next e WAV; fixture distinta |
| regressions | Snapshots do adapter e entrega restrita de artwork; diagnóstico próprio |
| lyrics-clock / lyrics-motion | TTML/provider clock, seek/interpolação/freeze e movimento upstream |
| timeline | Seek sincronizado perfil/compact com WAV e adapter simulado |
| music-ux | UX musical, stats/filter/sort/descoberta e inline playback/cache/mobile |
| music-search-pagination | Continuation, dedupe/stale/foco/limites |
| music-pages-evolution | Relações e apresentação de páginas musicais |
| music-final-recommendations | Rotação/reserva, tipos, retenção e fonte esgotada |
| artist-discography-window | Janela progressiva CORE/FULL, filtros/sort/foco/expansão |
| boot-performance | Contratos de boot/Gallery/Collection/PARTY com medidas determinísticas |

Os seis últimos já possuem comandos focused úteis; tamanho não justificou
extração. Unitário youtube-music-catalog permaneceu intacto: Node 24 executou o
teste real `search continuation uses one official request, independent bounded
cache/pending and rejects invalid tokens` via --test-name-pattern, sem rodar os
demais. Manual/live/diagnostic/music-real/voice pesado ficaram fora do escopo.

Now Playing virou alias fino. Os oito aliases dos passes anteriores foram
mantidos, com referências vigentes e encaminhamento default/focused verificado.
Nenhum alias removido. A seleção global quick, default, smoke, party e legacy
foi preservada; novos quick-music (20), quick-spaceamp (5), quick-party-ui (9)
são subconjuntos disjuntos do quick. Collection/health/organization continuam
somente no global. AGENTS recebeu apenas regra de quick por domínio e fallback.

Medições aproximadas locais, sem thresholds:

| Execução | PASS / tempo |
|---|---|
| Now Playing antigo, baseline único | 79,8 s |
| lyrics:vendor via alias focused | 4,9 s |
| lyrics / palette / timeline | 6,1 / 7,6 / 3,5 s |
| shell / atmosphere | 27,7 / 29,8 s |
| visualizer / responsive / failure / preferences | 2,8 / 5,4 / 4,4 / 3,3 s |
| presentation full | 14 cenários, 86,9 s |
| quick-music / quick-spaceamp / quick-party-ui | 9,2 / 2,5 / 3,1 s |
| quick global funcional no fechamento | 14,1 s |

Full não foi otimizado à custa do isolamento: 14 contexts aumentam custo total,
mas seleção focused evita contratos alheios e full usa um boot server/Edge.
Todos os grupos, principal focused, full, aliases, inválido e cleanup passaram.
Node --check passou nos 19 executáveis/fixtures tocados. Browser precisou permissão
fora da sandbox; tentativa global bloqueada por EACCES loopback foi abortada.
Organization focused e a execução global funcional passaram com permissão local.
Não foi rodado smoke global, mídia/TURN reais ou diagnostics.

Os harnesses restantes são coesos, históricos ou baratos: não há justificativa
para um Pass 4 apenas por organização. Custo futuro deve ter evidência concreta.

Fechamento: syntax PASS em 66,9 s (incluindo auditoria estática); diff --check limpo.
