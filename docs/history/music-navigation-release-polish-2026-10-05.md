# Navegação e releases musicais

Working tree da branch `mudanca_search`; baseline local `7d4542c`. Sem commit automático e sem dependências novas.

## Navegação e renderização

O gate de 400 ms foi removido integralmente, incluindo timeout, Promise.race e espera antes de go(). open() consulta peekCore, mergeia cache conhecido sincronamente, inicia/reutiliza prefetchCore sem await e muda o hash na mesma interação. A rota continua compartilhando corePending; revision protege respostas de rotas anteriores.

Na gravação real, clique até hashchange:

| Abertura | Antes | Depois |
| --- | ---: | ---: |
| Thanatos, primeiro clique | 295,6 ms | 3,1 ms |
| Thanatos, hover/cache | 1,7 ms | 1,4 ms |
| Time Lapse, contexto | 2,7 ms | 2,8 ms |
| Kinokoteikoku | 401,7 ms | 3,0 ms |
| Beachside talks | 298,7 ms | 1,7 ms |
| Whale Net | 245,1 ms | 2,7 ms |
| Mado, recommendation | 340,1 ms | 2,4 ms |

O teste controlado com core atrasado em 700 ms confirmou primeiro repaint útil em um frame: music 24,4 ms, album 11,4 ms, artist 13,9 ms. O hash mudou sincronamente. São medidas desta execução, não garantias de performance de hardware/rede.

Full redraws **após o draw inicial**, com seed:

| Tipo | Antes | Depois |
| --- | ---: | ---: |
| music | 0 | 0 |
| album | 1 | 0 |
| artist | 1 | 0 |

patchMusicCore, patchAlbumCore e patchArtistCore delegam a um patch musical compartilhado. Preservam toolbar, title-layout, cover frame, h1, actions e title-about. Alteram metadata, artwork somente se diferente, detalhes dt/dd, total, tipo e estruturas novas. Álbum insere/atualiza tracklist localmente. Artista insere banner, músicas populares e discografia localmente; atualização de releases conserva filtros e ordenação. Seções já ordenadas não são destacadas do DOM; reordenação necessária preserva foco. Discovery/contexto existentes são mantidos. Erro de core também acrescenta aviso local quando há seed. URL direta sem seed continua podendo receber draw completo.

Duração conhecida permanece visível desde o seed. aria-busy continua semântico; TitlePage não recebe opacity/filter/brightness. Motion de 170 ms permanece apenas em seções novas e respeita reduced motion.

## Coleção

O shift vinha de storeItem → TitlePages.refresh → drawDetail, somado ao parágrafo separado “Na sua coleção” antes das actions. storeItem/bulkUpdate agora usam patchCollectionState. O estado pessoal fica inline nas actions; o espaço do controle de conclusão e a altura das actions são reservados. O patch conserva o container de actions, foco e scroll; não reconstrói hero, metadata, discovery ou albumContext.

`saved.total` era usado como evidência de acompanhamento, embora seja metadata do catálogo. appendPersonalTracking exige notes, score, datas pessoais, listas, progress > 0 ou status diferente de planned. planned 0/1 não exibe acompanhamento; total só entra no denominador quando há progresso real.

O teste quick add de Single com uma faixa conservou identidade e x/y/width/height de toolbar, title-layout, cover, h1, actions e title-about, além de scrollY. Favoritar não abriu acompanhamento; concluir abriu somente a seção pessoal.

## Single, artwork e auditoria real

Single/EP continuam kind=album. releaseLabel mostra Single, EP ou Álbum. parseBrowse resolve albumType por subtitle explícito do header; ausência não sobrescreve tipo conhecido. browseRow também usa subtitle; títulos e número de faixas não são heurísticas de tipo. Metadata de shelves “Albums”, “Singles” e “EPs” fornece contexto de discografia.

Identidades reais:
- Beachside talks: `ytmusic:artist:UC5zUtmgvP6Ry2uzshEAxPOw`.
- Whale Net: `ytmusic:album:MPREb_WpaRwvXraMb`.
- Mado: `ytmusic:album:MPREb_pnNS2ekfHeB`.
- Subtitle do header de Mado: Single • 2026; albumType=single.
- relatedAlbums de Whale Net e Mado: vazios nesta captura.
- Artist detail: dez releases válidas, incluindo Whale Net e Mado.

Path principal observado do card: `musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer.thumbnail.thumbnails`. O helper twoRowArtwork lê **somente esse array direto** primeiro, depois usa o extrator genérico como fallback. Antes, image() percorria os thumbnails recursivamente dentro do objeto recebido e poderia escolher um descendente maior; o teste com thumbnail aninhado reproduz esse risco e confirma a seleção correta agora.

**A divergência exata de capa relatada para Mado não foi reproduzida na captura real atual.** Card e header, antes e depois, apontaram para o mesmo asset:
`https://lh3.googleusercontent.com/2ZVi0QE83T2ShPmyc4R71HNcdZCA34lU3iRPp1rOjdrTrKLoXU8HtSUu8Hwbxsod1NZPcDKH6YBET8O3=w800-h800-l90-rj`.
Portanto não há evidência para atribuir o print anterior a um thumbnail errado específico. O fallback de rádio também podia usar artwork de track ao construir uma release; agora, quando existe, seu detalhe em cache fornece a artwork da entidade. Nenhuma faixa/release recebeu hardcode.

intentCore atualiza apenas a imagem do card quando core/cache traz artwork melhor, preservando img/frame existentes; cria img localmente quando só havia placeholder. Prioridade: custom/saved → core conhecido → principal do renderer → fallback. Intenção foi aplicada também a track rows, discografia e recommendations, sem prefetch de todos os resultados.

## Recommendations e cache

O vazio de releases vinha da ordem relatedAlbums → rádio e da exigência de albumCatalogId nas faixas de rádio. O artista, que tinha releases válidas, não era consultado.

Ordem atual, iniciada apenas quando a seção de descoberta começa:
1. relatedAlbums válidos, primeiro;
2. releases do artista em cache;
3. artist detail, compartilhado pelo cache/pending existente, se necessário;
4. albums derivados do rádio;
5. empty state.

Related e releases do artista são combinados, deduplicados por catalogId, excluem a release atual e têm limite 12. Single pode recomendar álbum, EP e Single, conservando albumType. O frontend mantém relatedAlbums conhecidos ao combinar a resolução do backend.

[] não entra no cache frontend de cinco minutos. Clique explícito usa force=true/force=1, bypassa recommendations cache e executa resolução novamente. Detail/core não é invalidado. Quando chega ao rádio, force também bypassa seu resultado cacheado. O IntersectionObserver inicial pode usar cache normalmente.

## Requests reais de Mado

No fluxo completo depois da correção:
- uma busca de Beachside talks;
- um browse de Beachside talks;
- um browse de Whale Net;
- um browse de Mado;
- core e enrichment frontend para cada identidade compartilham o browse backend;
- recommendations de Whale Net e Mado usam releases do artista já em cache;
- refresh de Mado realizou nova chamada `/api/music/recommendations?...&force=1`;
- nenhum rádio foi necessário para Whale Net/Mado;
- três browses adicionais de outras releases ocorreram por pointerenter durante o fluxo gravado; não houve prefetch em massa. O log completo identifica todas as chamadas.

## Validação e arquivos

47 testes Node passaram (core, catálogo, parser, editorial, releases, force/empty cache e Navigation). Browser checks passaram: music-navigation-polish-browser; music-first-paint-browser atualizado para gate zero; music-core-hydration-browser; music-ux-browser; title-detail-continuity-browser; music-pages-evolution-browser. O fluxo real before/after terminou sem pageerrors. git diff --check passou.

Produção alterada: dist/title-pages.js, title-pages.css, extras.js, catalog.js, catalog-discovery.js, music-page-ui.js; server.cjs; server/music-catalog.cjs, youtube-music.cjs e youtube-music-parser.cjs. Testes antigos foram ajustados apenas para navegação imediata e resolução lazy suplementar. Testes novos: music-release-polish.test.cjs, music-navigation-polish-browser.cjs, music-navigation-live-browser.cjs e inspect-release-live.cjs.

Artefatos locais:
- artifacts/music-navigation-live/before-real.mp4 e after-real.mp4: busca, clique frio, Back, hover/cache, album-context, artista, Whale Net quick add e Mado recommendation/refresh.
- artifacts/music-navigation-live/before-observed.json e after-observed.json: latências, draws, URLs de artwork, frontend e upstream requests.
- artifacts/music-navigation/measurements.json: primeiro repaint, hash síncrono e checks de identidade/coleção.
- artifacts/release-audit/: payloads públicos completos e observed.json.

A comparação de vídeo usa frontend do HEAD como “antes” e frontend atual como “depois”, ambos com backend atual, para isolar a UX sem bloquear o trecho Mado por recommendations vazias do backend anterior. O contador de draws de Thanatos vale dois porque a música foi aberta duas vezes; não indica redraw por hydration.
