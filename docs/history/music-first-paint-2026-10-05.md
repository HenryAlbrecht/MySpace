# First paint musical

Correção na branch mudanca_search, sem commit automático.

A duração conhecida era escondida pela condição `hydrating && !item.releaseDate`.
O timing agora combina todos os campos conhecidos e mantém a linha reservada quando ambos faltam.
O seletor global `[aria-busy="true"]` aplicava opacity .65 à TitlePage inteira.
Agora apenas `.discover-results[aria-busy="true"]` conserva esse feedback; aria-busy continua semântico na página musical.

TitlePages.open consulta peekCore e reutiliza prefetchCore/corePending. Aguarda até 400 ms antes de navegar: um limite intermediário no intervalo solicitado, suficiente para o core de 180 ms do teste abrir completo, sem esperar pelo atraso de 1,2 s. Cache pronto navega imediatamente. Timeout ou rejeição navegam com seed; o route compartilha o pedido pendente e o patch posterior acrescenta o ano. Novas intenções e mudanças de rota invalidam aberturas atrasadas.

patchMusicCore conserva os nós dt/dd já existentes, acrescenta lançamento na ordem correta e altera apenas valores diferentes. A guarda da capa exige uma imagem existente antes de ler seu dataset, inclusive em páginas sem artwork.

Validação:
- 42 testes unitários de core, catálogo, parser e páginas musicais passaram.
- navigation-smoke passou.
- music-first-paint-browser passou: clique rápido 241 ms, clique com cache 21 ms; um core por identidade; quatro combinações de timing; core de 1,2 s com gate de 400 ms; music/album/artist com opacity 1 e --bg/--panel/--panel2 estáveis; nós e scroll preservados; abertura obsoleta descartada.
- music-core-hydration-browser passou: 20 resultados sem prefetch em massa, hover/focus/open/route deduplicados, foco/scroll/artwork/player/currentTime preservados.
- music-ux-browser passou: Back, álbum/contexto/cache, tracklists, descoberta lazy, controles e mobile. Expectativa atualizada: core rápido permite seção de descoberta já montada ao entrar no álbum.
- music-first-paint-live-browser passou com catálogo público real: Thanatos → Back → hover/click → Time Lapse → Kinokoteikoku. requests.json registra um core para Thanatos, outro para uma faixa sob o ponteiro e um para artista. O álbum veio do cache/contexto. Vídeo em artifacts/music-first-paint/real-flow.mp4.

CORE/ENRICHMENT, relatedAlbums, recomendações e CSS Grid preservados. Medidas de tempo refletem esta execução local, não uma garantia de latência da rede.
