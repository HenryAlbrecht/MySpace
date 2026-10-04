# Route visibility — 2026-10-03

Branch mantida: `feature/front-polish`. Correção estrutural pequena, sem router novo, redesign, opacity para mascarar visibilidade ou mudança de PARTY/providers.

## Causa confirmada

`extras.navigate()` alterava o hash e imediatamente chamava applyRoute(), mostrando PARTY antes de Search/Discover receberem hashchange para esconder suas superfícies. A instrumentação anterior registrou dez estados mistos: sete imediatamente após clique e três em rAF. Portanto a inconsistência também alcançava frames visíveis, não apenas estado interno.

## Alteração

- `dist/extras.js`: quando o hash muda, apenas atualiza location.hash. Todos os listeners sincronizam durante a mesma task hashchange antes do próximo paint. Se o hash permanece igual, mantém applyRoute explícito para reaplicar estado.
- `dist/title-pages.js`: go() segue a mesma regra para abrir/voltar de fichas. Hash alterado não chama CollectionActions.applyRoute()/route() antecipadamente. Reaplicação da mesma rota mantém o fluxo explícito e restauração existente.

Os owners de visibilidade existentes e seus listeners permanecem. A ordem atual coloca o motion depois de extras, TitlePages e DiscoveryPage; ele anima a superfície já sincronizada. Não foi necessário alterar motion, protocolos PARTY, providers ou os tokens de proteção de respostas tardias.

## Validação

`tests/route-visibility-visual.cjs` usa um browser/context local, mede hidden/display/caixas de todas as sete superfícies, hash e body.dataset.page no clique e em rAF consecutivos por 320 ms. SPACEAMP é persistente e não conta como superfície.

Cobertura: Discover → PARTY; Search → PARTY; PARTY → Discover/Search; Collection/Profile/Title → PARTY; PARTY → Collection; abrir ficha pelo caminho TitlePages.open; respostas tardias de Search/Discover com itens de fixture. Nas respostas tardias verifica superfície, foco, scroll e ausência de animação da página antiga, incluindo descendentes.

Depois: zero estados com mais de uma superfície; uma superfície em todos os samples. A antiga pode permanecer até a task hashchange, sem coexistir com a nova.

Checks adicionais:

- Motion design visual: passando.
- Motion stability: 63 sequências, shifts=[], artworkShift=0, railShift=false.
- Scroll continuity: categorias longas 900 → 900 sem scrollTo; categoria curta ajusta suavemente; retorno da ficha preservado.
- Nove smokes, syntax/static e diff check: passando.

Evidências locais ignoradas: `artifacts/route-visibility/before/frames.json` e `after/frames.json`. Cada execução usa um browser/context e encerra apenas os próprios recursos. Sem providers reais, capture, screen share, WebRTC pesado, mesh ou TURN. Sem commit/push/merge.
