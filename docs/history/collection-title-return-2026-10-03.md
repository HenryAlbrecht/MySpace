# Retorno da ficha à Collection

Correção específica em `feature/front-polish`: abrir uma ficha pela Collection
guarda temporariamente a categoria, posição vertical e ID do item. Ao retornar
àquela rota, a Collection prepara a seleção, restaura o scroll e devolve foco
com `preventScroll: true`. O contexto é consumido nessa saída da ficha.

Capas recebem foco no `.shelf-cover`; Lista mantém `selectedListItemId` e recebe
foco na `.list-entry`. O hover estacionário não substitui a seleção restaurada.
O fullscreen XMB não é reaberto.

Nova entrada pelo cabeçalho continua no topo, assim como a abertura da ficha.
Trocas internas de categoria mantêm a política existente. Fichas abertas pela
Busca não recebem esse contexto da Collection.

O harness `tests/collection-title-return-visual.cjs` valida retorno em Y≈900,
scroll/foco/seleção, Back, botão voltar, entrada após PARTY e isolamento da Busca.
As regressões de câmera, continuidade de scroll, visibilidade de rota,
estabilidade de motion e continuidade visual usam browsers sequenciais e
fixtures locais. Não há consulta a providers ou regressão WebRTC pesada.
