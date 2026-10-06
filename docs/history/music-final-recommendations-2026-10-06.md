# Polish final das recomendações musicais — 2026-10-06

Branch mudanca_search, working tree atual, HEAD inicial e5a70b3. Sem commit. Arquitetura aprovada preservada: pool local/janela, ranking cross-artist, quota suave, saved badge, quickAdd estável, rádio, CORE/ENRICHMENT, gêneros da coleção, player/playlist e navegação. Nenhuma alteração no blender, Catalog.forCollection, rotação global, filters/reasons/dismissed ou CSS.

## Gêneros

collectionGenreMatches agora exclui a obra atual com MusicModel.sameWork, mantendo os demais filtros, normalização, ranking, preview 3, expansão e patches. Teste com Creep/Radiohead em IDs YouTube Music e iTunes confirmou que a mesma obra não recomenda a si própria.

## Releases

Antes, enough() ranqueava com o limite implícito 12 e encerrava com dez cross-artist, mesmo quando localPool pedia 24. Agora ranqueia com o limit real e exige:

- Normal: min(limit,10) no total e cross-artist.
- Local: min(limit,20) no total e min(limit,18) cross-artist.

É objetivo, não obrigação. Retorna menos quando não há candidatos comprovados dentro dos budgets. Na fixture comum aos três subtipos: related 7 + radio 5 + dois artistas relacionados com 4 releases cada. Normal termina em 12 sem buscar artistas. Local continua pelos fallbacks existentes e termina em 20.

| Fixture | Pool | Rádio | Artista atual | Artistas relacionados | Detalhes de releases | Last.fm | Buscas de artistas |
|---|---:|---:|---:|---:|---:|---:|---:|
| Normal, cada subtipo | 12 | 1 | 0 | 0 | 0 | 0 | 0 |
| Local Album | 20 | 1 | 1 | 2 | 0 | 0 | 0 |
| Local EP | 20 | 1 | 1 | 2 | 0 | 0 | 0 |
| Local Single | 20 | 1 | 1 | 2 | 0 | 0 | 0 |

A chamada inicial do álbum seed não está incluída na coluna de candidatos. Na fixture adversa já existente, os limites observados permanecem releaseDetails 4, relatedArtistDetails 3, currentArtistDetails 1. Concurrency máxima 2. Não aumentados budgets de rádio, Last.fm ou artist search de releases. Artista da seed continua limitado a dois.

## Subtipo

Para seed de subtipo conhecido, rankCandidates e o merge do frontend exigem igualdade exata. Unknown não passa. Hidratação direcionada usa a mesma reserva global de quatro releaseDetails: explicit related primeiro, depois radio, related artist e similar artist. Consultas em lotes de até dois; IDs tentados não são consultados novamente na mesma execução. O resultado canônico preserva a posição e recommendationSignal do candidato original. Sem inferência pelo título ou número de faixas. Seed com subtipo conhecido no cache o mantém quando detail é esparso.

Fixtures: Single/unknown→Album rejeitado; EP/unknown→EP aceito na primeira posição; Album/unknown→Single rejeitado; Album/unknown→Album aceito na primeira posição. Duas aceitações e duas rejeições, uma hidratação por cenário. Fixture com vinte unknowns gastou somente quatro detalhes e retornou zero, sem subtype comprovado. Frontend também rejeitou payload contendo unknown e Album em página Single.

## Artistas

Normal continua somente relatedArtists YT, até 12. Local faz dedupe e retorna imediatamente com pelo menos 18 artistas conhecidos. Se escasso, uma chamada Last.fm fornece similaridade; até seis nomes são resolvidos pelo resolver existente, com concorrência dois, aceitando apenas um match exato com ID YT válido. source final permanece YouTube Music. Last.fm nunca cria identidade paralela.

| Fixture | YT inicial | Last.fm calls | Resoluções/buscas | Pool final | Detail YT do artista |
|---|---:|---:|---:|---:|---:|
| Reserva suficiente | 18 | 0 | 0 | 18 | 1 |
| Escasso, resolvível | 8 | 1 | 6 | 14 | 1 |
| Escasso, sem match | 7 | 1 | 6 | 7 | 1 |

O caso de oito não chega a 16 porque respeita o teto de seis resoluções. Qualidade e budget prevalecem sobre quantidade. Homônimos ambíguos são rejeitados; falha de provider fica parcial/retryable.

reserveAvailable informa alternativas além dos 12 ou tentativa pendente por falha. sourceExhausted informa que nenhuma fonte permitida resta. O frontend repassa essa metadata sem alterar global Discover. Quando Artist tem alternativas locais mas sourceExhausted, rotaciona sem repetir o detail determinístico. Se pool inteiro está visível, resposta completa e nenhuma reserva indicada, o action some. Se a API indica fonte restante, o primeiro action permanece disponível e busca mais. Falhas não são tratadas como esgotamento.

## Rotações e requests no navegador

Dados de fixtures isoladas, não aferição de catálogo ao vivo. Primeira rotação:

| Tipo | Pool | Visíveis | Mantidos | Não vistos | Requests adicionais |
|---|---:|---:|---:|---:|---:|
| Music | 24 | 12 | 4 | 8 | 0 |
| Artist | 24 | 12 | 4 | 8 | 0 |
| Album | 20 | 12 | 4 | 8 | 0 |
| EP | 20 | 12 | 4 | 8 | 0 |
| Single | 20 | 12 | 4 | 8 | 0 |

Segunda rotação: quatro mantidos e oito substituídos em todos. Artist usa zero requests por fonte esgotada, com quatro ainda não vistos. Music usa um force, com quatro não vistos; releases usam um force, com zero ainda não vistos. Isso preserva a política aprovada de force quando há menos de seis unseen na reserva; não é promessa de músicas inéditas infinitas. Todos os lotes permaneceram no subtipo correto.

Artist com 14 manteve 12 visíveis e duas alternativas: duas rotações sem requests. Artist com sete mostrou sete, ocultou action e não repetiu requests. Caso com dez e reserveAvailable=true manteve action e permitiu um force. Pool de quatro EPs continua com quatro. QuickAdd preserva card/row/capa/foco/scroll/ordem, badge e coexistência na seção de gêneros. Mobile sem overflow. Nenhum pageerror.

## Validação

93 testes passaram com node --test --test-isolation=none: music-final-recommendations (15 novos casos), collection-genres, duration-memory, local-rotation, core-hydration, collection-polish, recommendation-strategy, collection, pages-evolution, youtube-music, youtube-music-catalog, release-polish e editorial.

Navegador: music-final-recommendations-browser, music-collection-genres-browser e music-duration-memory-browser passaram. navigation-smoke passou. Syntax checks nos cinco arquivos de produção e git diff --check passaram. As três falhas legadas documentadas na rodada anterior continuam fora desta seleção; esta rodada não altera seus testes/providers.

## Arquivos alterados

- dist/music-page-ui.js: sameWork.
- server/music-recommendation-ranking.cjs: target proporcional, subtype estrito, hidratação compartilhando budget, seed monotônico.
- server/music-catalog.cjs: fallback Artist limitado, pending dedupe e metadata de reserva/esgotamento.
- dist/catalog-discovery.js: repasse de sourceExhausted.
- dist/title-pages.js: subtype estrito, action sem alternativas e rotação local de Artist esgotado.
- tests/music-recommendation-strategy.test.cjs: expectativa atualizada para rejeitar unknown.
- Novos tests/music-final-recommendations.test.cjs e tests/music-final-recommendations-browser.cjs.

## Capturas

Arte sintética, layout real, screenshots inspecionadas. Diretório artifacts/final-recommendations, com report.json contendo requests e contagens.

- [Artist escasso antes](../../artifacts/final-recommendations/Artist-scarce-before.png) e [depois](../../artifacts/final-recommendations/Artist-scarce-after.png).
- [Artist sem reserva, action oculto](../../artifacts/final-recommendations/Artist-no-reserve.png).
- [Album](../../artifacts/final-recommendations/Album-after.png).
- [EP](../../artifacts/final-recommendations/EP-after.png).
- [Single](../../artifacts/final-recommendations/Single-after.png).
- Duas rotações consecutivas, por tipo: *-before.png, *-after.png, *-rotation-2.png. Exemplos [Album inicial](../../artifacts/final-recommendations/Album-before.png), [rotação 1](../../artifacts/final-recommendations/Album-after.png), [rotação 2](../../artifacts/final-recommendations/Album-rotation-2.png).
- Capturas mobile também disponíveis por tipo.
