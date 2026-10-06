# Arquitetura musical atual

YouTube Music fornece busca, identidade `ytmusic:video/album/artist:…`, metadata CORE, artwork, discografia e identidade de playback. `server/youtube-music.cjs` consulta o catálogo; `server/music-catalog.cjs` coordena providers e recomendações, usando os módulos de ranking existentes. `dist/catalog.js` possui cache, tarefas e fases CORE/enrichment no navegador.

Last.fm fornece editorial, bio, tags, similaridade e sinais de discovery. Sugestões passam pela resolução canônica existente; não viram providers de identidade. MusicBrainz e lrc.red auxiliam identifiers e matching quando aplicável. Apple/iTunes e fotos Deezer permanecem nos caminhos de compatibilidade antigos, sem ser catálogo principal.

`dist/music-model.js` define identidade/matching; `dist/music-page-ui.js` fornece componentes e seleção musical compartilhada; `dist/title-pages.js` coordena rota/lifecycle e fases. `dist/music-bridge.js` conecta Collection ao único SPACEAMP; source link mantém lookup e vínculo manual legacy. Itens YouTube Music usam playback identity existente. Album, EP e Single usam `kind=album` com `albumType`.

`dist/spaceamp-now-playing.js` apresenta o estado do player, clock e comandos delegados. Lyrics usam adapter am-lyrics; `dist/spaceamp-atmosphere.js` continua independente. Não criar reprodução/armazenamento paralelo nem empobrecer CORE durante enrichment.

`dist/music-discovery-view.js` possui apresentação/reconciliação de recommendations, recebendo dependências explícitas; `dist/music-collection-matches.js` reconcilia gêneros em comum. `dist/spaceamp-visualizer.js` possui analyser/canvas e lê o clock do SPACEAMP existente. Não altera providers, requests, ranking ou matching.

Veja [contratos](../contracts.md), [mapa](../module-map.md) e [testes](../../tests/README.md). [Catálogo Apple anterior](apple-canonical-catalog.md) e [vínculo anterior](music-automatic-source.md) são históricos/legacy.

Artistas YouTube Music mantêm previews no CORE e handles transitórios em `artistSections`. No FULL, `music-catalog.cjs` inicia editorial e discografia em paralelo: o client consulta Albums e Singles & EPs pelos handles oficiais, segue continuations e combina releases por ID canônico. O parser possui renderers/metadata; o client possui requests, limites e cache/pending existente; Catalog e TitlePages propagam/reconciliam `topAlbums` sem remontar a seção. Songs/related possuem a mesma operação interna de seção, mantendo previews na UI; Videos conserva somente metadata. `Catalog.artistAlbums` continua legacy.
