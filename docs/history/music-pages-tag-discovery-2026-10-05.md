# Páginas musicais e descoberta por tags

Implementado na branch `mudanca_search`, a partir do working tree atual. Sem framework, novas dependências, segundo player ou alteração de lyrics/autoscroll.

## Arquivos e responsabilidades

- `dist/music-page-ui.js`: tracklists, duração opcional, links contextuais e tags. Recebe também o sanitizador que já existia em TitlePages, compartilhado sem duplicação.
- `dist/tag-page.js`: superfície independente `#tag/<nome>`, leitura editorial e resultados progressivos; não é um tipo de título e não oferece ações de coleção/favorito/status para a própria tag.
- `dist/title-pages.js`, `dist/interface.css`: hierarquia musical, metadados contextuais, músicas em linhas, álbuns em capas e artistas em fotos. O shell, tipografia, escala, personalização e controles existentes permanecem.
- `dist/index.html`, `dist/extras.js`, `dist/motion-design.js`: registro dos módulos e da rota; integração com a navegação e motion existentes.
- `dist/music-bridge.js`, `dist/playlist.js`, `dist/music-model.js`: operação de playlist na bridge existente, dedupe conservador, preservação da identidade e duração na conversão para a fila. `track.album` continua sendo artwork; o nome continua em `albumTitle`.
- `dist/collection.js`, `dist/extras.js`: quick add reutiliza validação, persistência e dedupe existentes. Dados de páginas como tracklists/related não são persistidos como parte do item.
- `server/youtube-music-parser.cjs`: banner landscape e contagem de inscritos do header de artista.
- `server/lastfm.cjs`, `server/music-catalog.cjs`, `server.cjs`: API de tags, resolução conservadora para YouTube Music e endpoint local.

## Banner de artista

São suportados `musicImmersiveHeaderRenderer`, `musicVisualHeaderRenderer`, `musicResponsiveHeaderRenderer` e `musicDetailHeaderRenderer`. Candidatos vêm de `background`, `thumbnail` e `foregroundThumbnail` do header; aceitam apenas URLs HTTPS dos CDNs já usados e dimensões conhecidas: largura mínima de 600 e proporção de pelo menos 1,5. Avatar quadrado, retrato, URL inválida ou dimensões ausentes não geram banner.

Prioridade: imagem manual do TitleBanner, banner válido do artista, nenhum banner. Álbuns e músicas não recebem banner automático; banners manuais existentes permanecem. Falha ao carregar um banner automático remove a área, sem impedir a página. A foto principal do artista continua com a seleção existente, mesmo quando coincide legitimamente com uma capa.

Oasis e Kinokoteikoku foram consultados no serviço real: ambos forneceram banner landscape e contagem de inscritos. Não se inventam origem, atividade ou outros dados biográficos.

## Tags e catálogo

Os valores continuam no campo legado `genres` para compatibilidade de coleção/backup, mas são tratados como tags: `seen live`, países e outros termos não são filtrados nem apresentados como gêneros obrigatoriamente. O enrichment continua na consulta editorial de detalhes do backend, com `genresSource: Last.fm`; não há uma segunda consulta de tags no frontend.

Links no header e na exploração abrem a página interna de tag. O Last.fm fornece `tag.getInfo`, `tag.getTopTracks`, `tag.getTopAlbums`, `tag.getTopArtists` e `tag.getSimilar`, usando o cache, dedupe de requests, fila e timeout existentes. Nome, seção e página são validados; nomes são codificados com URLSearchParams.

O texto aparece primeiro. Cada seção é carregada independentemente, em páginas de seis sugestões, com no máximo dois workers de resolução por seção. O frontend carrega as seções em sequência para limitar bursts; uma seção falha sem apagar as anteriores. Há carregar mais quando a API informa páginas adicionais. Tags relacionadas são links internos. Leitura longa reaproveita o sanitizador e o padrão de ler mais; tradução das páginas normais permanece, sem uma nova implementação de tradução para tags.

Last.fm → YouTube Music usa a mesma comparação conservadora de título/artista das recomendações existentes. Somente uma identidade canônica distinta e compatível é aceita. Matches ambíguos, falhas e resultados sem identidade confiável são omitidos; duplicatas por ID são removidas. Nenhum item Last.fm paralelo é criado. Modelos `sameItem`, `sameWork`, `recordingMatch` e `findRecording` continuam conservadores, incluindo versões diferentes.

Teste real de shoegaze: seis músicas, seis álbuns e cinco artistas resolvidos; um artista foi omitido por falta de correspondência única. Descrições/tags dependem da configuração e disponibilidade do Last.fm. Banner, relações, artwork e resultados disponíveis dependem do payload do YouTube Music.

## Páginas e ações

Artista: banner opcional, foto, inscritos quando fornecidos, tags navegáveis, biografia expansível, informações disponíveis, músicas populares como tracklist, discografia como grid e artistas relacionados como fotos. O filtro discreto de discografia continua sendo select, preservando ordenação, tipos e carregar mais.

Álbum: artista/ano no header, informações e faixas em linhas com índice, duração real quando conhecida e uma ação lateral para playlist. Descrição ausente fica compacta; clique na faixa abre música.

Música: artista/álbum navegáveis, ano/duração, tags, detalhes e reprodução em seção própria. Sugestões de músicas também usam linhas. Tocar/fila continuam na MusicBridge/SPACEAMP existentes e dependem de fonte reproduzível; preview mantém o rótulo explícito de prévia.

Quick add musical salva `planned`, progresso zero e nota nula pela CollectionActions. Clique repetido retorna o item existente e preserva nota, status, notas pessoais, capa e fonte local/manual. O editor completo continua disponível pelo botão de edição. Favoritar usa as regras existentes da coleção/vitrine.

Playlist tem estado próprio e usa MusicBridge.addToPlaylist; adicionar não salva na coleção. Dedupe usa identidade canônica, findRecording e identidade de fonte, preservando fontes mais fortes. A conversão mantém title, artist, albumTitle, artwork, catalogId, duração, playbackSource, metadataSources e ISRC. Enqueue também evita duplicar a mesma faixa ao tocar após adicioná-la. Nenhuma dessas operações de metadados/redraw chama pausa, stop ou seek.

Tracklists usam tokens de motion, foco de teclado e movimento horizontal discreto; reduced motion o remove. Ações ficam acessíveis por teclado/toque. No mobile o contexto secundário da faixa é ocultado, preservando título, duração e ação; não há overflow nas superfícies verificadas.

## Validação e revisão

- 78 testes unitários relevantes: catálogo, YouTube Music, parser/banner, tags, modelo, coleção, editorial, matcher, ISRC e SPACEAMP.
- Page smoke de boot/script order.
- HTTP: endpoint de tag, encoding e rejeição de tag/seção/página inválidas.
- Browser de evolução: banner e prioridade manual, artista sem banner/biografia/tags, biografia longa, álbum longo sem descrição e curto com descrição, durações ausentes, música com/sem reprodução/tags, quick add preservando dados pessoais, playlist independente/deduplicada, metadados sem reset de currentTime, rota de tags, links relacionados, tag inválida e falha parcial. Desktop 1280px e viewport 390px.
- Browsers existentes de catálogo YouTube Music, continuidade de detalhes/recomendações, playback/coleção e backup roundtrip. Backup ampliado para catalogId, duração, albumTitle e artwork de playlist.
- Testes antigos que exigiam fallback Apple ou resolução das recomendações para Apple foram atualizados porque esse contrato já havia mudado. A cobertura de identidade Apple/manual legada foi mantida.

Capturas em `artifacts/music-pages-evolution/`: artista/álbum/música/tag desktop e variantes mobile. As imagens dessas capturas são fixtures gráficas para isolar layout e falhas de rede; dados reais de banner e resolução de tag foram verificados separadamente. A revisão não equivale a reprodução audiovisual real no Zen. A pequena descontinuidade vertical das lyrics permanece fora desta rodada.
