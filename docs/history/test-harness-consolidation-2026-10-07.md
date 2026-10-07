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
