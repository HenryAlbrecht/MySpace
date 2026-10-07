# Coleção relacionada por gêneros — 2026-10-06

Implementado no working tree de `mudanca_search`, sem commit. O HEAD inicial era `4075e4b`; a rotação recente foi preservada. Nenhum arquivo de backend, ranking, cache, player, playlist, Navigation ou CSS foi alterado nesta rodada.

## Comportamento

A seção voltou a `na sua coleção · gêneros em comum`. É derivada dos itens atuais da coleção, do mesmo kind, excluindo a identidade atual, com ao menos um gênero compartilhado. Strings recebem Unicode NFKC, trim e lowercase; a comparação é exata, sem sinônimos. Tags duplicadas contam uma vez. Ranking: número de tags compartilhadas, featured, score, updated, todos decrescentes. Sem gêneros úteis ou matches, o slot existe e fica oculto.

Música usa MusicPageUI.trackRow, mantendo capa, contexto, duração e ações. Artistas usam cards quadrados. Releases usam cards quadrados com metadados completos de artwork, subtipo e ano; Album, EP e Single podem aparecer juntos nesta seção. Isso não altera o filtro de subtipo das recomendações.

Preview de três, `ver todos (N)` e `recolher`. A expansão pertence ao slot da página e reinicia na troca de página. Ordem: conteúdo principal, recomendações, coleção por gêneros, explorar.

O patch de enrichment atualiza o slot existente quando os gêneros chegam. Não chama drawDetail nem substitui hero ou recomendações. O patch de coleção recalcula após quickAdd, edição e exclusão; reutiliza nodes sem mudanças, atualiza a numeração e preserva scroll/foco. Duplicação entre a coleção relacionada e recomendações é permitida; não há sincronização com visible/seen/pool.

A rotação mantém pool 24, janela 12, quatro âncoras, oito alternativas, quota suave de salvos, badges e quickAdd estável. Reserva suficiente evita rede; reserva insuficiente permite force. Global Discover segue seu blender anterior.

## Remoções

Removidos validateDiscoveryOrigin e seu export, discoveryContext/discoveryOriginFor, propagação de origin por TitlePages.open/trackRow/Discover, first-origin-wins em storeItem, microdedupe do preview contra recomendações e testes exclusivos dessa arquitetura. validateItem apenas descarta o campo discoveryOrigin recebido. Sem migração, varredura ou regravação em massa do storage. Documentos históricos continuam registrando o comportamento anterior, substituído por esta rodada.

## Arquivos

Produção: dist/collection.js, dist/extras.js, dist/music-page-ui.js, dist/title-pages.js, dist/discovery-page.js.

Testes: novos tests/music-collection-genres.test.cjs e tests/music-collection-genres-browser.cjs; adaptados tests/music-duration-memory.test.cjs, tests/music-duration-memory-browser.cjs e tests/music-local-rotation-browser.cjs. As verificações de duração e rotação foram mantidas; retiradas as de origem persistida.

## Verificação

- 78 testes passaram: collection, collection-genres, duration-memory, local-rotation, core-hydration, collection-polish, recommendation-strategy, pages-evolution, youtube-music, youtube-music-catalog, release-polish e editorial. Executados com node --test --test-isolation=none.
- navigation-smoke.cjs passou: retorno, scroll por página, proteção contra restauração tardia e entry policy.
- Browser collection-genres: música, artista e releases mistos; hidden antes do enrichment, preview 3/expand 10/collapse 3, hero e recomendações preservados, edição de tag, exclusão real e quickAdd de reinclusão, scroll estável. Nenhum pageerror.
- Browser local-rotation: nos cinco tipos, 4/12 repetidos e 8 novos, zero chamadas usando reserva. Pool escasso faz um force; quatro EPs permanecem quatro EPs. QuickAdd preserva row/capa/foco/scroll/ordem, atualiza badge e permite o mesmo candidato na seção de gêneros. Mobile sem overflow. Nenhum pageerror.
- Browser duration-memory: batches reais previamente auditados de artistas, slots/rows/hero preservados, uma busca suplementar por artista e patch de duração no node existente. Nenhum pageerror. Sem chamadas musicais ao vivo nesta verificação.
- Syntax checks nos cinco arquivos de produção e git diff --check passaram.

Checagem ampliada encontrou três falhas antigas: recovery/retry, resolution/all-Apple-failures e search-reserve/incremental. Reproduzidas com os arquivos correspondentes extraídos do HEAD anterior em artifacts/collection-genres/baseline (9 passam, 3 falham). Esses cenários injetam o resolver legado iTunes no catálogo atual; não foram alterados ou corrigidos nesta rodada. A suite ampliada não está totalmente verde.

## Screenshots

Fixtures isoladas com arte sintética, preservando estilos reais; imagens inspecionadas visualmente.

- [Music preview](../../artifacts/collection-genres/music-preview.png)
- [Artist preview](../../artifacts/collection-genres/artist-preview.png)
- [Album/EP/Single preview](../../artifacts/collection-genres/album-preview.png)
- [Seção expandida com releases mistos](../../artifacts/collection-genres/album-expanded.png)
- Expansões adicionais music-expanded.png e artist-expanded.png, e report.json no mesmo diretório.
- Regressão desktop/mobile de rotação: artifacts/local-rotation/report.json e screenshots por tipo.
