# Scroll continuity — 2026-10-03

Branch `feature/front-polish`. Correção de navegação/viewport, sem redesign, providers, Player Core, modelo Collection ou networking PARTY.

## Reprodução e causa

Antes da alteração, browser local com 40 itens por categoria reproduziu Filmes → Séries: Y=900 → 0. A posição era indexada pelo hash completo; hashchange restaurava zero para a categoria sem histórico. Categoria vazia também encolhia o documento e sofria clamp no primeiro frame (Y=1600 → 79, seguido da restauração indevida para zero).

## Correção

- `dist/navigation.js`: Collection e suas categorias/alias usam a mesma chave de leitura `#colecao`. Registros anteriores dessa família são normalizados ao carregar o histórico da sessão. Mudança interna não agenda frame de restauração nem chama scrollTo. Outras superfícies/fichas continuam com posições independentes.
- Restauração explícita seguida de hashchange não cancela o retorno pendente de uma ficha para Collection. Callbacks obsoletos continuam protegidos por revisão e chave da superfície.
- `dist/collection-view.js`: renderizações internas passam por preserveViewport, incluindo categorias e controles que chamam o mesmo render. Reserva temporária de min-height no corpo da Collection protege a altura anterior enquanto o conteúdo é substituído. Scroll anchoring é suspenso apenas durante essa reserva.
- Conteúdo natural é medido pelos filhos enquanto a caixa externa permanece reservada. Se a posição atual ainda existe, a reserva é removida imediatamente, sem scroll. Se não existe, scroll suave nativo leva ao limite válido antes da remoção. Finalização depende da posição medida em rAF, sem timeout. Reduced motion usa ajuste imediato.
- Reserva também é liberada na saída da superfície, erro, gesto de intervenção ou resize. Estilos anteriores são restaurados; não há espaço vazio permanente.

Não foi feita apenas a troca de instant por smooth: a restauração incorreta foi removida das mudanças internas. Scroll suave só ocorre quando a altura final torna a posição impossível. Uma categoria muito menor exige deslocamento maior; a correção evita o snap, sem fingir que a posição continua disponível.

Motion de indicador e conteúdo da Collection permanece o mesmo do refinement. Header/tabs não ganham movimento de câmera adicional quando a posição é válida.

## Validação

`tests/scroll-continuity-visual.cjs` usa um browser/context com fixtures locais e bloqueia HTTPS externo. Mede rAF por 900 ms após cada ação (janela de observação do teste, não timeout de produção).

Resultados:

- Filmes → Séries: 900 → 900; zero chamadas scrollTo.
- Séries → Jogos: 900 → 900; zero chamadas scrollTo.
- Clicar Collection no header: 900 → 900; zero chamadas scrollTo.
- Categoria vazia: primeiro frame Y=1600; acomodação suave até Y=79; min-height removido.
- Collection → Title: Y=0 na ficha; voltar: Y=900.
- Reduced motion: categoria curta sem smooth, reserva removida.
- Navigation smoke: família/alias, retorno pendente e proteção de restauração obsoleta.
- Collection/XMB: 15 testes passando.
- Nove smokes; syntax/static; diff check: passando.
- Motion stability: 63 sequências, shifts=[], artworkShift=0, railShift=false, banner preservado.
- Motion design visual: passando.

Evidências locais ignoradas: `artifacts/scroll-continuity/before/frames.json` e `after/frames.json`. Não são dependências de clones novos. Sem providers reais, captura, WebRTC pesado, TURN, mesh ou stress. Cada harness encerra apenas seus próprios recursos. Sem commit/push/merge.
