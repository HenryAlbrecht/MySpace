# Contratos vigentes

O working tree define a implementação. [Arquitetura](architecture.md) e [mapa](module-map.md) localizam ownership; histórico registra estados anteriores.

## Owners e invariantes globais

| Estado/contrato | Owner e consumidores |
|---|---|
| Collection e gravação dos itens | `dist/extras.js` compõe CollectionActions; `dist/collection/collection.js` valida; views recebem ações e dados |
| Playback, fila e controles | SPACEAMP único criado em `dist/app.js`, modelo em `dist/spaceamp/spaceamp.js`; `dist/music/queue-manager.js` possui a fila transitória e `dist/music/playlist.js` conecta seus comandos ao player |
| Busca/cache/CORE/enrichment | `dist/catalog/catalog.js`; respostas antigas não substituem rota/seleção atual; CORE não perde campos ricos |
| TitlePage/rota/fases async | `dist/title/title-pages.js`; Navigation possui retorno, scroll e foco |
| Preferências de títulos | `dist/title/title-preferences.js`; capa escolhida ainda possui leitura/gravação direta legacy em TitlePages |
| Preferências de apresentação | Views existentes ainda gravam suas chaves; extrações não criam novas chaves/stores |
| Perfil/backup | `dist/app.js` e `dist/extras.js`; MediaStorage/MediaPackage possuem blobs; rollback e formatos permanecem |
| PARTY | ROOM mantém presença/chat; CALL possui ciclo independente; módulos voice possuem transporte e streams |
| Discovery musical local | `dist/music/music-discovery-view.js` mantém pool/visible/seen/rotation; Catalog mantém requests/cache; `dist/music/music-collection-matches.js` reconcilia gêneros sem persistir |
| Analyser/visualizer | `dist/spaceamp/spaceamp-visualizer.js` mantém context/bins/tap do áudio existente; shell possui lifecycle e chama a função visualizer |
| Quick Menu do sistema | `dist/xmb/xmb-quick-menu.js` possui shell, foco e comandos; Now Playing compõe a seção musical com getters/callbacks dos owners existentes; XMB fornece abertura com handoff e callbacks da seção Sistema |
| Controle do Now Playing | `dist/spaceamp/spaceamp-now-playing-input.js` coordena grupos/ranges e panes; `dist/spaceamp/spaceamp-lyrics-navigation.js` seleciona linhas nativas e scroll manual, sem playback/clock/providers |
| Perfil visual de lyrics | `dist/spaceamp/spaceamp-lyrics-profile.js` mantém paint/observers no Shadow DOM; shell fornece validade do componente e chama apply/clear, mantendo clock/seek/importação |
| Apply/rollback de backup | `dist/backup/backup-restoration.js` recebe persist/save; compositor possui confirmação e atualização pós-transação |

Views delegam ações ao owner. Nenhum módulo visual cria SPACEAMP, Audio, YT.Player, queue ou storage paralelo. Novas extrações usam callbacks explícitos, sem service locator. Cache/pending existentes mantêm escopo e limites; não adicionar requests/N+1.

PoC Tauri 2 usa a mesma interface e owners, com assets embutidos e sem servidor
Node obrigatório. Autorizações de pastas pertencem ao Rust (`folder_access.rs`),
persistidas no AppLocalData em `authorized-folders-v1.json`. Somente o diálogo
nativo de `authorize_folders(category)` pode criá-las. `list_folders` retorna IDs,
caminhos de exibição e estado; `revoke_folder(id)` e `discover_steam(id)` nunca
aceitam caminhos como autorização. Dados legados de localStorage não são migrados
para grants. DesktopFolders espelha o registro nativo sem persistir estado.
Revogação é atômica e serializada com descoberta por mutex/lock de arquivo;
após retornar, o ID não pode ser reutilizado. Indisponibilidade mantém o grant.
Identidade de volume/arquivo é conferida antes da leitura; substituição da pasta
exige nova seleção. Handles de diretórios/manifestos sem compartilhamento de
escrita/exclusão e recusa de reparse points impedem traversal/escapes no Windows.
Steam enumera somente steamapps e lê appmanifest_*.acf dentro da raiz autorizada
de Jogos, sem seguir outras bibliotecas, executar ou alterar arquivos. Grants
são separados por categoria; remover Jogos não revoga o grant distinto de Música.
Não integram Collection ou backup .myspace. `discover_music(id)` aceita apenas
grants de Música; percorre MP3/FLAC de forma limitada, com os mesmos guards de
diretório/arquivo e resultados transitórios no diagnóstico e na Biblioteca do
SPACEAMP. Playback local usa o mesmo SPACEAMP/QueueManager por intenção explícita,
sem mutar Collection, XMB, providers ou MediaStorage. Limites e estados parciais
estão documentados em `docs/desktop-tauri.md`; não há leitura por caminho IPC.

Offline Library Cache V1 usa uma chave versionada do localStorage isolado do
WebView Tauri, composta em `desktop-poc.js` e fora do boot web. Os owners salvam
metadata por ID de grant; nenhum caminho é incluído. O cache é apenas catálogo:
não cria grant, não participa da autorização de leitura/streaming e não habilita
launch. A lista nativa confirma quais grants permanecem; erro nessa lista mantém
o cache marcado indisponível, enquanto uma lista bem-sucedida remove grants
revogados. Erros de armazenamento não interrompem a descoberta nem a UI.

Desktop Music Library mantém a projeção em memória por grant e publica apenas
metadata na opção Músicas locais da Biblioteca existente (`playlist.js`). O Rust
fornece `file_id` (volume + índice do arquivo obtido do handle protegido); a UI
usa `desktop:music:file_id`, sem caminho ou playbackSource. Pastas sobrepostas e
hard links do mesmo arquivo resultam em uma faixa. Cópias distintas não são
deduplicadas por título; blobs já importados não têm essa identidade nativa e
continuam intactos nas playlists/Collection. O cache local Desktop guarda somente
metadata por grant; não altera playlists, Collection, backup ou arquivos de áudio.
Descoberta completa substitui o snapshot daquele grant e remove arquivos que
não foram encontrados; parcial mantém entradas anteriores não verificadas.
Falha/pasta indisponível conserva metadata da sessão; revogação
remove somente o snapshot do grant. Respostas stale/revogadas são descartadas.
No boot, o owner restaura metadata em estado não verificado antes de redescobrir
os grants sem seletor; grants indisponíveis ficam sinalizados e uma descoberta
completa atualiza o snapshot e remove arquivos confirmados como ausentes.
Timeout, erro ou descoberta parcial não apagam o cache anterior. Revogar um grant
remove somente sua contribuição. A versão web
não instancia nem lê esse cache.

Local Playback V1: MusicBridge reconhece apenas os IDs Desktop transitórios e
prepara metadata sem procurar homônimos/providers/Collection. A intenção na
Biblioteca inicia um contexto no QueueManager existente; `playlist.js` resolve
o áudio por `open_music(fileId)`, que só consulta o índice preenchido pela
descoberta Rust. Nenhum comando aceita caminho. Tickets UUID de sessão alimentam
o protocolo `myspace-music`, restrito à WebView main/origem local, sem servidor.
Cada leitura/check valida o grant persistido, identidade da raiz, ancestrais sem
reparse points e identidade do arquivo; handles ficam retidos durante a leitura.
Respostas Range individuais são limitadas a 1 MiB, sem blobs/IndexedDB/decodificação
em Rust. O elemento audio, controles e término de faixa continuam no SPACEAMP.
Troca/cancelamento fecha o ticket; checks sequenciais a cada ~1 s interrompem
também áudio já em buffer quando o arquivo some ou o acesso é revogado. O prazo
depende do agendamento da WebView e de operações nativas/disco em andamento.
Falhas são puladas na fila finita; uma faixa falha não é tentada repetidamente no
mesmo contexto. Nova intenção na Biblioteca permite tentar novamente. Essa fonte
Desktop não é um novo formato persistido: playlists/Collection/backup e fontes
locais importadas no MediaStorage continuam com os contratos anteriores.

Desktop Game Library projeta snapshots autorizados Steam no mesmo fluxo de jogos
do XMB, via callback `getGameItems` na composição da CollectionView. Não grava
na Collection, não cria provider ou visualização paralela. `Catalog.normalize`
fornece `steam:AppID`; duplicatas entre bibliotecas e itens salvos são reunidas
por essa identidade (incluindo metadataSources.catalogId). Itens salvos têm
prioridade e preservam ID, título, status, arte, ocultação e notas. Estado local
é metadata não enumerável e não integra spreads/JSON/backup. Descobertos sem
item salvo usam ID transitório determinístico `desktop:steam:AppID`.
Resultados completos substituem o snapshot; parciais/com erros preservam itens
anteriores como não verificados. Indisponibilidade conserva o snapshot da sessão
como indisponível; revogação descarta somente a projeção daquela autorização.
Respostas antigas/revogadas não repovoam o XMB. No boot Desktop, grants de Jogos
são redescobertos sem seletor; diagnósticos publicam mudanças e o XMB ativo
reconcilia seleção por identidade. O cache Offline Library V1 persiste somente
AppID, nome e estado por grant no armazenamento local do Desktop; é restaurado
como não verificado antes da descoberta. O cache nunca comprova autorização nem
habilita lançamento: somente a descoberta nativa atual pode fazê-lo. Falhas,
timeouts e resultados parciais mantêm os registros conhecidos; uma descoberta
completa substitui o snapshot. Revogação remove a contribuição daquele grant,
preservando itens personalizados da Collection. Não há artwork remota automática.

Game Launch V1 oferece ação nos detalhes dos jogos Steam com presença local
descoberta: mouse no botão, Enter/A nos detalhes; abrir a lista/detalhes por si
só não executa. Só o AppID segue ao comando nativo, sem caminhos/URLs/argumentos.
Rust exige vínculo prévio da descoberta com grant de Jogos, AppID u32 positivo
canônico, identidade persistida da raiz, manifesto `appmanifest_<id>.acf` válido
com mesmo AppID e installdir seguro, e diretório presente sem reparse points.
Registro/handles permanecem protegidos até a entrega ao Windows. Revogar antes
da validação impede delegação; revogar depois não desfaz um pedido já entregue.
`ShellExecuteExW` abre apenas a URI construída `steam://rungameid/<id>`, sem exe,
argumentos, shell genérico, `runas` ou elevação solicitada. Falhas de associação,
cliente ausente e erro do Windows são apresentados; pedidos aceitos têm cooldown
de 2 s por instância. Retorno aceito não comprova execução/licença/instalação
íntegra, e não alimenta Recently Played nem altera Collection/navegação. O Steam
controla login, atualizações e escolha da instalação. Web e jogos sem vínculo
local descoberto mantêm suas ações anteriores.
Select em item somente local pede salvar pela ficha antes da personalização;
qualquer salvamento explícito continua pertencendo a CollectionActions.
Storage do Desktop é separado do browser; transferência usa o pacote .myspace
existente, sem importação automática de perfis do navegador. Providers HTTP ainda
não migrados são uma limitação explícita, não ganham fallback para localhost.

Boot: Collection e Gallery não montam conteúdo pesado quando ocultas; primeira entrada renderiza o estado atual. Collection dirty acompanha mudanças de items e filtros; Gallery acompanha photos, sem persistir lifecycle. PARTY é criada uma vez na primeira entrada/deep link e reutilizada; sair mantém o hide/leave existente. Ordem de scripts e fachadas permanecem disponíveis. Assets GET/HEAD revalidam por ETag (`no-cache`); 304 e HEAD não leem/enviam o corpo do arquivo. APIs permanecem `no-store`.

## Collection, perfil e persistência

Profile extras: `profile/profile-extras-view.js` lê dados por `getData` e solicita mutações pelos callbacks de `extras.js`, owner de save/persistência e arquivos locais. `featuredMusic` é uma escolha persistente de personalização; o host do SPACEAMP apresenta a faixa ativa separadamente. Tocar uma faixa não altera o destaque nem a adiciona à Collection ou a playlists. A view possui o único lifecycle dirty da Gallery; save invalida quando photos muda, entrada renderiza uma vez, retorno sem mudança reutiliza. Collection conserva seu próprio lifecycle. O editor compartilhado continua no compositor; URLs de vídeo e seus tokens são estado visual local, sem storage novo.

`extras.js` persiste playlists atuais com IDs/ordem/fontes próprias e `featuredMusic`. Músicas locais referenciadas permanecem no MediaStorage. O backup atual inclui playlists, capas e `featuredMusic`; MediaPackage inclui os arquivos locais e capas personalizadas/escolhidas dessas estruturas. A fila efetiva do SPACEAMP é transitória e não é retomada no reload. Não há conversão automática de formatos antigos de playlist ou artwork.

## Identidade e catálogo musical

YouTube Music fornece a identidade canônica do catálogo musical atual. `sameItem` e `sameWork` não são intercambiáveis; releases usam `kind=album` e `albumType=album/ep/single`. Apple Music/iTunes e Deezer não são providers suportados, e seus IDs não são identidades válidas do catálogo atual. Não criar identidade alternativa durante enrichment.

Busca de áudio e linha de álbum com clipe podem ter IDs distintos. MusicModel.sameReleaseTrack associa somente o mesmo albumCatalogId, título/artista normalizados, duração até 3 segundos de diferença e versão/posição compatíveis. findAlbumTrack exige correspondência única; IDs canônicos permanecem intactos. FULL da faixa selecionada herda número/artista do álbum pelo cache/browse existente; search/CORE não fazem consulta por resultado. CollectionActions reutiliza a entrada compatível ao salvar/adicionar, preservando seu ID; cópias antigas não são apagadas automaticamente. Downloads e contexto do álbum usam a mesma associação.

Search YouTube Music: `parseSearch` preserva seu retorno array/limite de 40 entidades; `parseSearchPage` extrai items e continuation da página recebida. `/api/music/search?kind=music|album|artist&q=...&cursor=...` mantém provider/items e acrescenta next opaco (null no fim). O client usa uma operação oficial `/search` por página, com `{continuation}` nas seguintes; valida cursor não vazio, até 4.096 caracteres, sem controles ASCII (incluindo DEL), e rejeita input inválido com 400. Token seguinte inválido/repetido encerra. Cache/pending existente distingue kind/query/cursor, sem busca textual repetida, details por resultado ou fallback novo. No Tauri, somente uma busca iniciada pela UI usa `search_youtube_music`; o comando mantém a API key no Rust, aceita apenas music/album/artist e envia requests a `music.youtube.com` sem seguir redirects. A resposta usa o mesmo parser compartilhado, e `Catalog` mantém normalização, ordem e cache de páginas. A versão web continua no endpoint HTTP.

Artist/Album Pages no Tauri reutilizam o mesmo parser e `Catalog`: `browse_youtube_music` aceita somente os IDs canônicos `UC…`/`MPRE…`; `browse_youtube_music_artist_section` aceita somente Albums/Singles & EPs e handles/continuations limitados. CORE do browse preserva metadata e previews; FULL do artista combina as seções no mesmo `topAlbums`, preserva os previews em falha parcial e mantém os limites de 10 páginas/1.000 itens por seção. Browse de álbum expõe as faixas existentes, cujos `playbackSource` continuam no modelo canônico e podem ser tocados pelo SPACEAMP/QueueManager. Recomendações do Desktop são carregadas somente sob demanda: rádio consulta `/next` com ID de vídeo validado; artista/álbum consultam os detalhes pelos IDs `UC…`/`MPRE…` e reutilizam `parseRadio`/`parseBrowse` para conteúdo relacionado. `Catalog` mantém deduplicação, cache e apresentação; não há lookup textual de identidade. Last.fm segue disponível pelo endpoint web, mas não no Desktop: sua chave permanece no servidor e não é empacotada no app. A versão web mantém `/api/music/recommendations` e `/api/music/ytmusic/:kind/:id`.

`Catalog.search()` continua Array da primeira página; `Catalog.searchPage()` é aditivo, compartilha o mesmo cache de páginas e retorna `{items,next}`. Só a Search Page principal pagina por intenção: até 10 páginas/400 itens por busca, com dedupe por catalogId e primeira ordem preservada. O estado agregado e tokens visitados pertencem à Search Page; respostas antigas são invalidadas pelo revision/AbortController/rota existentes. Append mantém cards/imagens, scroll/foco e agrupamento de artistas homônimos entre páginas. Erro de continuation preserva prefixo/cursor e permite retry, sem refazer a primeira busca. O editor e a busca de artista por música conhecida continuam first-page. Artwork de artistas vem da resposta YouTube Music, sem enriquecimento por resultado. Tracks de álbum conservam o limite atual de 200 e continuation permanece dívida separada. API caching global não mudou.

## Playback source e vínculo

Busca e lookup de playback usam somente YouTube Music; Last.fm fornece editorial/tags/similaridade. Resultado confiante retorna `matched`; ambiguidade retorna `choose` sem fonte automática. Falha retorna `not-found` com `unavailable`, sem impedir vínculo manual e sem trocar de provider. MusicBrainz auxilia identificadores musicais. lrc.red é consultado pelo Lyrics Repository somente para documentos de letras e não resolve catálogo ou fontes de reprodução.

O parser classifica `mediaType=audio|video` usando o tipo oficial do endpoint, o label da linha, as dimensões fornecidas da miniatura e o byline com contagem de views/likes. URL `/vi/` ou dimensões ausentes não provam que uma faixa é clipe. Search musical e rádio excluem vídeos; `parseVideoSearch`/`searchVideos` mantêm resultados de vídeo separados para outros consumidores. Álbum conserva as linhas nativas, inclusive aquelas vinculadas a OMV, sem atribuir o clipe como áudio. CORE preserva a metadata do álbum; FULL da faixa selecionada busca uma versão ATV compatível, com cache/pending existente e sem lookup por faixa de uma lista. Identidade pedida, capa e edição permanecem estáveis; `playbackSource` pode ter um ID diferente do catálogo. O enriquecimento propaga fonte e tipo até os comandos da ficha. A rádio usa prioritariamente o ID do áudio resolvido.

Ao abrir um vínculo sem fonte, o diálogo consulta YouTube Music e preenche um `matched` sem gravar até salvar. Digitação, arquivo escolhido ou fechamento invalidam callbacks antigos. Fontes manuais usam `playbackSourceOrigin=manual`; a correção de um default antigo de OMV só substitui fonte ausente ou o próprio ID do catálogo, preservando vínculos manuais/locais. Cache de sessão musical usa a versão `myspace-catalog-session-v2` para não restaurar respostas do parser antigo.

`MusicSourceLink.autoLink()` pode salvar automaticamente `playbackSource` de um registro importado sem fonte quando `matched` fornece YouTube válido. `choose` exige seleção e save; `not-found` não fabrica fonte. Vínculo manual posterior pode substituir a resolução automática. Item removido, fonte já vinculada, identidade/metadata alterada ou registro substituído durante o lookup invalidam o resultado; callbacks stale não sobrescrevem os dados atuais. A gravação usa CollectionActions e preserva identidade de catálogo, capa e metadata. As ações de faixa sempre mostram download offline: fontes de áudio autorizadas baixam diretamente, arquivos locais são exportados, e outras fontes abrem o vínculo para informar uma URL autorizada. Veja [resolução de fonte de reprodução](music/music-automatic-source.md).

## Artist UI e CORE/FULL

Artist UI: `dist/music/title-artist-view.js` recebe o item reconciliado por TitlePages, sem estado global de título/rota nem fetch CORE/FULL. `append`/`patch` mantêm seção/cards, filtro, sort, foco e scroll. O modelo mantém todos os releases; o DOM conserva lotes de 18 desktop/8 mobile, sem nodes/imagens para releases ainda não mostrados e sem rede no ver mais. Retry é callback do coordenador. Paginação legacy usa o Catalog existente; não há cache/provider/playback paralelo.

Completude de artista YouTube Music: `artistSections` e `discographyResolution` são metadata transitória, excluída da Collection. CORE conserva os previews; FULL combina Albums + Singles & EPs com os previews, por `catalogId`, preservando edições distintas e campos CORE. `albumType` vem do release individual; tipo desconhecido fica ausente, inclusive no shelf combinado. A UI mantém seção/cards existentes, filtro, ordenação, foco e scroll.

A operação interna de seção usa browseId/params ou continuation oficiais, sem busca/details por release. Limites: 10 páginas, 1.000 itens canônicos por seção, token/params de até 4.096 caracteres sem controles ASCII. Token repetido/inválido, teto ou falha tardia retornam prefixo parcial; falha inicial preserva previews no FULL. Resultados usam cache/pending existente (TTL padrão de 15 minutos, 80 entradas), inclusive prefixos parciais; force é explícito na operação interna, sem retry automático. Sem handle, a seção permanece preview. Songs/related não expandem a UI; Videos conserva somente metadata. Continuation de tracks de álbum continua fora do escopo.

## Navigation, foco e reconciliação

Reconciliação local mantém nós, scroll, foco, Back e seleção. Motion mantém tokens e reduced-motion; CSS mantém cascata. Fachadas públicas incluem Collection, CollectionActions, Catalog, TitlePages, MusicBridge, SPACEAMP, SpaceAmpNowPlaying e PARTY_ROOM. Ordem em `dist/index.html` também deve valer nos harnesses isolados.

Now Playing retorna o foco ao controle que o abriu. No XMB, o contexto salvo mantém categoria, seleção e scroll; um opener ainda conectado recebe foco de volta (item, botão de detalhes ou entrada Now Playing conforme o fluxo). Sem opener conectado, retorna à entrada/seleção existente. Não se exige `.xmb-play` para uma abertura pelo item. Relógio e metadata dinâmica podem mudar sem remontar a UI.

Handoff de artwork é temporário e possui revision: o reverse espera o src do destino XMB, sem exigir a mesma URL da capa Now Playing. O render que restaura contexto não invalida o reverse atual. Uma seleção nova, categoria, entrada/saída de detalhes ou saída XMB invalida a revisão e limpa clones/targets; callbacks antigos não alteram revisão nova. Readiness/decode possui limite de 2 s para nenhum clone permanecer no body indefinidamente.

Abrir Now Playing pelo Quick Menu captura contexto atual de retorno (seleção/scroll/foco) sem reutilizar cegamente handoffContext. Handoff visual XMB → Now Playing só usa artwork associada à faixa atual, validada pelo isCurrentSpaceAmpTrack existente e restrita à categoria Música. Seleção de outra música ou outra categoria limpa handoff pendente e abre a apresentação real do SPACEAMP sem clone; nowEntry sem origem coerente abre normalmente. O reverse aplica a mesma validação de faixa.

O mini player do XMB permanece visível em qualquer categoria e nível de pastas enquanto há uma faixa atual disponível. Ele se oculta com o XMB fechado ou com a tela completa Now Playing aberta; a notificação Dash de nova faixa continua independente da visibilidade do mini player. Seta para cima continua a navegação da lista e não foca o mini player; o Quick Menu conserva o acesso ao player e às letras.

## SPACEAMP / Now Playing / lyrics

Lyrics mantém `autoscroll` e `interpolate` do am-lyrics, sem `line-motion`/`no-blur` impostos pelo shell. O vendor controla blur, hover, scroll e as transformações nativas de linhas, palavras e glifos; o adapter acrescenta apenas o destaque da seleção pelo controle XMB. Movimento animado pode alterar a caixa visual, mas não deve deslocar o layout horizontal. Clock visual interpola amostras do player; precisão de seek/ack/pausa pertence ao harness dedicado. `prefers-reduced-motion` continua removendo transformações e transições conforme o vendor.

`dist/music/lyrics-repository.js` é o owner da identificação, consulta ao lrc.red, validação TTML, matching, cache transitório, persistência local, deduplicação e cancelamento. Now Playing consulta somente quando está aberto e Letras está ligada; fechar, desligar Letras ou trocar a faixa aborta a busca, e respostas antigas não atualizam o renderer. O Repository consulta o banco IndexedDB `myspace-lyrics` antes da rede; um único registro por ISRC do lrc.red mantém TTML válido e até oito snapshots de identidade/metadata da faixa, permitindo reconhecer metadata enriquecida sem usar somente o título. ISRC é prioridade; a identidade canônica YouTube Music reutiliza o registro quando presente, e sem essas duas âncoras o fallback usa o `recordingMatch` vigente com título, artista, álbum, duração e marcadores de versão. Resultados ambíguos ou incompatíveis não são usados. Schema version 2 preserva os registros V1 e acrescenta índices de identidade, matching e ordenação por data; ISRC continua sendo a chave primária. O ledger de tamanho é reconstruído sem remover letras. Não há limite de quantidade ou expiração: o teto agregado é 64 MiB de JSON serializado em UTF-8 para todos os registros, incluindo TTML, snapshots e campos de índice. Ao ultrapassar o teto, o Repository remove os registros mais antigos por `storedAt` e ISRC como desempate; buscas e gravações comuns usam índices/ledger e não varrem o object store. A métrica é lógica e não representa o overhead físico do navegador. Quota real e políticas do navegador continuam variáveis; IndexedDB não garante permanência absoluta. Falhas de leitura/escrita/quota são ignoradas pelo Repository, que continua a busca online. Letras ficam fora do backup `.myspace` e do backup JSON nesta versão; a restauração de mídia não altera esse banco. A busca online usa ISRC diretamente em `/s/{ISRC}.ttml`; se indisponível, envia somente título, artista e, quando conhecidos, álbum e duração para `/match.json`. Matching rejeita gravações ambíguas e versões/álbuns/durações incompatíveis. Quando um resultado único contém apenas ISRC, o Repository verifica a metadata desse identificador em `/s/{ISRC}.json` antes do TTML. URLs de letras retornadas como conteúdo da resposta são ignoradas; destinos são construídos localmente no host HTTPS confiável. Cache em memória limita-se a 24 entradas/4 MiB, compartilha consultas pendentes com cancelamento por consumidor. Credenciais são omitidas e redirects recusados. O `am-lyrics` recebe `provided-content-only` antes de conectar e aguarda TTML explícito; portanto o fluxo MySpace não executa providers internos. Tradução e romanização continuam opcionais; quando habilitadas, enviam texto das letras a `translate.googleapis.com`.

O renderer vendorizado é o snapshot upstream 1.7.4 em `vendor/am-lyrics-1.7.4`, com dependências/build fixados pelo `pnpm-lock.yaml`; `pnpm build` recompila o bundle servido localmente. A opção pública `provided-content-only` impede pesquisas próprias enquanto o host aguarda e depois processa somente o `ttml` explícito. TTML vazio ou inválido deixa a faixa sem letras e não ativa providers internos. `provided-source` identifica `lrc.red` no renderer.

O owner Now Playing estende o mesmo `spaceamp-now-playing-preferences-v1` com videoEnabled/romanizationEnabled/translationEnabled (defaults false; campos antigos ou inválidos usam defaults). São preferências globais, sem estado por faixa. Vídeo é apresentado somente com fonte YouTube/iframe compatível; indisponibilidade usa artwork sem desligar videoEnabled, e a próxima fonte compatível retoma vídeo. Fechar/reabrir e reload preservam o desejado; iframe/host não são recriados ou reparentados.

O adapter de lyrics inicializa showRomanization/showTranslation antes de conectar o novo am-lyrics, aproveitando seu processamento inicial. No componente atual, os comandos async nativos executam mudanças e o adapter reconcilia o desejado vivo após cada operação; troca de componente invalida trabalho visual antigo. Toggles nativos via mouse/teclado atualizam o mesmo owner. Timestamp/offset conservam a âncora visual até o comando concluir e reencontram a linha atual após render, compensando somente o delta de scroll. Vendor, loading e autoscroll permanecem upstream; tradução usa o destino inglês do vendor. Menu lê metadata/progresso existentes; timer de apresentação de 400 ms apenas enquanto aberto relê o tempo real, sem clock paralelo. Trackchange não fecha/reabre o menu; promoção de top layer responde somente à promoção real do host de vídeo.

Now Playing mantém o mesmo stage montado, com geometria 1:1 para artwork e 16:9 para vídeo. Após preparo, a geometria transiciona com --motion-focus/--ease-xmb e o vídeo entra quando o frame atinge 16:9; sem lyrics, o frame se expande centralizado. A coluna de lyrics permanece montada e conserva scroll/cursor. Na saída, a geometria retorna após o fade do vídeo, com artwork por baixo. Reduced-motion troca geometria imediatamente. O host/iframe existente é promovido inicialmente transparente, posicionado e revelado após frames de preparo e saída do loading do owner. A artwork permanece sob o vídeo; saída usa fade curto com --motion-fast/--ease-xmb, imediato em reduced-motion. Revision, identidade do iframe e fechamento invalidam revelações antigas. Quick Menu conserva elemento focado (inclusive rail), seção e scroll na promoção; a supressão de animação permanece até a próxima abertura. Retorno XMB aceita foco de item salvo somente se ainda selecionado; focusin tardio de outra linha retorna à seleção lógica sem alterar categoria/scroll.

## XMB / Quick Menu / controller

XMB apresenta áreas Perfil, Jogos, Música, Vídeo, Leitura, Fotos e Outros sem mudar
`Collection.kinds` ou os filtros persistidos. Música contém Músicas/Álbuns/Artistas/Playlists;
Vídeo contém Filmes/Séries/Animes; Leitura contém Livros/Mangás. As demais áreas
abrem diretamente seus itens. Pastas são apresentação temporária, nunca registros.
Entrada pela Collection abre a área e pasta do kind atual. LEFT/RIGHT muda área;
UP/DOWN seleciona; Enter/A abre pasta ou executa a ação do tipo real; D/X abre
detalhes e O no teclado abre a página do item. Esc/B retorna detalhes → itens → pastas →
saída, omitindo pastas nas áreas diretas. Seleção e scroll são lembrados por pasta
durante a sessão; trocar área mostra sua raiz e conserva a pasta selecionada.
Now Playing e Quick Menu preservam área, pasta, nível, seleção, scroll e foco.
Select/S abre o editor visual dos jogos, músicas e álbuns persistidos na Collection.
`appearance.xmb.systemSoundsEnabled` controla os efeitos do XMB, PS Vita e
Quick Menu (padrão ligado). Aparência aplica o valor em `data-xmb-system-sounds`;
desligar interrompe vozes e loops pendentes/ativos sem pausar música nem trilhas
de destaque dos jogos. `SPACEAMP.systemSound(name)` delega efeitos curtos ao host
de áudio, sem alterar playback, fila ou volume musical. Samples usam ganho 0.7,
limite de dez vozes, debounce de cursor de 30 ms e buffers compartilhados.
Bolha/página/abrir/fechar Vita substituem o clique genérico. Dobra lenta é silenciosa;
média/rápida substituem o loop, nunca empilham; soltar/cancelar/fechar interrompe.
Avisos de música permanecem silenciosos. Sem gesto autorizado pelo navegador,
efeitos são descartados, sem fila de cliques para tocar depois.
Y no controle, V no teclado ou o botão PS Vita abre atalhos sobre o XMB. São referências a jogos da
Collection (`xmbVitaOrder`, inteiro não negativo), independentes de `xmbPinned`.
Remover um atalho mantém o jogo; a ordem só é gravada por CollectionActions.
A grade tem dez bolhas por página em linhas 3–4–3; LEFT/RIGHT fica na linha,
UP/DOWN mantém a posição horizontal proporcional e atravessa páginas sem wrap.
Select/S entra em edição; A move/adiciona e Select abre o editor do ícone.
B cancela movimento antes de sair da edição; só confirmar grava a nova ordem.
A na navegação abre LiveArea; confirmar novamente ou descolar o canto abre a
ficha existente do jogo pelo callback da Collection, sem launcher/emulador paralelo.
B na LiveArea volta às bolhas; B na grade retorna ao mesmo foco/scroll do XMB.
Y/V fecha o overlay; R3 também permanece como atalho. Options mantém o Quick Menu existente. Movimento reduzido
elimina as animações; fechamento invalida timers, pesquisas e vídeos da LiveArea.
As artes locais pertencem a `xmbArt`: `image` substitui a capa no XMB;
`albumImage` é a alternativa local quando não existe álbum salvo associado.
Com `albumCatalogId` associado a um álbum da Collection, editar a capa do álbum
grava no próprio álbum e suas faixas herdam essa arte. A capa específica da faixa
tem preferência. `background`/`backgroundVideo` da faixa prevalecem sobre o fundo
do álbum. Não alteram identidade, playback ou capas canônicas do catálogo.
CollectionActions continua responsável pelas gravações; MediaPackage inclui esses blobs.
As preferências `appearance.xmb.crtEnabled` e `dimEnabled` são independentes e
desligadas por padrão: CRT aplica linhas estáticas/vinheta somente ao fundo musical
e ao backdrop do editor; Dim usa a textura de fundo a 8%, com blur só no pop-up.
Não atingem o am-lyrics. `musicBackdropEnabled` e `musicWaveEnabled` ficam ligados
por padrão. Reprodução ativa leva fundo/capa da música pelo XMB, cedendo à arte de
jogo selecionado. Ao pausar, o fundo personalizado continua na área Música; fora
dela sai. Sem reprodução, a seleção musical define o fundo. Ondas usam vídeo
Multiply, somente durante reprodução e sem movimento reduzido; param ao ocultar
a página, abrir o player completo ou sair do XMB. Tudo deriva dos eventos/snapshots
do SPACEAMP, sem player, clock ou fila paralelos.
A pasta virtual Playlists lê os registros persistentes e suas capas pela fachada `MusicBridge.getPlaylists()`/`getPlaylistCover()` e inicia a sessão por `MusicBridge.playPlaylist()`; não adiciona `playlists` a `Collection.kinds`, filtros ou persistência da Collection. A ação principal em playlist com várias faixas abre a lista de faixas com a mesma transição lateral das pastas e mantém a faixa selecionada na posição vertical de foco ao navegar, sem iniciar playback; A na faixa escolhida chama `playPlaylist(playlistId, startIndex)` e abre Now Playing com contexto XMB preservado. Playlist com uma faixa pode iniciar diretamente. Esc/B retorna da seleção de faixa à playlist e depois às pastas. Somente itens music com fonte usam SPACEAMP como faixas; album/artist não são faixas. SPACEAMP também controla efeitos de foco curtos via `playCue`, sem alterar faixa, fila, estado Now Playing ou volume escolhido pelo usuário.

`PlaybackContext` (`dist/music/playback-context.js`) descreve a intenção musical e a ordem de faixas sem criar identidade nova. `QueueManager` (`dist/music/queue-manager.js`) controla a sessão ativa em memória: seleção, avanço/retorno, Reproduzir a seguir, append, remoção/reordenação, histórico, shuffle, repeat e invalidação de operações antigas. O histórico de navegação retém no máximo as 100 passagens mais recentes por sessão e preserva repetições como eventos distintos; o cursor shuffle mantém também a faixa atual para permitir ida/volta, sem alterar `cycleConsumed` ou o bag. Shuffle usa um bag transitório de chaves estáveis por entrada, sem embaralhar a ordem canônica: cada entrada pendente é consumida uma vez por ciclo; Repeat OFF encerra, Repeat ALL inicia outro ciclo evitando repetir imediatamente a faixa de fronteira quando há alternativas e Repeat ONE é aplicado pelo evento automático `ended`, sem bloquear Próxima manual. ANTERIORES em shuffle projeta o caminho real retido com cursor de retorno/avanço; sem shuffle continua projetando todas as faixas contextuais anteriores, sem limite artificial. A janela da fila mostra as cinco entradas mais recentes de ANTERIORES em ordem cronológica e expande para entradas anteriores em blocos de dez, sem renderizar as ocultas. A SEGUIR projeta prioridades, o caminho já percorrido e o bag ativo. Selecionar uma faixa anterior preserva a única entrada existente na sessão. `SPACEAMP.getState()` espelha fila, contexto e modos; essa sessão não edita playlists permanentes.

No perfil, o SPACEAMP mantém o player global único; Biblioteca e Fila abrem diálogos independentes controlados por `dist/music/playlist.js`. A Biblioteca administra playlists persistidas: inclui músicas da busca do YouTube Music ou da Collection sem criar itens na Collection, oferece busca cancelável/paginada e salva capas automáticas, personalizadas ou escolhidas de uma faixa. A capa escolhida permanece na playlist mesmo se a faixa fonte for removida. A Fila lê e altera somente o snapshot ativo do `QueueManager`. Abrir/fechar esses diálogos não inicia nem reinicia playback. A seção de música em destaque do perfil continua separada do estado “tocando agora”.

`MusicBridge.prepareTrack()` é a resolução central sob intenção de reprodução. `play()` e as ações de fila passam por ela; playlist, álbum, Descobrir, busca, Collection e XMB também a usam. Reutiliza fontes válidas e o cache/pending Catalog existente, sem fonte paralela. IDs internos das faixas salvas em playlist não são IDs da Collection; a invalidação stale só compara remoção quando o item resolvido era de fato uma entidade persistida na Collection. Um ID de clipe conhecido vinculado automaticamente não é considerado áudio resolvido. Fonte manual/local posterior prevalece e remoção durante lookup invalida o resultado.

Ouvir álbum cria um contexto com a edição e a ordem originais, inicia na faixa escolhida e resolve primeiro somente essa faixa. As seguintes são preparadas ao avançar, de forma progressiva e protegida por revisão/AbortSignal; a playlist salva não é alterada. O contexto de playlist usa um snapshot da ordem salva; busca, Descobrir e Collection usam apenas faixas music do conjunto coerente exibido. Uma sessão nova substitui a anterior. Faixas indisponíveis são puladas sem escolher uma versão arbitrária; fila finita termina conforme repeat.

Download de álbum é uma sequência transitória por URLs autorizadas, pula faixas locais, respeita intervalo configurado e Retry-After do servidor, e preserva downloads concluídos ao cancelar. Fechar interrompe a espera, cancela a faixa em andamento via AbortSignal e impede a próxima faixa. Não há retomada automática depois de fechar/recarregar.

MediaDownload é o owner comum do progresso/cancelamento de áudio e vídeo. `download()` aceita AbortSignal opcional no quinto argumento, envia downloadId aleatório e consulta `GET /api/xmb/media-download-progress?id=…` somente durante o processamento. O servidor mantém um único estado transitório associado à operação ativa; IDs desconhecidos retornam 404. Progresso da fonte vem do yt-dlp; preparação no FFmpeg é indeterminada; transferência usa Content-Length. Cancelamento aborta fetch, propaga a desconexão ao processo e remove temporários depois de seu encerramento, mantendo cooldown. AbortError não gera arquivo offline. Interfaces consumidoras não criam controles/processos paralelos; exportar arquivo já local delega ao gerenciador do navegador.

Gamepad LEFT/RIGHT percorre controles horizontalmente sem wrap. A quick bar pertence à acessibilidade mouse/teclado e fica fora da malha principal do gamepad; UP/DOWN alterna transport/ranges; RIGHT só entra no pane disponível na borda direita de transport (Próxima) ou ranges (Volume), após navegar pelos controles internos. Ranges em ajuste conservam LEFT/RIGHT para alterar valor. Synced inicia na linha ativa; UP/DOWN só seleciona, primary ativa a linha nativa pelo `line-click` existente. Unsynced permite scroll manual sem seek. LEFT/B retorna ao controle anterior se conectado, visível e habilitado; caso hidden/inert/disabled, escolhe controle válido do player (ou o shell se nenhum existir). B no player fecha com a origem XMB preservada. Troca de componente descarta nodes antigos e reconcilia seleção. Loading/erro não impede navegação do player. Troca automática de faixa atualiza estado sem abrir Now Playing; abertura explícita pelo XMB continua válida.

DOM focus não é cursor de controle: `spaceamp-controller-selected` é marcado apenas pelo adapter de navigation, limpo em leave/reset/troca de componente e keyboard/pointer. Native focus-visible permanece upstream. O cursor pode ser suspenso pelo Quick Menu e restaurado para a origem lyrics; teclado/pointer não reintroduzem apresentação artificial.

Options abre o mesmo Quick Menu no XMB e no Now Playing (inclusive fora do XMB). Sem música, pode abrir Sistema quando existem ações reais; sem capacidades não abre menu vazio. B/Options fecha só o menu; origem XMB/player/lyrics conserva seleção/scroll/foco/surface. Abrir Now Playing fecha menu e usa a apresentação/handoff existente sem selecionar/reiniciar faixa. O menu lê estado vivo, chama playback/volume/navigation do SPACEAMP e preferencias do owner atual. LB/RB são `previous`/`next`, edge-trigger, consumidos no Now Playing ou menu; XMB normal não faz skip. Quick Menu/Now Playing nunca abrem por auto-next. Vídeo conserva iframe/host e usa top layer; o menu se promove após alterações de vídeo, sem recriar player.

Quick Menu tem rail explícito Música/Sistema: UP/DOWN escolhe seção, RIGHT/A entra nas linhas; LEFT em qualquer linha no estado normal retorna ao rail, que conserva a última linha válida por seção. Volume/enums entram em adjustment com A (ou RIGHT); somente nesse modo LEFT/RIGHT altera valor e A/B encerra sem fechar o menu. Booleanos alternam diretamente com A. Options fecha o menu; B no estado normal fecha uma camada. Abre em Play quando há música. Sistema recebe callbacks do owner XMB para fullscreen (estado da API nativa) e saída; saída fecha primeiro o menu. Fullscreen intencional não dispara Back/close do XMB; saída nativa de fullscreen com menu aberto fecha somente o menu. Nenhum registry ou estado persistido novo.

Triangle/tertiary faz um único play/pause no Now Playing, lyrics e menu, conservando superfície/foco; no XMB mantém página completa. Square/secondary no menu leva ao Volume em Música já em adjustment; A/B/Square encerra e conserva o foco nessa linha. No Now Playing abre ajuste do range Volume existente; LEFT/RIGHT ajusta e A/B/Square retorna à origem. Origem lyrics conserva seleção sem nodes antigos e suspende cursor/foco até retorno, inclusive com troca de componente. Quick bar continua fora da malha do gamepad.

O Quick Menu recebe origem explícita XMB/player/lyrics. XMB oferece apenas transporte/Volume/Abrir Now Playing e Sistema; player e lyrics oferecem as mesmas preferências de apresentação. Transliteração/Traduzir para inglês são ocultadas somente quando Letras está OFF, sem apagar o desejado. Loading/ausência de botões nativos não remove essas linhas nem altera foco/scroll. Desativar Letras limpa o cursor e retorna ao player ao fechar o menu.

Select (botão 8 no mapeamento standard) ou S abre a personalização própria do XMB para o jogo selecionado; não abre o editor desktop. B/Círculo, Select/S, Backspace, Esc ou Options salvam e fecham usando CollectionActions.updateItem. As ações permitem editar título, fixar/desfixar na tela inicial do XMB pelo campo persistente `xmbPinned`, favoritar/desfavoritar no perfil pelo campo `featured` e Ocultar/Mostrar no XMB; ocultar mantém o jogo na Collection e o campo `xmbHidden` pode ser revertido pelo editor da Collection. O foco inicial fica em Fixar/Desfixar na tela inicial; RIGHT leva à prévia da capa. A prévia recebe foco sem entrar em reposicionamento: UP/DOWN continuam navegando e A/Enter ativa ou encerra o modo de reposicionamento. Nesse modo, setas visíveis sobre a capa ou o wallpaper indicam as direções e as setas do controle ajustam a posição da prévia focada; sair do foco encerra o modo. Nas ações de Bolha, Capa e Wallpaper, UP/DOWN mantém a mesma coluna entre linhas adjacentes; subir da primeira ação retorna à prévia do wallpaper. O campo opcional `xmbArt` guarda bubble/image/background, `backgroundVideo`, `idleVideo`, `idleVideoMuted`, `screenshots`, `focusAudio`, `focusAudioEnabled` e bias x/y entre -1 e 1 para a capa e `backgroundX`/`backgroundY` entre -1 e 1 para o wallpaper; a apresentação dos jogos começa em pílula horizontal, a capa sem posição salva alinha pela base e o wallpaper sem posição salva fica centralizado; sem imagem de bolha própria, a prévia da bolha usa a capa vertical (personalizada ou do catálogo) como padrão. No modo pílula, a capa vertical continua recortada pela moldura horizontal. O botão “Buscar” chama `/api/xmb/game-art?mode=choose` e abre uma grade de opções do SteamGridDB e do IGDB, com SteamGridDB primeiro; cada imagem mostra origem e título, as setas navegam, A/cruz aplica e B/círculo retorna ao editor. A rota sem `mode=choose` conserva a resposta com uma única imagem. A lista reúne imagens compatíveis com bolha, formato da capa ou wallpaper; capas pílula priorizam as dimensões 920×430 e 460×215 do SteamGridDB, e imagens equivalentes favorecem maior resolução. SteamGridDB usa `STEAMGRIDDB_API_KEY`; IGDB usa `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`; ScreenScraper não participa da busca manual. O botão principal do mapeamento standard (A no Xbox, cruz no PlayStation; índice 0) ativa o controle focado; X do Xbox (índice 2) não confirma a seleção de arte; no seletor de Som ao destacar, baixa a faixa focada quando disponível. Options conserva o Quick Menu. A aparência global herdada no XMB permanece full-bleed, sem o véu de transparência configurável antigo, em intensidade original, sem camada de escurecimento; `xmb.panelOpacity` legado é ignorado. `appearance.xmb.gameWallpaperTransitionEnabled` controla a transição dos wallpapers de itens (padrão ligado); com movimento habilitado, arte de jogo aguarda 1 s de foco estável e então cruza em 460 ms (ou aparece com entrada suave quando ainda não há wallpaper anterior), com zoom de 2,5%. Categorias não-jogo aguardam 500 ms. Trocar de área/categoria remove a arte anterior imediatamente, evitando que uma imagem de outra categoria apareça durante a espera. Desligar a preferência ou ativar reduced-motion troca a imagem sem atraso nem animação. A camada ambiente do wallpaper global permanece estável ao alternar entre itens com e sem wallpaper próprio. Mídias locais (imagem, áudio e vídeo) do editor XMB e wallpapers enviados em Aparência são armazenados como blobs no IndexedDB via MediaStorage; `xmbArt` guarda referências `xmb-art:` e `appearance.background` / `appearance.xmb.customBackground` guardam `appearance-art:` em vez de Base64. Os originais são preservados; imagens maiores ganham derivados de até 384 px para miniaturas, 1280 px para detalhes e 2560 px para wallpapers de tela cheia. Áudio e vídeo mantêm o original sem variantes. Dados Base64 de formatos abandonados não são migrados automaticamente; os fluxos atuais gravam blobs e referências pelo MediaStorage. Pacotes `.myspace` incluem originais e derivados; exportação JSON contém apenas as referências locais. Limites de quota do navegador continuam aplicáveis.

Na categoria Jogos, itens fixados aparecem como atalhos na raiz e Todos os jogos abre pastas por plataforma, sem duplicar registros da Collection. Jogos Steam ficam juntos em Steam; outros jogos de PC ficam em PC, e plataformas de emulação mantêm seus nomes. A pasta e a lista usam as transições, o foco e a restauração de posição dos demais níveis XMB; ao voltar da lista de jogos, a plataforma recém-aberta permanece selecionada. Recently Played exige um sinal real de execução e não é inferido da seleção nem da edição de metadata.

O modo `appearance.xmb.gameIdleMedia` define a mídia após 5 s de foco estável (padrão `video`): o vídeo local ou do YouTube aparece dentro da arte do jogo selecionado, mudo e em loop por padrão; `idleVideoMuted` permite ativar o áudio por jogo. Em `screenshots`, capturas adicionadas pelo usuário cruzam dentro da mesma arte a cada 4 s; nenhuma captura é feita automaticamente. `off` mantém a arte original. `xmbArt.focusAudio` toca uma vez após 1 s de foco estável e pode ser desligado por jogo com `focusAudioEnabled`; a reprodução usa `SPACEAMP.playCue` sem entrar na fila musical. Wallpaper geral, wallpaper próprio do XMB e wallpaper de jogo aceitam imagem ou vídeo; vídeos rodam mudos e em loop. O wallpaper geral segue o Xora em intensidade original, sem véu; camadas de arte mantêm a mesma ordem durante as transições para não variar o brilho ao navegar.

No editor XMB, `/api/xmb/game-media?type=audio` pesquisa trilhas do jogo no YouTube Music e `type=video` pesquisa diretamente o YouTube pelo endpoint first-party `youtube.com/youtubei/v1/search`, sem passar pelo IGDB nem pelo yt-dlp. O seletor aceita termos editáveis e retorna até 50 resultados por consulta, sem buscar ao abrir; sem busca explícita, áudio acrescenta “soundtrack” ao título do jogo. Resultados do YouTube são reproduzidos somente em iframes visíveis; trailers entram na arte do jogo após o tempo de espera. O yt-dlp não participa de buscas ou reprodução. Itens vindos do catálogo YouTube Music preservam `music.youtube.com` na URL de reprodução e mantêm a mesma identidade por `videoId`; o player oficial continua usando o iframe do YouTube. Para fontes que autorizem download, `POST /api/xmb/media-download` aceita apenas HTTPS em hosts exatos configurados em `YTDLP_ALLOWED_HOSTS` (separados por vírgula), bloqueia domínios do YouTube e limita arquivos a 200 MB. `YT_DLP_PATH` e `FFMPEG_PATH` podem apontar para os executáveis locais; sem hosts configurados, a rota permanece desativada. yt-dlp seleciona o melhor áudio disponível e prefere vídeo até 1080p. FFmpeg grava título, artista, artista do álbum, número da faixa e data fornecidos pelo catálogo, sem copiar tags de gênero/editoriais. Áudio WebM e MP3 são codificados em MP3 CBR 320 kbps; outros formatos mantêm seus streams por cópia, sem recodificar. Para música, tenta embutir a capa do álbum nos formatos compatíveis; a capa enviada pelo app é limitada a 768 KB. Metadados existentes na fonte são preservados, e a arte permanece na coleção MySpace mesmo quando o contêiner não aceita capa embutida. A qualidade depende do arquivo oferecido pela fonte, e o limite de download continua em 200 MB. A rota serializa downloads no processo local e aplica o intervalo configurado no perfil XMB (padrão de 60 segundos, entre 60 e 3600), contado após cada tentativa. No vínculo de reprodução musical, URL autorizada pode ser baixada e salva como `playbackSource.type=local` pelo `MediaStorage`; busca e reprodução YouTube continuam online. Música local usa o mesmo SPACEAMP. No XMB, o editor usa arquivos locais e busca; as URLs autorizadas não são mais inseridas manualmente. Nos seletores de Som ao destacar e Trailer/vídeo em espera, Quadrado no PlayStation / X no Xbox baixa o resultado focado quando o download é permitido; os cards não exibem botões de download. Mídia XMB baixada ou escolhida localmente usa IndexedDB pelo fluxo já existente; a quota do navegador continua aplicável.

A busca de wallpaper do SteamGridDB consulta heróis, prioriza a maior área em pixels e usa 16:9 como critério de desempate, reduzindo ampliação de imagens pequenas sem distorcer o fundo.

Nas listas diretas, o predecessor aparece acima da categoria sem duplicação; os sucessores ficam abaixo do foco quando cabem inteiros antes do rodapé. A composição acompanha o eixo da categoria selecionada e se aplica às demais áreas raiz; navegar revela os próximos itens. Pastas conservam sua geometria e rolagem.

## PARTY / ROOM / CALL

ROOM mantém sala, presença e chat; CALL possui lifecycle independente. Sair da CALL não implica sair da ROOM. `dist/party/spacevoice.js` compõe a UI; os módulos em `dist/voice/` possuem transporte e streams. Veja [arquitetura](architecture.md#party-e-voz) e [contrato de voz](../dist/voice/README.md).

## Aceite e limites

Aceite automatizado é [validate.ps1](../tests/validate.ps1); testes adicionais e limites estão em [tests/README.md](../tests/README.md). O fluxo de controller lyrics é certificado no handoff e no componente oficial, sem rede externa.

Local Artwork Desktop usa o mesmo índice autorizado e protocolo do playback, com
URLs transitórias por file_id/revision. Capas JPEG/PNG embutidas têm prioridade
sobre cover/folder no diretório da faixa. Validação limitada no Rust + decode do
Artwork existente, cache limitado de sessão e revalidação de autorização inclusive
em cache hits; refresh/revogação invalidam o cache. Biblioteca e Now Playing usam
os campos de artwork existentes, sem persistir imagens ou consultar providers.
Limites e comportamento de refresh: docs/desktop-tauri.md, Local Artwork V1.

Jogos Steam somente descobertos podem abrir o editor XMB existente por S/Select
ou botão direito. Abrir/fechar sem mudanças não persiste; uma personalização
explícita salva apenas esse jogo por CollectionActions.customizeSteamGame, com
steam:AppID e dedupe pelo vínculo Steam já salvo. A seleção passa ao ID pessoal.
Dados personalizados continuam prioritários sobre discovery, e revogar o grant
não remove o item pessoal nem autoriza lançamento. Upload de capa reutiliza
MediaStorage/XmbArtworkStorage. Não há importação automática ou busca de capas.

Steam Artwork V1: image transitória por AppID usa o cache local via protocolo
nativo já existente e Artwork do XMB; xmbArt/arte pessoal têm prioridade absoluta.
Categoria steam-artwork é autorizada somente pelo picker, separada de Jogos/Música;
nenhum caminho do frontend autoriza leitura. Um grant de Jogos pode fornecer apenas
appcache/librarycache dentro de sua própria raiz. Não há subida de diretórios ou
buscas externas. Grants de Jogos e cache são revalidados inclusive em cache hit.
Revogação não apaga edição/Collection. Limites, formatos e compatibilidade do registro:
docs/desktop-tauri.md, Steam Artwork V1. Web conserva os renderers/fontes anteriores.

Wallpaper Steam offline usa desktopLocal.background transitório e rota nativa
com sufixo -background para headers locais. xmbArt.background pessoal tem prioridade;
a capa/bolha e os dados salvos não são alterados. A prévia e o fundo XMB usam a
mesma alternativa; ausência/revogação do header retorna ao fundo global.
