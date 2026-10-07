# Recomendações contextuais e Descobrir — 2026-10-05

Branch: `mudanca_search`. Working tree como fonte de verdade. Nenhum commit criado.

## Política local

Antes, `relatedAlbums` era concatenado à discografia do artista atual e qualquer resultado encerrava o fluxo antes do rádio. O frontend ainda devolvia carrosséis brutos e os mesclava após a API. Isso permitia concentração no artista atual e mistura de subtipos.

Agora o backend define o ranking e o frontend apenas remove obras salvas e renderiza a ordem, movimentando cards existentes no refresh. Não há gate de navegação, redraw de página nem alterações em CORE/ENRICHMENT, artwork parser, duração, CSS Grid ou player.

Ordem das fontes: relacionados explícitos de outros artistas → releases do rádio → releases de artistas relacionados no YT → artistas similares Last.fm resolvidos para identidades YT inequívocas → discografia própria limitada. Subtipo conhecido tem prioridade; desconhecido só é aceito num relacionamento explícito, de outro artista. Metadata conhecida em outra ocorrência do mesmo ID prevalece sobre ausência de subtipo. Se a seed não declara subtipo, não se inventa um.

Música continua usando rádio, com músicas de outros artistas primeiro. Album/EP/Single mantêm o subtipo conhecido. Artista continua usando artistas relacionados, excluindo a seed e deduplicando IDs. Máximo 12, com no máximo 2 obras do artista atual; não há preenchimento artificial. Havendo espaço e alternativas, as duas obras próprias são separadas. Dentro de uma mesma fonte/tier, os artistas alternam sem promover fonte menos relevante.

A comparação usa IDs de artista quando ambos existem, nomes NFKC normalizados quando falta ID, e suporta identidades múltiplas em `artists`/`artistCatalogIds`. Mesmo nome com IDs diferentes não é confundido.

Last.fm é somente sinal de artistas similares. Foi reutilizado o resolver conservador já existente em music-catalog; títulos/artistas precisam corresponder e uma única identidade YT válida deve sobreviver à deduplicação. Homônimos ficam fora. Isso evita depender de topAlbums do Last.fm para decidir se algo é EP/Single; todas as releases navegáveis permanecem ytmusic.

## Limites e cache

Por ranking de release: rádio ≤1; detail do artista atual ≤1 quando não há detail completo no entity cache; details novos de artistas relacionados ≤3, compartilhando o orçamento YT/Last.fm; details de releases desconhecidas do rádio ≤4; concorrência de details ≤2. Começa pelos dois artistas YT mais relevantes e reserva a terceira consulta para o fallback. Até 3 buscas conservadoras de artistas Last.fm, com parada quando há resultados suficientes ou o orçamento se esgota. Caches e pending existentes continuam compartilhados; o ranking da mesma release também compartilha pending. Force separa o pending e reexecuta ranking/rádio. Cache frontend tem versão contextual-v2 e não guarda vazio nem resultado com falhas YT.

O contador lógico de details pode incluir uma chamada atendida pelo cache interno do cliente quando o entity cache perdeu a entrada; por isso as requisições de rede reais são registradas separadamente. O budget não inclui o browse da própria seed (CORE), configuração inicial nem eventual busca de foto já existente no cliente YT.

## Auditoria pública real

Execução em contexto guest, sem cookies/conta e sem coleção pessoal. Os carrosséis YT variaram entre execuções; números abaixo são da última auditoria Node. O browser registrou sua própria resposta real separadamente.

| Seed | Subtipo real | Resultados | Outros artistas | Próprio artista | Rede no ranking | Tempo |
|---|---|---:|---:|---:|---:|---:|
| Mado | single | 12 | 12 | 0 | 7 | 2400 ms |
| Whale Net | single | 12 | 12 | 0 | 1 | 554 ms |
| Long Goodbye | ep | 5 | 5 | 0 | 14 | 4659 ms |
| Time Lapse | album | 12 | 12 | 0 | 4 | 1462 ms |

Whale Net é Single no payload atual do YouTube Music, apesar de chamado Album no pedido. Não houve override ou exceção para esse título. Time Lapse foi usado para validar Album, e Long Goodbye para EP.

### Mado

Budget lógico: `{"radio":1,"currentArtistDetails":1,"relatedArtistDetails":2,"releaseDetails":0,"lastfmSignals":0,"artistSearches":0}`.

| Rank | Título | Artista | Subtipo | Fonte |
|---:|---|---|---|---|
| 1 | When We Dream | RAY | single | related-artist |
| 2 | sleep sleep | Split end | single | related-artist |
| 3 | sagittarius | RAY | single | related-artist |
| 4 | hoshi no katachi | Split end | single | related-artist |
| 5 | Bittersweet | RAY | single | related-artist |
| 6 | haru | Split end | single | related-artist |
| 7 | Tentai | RAY | single | related-artist |
| 8 | hi wo tomosu | Split end | single | related-artist |
| 9 | otogi | RAY | single | related-artist |
| 10 | TEENAGER | Split end | single | related-artist |
| 11 | AO | RAY | single | related-artist |
| 12 | sea side | Split end | single | related-artist |
### Whale Net

Budget lógico: `{"radio":1,"currentArtistDetails":1,"relatedArtistDetails":1,"releaseDetails":0,"lastfmSignals":0,"artistSearches":0}`.

| Rank | Título | Artista | Subtipo | Fonte |
|---:|---|---|---|---|
| 1 | When We Dream | RAY | single | related-artist |
| 2 | sleep sleep | Split end | single | related-artist |
| 3 | sagittarius | RAY | single | related-artist |
| 4 | hoshi no katachi | Split end | single | related-artist |
| 5 | Bittersweet | RAY | single | related-artist |
| 6 | haru | Split end | single | related-artist |
| 7 | Tentai | RAY | single | related-artist |
| 8 | hi wo tomosu | Split end | single | related-artist |
| 9 | otogi | RAY | single | related-artist |
| 10 | TEENAGER | Split end | single | related-artist |
| 11 | AO | RAY | single | related-artist |
| 12 | sea side | Split end | single | related-artist |
### Long Goodbye

Budget lógico: `{"radio":1,"currentArtistDetails":1,"relatedArtistDetails":3,"releaseDetails":4,"lastfmSignals":1,"artistSearches":1}`.

| Rank | Título | Artista | Subtipo | Fonte |
|---:|---|---|---|---|
| 1 | kaiki suru kokyu | the cabs | ep | related |
| 2 | slow down | Fennel | ep | related |
| 3 | nightlife | yuragi | ep | radio |
| 4 | Fujieda EP | Asian Kung-Fu Generation | ep | related-artist |
| 5 | Burning | Hitsujibungaku | ep | related-artist |
### Time Lapse

Budget lógico: `{"radio":1,"currentArtistDetails":1,"relatedArtistDetails":2,"releaseDetails":4,"lastfmSignals":0,"artistSearches":0}`.

| Rank | Título | Artista | Subtipo | Fonte |
|---:|---|---|---|---|
| 1 | Iine! | Sunny Day Service | album | related |
| 2 | Fluorite code | cephalo | album | related |
| 3 | Fanclub | ASIAN KUNG-FU GENERATION | album | related |
| 4 | thread of stone | kanekoayano | album | related |
| 5 | Tsukuru | Hitohira | album | related |
| 6 | Double Rift | CRCK LCKS | album | related |
| 7 | No New World | MASS OF THE FERMENTING DREGS | album | radio |
| 8 | Don't Laugh It Off | Hitsujibungaku | album | related-artist |
| 9 | Surf Bungaku Kamakura Complete | Asian Kung-Fu Generation | album | related-artist |
| 10 | Hitsujibungaku Tour 2023 "if i were an angel," 2023.10.03 | Hitsujibungaku | album | related-artist |
| 11 | Planet Folks | Asian Kung-Fu Generation | album | related-artist |
| 12 | 12 hugs (like butterflies) | Hitsujibungaku | album | related-artist |

O arquivo live.json registra todos os candidatos, inclusões/exclusões (duplicate-or-seed, release-subtype, unknown-subtype, same-artist-quota, batch-limit), ranks, fontes, IDs e requisições. Não contém credenciais.

## Blender global

Mantidas seleção de até 6 seeds por favorito/nota/atualização, diversidade de kind, motivos, gêneros compartilhados, exclusão de salvos/sameWork, filtros e descarte/restauração.

Antes: partial achatava pools; final fazia round robin; a página ainda movia os resultados novos à frente no fim. Agora partial e final chamam a mesma blendDiscoveryPools; a página aplica a sequência recebida. Novos pools podem inserir candidatos entre os já vistos, mas a ordem relevante dentro de cada pool permanece e a conclusão não faz outra reordenação.

O blender considera somente os heads dos pools. Penalidades suaves equilibram participação por seed, mesma seed/mesmo artista consecutivos, concentração de artista nos primeiros 12 e repetição do tipo visual (incluindo album:album/ep/single). Elas relaxam quando faltam alternativas; não deixam slots vazios. O teste com seis mídias detectou e corrigiu starvation causada por uma penalidade de artista que adiava demais um pool.

Rotation mantém a rotação existente das seeds, mas remove o shift integral rotation*4. Dentro dos pools, só troca pares adjacentes equivalentes (mesmo kind, subtipo e sinal) nos primeiros 8; posições inferiores ficam no lugar. Não usa random sort.

Fixture A1..A4/B1..B3/C1..C2: partial antigo A1,A2,A3,A4,B1,B2,B3,C1,C2; partial/final novos A1,B1,C1,A2,B2,C2,A3,B3,A4. A base final antiga já intercalava essa fixture; a melhoria aqui é unificar o loading e aplicar diversidade quando necessário.

### Comparação com pools reais idênticos

A comparação usa o código HEAD anterior e o código atual com as mesmas respostas YT capturadas no navegador, isolando o blender da mudança de fontes locais.

| Posição | Final anterior | Final novo |
|---:|---|---|
| 1 | あさひなぐ - ASAHINAGU | あさひなぐ - ASAHINAGU |
| 2 | Iine! | Iine! |
| 3 | rubens | rubens |
| 4 | kaiki suru kokyu | kaiki suru kokyu |
| 5 | Threads of a Dream | Threads of a Dream |
| 6 | 白昼夢は色彩の無い - hakuchumuha shiisainonai | When We Dream |
| 7 | Fluorite code | 白昼夢は色彩の無い - hakuchumuha shiisainonai |
| 8 | RAY | Fluorite code |
| 9 | slow down | slow down |
| 10 | When We Dream | RAY |
| 11 | サマースクール | Tsukinami-chan |
| 12 | thread of stone | サマースクール |

Partial anterior, primeiros 12: あさひなぐ - ASAHINAGU; 白昼夢は色彩の無い - hakuchumuha shiisainonai; サマースクール; 海の法則 - Who is ruling the ocean?; 雨 - Ame; ルート225 - Route225; 56番線 - Line 56; confess; TEENAGER; 想像の雨 - Sozo no Ame; 心に雲を持つ少年 - Kokoro ni Kumo wo Motsu Shonen; サマーナイトタウン - Summer Night Town.

Distribuição anterior: `{"seed":{"Thanatos":3,"Time Lapse":3,"Beachside talks":2,"Long Goodbye":2,"Mado":2},"kind":{"music":3,"album":7,"artist":2},"subtype":{"music":3,"album":3,"artist":2,"ep":2,"single":2},"artist":{"MASS OF THE FERMENTING DREGS":1,"Sunny Day Service":1,"rubens":2,"the cabs":1,"chouchou merged syrups.":1,"cephalo":1,"RAY":2,"Fennel":1,"SEAPOOL":1,"kanekoayano":1}}`.

Distribuição nova: `{"seed":{"Thanatos":3,"Time Lapse":2,"Beachside talks":2,"Long Goodbye":2,"Mado":2,"Whale Net":1},"kind":{"music":3,"album":7,"artist":2},"subtype":{"music":3,"album":2,"artist":2,"ep":2,"single":3},"artist":{"MASS OF THE FERMENTING DREGS":1,"Sunny Day Service":1,"rubens":3,"the cabs":1,"RAY":2,"chouchou merged syrups.":1,"cephalo":1,"Fennel":1,"SEAPOOL":1}}`.

Atualização real no navegador, primeiros 12: Fluorite code; RAY; 白昼夢は色彩の無い - hakuchumuha shiisainonai; slow down; When We Dream; Threads of a Dream; Iine!; あさひなぐ - ASAHINAGU; kaiki suru kokyu; rubens; sagittarius; Fanclub.

A auditoria real global usou músicas, Album, EP, Singles e artista. Game/anime/manga foram verificados com dados controlados no navegador e no smoke, sem afirmar uma integração externa real que não foi executada.

## Validação e arquivos

Suite Node: 57 testes (catálogo YT, CORE, páginas musicais, modelo/player, navegação, releases, estratégia e discovery smoke). Nove testes novos cobrem identidade/colaboração, quota/escassez, subtype conhecido/desconhecido, rádio, bounded concurrency, fallback conservador, ambiguidade, pending, falhas parciais, blender, rotation e autoridade do backend.

Browser Playwright/Edge: music-navigation-polish-browser; music-first-paint-browser; music-core-hydration-browser; music-ux-browser; music-pages-evolution-browser; music-recommendation-browser; music-recommendation-live-browser. Sem pageerrors nos novos cenários; verificadas telas reais e mobile sem overflow; descarte/restauração, filtro e manutenção de resultados em falha também passaram. A skill verification foi aplicada; agent-browser CLI não está disponível, então a verificação usou o harness Playwright existente.

Produção alterada: server/music-catalog.cjs; novo server/music-recommendation-ranking.cjs; dist/catalog-discovery.js; dist/discovery-page.js; dist/title-pages.js. Parser, lastfm.cjs, player e CSS não alterados.

Fixtures de regressão atualizadas: tests/music-release-polish.test.cjs e tests/youtube-music-catalog.test.cjs agora declaram subtipos reais e esperam a nova ordem; music-core-hydration-browser.cjs recebe do endpoint mock o resultado já ranqueado, sem depender do merge bruto removido. Novos testes: music-recommendation-strategy.test.cjs, music-recommendation-browser.cjs, music-recommendation-live.cjs, music-recommendation-live-browser.cjs.

## Evidências

- [Whale Net](../../artifacts/recommendation-strategy/whale-net.png)
- [Mado](../../artifacts/recommendation-strategy/mado.png)
- [Long Goodbye EP](../../artifacts/recommendation-strategy/ep.png)
- [Time Lapse Album](../../artifacts/recommendation-strategy/album.png)
- [Descobrir global](../../artifacts/recommendation-strategy/global.png)
- [Global após refresh](../../artifacts/recommendation-strategy/global-refresh.png)
- [Global mobile](../../artifacts/recommendation-strategy/global-mobile.png)
- [Candidatos, ranks, budget e rede](../../artifacts/recommendation-strategy/live.json)
- [API e renderização no navegador](../../artifacts/recommendation-strategy/browser.json)
- [Comparação do blender](../../artifacts/recommendation-strategy/comparison.json)

Artifacts ignorados pelo Git permanecem disponíveis localmente.
