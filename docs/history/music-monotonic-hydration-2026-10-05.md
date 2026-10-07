# Patches musicais monotônicos e álbuns relacionados — 2026-10-05

Branch mudanca_search, working tree atual, sem commit.

## DOM e dados

O fluxo de música com seed válido antes fazia três drawDetail completos: seed, core e enrichment. Agora faz um: seed; patchMusicCore atualiza timing e detalhes e monta contexto/discovery somente quando faltam; patchMusicEnrichment atualiza gêneros, editorial, créditos e stats, sem reconstruir toolbar, title-layout, ações, capa, detalhes, contexto, tracklists ou discovery. Álbum/artista podem fazer um commit estrutural no core além do seed, mas enrichment é sempre local. Entradas sem seed útil ainda podem precisar do commit estrutural do core.

mergeRichest ignora valores ausentes/vazios e mantém informação válida anterior. O patch editorial também restringe os campos secundários; não sobrescreve ano, edição, capa ou reprodução. Capas salvas/personalizadas são preservadas. Páginas musicais com seed válido não têm bloco temporário “Carregando informações” no fluxo; usam aria-busy. Timing mantém a linha reservada até o core quando falta ano, e detalhes mostram dados reais do seed imediatamente. Animação só nas inserções locais, com reduced motion. Painéis dobráveis não são reconstruídos ao reordenar seções.

## Contexto e cache

music-catalog preserva o album browse usado para descobrir o ano em albumContext. O mesmo resultado fornece ano, trecho da tracklist e uma entrada core de álbum no detailCache existente. appendAlbumContext prioriza contexto do item, peekCore do álbum, albumContexts e só depois prefetchCore. Ano já conhecido não exige novo browse apenas para liberar o core; contexto que faltar chega como inserção localizada. albumContext/relatedAlbums são descartados por Collection.validateItem, mantendo os dados transitórios fora da coleção/backup.

Contagem correta: na comparação real o browse externo já era deduplicado pelo client: 1 antes e 1 depois. Foi removida a consulta HTTP adicional de contexto quando o core já traz o álbum. O teste controlado confirma zero chamadas adicionais de core de álbum para montar contexto e abrir o álbum; a consulta editorial posterior ainda pode existir, servida pelo browse cacheado. O teste com client real e payload fixture confirma um único browse em core musical → enrichment → abertura do álbum.

## Recomendações reais de hades

Consulta pública ao YouTube Music em 2026-10-05: ytmusic:album:MPREb_0Rj78e94lBV, hades (the nine stages of change at the deceased remains), my dead girlfriend, 2015, 10 faixas. Encontrado um musicCarouselShelfRenderer “Releases for you”, 10 cards e 10 álbuns válidos. O parser antigo ignorava esse carousel no branch album. O rádio da primeira faixa retornou 40 músicas, zero com albumCatalogId e zero outros álbuns identificáveis. Isso explica o empty state antigo.

parseBrowse(album) agora extrai relatedAlbums pela estrutura/endpoint e validação de browseRow, combinando carrosséis sem depender do idioma do heading; exclui seed, duplicados por ID e entidades que não são álbuns. Preserva nome, IDs, edição/ano, artista, imagens, tipo, URL e fonte. Backend prefere relatedAlbums; rádio só fica como fallback. Frontend usa relatedAlbums já carregados, mantendo a renderização lazy via IntersectionObserver; zero chamadas de recommendations de álbum quando há sugestões locais. Subtexto: “Álbuns relacionados no YouTube Music”.

## Evidência e testes

42 testes unitários passaram: fases core/enrichment, herança de ano/cache, carrosséis multilíngues/filtros, preferência sem rádio, browse único, remoção de contexto transitório da coleção e regressões musicais.

Browsers passaram: music-core-hydration-browser, music-ux-browser, music-pages-evolution-browser, title-detail-continuity-browser, navigation-smoke e music-monotonic-live-browser. Verificados identidade de layout/capa/detalhes/contexto/discovery, foco, scrollY, currentTime=37, mesma faixa, nenhum comando play/pause/load, 20 resultados sem prefetch massivo, foco/hover/clique deduplicados, Grid/mobile, custom cover, coleção/playlist e Back.

Comparação real te wo futte (手を振って), 3:48, álbum hades: title-layout observado 3 vezes antes e 1 depois; timing final 2015 · 3:48; contexto presente; browse externo=1 em cada execução. As gravações usam metadata e respostas reais, navegador isolado, sem tocar na conta/dados do usuário. O “antes” usa title-pages.js do HEAD anterior da branch com os demais arquivos atuais, para isolar a mudança de UI; não é uma gravação do computador/Zen do usuário. Arquivos em artifacts/music-monotonic: before-real.mp4, after-real.mp4, respectivos PNGs e observed.json, hades-related-real.png; payloads hades-browse.json/detail.json/radio.json.

Arquivos de produção: dist/title-pages.js, catalog.js, catalog-discovery.js, collection.js, interface.css; server/music-catalog.cjs, youtube-music.cjs, youtube-music-parser.cjs. Testes: music-core-hydration-browser.cjs, music-ux-browser.cjs, youtube-music-catalog.test.cjs e novo music-monotonic-live-browser.cjs. Sem novas dependências.
