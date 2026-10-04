# Motion stability / layout shift pass — 2026-10-03

Executado em `feature/front-polish`, limitado à apresentação do frontend. Não altera providers, persistência, Player Core, protocolos PARTY ou WebRTC.

## SPACEAMP: causas e resultado

Havia duas causas independentes na saída do Profile:

- A transição de `width` do dock interpolava a largura herdada do Profile. Os controles se reorganizavam nos frames visíveis; no YouTube mobile, também mudava a altura. Removida somente essa transição de layout.
- O `transform` da animação em `.amp-mini` criava temporariamente um containing block para a capa absoluta. Ao terminar, a capa passava a usar o dock como referência e saltava para a direita. A animação foi movida para `.amp-mini-info`, preservando a entrada sem mudar a referência da capa.

As classes de navegação já são aplicadas sincronamente. Não foi necessário mudar o fluxo JS, esconder o player com timeout ou adicionar FLIP. O primeiro frame após o handler de navegação usa a geometria final; a apresentação mantém opacity/translate.

Antes, 27 transições medidas apresentavam interpolação de largura. Depois, as 63 sequências de estados verificadas não apresentaram variação estrutural acima da tolerância de 1 px, incluindo o anchor horizontal da capa. Isso é evidência dos casos medidos, não uma certificação universal de CLS.

## Outros ajustes

- `dist/interface.css`: capas de título, featured e preview mantêm a caixa e proporção autoradas antes/depois do decode. Removidas regras `:has(img)` que voltavam a altura natural. Na fixture, a chegada da imagem aumentava o card em 112 px; agora a diferença é zero.
- `dist/collection-view.js` e `dist/interface.css`: o detalhe da lista informa tipo/layout e reserva uma caixa vertical, horizontal ou quadrada antes da imagem. Placeholder e imagem compartilham geometria.
- `dist/spacevoice.css`: removidas transições de colunas/min-height do rail e width/height do avatar. O rail abre nas colunas finais; os movimentos de apresentação dos conteúdos permanecem.
- `dist/title-pages.js` e `dist/title-pages.css`: erro de banner mantém o espaço com fallback. Banner de jogo retrato usa contain em vez de remover o hero após carregar. A fixture de falha mantém 300 px e o hero visível.
- `dist/spaceamp.css`: correções de largura e containing block descritas acima; reduced-motion acompanha o novo alvo da animação.

## Auditoria e movimentos mantidos

Seleção da lista, expansão de disclosures e indicador decorativo do XMB são movimentos deliberados e foram mantidos. Não houve redesign.

Search/Discover reutilizam cards por identidade e não reiniciam a entrada na atualização da imagem. Recomendações também preservam os cards existentes. Galeria já reserva altura e usa contain. Diálogos/Aparência são decorados sincronamente antes do paint; seus previews recebem a reserva de caixa. Avatar do Profile já tem dimensões definidas. Nenhuma dessas áreas exigiu reescrever seus fluxos.

## Validação

`node tests/motion-stability-visual.cjs after` usa um browser/context e fixtures locais em 390/820/1440 px. Mede bounding boxes em requestAnimationFrame consecutivos por toda a duração da entrada, após o handler de hashchange, em Profile/Collection/Search/Discover. Cobre local, YouTube vídeo e YouTube capa, decode tardio, banner inválido, rail PARTY e reduced-motion.

Resultado: 63 sequências, zero shifts estruturais detectados; artworkShift=0; railShift=false; banner preservado. Evidências locais ignoradas: `artifacts/motion-stability/after/frames.json` e `compact-final.png`. Os modos `before`/`audit` registram a comparação sem exigir as assertions finais.

Outros checks concluídos:

- Collection, voice UI, PARTY room UI e SPACEAMP integrations: 17 testes passando.
- Grupo smoke: nove smokes passando.
- Grupo syntax e auditoria estática: passando.
- `git diff --check`: passando.

YouTube é uma fixture de apresentação, sem certificar buffering/autoplay ou serviço real. Não houve captura, peers, chamadas a providers ou regressão WebRTC pesada. O harness encerra apenas seu próprio servidor/browser em finally. Nenhum commit, push ou merge foi executado.
