# Durações e memória simples de descoberta — 2026-10-05

Branch: `mudanca_search`. Working tree como referência; sem commit automático.

## Duração: evidência real

Foram consultados o artist browse público e uma busca musical por artista no YouTube Music. Os payloads completos e as rows extraídas estão em `artifacts/duration-memory/audit.json`, `Goo-Goo-Dolls-browse.json` e `Jimmy-Eat-World-browse.json`.

Nas dez top tracks observadas, `flexColumns` contém quatro `musicResponsiveListItemFlexColumnRenderer.text` com `runs`: título, artista com endpoint, reproduções (ex.: `2B plays` / `260M plays`) e álbum com endpoint. `fixedColumns` está ausente. Nenhuma destas dez rows contém duração, seja em `runs`, seja em `simpleText`. A ausência real de metadata é a causa principal destes exemplos.

O parser também ignorava `simpleText` em colunas de duração. Isso foi corrigido preventivamente com `durationFromText`, limitado aos text objects das flex columns de metadata e fixed columns. Não há scan recursivo de clocks, e o título não fornece duração.

| Artista / faixa | videoId no browse | Duração direta | Busca única, ID exato |
| --- | --- | --- | --- |
| Goo Goo Dolls — Iris | Dy_eP-mqWow | ausente | 4:50 |
| Goo Goo Dolls — Iris (Live) | KbFZt4KGuiI | ausente | sem match |
| Goo Goo Dolls — Slide | KXRKoM0misA | ausente | sem match |
| Goo Goo Dolls — Name | sQxszQ9BsxM | ausente | 4:30 |
| Goo Goo Dolls — Iris (Acoustic) | F2BPGir2dUQ | ausente | sem match |
| Jimmy Eat World — The Middle | rubpIfLPzvU | ausente | 2:46 |
| Jimmy Eat World — Sweetness (Pop Goes Punk) | MARS61oqsak | ausente | sem match |
| Jimmy Eat World — Sweetness (Bleed American) | J7y0AG4PHJc | ausente | 3:41 |
| Jimmy Eat World — Hear You Me | fcmFH5OvdtA | ausente | 4:45 |
| Jimmy Eat World — Pain | EbSlCrleDgE | ausente | sem match |

Resultado observado: zero clocks diretamente no browse; cinco recuperados em lote; cinco continuam indisponíveis nestas duas respostas. Isso não significa que a faixa nunca tenha duração em outro contexto do catálogo. A busca é limitada aos resultados existentes (20), sem paginação ou lookup por faixa. Não foram transferidas durações de outras versões de Iris/Sweetness. Não há exceções por artista ou título na implementação.

Um lookup automático suplementar por artista, depois da inserção da tracklist, reutiliza `Catalog.search('music', artist.title)` e seu cache. Total adicional nestas duas páginas: duas chamadas de busca, uma por artista. Um mapa pequeno compartilha a promessa em renderizações/reentradas; hero, biografia e discografia não aguardam esse lookup. Somente o texto dos slots existentes `.music-track-duration` muda. Todas as rows agora criam esse slot, mesmo vazio. Hover/focus continua usando o `prefetchCore` existente; se o core fornecer duração, o callback atualiza somente o slot da row selecionada. Não há prefetch automático dos detalhes de todas as tracks.

## Memória de descoberta

`TitlePages.open(item, {origin})` mantém um único contexto transitório separado do objeto de catálogo: rota de destino, kind/catalogId do destino e origem validada. O contexto é descartado ao mudar para outra rota, ou ao chamar `open` sem origem. Busca, coleção, discografia, album context e tags mantêm suas chamadas comuns. Reabrir por URL após sair não recupera contexto anterior. Não se grava nada só por abrir uma recomendação.

Schema opcional no item salvo:

```js
discoveryOrigin: {
  kind: 'music' | 'album' | 'artist', // outros kinds existentes também são aceitos para seeds globais
  catalogId: 'ytmusic:...',
  title: 'Título da origem',
  surface: 'title' | 'global'
}
```

A validação aceita somente kind conhecido, catalogId não vazio de até 200 caracteres, identidade musical válida quando aplicável, título não vazio de até 120 caracteres sem controles e surface `title`/`global`. Campos extras são descartados; origem inválida é removida, sem invalidar o item importado. Itens antigos continuam válidos. Não existe timestamp de origem, storage adicional, graph ou lista de origens.

O ponto comum de gravação da coleção incorpora o contexto apenas para item novo, cobrindo quickAdd e favorito com auto-add. Para item já existente, preserva exclusivamente a origem anterior, inclusive sua ausência. Alterações posteriores não reatribuem provenance. O global passa os `seedKind`, `seedCatalogId` e `seedTitle` existentes; não ganhou UI de histórico.

Nas páginas musicais, a seção por coincidência de gêneros foi removida. `descobertos por aqui` filtra os itens salvos por `surface === 'title'` e kind/catalogId da origem igual à página atual, ordenando por `updated DESC`. Fica depois das recomendações e antes de explorar mais títulos. Mostra até três itens; `ver todos (N)` expande todos os matches, com opção de recolher. Música usa track rows; releases e artistas usam os cards quadrados existentes. Releases mostram subtipo e ano. Cover recebe image, imageFallback, coverLayout e kind.

`patchCollectionState` atualiza a seção local, preservando o restante da TitlePage. A filtragem existente de recomendações também reaplica os itens salvos sem buscar novamente; exclusão pelo editor atualiza a memória local. Sem cleanup de origem separado.

## Verificação

- 59 testes de parser, validação, CORE/ENRICHMENT, catálogo, recommendations/ranking/blender, release type, navegação e playback passaram.
- Parser: `simpleText 3:59 → 239`, `runs 4:30 → 270`, `1:02:15 → 3735`; rejeita ano, playcounts, campo aninhado arbitrário e título com aparência de clock.
- Edge headless isolado: lote por ID exato, uma busca por artista, hero/rows/slots com identidade preservada; intent patch de uma row quando o core de teste fornece duração.
- Fluxos: abrir recomendação não salva; local abrir/adicionar/Back; item sai das recomendações e aparece nos descobertos; busca manual e URL direta sem origem; contexto global via card; favorito com auto-add; primeira origem vence; item antigo sem origem não ganha uma por edição; preview/expand/recolher; exclusão e patch sem redesenho do hero ou recommendations.
- Import sanitization testado diretamente; nenhum perfil real foi alterado.
- Sem erros de JavaScript no navegador de teste. `git diff --check` passou.

Screenshots em `artifacts/duration-memory/`: `Goo-Goo-Dolls-tracks.png`, `Jimmy-Eat-World-tracks.png`, e `discovered-music.png`, `discovered-album.png`, `discovered-artist.png`. As screenshots dos artistas reproduzem os payloads reais auditados nesta rodada; as de descoberta usam fixtures isoladas com arte sintética. `browser.json` registra rows, duração e contagem de buscas. O teste de foco usa resposta de core simulada e não faz parte da contagem de clocks reais recuperados em lote.

Arquivos de produção alterados: `server/youtube-music-parser.cjs`, `dist/music-page-ui.js`, `dist/catalog.js`, `dist/title-pages.js`, `dist/collection.js`, `dist/extras.js`, `dist/discovery-page.js`. Testes novos: `tests/music-duration-memory.test.cjs`, `tests/music-duration-memory-browser.cjs` (requer os payloads de auditoria em artifacts). Este relatório completa os detalhes da rodada.
