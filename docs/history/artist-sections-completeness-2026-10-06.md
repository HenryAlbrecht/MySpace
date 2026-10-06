# Completude das seções de artista — 2026-10-06

Correção funcional na branch `refactor/organization-v2`, posterior ao Organization/Acceptance V2.4. Working tree inicial limpo; AGENTS e contratos lidos, testes focados verdes e diagnóstico guest real realizados antes de alterar produção. Sem commit/push. Este registro documenta a ampliação do contrato CORE/FULL; contratos vigentes permanecem em `docs/contracts.md`.

## Causa e medição real

O parser consumia somente os previews inline do primeiro browse e descartava os handles das seções completas. Além disso, os whitelists de enrichment em Catalog/TitlePages descartavam `topAlbums`. O caminho `Catalog.artistAlbums` permanece legacy e não foi usado como base da correção.

The Cure: `UCKuG9-MGolUuWbEcoz5qijw`. Albums e Singles & EPs possuem 10 previews cada; os handles estão em `header.musicCarouselShelfBasicHeaderRenderer.moreContentButton.buttonRenderer.navigationEndpoint.browseEndpoint` e também nos runs de `header.title`. Ambos usam `MPADUCKuG9-MGolUuWbEcoz5qijw`, com params distintos: Albums `ggMIegYIARoCAQI%3D`; Singles & EPs `ggMIegYIAhoCAQI%3D`. As listas completas retornaram `gridRenderer.items` com `musicTwoRowItemRenderer`, sem continuation nessa medição.

| Listagem | Preview inline | Completa |
|---|---:|---:|
| Albums | 10 | 31 |
| Singles & EPs | 10 | 34 (29 Singles, 5 EPs) |
| Discografia combinada | 20 | 65 |

Os 45 releases adicionais incluem The Top (Remastered Version), Pornography (Deluxe Edition), Faith, Seventeen Seconds e Three Imaginary Boys. Esses nomes não são hardcoded em produção ou fixtures.

Top songs tem 5 previews e handle em `musicShelfRenderer.bottomEndpoint.browseEndpoint`: playlist VL, params `ggMCCAI%3D`. A lista completa medida retornou 100 rows e continuation de 208 caracteres em `continuationItemRenderer.continuationEndpoint.continuationCommand.token`; a segunda resposta retornou 50 rows em `onResponseReceivedActions[].appendContinuationItemsAction.continuationItems`, sem token final. Rows de vídeo não viram músicas canônicas automaticamente. Videos tem 10 previews, handle VL/mesmos params e 80 rows completas; metadata somente. Fans might also like tem 10 previews e nenhum handle no payload medido: nenhum ID foi inventado. Live performances, Featured on e playlists também apareceram; fora da operação implementada.

Diagnóstico final: dois browses de seção para obter 31 + 34 = 65. Duas operações concorrentes e uma posterior mantiveram exatamente esses dois requests. A sequência completa teve quatro POSTs de metadata (busca do artista, browse do artista, duas seções), além do GET guest de configuração. Evidências locais ignoradas: `artifacts/artist-sections/before-audit.json`, `full-audit.json`, payloads brutos e `after-real.json`.

## Contrato e ownership

- `server/youtube-music-parser.cjs`: descriptors transitórios `artistSections`, renderers medidos, continuations e tipos individuais.
- `server/youtube-music.cjs`: operações internas `artistSection`/`artistDiscography`, browse oficial, dedupe por `catalogId`, cache/pending existente. Albums e Singles & EPs executam em paralelo.
- `server/music-catalog.cjs`: CORE mantém previews; FULL inicia discografia e editorial em paralelo pela rota existente.
- `dist/catalog.js`: propaga releases sem diminuir o CORE e descarta cache de sessão antigo de artista YT sem descriptors.
- `dist/title-pages.js`: reutiliza `updateReleases`, mantém seção/cards retidos e estado de filtro/sort/foco/scroll.
- `dist/collection.js`: adiciona os dois campos transitórios à exclusão existente, preservando o formato persistido; nenhuma chave/store nova.

Sem módulos de produção ou endpoint público novos. Album/EP/Single continuam `kind=album`; tipo vem do item, nunca do shelf combinado. IDs distintos com título igual permanecem distintos. Sem search/details por release, Apple ou Last.fm para discografia.

Limites por seção: 10 requests/páginas, 1.000 itens e tokens/params de até 4.096 caracteres sem controles ASCII. Discografia faz no máximo 20 browses de seção. Token repetido/inválido, limite ou falha tardia preservam o prefixo e sinalizam partial; falha de uma seção conserva o preview e o resultado da outra. Cache/pending reutiliza TTL de 15 minutos e teto de 80 entradas, incluindo prefixos parciais; force somente explícito. Mudanças upstream de renderer continuam um limite do client guest.

Songs/Related têm suporte interno testado, sem listas visuais completas. Related sem handle permanece preview. Videos não cria mídia/Collection/UI. Search continua somente primeira resposta, limite local de 40; continuation de busca é dívida separada. Tracks de álbum mantêm 200; continuation de tracklist não foi auditada nesta tarefa. Playback, ranking, Apple legacy, CSS, motion, XMB, backup e PARTY não foram alterados.

## Validação

Quick PASS: 37 arquivos / 193 testes (sete testes novos no arquivo existente), guard de fetch externo sem acessos registrados. Smoke PASS: 9 arquivos. Syntax/static PASS e `git diff --check` PASS. Focados adicionais CORE/pages e Collection/Catalog PASS. A primeira tentativa de smoke encontrou bloqueio EACCES de localhost no sandbox; repetição autorizada passou sem adaptar produção/testes.

Browsers locais com fixtures PASS: `artist-discography-browser.cjs`, `music-core-hydration-browser.cjs`, `title-detail-continuity-browser.cjs`, `music-collection-genres-browser.cjs`, `music-final-recommendations-browser.cjs`. O novo harness usa servidor/Catalog/client reais com respostas guest determinísticas: CORE 3 → FULL 7, mesma seção/cards existentes, foco/scroll/sort preservados e filtros sobre a lista expandida. Sem browse por release durante enrichment; intenção de ponteiro mantém prefetch existente. Diagnóstico real não integra quick; contagens upstream são observação datada.

## Follow-up — apresentação progressiva, 2026-10-06

Referência inicial: HEAD `4499a7082601bb1f1506be19497836a1e9e6dc2b`, working tree limpo. O browser anterior e focados Collection/Catalog/CORE passaram antes de editar produção. O problema era `draw()` criar um card para cada release filtrado, apesar de poucos estarem visíveis/interessarem ao usuário. Backend, dados, fases e cache permaneceram intactos.

Janela efêmera da seção: 18 inicialmente/lote no desktop; 8 em viewport <= 600 px, definido na criação da seção. Filtra/ordena todos os releases antes do slice; somente o slice cria cards, imagens e intent hooks. Map preserva cards já visitados. `ver mais N` amplia localmente até o fim; `recolher` volta ao INITIAL e ancora os controles após layout, com ajuste instantâneo no frame seguinte e guarda de seção conectada. Não cria nodes antecipados nem usa idle/observer para adiar FULL.

FULL preserva a janela: 18 permanece 18; preview previamente expandido até 20 permanece 20 quando chegam 65. Filtro reinicia em INITIAL; sort mantém a quantidade. Um card focado que passe para fora do slice é retido temporariamente como exceção de um card adicional, sem expandir todo o grid. Notice usa total filtrado e quantidade exibida. Partial/unknown mantêm os contratos anteriores. Paginação legacy permanece separada e funcional: fixture 20 carregados → request provider → 23 conhecidos, janela ainda 20 → `ver mais 3` local.

`cover()`/Artwork continuam com lazy/decode existente; nenhuma mudança global de imagens ou `decoding=async` adicional. Expansão/recolhimento não chamam Catalog. Inserção de card sob ponteiro parado não vira prefetch; movimento/foco real mantém intentCore. Prefetch de aproximação do ponteiro e o observer independente de discovery permanecem existentes; o harness isola essas interações ao comparar requests da ativação local.

| Medição local, fixture CORE 20 / FULL 65 | Antes | Depois |
|---|---:|---:|
| Releases no model/cache | 65 | 65 |
| Cards/imagens iniciais desktop | 65 / 65 | 18 / 18 |
| Cards/imagens iniciais mobile | 65 / 65 | 8 / 8 |
| Requests HTTP de detalhes CORE/FULL | 2 | 2 |
| Requests por release durante hidratação | 0 | 0 |
| Requests ao ativar expansão local | — | 0 |

Medição aproximada do patch desktop: 3,5 ms antes / 0,4 ms depois; mobile: 2,3 ms / 0,1 ms. São observações de uma execução, sem threshold/microbenchmark no quick. Requests de seção do backend não foram alterados; a medição real anterior de The Cure continua referência (dois browses). Este follow-up usa fixtures locais, sem nova recertificação upstream. Evidências: `artifacts/artist-window/before.json`, `after.json` e logs locais.

Produção alterada somente em `dist/title-pages.js` e uma regra de controles flex/gap em `dist/title-pages.css`. Novo harness `tests/artist-discography-window-browser.cjs`; README/INVENTORY atualizados. Sem backend, Artwork, MusicPageUI, Catalog, Collection, Navigation, motion ou contratos arquiteturais alterados. Sem commit/push.

Aceite: quick PASS (37 arquivos / 193 testes, guard sem rede externa); smoke PASS (9 arquivos); syntax/static e diff-check PASS. Focados Collection/Catalog/CORE/pages/Artwork PASS (34 testes). Browser de janela PASS em desktop/mobile/preview expandido/foco/partial/unknown/legacy; regressões discografia anterior, continuity, CORE hydration, recommendations e Collection genres PASS. O harness assenta scroll antes do FULL para evitar concorrer com sua própria rolagem; assertions certificam scroll exato e controles de recolher visíveis. Resize contínuo não recalcula o lote; reabrir a seção usa o viewport atual.
