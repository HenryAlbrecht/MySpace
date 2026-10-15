# Resolução de fonte de reprodução

## Identidade e fonte

YouTube Music fornece o catálogo e a identidade musical vigentes. Identidade de catálogo e `playbackSource` são conceitos separados: resolver uma fonte não altera ID, capa ou metadata do registro. Itens YouTube Music usam a playback identity existente. Registros importados sem fonte podem executar lookup; isso não autoriza criar identidades de catálogo de outros providers.

## Lookup e resolução automática

O endpoint local `/api/music/playback-source?title=…&artist=…` recebe também álbum/duração quando disponíveis. `server/music/music-catalog.cjs` consulta somente YouTube Music e valida título, artista, versão, álbum e duração, usando o cache/pending existente. Falhas não trocam de provider; páginas de catálogo não viram áudio.

`dist/music/music-source-link.js` possui `autoLink()` para registros salvos sem `playbackSource`:

- `matched` com fonte YouTube válida pode salvar `playbackSource` automaticamente por CollectionActions, sem confirmação no diálogo.
- `choose` mantém candidatos sem fonte automática. Selecionar um candidato preenche a URL; somente salvar vincula. Áudio direto permanece sujeito à escolha.
- `not-found` não fabrica fonte. Indisponibilidade mantém a possibilidade de vínculo manual; falha dos providers pode retornar `unavailable`.

## Vínculo manual e resultados stale

O diálogo oferece busca explícita e vínculo de YouTube/YouTube Music, URL de áudio compatível ou arquivo local. Ao abrir sem fonte, consulta o catálogo e preenche um resultado confiante sem gravar até salvar. Digitação, escolha de arquivo e fechamento invalidam a resposta antiga. Um vínculo manual posterior usa `playbackSourceOrigin=manual` e pode substituir a resolução automática.

Faixas de álbum podem chegar com ID de clipe OMV mesmo exibindo a metadata da música. O parser conserva `mediaType=video` e não fabrica uma fonte de áudio para esse ID. No FULL da faixa selecionada, o client busca uma versão ATV compatível e entrega a fonte separadamente, preservando identidade/edição/capa. Busca e rádio de músicas excluem clipes; a rádio usa prioritariamente o ID da fonte de áudio resolvida. MusicBridge pode corrigir um default igual ao ID OMV do catálogo, mas mantém fontes manuais e locais.

Lookup não sobrescreve fonte já vinculada, item removido nem dados alterados durante a consulta. Antes de aplicar o resultado, `autoLink()` verifica o registro atual, ausência de fonte, assinatura de identidade/metadata e referência esperada do item. Resultados/callbacks stale são descartados; limpar o status transitório obsoleto preserva os dados novos.

O player mantém um único host de reprodução; dock e perfil apresentam o mesmo SPACEAMP. Lookup não cria outro áudio, fila, socket ou player.

## Owners e validação focada

`dist/music/music-source-link.js` possui lookup e diálogo; `dist/music/music-bridge.js` mantém a fachada; CollectionActions possui as mutações. `server/music/music-catalog.cjs` coordena YouTube Music/Last.fm; `server/music/youtube-music.cjs` resolve a fonte de áudio da faixa selecionada. MusicBrainz/lrc.red permanecem somente auxiliares de identificadores para lyrics.

Runner canônico: `node tests/music/music-playback-browser.cjs source`. Cenários individuais: `source:auto`, `source:manual`, `source:not-found` e `source:choose`. Veja [testes](../../tests/README.md); a [evolução anterior](../history/music-automatic-source-evolution.md) é histórica.
