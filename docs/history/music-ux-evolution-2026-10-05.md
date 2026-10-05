# Evolução visual e UX musical

Branch `mudanca_search`; working tree usado como base, sem commit automático.

## Implementação

- `TitlePages` usa `.has-title-banner` quando há banner válido. A capa invade discretamente a transição banner/header, com overlap responsivo menor no mobile. Fontes, prioridade manual, altura, zoom e posição continuam em `TitleBanner`. Música e álbum continuam sem banner/editor. O tratamento foi verificado em artista, IGDB, Steam e AniList.
- Biografia e informações reais do artista ficam lado a lado no desktop quando ambas existem; no mobile ficam empilhadas. Sem stats não há coluna vazia. `artist.getInfo`, já consultado, fornece listeners/playcount; enrichment mantém catalogId, artwork e banner YouTube. Atribuição editorial perto da bio usa “Dados: Last.fm”.
- Discografia tem botões todos/álbuns/EPs/singles com `aria-pressed` e ordenação independente recente/antigo/A–Z. Ordenação local não faz requests; datas desconhecidas ficam ao final. O carregamento de páginas continua reaplicando ambos os estados.
- Recomendações carregam automaticamente via IntersectionObserver com margem de 200px. O observer dispara uma vez e desconecta na navegação. O DOM existente continua reutilizado em redraw; ações posteriores são discretas e falhas permitem retry. Resultados anteriores ficam preservados em falhas parciais.
- `MusicBridge.play(item)` reutiliza resolve e o SPACEAMP atual. `canPlay` valida a fonte antes de mostrar play nas linhas. O botão ocupa o índice, tem aria-label e acesso por teclado; título abre detalhes e playlist é uma ação separada. Fonte manual/local salva tem prioridade. Reaproveitar vínculo antigo não cria collection implicitamente.
- Música com albumCatalogId busca `Catalog.details` em paralelo ao header. Cache compartilhado limitado a 30 álbuns evita repetir no redraw. A seção “em <álbum>” usa MusicPageUI, mostra cinco vizinhas e destaca a faixa por identidade exata ou correspondência forte única. Falha omite a seção sem afetar a música. Sem identificação, mostra primeiras faixas. O link final abre o álbum.
- Nomes: artistas similares, músicas populares, álbuns populares, artistas em destaque. Tags continuam textuais, sem banner. Fotos nos grids recebem ratio flexível com contain, sem crop destrutivo.

## Arquivos alterados

`dist/interface.css`, `dist/music-bridge.js`, `dist/music-page-ui.js`, `dist/tag-page.js`, `dist/title-pages.js`, `server/lastfm.cjs`, `server/music-catalog.cjs`, `tests/music-pages-evolution-browser.cjs`, `tests/title-detail-continuity-browser.cjs`, `tests/music-pages-evolution.test.cjs`, `tests/music-ux-browser.cjs` e este registro.

## Verificação

- Conjunto musical/catálogo/coleção/SPACEAMP: 82 testes aprovados, seguido de um teste adicional aprovado da bridge (83 no conjunto).
- Browser UX: overlap em artista/IGDB/Steam/AniList, bio/stats, combinações de filtro/sort, lazy load sem clique e reaproveitamento, teclado play, independência da collection, contexto/cache do álbum e largura mobile.
- Regressões aprovadas: evolução musical, continuidade dos detalhes, catálogo YouTube, reprodução/coleção, roundtrip de backup, smoke de boot e HTTP de tags.
- Screenshots: `artifacts/music-ux/artist-desktop.png`, `album-desktop.png`, `song-desktop.png`, `IGDB-desktop.png`, `Steam-desktop.png`, `anime-desktop.png`, `artist-mobile.png`, `album-mobile.png`, `music-mobile.png`; tags e estados vazios em `artifacts/music-pages-evolution`.
- Revisão visual feita em desktop 1280 e mobile 390. Arte de fixture é ilustrativa; os dados e serviços reais variam. Playback inline foi verificado na fronteira SPACEAMP; não houve reprodução real de stream YouTube nesta rodada. Não foi criado um indicador global de faixa tocando: o destaque implementado identifica a faixa da página dentro de seu álbum.
