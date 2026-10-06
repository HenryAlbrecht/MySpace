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
