# Recomendações locais rotativas — 2026-10-05

Branch `mudanca_search`; working tree como referência. Sem commit automático.

## Causa e limites

O botão anterior sempre fazia `force`, consultando novamente fontes determinísticas, e vários caminhos descartavam os candidatos além dos primeiros 12. Por isso o refresh podia mudar só 0–1 item. O frontend ainda proibia recomendações salvas; ao salvar, o card era removido imediatamente.

Agora somente TitlePages musicais solicitam `localPool: true`. A API encaminha essa opção, e caches/promessas diferenciam pool local da chamada padrão. O global permanece com seus pools padrão, filtro de salvos e blender próprios.

| Tipo | Limite anterior do resultado contextual | Limite local novo | Janela visível |
| --- | --- | --- | --- |
| Music | 12 do ranking do rádio | até 24 | até 12 |
| Artist | 12 de relatedArtists | até 24 | até 12 |
| Album | 12 do ranking de releases | até 24 Albums | até 12 |
| EP | 12 do ranking de releases | até 24 EPs | até 12 |
| Single | 12 do ranking de releases | até 24 Singles | até 12 |

O tamanho real depende da fonte. Não foram ampliados limites de radio, releaseDetails, relatedArtistDetails, buscas Last.fm, concorrência ou os critérios que acionam os fallbacks de releases. O ranking padrão continua com 12; apenas o resultado local pede 24 dos candidatos já obtidos. O backend mantém classificação, cross-artist priority, dedupe e no máximo dois same-artist. Não há lookup de artista por candidato nem N+1 novo.

## Janela visível e rede

O estado da seção contém pool, visible, seen e rotation, sem persistência ou serviço novo. O pool inicial aceita até 24 candidatos classificados. Um merge após force preserva candidatos anteriores úteis, deduplica IDs, mantém classe/subtipo e limita same-artist; o acumulado é limitado a 48 para não crescer indefinidamente. O pool antigo não é apagado se uma resposta vier pequena, parcial ou falhar.

A primeira janela prioriza candidatos novos e reserva até duas posições para conhecidos quando disponíveis. Em cada rotação, mantém até quatro âncoras ainda úteis, prefere candidatos ainda não vistos na ordem de ranking e completa com alternativas fora da janela anterior, usando cursor determinístico quando necessário. Não há Math.random ou shuffle. A seleção continua priorizando novidade, com quota suave de salvos: até dois quando há novos suficientes; caso faltem novos, admite salvos para preencher a janela, inclusive pools inteiramente salvos.

O botão é `ver outras recomendações`. Antes de consultar a rede, calcula a próxima janela considerando a quota. Se ela consegue trazer pelo menos seis candidatos ainda não vistos, usa a reserva local: zero requests de recomendações. Quando a reserva não permite essa troca significativa, faz no máximo uma chamada `Catalog.recommendations(..., {force:true, localPool:true})` naquele clique e mergeia o resultado. A primeira carga faz uma chamada normal. `force` é uma chamada à API; caches existentes das fontes continuam aplicáveis, sobretudo no detail de artista. Não há promessa de variedade que a fonte não fornece.

## Itens salvos e memória

O estado salvo é consultado na Collection durante seleção/apresentação; não existe `entry.isSaved` no catálogo. O indicador discreto é `✓ na coleção`. Na música ele fica dentro do título da row, preservando os slots atuais de contexto, duração e playlist; releases mostram subtipo/ano e indicador; artistas mostram nome e indicador.

QuickAdd não recalcula a janela nem remove o card. O patch altera somente o indicador, mantendo node identity, imagem, foco e scroll. A próxima rotação pode substituir esse candidato pela prioridade de novidade. A quota se aplica à seleção da janela; salvar várias recomendações já visíveis pode temporariamente ultrapassar dois indicadores, para evitar sumiço imediato.

`discoveryOrigin` não mudou. `descobertos por aqui` continua filtrando origem local e ordenando por updated. Apenas o preview omite IDs atualmente visíveis nas recomendações; a expansão permite consultar todos os matches. Quando a janela muda, o preview é atualizado e itens que saíram podem reaparecer na memória. Uma memória pequena com todos os itens já visíveis fica oculta enquanto não houver preview útil.

## Verificação e resultados

- 66 testes de seleção, ranking, subtype, rádio, cache, global blender, duração, Collection, CORE/ENRICHMENT e navegação passaram.
- Casos de 15 novos + 5 salvos: primeira janela de 12 com dois salvos; seleção determinística; pelo menos seis candidatos ainda não vistos na segunda janela. Pools de dois salvos continuam mostrando os dois.
- Backend: chamadas locais obtêm até 24 sem ampliar consultas; chamadas padrão continuam limitadas a 12. Releases suficientes não acionam detalhes adicionais.
- Edge headless isolado, nos cinco tipos com pool de 24: primeiro/segundo lotes de 12; overlap de 4/12 (33,3%) em cada caso, média de quatro; oito candidatos ainda não vistos por rotação; zero requests adicionais usando reserva.
- Pool de 13: um request com force; candidatos anteriores não presentes na resposta pequena e os novos continuam elegíveis no merge.
- Pool de quatro EPs: mostra quatro, inclusive após force, sem introduzir Album ou Single.
- QuickAdd: row e artwork preservados, foco e scroll iguais, badge atualizado, ordem intacta.
- Preview da memória omite os salvos visíveis e volta a mostrar conhecidos após a rotação.
- Regressão no navegador de origem local/global, busca manual, URL direta, primeira origem, favoritos, expansão/remoção e durações passou. O teste anterior foi atualizado para a nova regra de salvos elegíveis, sem alterar suas verificações de provenance.
- Desktop e mobile sem overflow horizontal; nenhum pageerror nos testes de navegador. Os screenshots usam fixtures isoladas e arte sintética, não respostas musicais ao vivo.

Screenshots de antes/depois e mobile de **Music, Artist, Album, EP e Single** em `artifacts/local-rotation/`, com nomes `Music-before.png`, `Music-after.png`, `Music-mobile.png` etc. Contagens de requests e overlap estão em `report.json`.

Arquivos alterados: `server.cjs`, `server/music-catalog.cjs`, `server/music-recommendation-ranking.cjs`, `dist/catalog-discovery.js`, `dist/music-page-ui.js`, `dist/title-pages.js`, `dist/interface.css`; testes novos `tests/music-local-rotation.test.cjs` e `tests/music-local-rotation-browser.cjs`; ajuste de expectativa em `tests/music-duration-memory-browser.cjs`. A página global, player, playlist, metadata/artwork extraction, discoveryOrigin, CORE/ENRICHMENT e Navigation/Back não foram redesenhados.
