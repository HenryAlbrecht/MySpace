# Vínculo de reprodução atual

O catálogo Apple identifica músicas, álbuns e artistas. Um registro de catálogo não é uma fonte de reprodução. O usuário pode vincular YouTube/YouTube Music, URL de áudio compatível ou arquivo local.

O endpoint local `/api/music/playback-source?title=…&artist=…` consulta relações de gravações no MusicBrainz, com cache e fila existentes. Não usa chave YouTube, scraping ou extração de áudio. Um vínculo ausente pode iniciar lookup após salvar; o diálogo também oferece busca explícita.

**Mesmo uma única sugestão exige confirmação:** selecionar/preencher e salvar. Não há vínculo automático silencioso. Nenhuma sugestão substitui um link manual, item removido ou título editado durante a consulta. A consulta não altera capa, metadata ou identidade Apple.

O matching valida título, artista e versão. Áudio direto e links YouTube compatíveis podem ser sugeridos; páginas de catálogo não viram áudio. Falha ou ausência de resultado mantém URL/arquivo manual disponível. Não se presume faixa completa a partir de prévia Apple.

O player mantém um único host de reprodução; dock e perfil são apresentações do mesmo estado. Lookup não cria outro áudio, fila, socket ou player.

Responsabilidades: `server/musicbrainz.cjs`, `server/music-catalog.cjs`, `dist/music-source-link.js` e fachada `dist/music-bridge.js`. Cobertura atual: `music-auto-source.test.cjs`, `playback-suggestions.test.cjs` e `organization.test.cjs`. Veja [testes](../../tests/README.md); [evolução anterior](../history/music-automatic-source-evolution.md) é histórica.
