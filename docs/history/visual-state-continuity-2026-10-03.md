# Visual state continuity — 2026-10-03

Branch: `feature/front-polish`. Escopo de apresentação; sem alteração de providers,
persistência, protocolo de sala, WebRTC ou captura.

## PARTY

`dist/spacevoice.js` registra a intenção de entrada após resolver o roomId,
antes de aguardar metadata. A primeira apresentação usa a composição do lobby
com participante local e “preparando sala…”. A confirmação usa o status real do
transport, não apenas a existência de roomId. Falha mantém o lobby e expõe a
nova tentativa; sair limpa a intenção. Chat/presença continuam dependentes da
sala real. O botão de chamada fica indisponível durante preparação.

Avatars locais/remotos preservam o mesmo elemento. Iniciais ficam disponíveis
até o primeiro decode; uma imagem pronta permanece durante a substituição.

## Artwork

`dist/artwork.js` tem apenas `set`/`clear`: controla apresentação, decode e
revision por elemento. Não faz requests de catálogo, preload da coleção ou
cache de blobs. A primeira imagem usa o próprio elemento com `visibility`
para preservar geometria e lazy loading. Substituições carregam um candidato
separado e mantêm os pixels anteriores até o decode. `clear` invalida resultados
pendentes. Alt semântico permanece nas capas; imagens decorativas seguem vazias.

O helper é usado por `extras.imageNode` (Collection e seus resultados), capas de
TitlePages, cards persistentes de Discover, XMB e avatars PARTY. Placeholders
ficam restritos à ausência de imagem ou erro definitivo.

XMB faz early return quando o índice clampado continua na seleção atual.
Detalhe e backdrop reutilizam suas imagens entre seleções. O backdrop mantém
seus dois elementos anexados; respostas antigas não podem sobrescrever a última
seleção. Não foi necessário acrescentar fade. O modo artwork reserva o box de detalhe
antes do decode, usando scale-down para conservar a resolução intrínseca.

No follow-up, a categoria vazia ainda destruía esses elementos. Agora apenas
oculta o backdrop e mantém referências às três imagens prontas. Thumbnails
visitados são reutilizados num Map limitado a 64 nós; não há preload nem blobs.
O novo teste mede nove amostras de volta da categoria vazia: os mesmos nós e
pixels prontos aparecem desde a alteração síncrona, sem novo loading.

Banner e galerias secundárias de TitlePages foram auditados: conservam suas
reservas e fallbacks existentes. Não foi criado reconciler para Collection.

## Validação

- 31 testes focados: artwork, XMB, Collection, voice UI, room UI, presença e
  integrações SPACEAMP.
- Nove smokes de `tests/validate.ps1 -Group smoke`.
- `visual-state-continuity.cjs`: um browser/context, oito frames PARTY pending,
  composição relativa idêntica de avatar/stage/body pending→ready; falha/retry
  mantém avatar; primeira seleção + oito ArrowUp sem nenhuma mutação; última
  seleção + oito ArrowDown conserva detalhe/backdrop; B→C com decode atrasado
  conserva A até C e ignora B tardio.
- `route-visibility-visual.cjs`: 12 transições, zero superfícies misturadas.
- Motion design, motion stability e scroll continuity: aprovados. Motion stability
  mediu zero deslocamento de artwork e nenhum salto do rail; scroll continuity
  preservou a posição 900→900 e acomodou lista curta.
- Syntax/static e `git diff --check`: aprovados.

Evidências locais ignoradas: `artifacts/visual-state/report.json`,
`party-ready.png`, `xmb-final.png` e saídas dos harnesses de regressão.
Os retângulos são relativos ao shell para excluir o deslocamento intencional
já existente da animação de entrada da rota.

Somente fixtures locais e Edge headless. Sem providers reais, TURN, mesh,
compartilhamento, stress ou regressão WebRTC pesada.

## Follow-up: categoria diferente após categorias vazias

Preservar a última imagem também podia revelar pixels de outra categoria por
um frame. O XMB agora marca a interrupção de contexto: ao sair do vazio, só
revela imediatamente a mesma fonte já pronta. Para uma fonte diferente,
invalida os pixels antigos e reserva o box até o decode da imagem correta.
A retenção durante navegação contínua entre itens permanece.

O harness acrescenta Jogos → categoria vazia → Músicas, com decode bloqueado.
Capa e dois backdrops permanecem invisíveis durante a preparação; após liberar
o decode, todos mostram exclusivamente a fonte de Músicas. Retorno à mesma
categoria, limites e navegação rápida continuam aprovados. Também passaram
12 testes artwork/XMB, page smoke, syntax/static e diff check.
