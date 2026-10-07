# Resolução de fonte de reprodução

## Identidade e fonte

YouTube Music fornece o catálogo e a identidade musical vigentes. Identidade de catálogo e `playbackSource` são conceitos separados: resolver uma fonte não altera ID, capa ou metadata do registro. Itens YouTube Music usam a playback identity existente. Registros importados/legacy sem fonte podem executar lookup; isso não autoriza criar novas identidades Apple, Deezer ou Last.fm.

## Lookup e resolução automática

O endpoint local `/api/music/playback-source?title=…&artist=…` recebe também álbum/duração quando disponíveis. `server/music-catalog.cjs` consulta YouTube Music primeiro, valida o matching e usa MusicBrainz como fallback, com cache/pending e fila existentes. O matching considera título, artista e versão; páginas de catálogo não viram áudio.

`dist/music-source-link.js` possui `autoLink()` para registros salvos sem `playbackSource`:

- `matched` com fonte YouTube válida pode salvar `playbackSource` automaticamente por CollectionActions, sem confirmação no diálogo. O fallback MusicBrainz confiante de YouTube também pode produzir `matched`.
- `choose` mantém candidatos sem fonte automática. Selecionar um candidato preenche a URL; somente salvar vincula. Áudio direto permanece sujeito à escolha.
- `not-found` não fabrica fonte. Indisponibilidade mantém a possibilidade de vínculo manual; falha dos providers pode retornar `unavailable`.

## Vínculo manual e resultados stale

O diálogo oferece busca explícita e vínculo de YouTube/YouTube Music, URL de áudio compatível ou arquivo local. Um vínculo manual posterior pode substituir a resolução automática. Não se presume faixa completa a partir de prévia Apple legacy.

Lookup não sobrescreve fonte já vinculada, item removido nem dados alterados durante a consulta. Antes de aplicar o resultado, `autoLink()` verifica o registro atual, ausência de fonte, assinatura de identidade/metadata e referência esperada do item. Resultados/callbacks stale são descartados; limpar o status transitório obsoleto preserva os dados novos.

O player mantém um único host de reprodução; dock e perfil apresentam o mesmo SPACEAMP. Lookup não cria outro áudio, fila, socket ou player.

## Owners e validação focada

`dist/music-source-link.js` possui lookup e diálogo; `dist/music-bridge.js` mantém a fachada; CollectionActions possui as mutações. `server/music-catalog.cjs` coordena resolução YouTube Music/fallback; `server/musicbrainz.cjs` consulta relações de gravações.

Runner canônico: `node tests/music/music-playback-browser.cjs source`. Cenários individuais: `source:auto`, `source:manual`, `source:not-found` e `source:choose`. Veja [testes](../../tests/README.md); a [evolução anterior](../history/music-automatic-source-evolution.md) é histórica.
