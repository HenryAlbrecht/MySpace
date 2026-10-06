# Segunda rodada de polimento musical

Implementação na branch existente, sem commit e sem substituir o design aprovado.

## Regras

- `server/lastfm.cjs`: helper editorial compartilhado por bio de artista, wiki de faixa/álbum e wiki de tag. Remove apenas o rodapé final “Read more on Last.fm”, em texto ou link, com parágrafo opcional. Mantém texto real e ocorrências no meio do conteúdo.
- `dist/title-pages.js`: páginas musicais só renderizam biografia/sobre quando o resumo convertido em texto tem conteúdo. Ausência e indisponibilidade não criam bloco editorial. Outras mídias mantêm o comportamento anterior. Tradução e atribuição continuam quando há texto real.
- Informações do artista não incluem fonte isolada nem atribuição editorial duplicada. A seção só entra quando existem dados úteis, como lançamento, duração, ouvintes ou reproduções. Relações e metadados de música/álbum continuam.
- Artista mantém banner automático e prioridade do manual. Música e álbum não renderizam nenhum banner nem editor, sem remover preferências antigas do armazenamento. Outras mídias mantêm suporte.
- `dist/title-banner.js`: altura do artista e da prévia é 80% do valor configurado (padrão 300 → 240 px), preservando valor armazenado, zoom, posição e limite responsivo. Jogos e outras mídias não recebem essa redução.
- `dist/tag-page.js`: tags relacionadas apenas no final, deduplicadas, sem seção quando vazias ou indisponíveis. Cards de artistas não repetem nome como subtítulo; contagem de inscritos pode aparecer quando presente. Álbuns continuam mostrando artista.
- Gêneros de álbum/música continuam links para `#tag/...`; ausência não cria placeholders. Mensagem parcial de recomendações usa “catálogo”, sem atribuir falha à Apple. Caminhos legados iTunes/Deezer mantidos.

## Validação

- 79 testes unitários da suíte musical/coleção/catálogo/SPACEAMP passaram; depois foi acrescentado e aprovado mais um teste de altura de banner (80 casos no conjunto).
- Smoke de inicialização e teste HTTP de tags passaram.
- Browser: evolução musical, continuidade dos detalhes, catálogo YouTube e reprodução/coleção passaram. Cobertura inclui banner manual de álbum armazenado mas oculto, resumo ausente, artista sem informações úteis, links de gênero, related tags únicas/vazias, cards e áudio mantendo 37 segundos sem comandos play/pause/load.
- Screenshots geradas em `artifacts/music-pages-evolution`, desktop 1280 e mobile 390. Revisão visual de artista com biografia/banner, álbum mobile e tag mobile: estrutura e densidade preservadas, sem overflow horizontal.
- Fixtures controladas foram usadas para layout e falhas parciais. Reprodução real do YouTube e disponibilidade atual dos serviços externos não foram exercitadas nesta rodada.

## Arquivos

`server/lastfm.cjs`, `dist/title-pages.js`, `dist/title-banner.js`, `dist/tag-page.js`, `tests/music-pages-evolution.test.cjs`, `tests/music-pages-evolution-browser.cjs` e este registro.
