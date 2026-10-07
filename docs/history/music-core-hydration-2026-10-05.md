# Core musical e enriquecimento — 2026-10-05

Branch mudanca_search; working tree preservado, sem commit.

A resposta única de music-catalog.details retinha o ano resolvido no YouTube até terminar a cadeia de MusicBrainz, verificação lrc.red e Last.fm. Agora a mesma rota aceita phase=core: valida a identidade, lê a entidade YouTube/cache, resolve o ano pelo álbum associado quando necessário e retorna antes dos providers secundários. O fluxo completo permanece disponível para consumidores existentes.

Catalog.prefetchCore usa o detailCache e TTL existentes, com pending por kind/catalogId. Os resultados da busca principal e do editor iniciam prefetch apenas por pointerenter/focus. Clique navega imediatamente e a rota reutiliza a promise. Resultado já completo/cacheado também pode servir como core. Nenhum prefetch automático de todos os cards foi adicionado.

A TitlePage publica o core e só então pede enrichment. Last.fm inicia em paralelo à cadeia de identificadores, cujas dependências foram mantidas. O merge tardio permite somente campos editoriais/identificadores; ano, álbum, duração, capa e playbackSource continuam pertencendo ao core. A atualização mantém a capa decodificada, discovery e viewport; não envia comandos ao player. Enquanto falta core e ano, a linha de timing permanece reservada e vazia. Ano já conhecido aparece imediatamente.

Validação: 39 testes unitários; music-core-hydration-browser, music-ux-browser, title-detail-continuity-browser e navigation-smoke passaram. O teste controlado de dois providers com delay de 2s mediu core em 0,37ms e resposta completa em 2001ms (providers paralelos). Esses números medem fixtures, não a latência real do YouTube. Antes, o core não tinha resposta separada e aguardava os providers.

Browser: 20 resultados sem interação geram zero core requests. Focus + hover + clique pendente geram uma única chamada. Header reservado → 2015 · 3:48 antes do editorial de 2s; timing e identidade da imagem preservados após enrichment. Tracklists Grid, mobile sem overflow, Back/posição, inline play independente da coleção, fila e cache do contexto de álbum passaram no teste UX existente.

Artefatos em artifacts/music-core: pending.png, core.png, enriched.png e search-to-track.mp4. O vídeo grava o fluxo no navegador com screenshots contínuas e FFmpeg já instalado, usando respostas controladas. Não é uma gravação da conta/serviços reais do usuário.

Arquivos: server/music-catalog.cjs, server.cjs, dist/catalog.js, dist/title-pages.js, dist/editor-ui.js; testes music-core-hydration.test.cjs e music-core-hydration-browser.cjs.
