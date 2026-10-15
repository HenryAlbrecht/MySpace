# Music Library Interoperability V1

Auditoria documental da working tree em 14/10/2026. Nenhuma funcionalidade de produção foi alterada.

## Diagnóstico

O MySpace já separa parcialmente a identidade musical da fonte de reprodução: a faixa pode ter identidade de catálogo/ISRC e uma fonte `youtube`, `audio` ou `local`. O arquivo local, porém, só é representado hoje por um `fileRef` que aponta para um Blob guardado pelo próprio app. Não há referência a caminho externo, índice de pastas, observação de mudanças ou estado de disponibilidade.

**Conclusão:** dá para reutilizar catálogo, Collection, playlists, contexto de playback, QueueManager e SPACEAMP. Para ler arquivos mantidos nas pastas originais, será necessária uma extensão pequena e explícita da identidade de fonte/arquivo e um owner de descoberta no futuro desktop. O QueueManager não precisa conhecer caminhos nem ser reescrito.

## Mapa do que existe

| Área | Existente e evidência | Uso ou limite para pastas externas |
|---|---|---|
| Catálogo e identidade | `dist/music/music-model.js`: IDs canônicos `ytmusic:video:*`, referências de catálogo, ISRC, `sameItem`, `recordingMatch`, `findRecording` e `sameReleaseTrack`. `docs/music/architecture.md`: YouTube Music é a identidade canônica; Last.fm é editorial. | Reutilizar a identidade de gravação e o matching conservador. `sameWork` é aproximação por título/artista e não deve identificar arquivo nem fundir gravações. |
| Collection | `dist/extras.js`: `myspace-extras-v1` em `localStorage`; `CollectionActions.saveMusic` mescla por ID, catalogId, fileRef/URL ou `MusicModel.findRecording`. | Continua sendo a biblioteca pessoal curada. Arquivos descobertos podem ser apresentados sem criar automaticamente um item pessoal; “adicionar à Collection” pode associar a fonte a um item existente. |
| Fontes musicais | `dist/music/music-model.js`: `playbackSource` aceita `local` + `fileRef`, `youtube` + `videoId`/URL e `audio` + URL. `dist/music/music-bridge.js`: `prepareTrack`, `resolve`, `play` e `enqueue` centralizam a preparação e delegam à playlist/SPACEAMP. | A fonte atual `local` não é um caminho: é uma chave opaca para o armazenamento interno. A identidade musical não deve ser substituída por caminho ou nome de arquivo. |
| Arquivos internos | `dist/media/media-storage.js`: IndexedDB `myspace-media`, object store `audio`, operações por chave (`put`, `get`, `remove`). Guarda Blobs de áudio e mídia/artwork referenciada; não possui API de diretório ou caminho. | É a persistência de arquivos gerenciados pelo navegador, não um índice da pasta original. Pode continuar atendendo uploads atuais e cache/artwork. |
| Playlists e fila | `dist/music/playlist.js`: playlists persistidas em `extras.playlists`, com cópias das faixas e referências `fileRef`; `playPlaylist` constrói um contexto. `dist/music/playback-context.js` descreve a sessão. `dist/music/queue-manager.js` mantém fila, posição, histórico, shuffle e repetição em memória. | Playlists podem manter uma referência opaca à faixa/fonte externa. Se ela sumir, a entrada deve continuar visível como indisponível/relinkável. Fila e contexto podem continuar sem persistir caminhos. |
| SPACEAMP | `dist/app.js`: player único; `SpaceAmpHost.setTrack` recebe faixa e URL de reprodução. `dist/music/playlist.js`: `sourceFor` resolve `fileRef` no MediaStorage e cria URL temporária de Blob antes de entregar ao player. | Um resolver desktop poderá fornecer a fonte tocável à integração existente. A resolução do arquivo deve ficar fora do QueueManager e não expor acesso irrestrito ao filesystem para a UI. |
| Tags e artwork locais | `dist/media/audio-tags.js` lê campos de título/artista e imagem embutida para ID3 e FLAC. Busca no código mostra que `readAudioTags` não é chamado pelo fluxo atual. Downloads podem gravar título, artista, álbum, álbum-artista, data e faixa; tentativa de artwork embutida é limitada por formato em `server/media/authorized-media-download.cjs`. | Há código reutilizável, mas a leitura é parcial e não está integrada à importação. Não há leitura de `cover.jpg` nem de tags de pasta/artista no fluxo de biblioteca. |
| Lyrics | `dist/music/lyrics-repository.js`: repositório IndexedDB próprio (`myspace-lyrics`) de TTML resolvido via lrc.red, associado a ISRC/identidade/snapshots. | Reutilizar como cache de letras online. Não lê sidecars `.lrc`/`.ttml`; suporte local futuro deve ser uma origem adicional, sem modificar o repositório ou sobrescrever arquivos. |
| Artwork e backups | `dist/xmb/xmb-artwork-storage.js` usa MediaStorage para artwork gerenciada. `dist/backup/media-package.js` empacota Blobs referenciados por Collection, playlists, destaque e perfil; restauração recupera os Blobs. | O backup atual leva mídia interna e referências do perfil, não pastas externas. Caminhos externos não devem ser tratados como arquivos pertencentes ao backup. |

## Fluxos atuais de arquivo

### Arquivo escolhido pelo usuário

1. `MusicSourceLink.link` apresenta um `<input type="file" accept="audio/*">`.
2. O arquivo selecionado é copiado como Blob para `MediaStorage` com um UUID `fileRef`.
3. `CollectionActions.saveMusic` associa esse `fileRef` ao registro musical selecionado, com `playbackSourceOrigin: "manual"`.
4. Na reprodução, `playlist.js` lê o Blob, cria uma URL temporária e usa o SPACEAMP existente.

O app não lê o arquivo original por caminho e não extrai tags nesse fluxo. Um helper de leitura parcial existe, mas não é integrado. Se a gravação na Collection falhar depois de `MediaStorage.put`, o handler atual não remove o Blob recém-criado; isso pode deixar dado sem referência no armazenamento. Registrado para uma etapa própria de integridade, sem correção nesta auditoria.

### Download offline

1. `MusicSourceLink.downloadOffline` pede ao backend um áudio de uma URL permitida e monta metadados a partir da faixa e, quando disponível, do álbum.
2. `server/media/authorized-media-download.cjs` baixa em diretório temporário, aplica tags via FFmpeg quando aplicável e tenta embutir capa em MP3/M4A/MP4/FLAC. Se a capa não puder ser embutida, a UI informa que ela continua na Collection.
3. `server.cjs` transmite o arquivo e remove o diretório temporário após a transferência. `dist/media/media-download.js` recebe os chunks como Blob.
4. O fluxo grava uma cópia gerenciada no IndexedDB e liga o novo `fileRef` à faixa da Collection. Também dispara uma cópia exportada para o navegador, que decide o local de download.

Portanto, há duas cópias após esse fluxo: o arquivo exportado, acessível fora do MySpace conforme a pasta de downloads do navegador, e o Blob interno usado para playback offline. A primeira não é vinculada por caminho ao app. Remover dados do site pode remover a cópia interna; não remove o arquivo exportado pelo navegador.

O backend aceita áudio em AAC, AIFF, FLAC, M4A, MP3, OGG/Opus e WAV, além de WebM em certos fluxos. A saída não preserva sempre o codec original: WebM vira MP3, MP3 é reencodificado em 320 kbps quando o remux de metadados roda, e AAC recebe contêiner/extensão M4A; outros remuxes usam cópia de streams. O seletor manual usa `audio/*`; a reprodução efetiva também depende dos codecs suportados pelo navegador. A função `readAudioTags` cobre ID3 e FLAC, apenas título, artista e artwork — não álbum, número da faixa ou ISRC.

### Identidade, origem e duplicação

- **Gravação:** catalogId canônico do YouTube Music e/ou ISRC. `recordingMatch` também oferece uma correspondência heurística única por título, artista, álbum e duração até 3 segundos, desde que marcadores de versão sejam compatíveis.
- **Arquivo gerenciado:** `fileRef` UUID/key do IndexedDB. O match exato local só é possível quando a mesma chave é preservada.
- **Origem:** tipo da fonte de playback (`youtube`, `audio`, `local`) e, em alguns fluxos, `playbackSourceOrigin` (`manual`/`catalog`).
- **Disponibilidade:** não há estado persistido “presente/ausente/temporariamente indisponível”. Se o Blob não for encontrado, a reprodução mostra que o arquivo não está disponível e oferece vínculo manual.
- **Duplicação:** salvar ou baixar pode mesclar com uma música existente pelos critérios acima, mas não existe fingerprint de conteúdo nem reconhecimento de arquivo reimportado. Título e artista isolados não são suficientes e não são usados pelo `recordingMatch`. Arquivos distintos da mesma gravação e versões diferentes precisam continuar identificáveis como arquivos distintos.

## Lacunas para biblioteca externa

1. Browser atual não oferece ao app um índice persistente de pastas selecionadas. A busca não encontrou uso de `showDirectoryPicker`, `webkitdirectory` ou `FileSystemHandle`.
2. `fileRef` só resolve Blob interno; não identifica arquivo em disco, pasta raiz ou caminho relativo.
3. Não há scanner, renovação de permissões, observador de pastas, detecção incremental de rename/move/delete, nem leitura de artwork externa.
4. A Collection persiste um único `playbackSource` por registro. Não representa várias cópias/fontes disponíveis ou seus estados independentemente.
5. Não há leitura local de sidecars LRC/TTML, nem integração da leitura parcial de tags ao fluxo de importação.
6. O matching por ISRC ou metadados relaciona gravações; não é prova de que dois arquivos físicos são o mesmo arquivo. ISRC ausente ou tags imprecisas deixam casos ambíguos.
7. A metadata da Collection/playlists é gravada como um JSON inteiro em `localStorage`; isso é adequado ao perfil atual, mas não é um índice de milhares de arquivos nem oferece atualização transacional/incremental para um scanner.

## Proposta mínima para desktop futuro

### Identidades e fontes

- Manter `catalogId`/ISRC e metadados como identidade da gravação. Não usar nome, caminho ou `fileRef` para substituir essa identidade.
- Manter o `fileRef` atual para Blobs que o próprio app guarda. No desktop, dar a cada arquivo externo um ID opaco por asset, separado da gravação; guardar caminho/localizador e estado apenas no índice local do desktop.
- Uma gravação pode relacionar-se a zero ou mais assets locais e a fontes online. A seleção de fonte para tocar continua sendo uma decisão da camada existente de preparação/playback; QueueManager recebe uma faixa preparada e não conhece filesystem.
- Um caminho absoluto não é identidade permanente. Para detectar mudanças, combinar ID opaco, raiz selecionada, caminho relativo, tamanho e data de modificação; usar fingerprint de conteúdo como auxílio de reconciliação quando necessário, sem confundi-lo com identidade musical.
- Correspondência automática forte apenas por identidade canônica/ISRC compatível ou fingerprint confiável. Metadados aproximados podem sugerir vínculo para confirmação, mas nunca fundir versões ou assets distintos silenciosamente.

Essa extensão é justificada: os contratos atuais distinguem gravação e fonte online/local gerenciada, mas não arquivo externo nem disponibilidade. É uma extensão estreita de fonte/asset, não uma nova identidade de catálogo. Projetar e aprovar esse contrato antes do scanner; não implementado nesta V1.

### Collection, playlists e playback

- Um índice de assets descobertos pode alimentar a navegação musical sem inserir cada arquivo automaticamente na Collection. A Collection permanece para itens salvos/favoritos e recebe apenas ações explícitas de adicionar ou vincular.
- Playlists persistem ID da gravação e/ou ID opaco do asset escolhido, nunca apenas um caminho. Ao remover/mover o arquivo, manter a faixa na playlist como indisponível e permitir relink; não apagar a organização pessoal.
- Arquivo externo nunca é movido, renomeado ou excluído pelo MySpace. Remover do índice remove só a referência do MySpace.
- SPACEAMP segue como player único. Resolver o asset autorizado no backend e fornecer uma fonte de playback compatível; manter QueueManager agnóstico de persistência, paths e filesystem.

### Tags, capas e letras

Precedência sugerida para apresentação, sem escrita automática: (1) edição explícita do usuário no MySpace; (2) tags e artwork embutidas no arquivo; (3) artwork lateral no diretório, como `cover.jpg`, e sidecar de letra com basename correspondente; (4) enriquecimento online apenas para preencher lacunas. Manter proveniência e não gravar tags/capas/lyrics no arquivo sem ação explícita.

Metadados lidos de arquivos devem ser locais por padrão. Online enrichment usa apenas título/artista/ISRC necessários à consulta, sem caminho ou nome de diretório. Lyrics Repository segue como está; futuramente, um resolvedor pode preferir sidecar local e cair para o repositório atual, sem modificar os documentos fonte.

### Persistência e limite de segurança

- Continuar usando IndexedDB no browser para blobs gerenciados pelo site; remover dados do site pode removê-los, como hoje.
- No desktop, SQLite é candidato para o índice de assets, estado de disponibilidade, raízes, tags normalizadas e busca/transações incrementais. Isso não implica substituir IndexedDB para cache ou mídia gerenciada.
- Manter as músicas externas nas pastas escolhidas. Backups do perfil devem exportar organização e IDs, não copiar nem publicar caminhos privados; oferecer separadamente backup opcional de blobs que o app gerencia.
- Tauri/Rust deve mostrar seletor de pasta, guardar apenas raízes autorizadas e expor operações específicas de listar/consultar/tocar/cancelar. Não entregar acesso arbitrário ao disco à UI.
- Solicitar cada raiz explicitamente; indexação local por padrão; sem execução de arquivos; sem seguir links simbólicos por padrão; tratar ciclos, permissões, volumes ausentes e cancelamento; diferenciar pasta desmontada de arquivo removido; nunca apagar/mover/renomear originais. Não enviar paths a providers.

## Roadmap revisto

1. **V2 — Contrato estreito de asset e fonte externa:** especificar ID opaco, múltiplas fontes/availability, relink e matching; preservar o player e a identidade musical. Necessário antes de scanner, pois `fileRef` atual só cobre IndexedDB.
2. **V3 — Descoberta desktop somente leitura:** escolha explícita de múltiplas raízes, leitura inicial de formatos/tags suportados e apresentação local; nenhum arquivo é copiado.
3. **V4 — Índice incremental:** mudanças, ausências, moves/renames, cancelamento e recuperação de raiz indisponível.
4. **V5 — Collection, playlists e playback:** ações explícitas de salvar/vincular, resolução da fonte disponível, estado/relink; QueueManager não precisa mudar se a faixa resolvida mantiver o formato de entrada atual.
5. **V6 — Interoperabilidade:** artwork lateral, sidecars LRC/TTML e precedência de metadados, sempre sem escrita automática.

## Referências principais

`docs/module-map.md`; `docs/contracts.md`; `docs/music/architecture.md`; `dist/music/music-model.js`; `dist/music/music-bridge.js`; `dist/music/playlist.js`; `dist/music/playback-context.js`; `dist/music/queue-manager.js`; `dist/music/music-source-link.js`; `dist/extras.js`; `dist/media/media-storage.js`; `dist/media/media-download.js`; `dist/media/audio-tags.js`; `dist/music/lyrics-repository.js`; `dist/xmb/xmb-artwork-storage.js`; `dist/backup/media-package.js`; `dist/backup/backup-restoration.js`; `server.cjs`; `server/media/authorized-media-download.cjs`.
