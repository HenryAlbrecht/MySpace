# Contratos vigentes

O working tree define a implementação. [Arquitetura](architecture.md) e [mapa](module-map.md) localizam ownership; histórico registra estados anteriores.

## Owners e invariantes globais

| Estado/contrato | Owner e consumidores |
|---|---|
| Collection e gravação dos itens | `dist/extras.js` compõe CollectionActions; `dist/collection/collection.js` valida; views recebem ações e dados |
| Playback, volume e controles | SPACEAMP único criado em `dist/app.js`, modelo em `dist/spaceamp/spaceamp.js`; playlist e adapters existentes executam a reprodução |
| Busca/cache/CORE/enrichment | `dist/catalog.js`; respostas antigas não substituem rota/seleção atual; CORE não perde campos ricos |
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
| Apply/rollback de backup | `dist/backup-restoration.js` recebe persist/save; compositor possui confirmação e atualização pós-transação |

Views delegam ações ao owner. Nenhum módulo visual cria SPACEAMP, Audio, YT.Player, queue ou storage paralelo. Novas extrações usam callbacks explícitos, sem service locator. Cache/pending existentes mantêm escopo e limites; não adicionar requests/N+1.

Boot: Collection e Gallery não montam conteúdo pesado quando ocultas; primeira entrada renderiza o estado atual. Collection dirty acompanha mudanças de items e filtros; Gallery acompanha photos, sem persistir lifecycle. PARTY é criada uma vez na primeira entrada/deep link e reutilizada; sair mantém o hide/leave existente. Ordem de scripts e fachadas permanecem disponíveis. Assets GET/HEAD revalidam por ETag (`no-cache`); 304 e HEAD não leem/enviam o corpo do arquivo. APIs permanecem `no-store`.

## Collection, perfil e persistência

Profile extras: `profile-extras-view.js` lê dados por `getData` e solicita mutações pelos callbacks de `extras.js`, owner de save/persistência e arquivos locais. A view possui o único lifecycle dirty da Gallery; save invalida quando photos muda, entrada renderiza uma vez, retorno sem mudança reutiliza. Collection conserva seu próprio lifecycle. O editor compartilhado continua no compositor; URLs de vídeo e seus tokens são estado visual local, sem storage novo.

## Identidade e catálogo musical

Identidade musical pertence ao YouTube Music. `sameItem` e `sameWork` não são intercambiáveis; releases usam `kind=album` e `albumType=album/ep/single`. Itens Apple/Deezer antigos continuam compatíveis nos caminhos existentes. Não criar identidade alternativa durante enrichment.

Search YouTube Music: `parseSearch` preserva seu retorno array/limite de 40 entidades; `parseSearchPage` extrai items e continuation da página recebida. `/api/music/search?kind=music|album|artist&q=...&cursor=...` mantém provider/items e acrescenta next opaco (null no fim). O client usa uma operação oficial `/search` por página, com `{continuation}` nas seguintes; valida cursor não vazio, até 4.096 caracteres, sem controles ASCII (incluindo DEL), e rejeita input inválido com 400. Token seguinte inválido/repetido encerra. Cache/pending existente distingue kind/query/cursor, sem busca textual repetida, details por resultado ou fallback novo.

`Catalog.search()` continua Array da primeira página; `Catalog.searchPage()` é aditivo, compartilha o mesmo cache de páginas e retorna `{items,next}`. Só a Search Page principal pagina por intenção: até 10 páginas/400 itens por busca, com dedupe por catalogId e primeira ordem preservada. O estado agregado e tokens visitados pertencem à Search Page; respostas antigas são invalidadas pelo revision/AbortController/rota existentes. Append mantém cards/imagens, scroll/foco e agrupamento de artistas homônimos entre páginas. Erro de continuation preserva prefixo/cursor e permite retry, sem refazer a primeira busca. O editor e a busca de artista por música conhecida continuam first-page; Apple é explícito/legacy e retorna next null. Artwork de artistas mantém o trabalho existente por página, sem reenriquecer o agregado. Tracks de álbum conservam o limite atual de 200 e continuation permanece dívida separada. API caching global não mudou.

## Playback source e compatibilidade legacy

Lookup de playback usa YouTube Music primeiro. Resultado confiante retorna `matched`; ambiguidade retorna `choose` sem fonte automática. Fallback MusicBrainz confiante de YouTube também pode retornar `matched`; áudio direto permanece sujeito à escolha. Falha dos dois providers retorna `not-found` com `unavailable`, sem impedir vínculo manual. Fonte/identidade canônica e estado persistido permanecem distintos; testes não exigem vínculo manual para todo resultado confiante.

`MusicSourceLink.autoLink()` pode salvar automaticamente `playbackSource` de um registro importado/legacy sem fonte quando `matched` fornece YouTube válido. `choose` exige seleção e save; `not-found` não fabrica fonte. Vínculo manual posterior pode substituir a resolução automática. Item removido, fonte já vinculada, identidade/metadata alterada ou registro substituído durante o lookup invalidam o resultado; callbacks stale não sobrescrevem os dados atuais. A gravação usa CollectionActions e preserva identidade de catálogo, capa e metadata. Veja [resolução de fonte de reprodução](music/music-automatic-source.md).

## Artist UI e CORE/FULL

Artist UI: `dist/music/title-artist-view.js` recebe o item reconciliado por TitlePages, sem estado global de título/rota nem fetch CORE/FULL. `append`/`patch` mantêm seção/cards, filtro, sort, foco e scroll. O modelo mantém todos os releases; o DOM conserva lotes de 18 desktop/8 mobile, sem nodes/imagens para releases ainda não mostrados e sem rede no ver mais. Retry é callback do coordenador. Paginação legacy usa o Catalog existente; não há cache/provider/playback paralelo.

Completude de artista YouTube Music: `artistSections` e `discographyResolution` são metadata transitória, excluída da Collection. CORE conserva os previews; FULL combina Albums + Singles & EPs com os previews, por `catalogId`, preservando edições distintas e campos CORE. `albumType` vem do release individual; tipo desconhecido fica ausente, inclusive no shelf combinado. A UI mantém seção/cards existentes, filtro, ordenação, foco e scroll.

A operação interna de seção usa browseId/params ou continuation oficiais, sem busca/details por release. Limites: 10 páginas, 1.000 itens canônicos por seção, token/params de até 4.096 caracteres sem controles ASCII. Token repetido/inválido, teto ou falha tardia retornam prefixo parcial; falha inicial preserva previews no FULL. Resultados usam cache/pending existente (TTL padrão de 15 minutos, 80 entradas), inclusive prefixos parciais; force é explícito na operação interna, sem retry automático. Sem handle, a seção permanece preview. Songs/related não expandem a UI; Videos conserva somente metadata. Continuation de tracks de álbum continua fora do escopo.

## Navigation, foco e reconciliação

Reconciliação local mantém nós, scroll, foco, Back e seleção. Motion mantém tokens e reduced-motion; CSS mantém cascata. Fachadas públicas incluem Collection, CollectionActions, Catalog, TitlePages, MusicBridge, SPACEAMP, SpaceAmpNowPlaying e PARTY_ROOM. Ordem em `dist/index.html` também deve valer nos harnesses isolados.

Now Playing retorna o foco ao controle que o abriu. No XMB, o contexto salvo mantém categoria, seleção e scroll; um opener ainda conectado recebe foco de volta (item, botão de detalhes ou entrada Now Playing conforme o fluxo). Sem opener conectado, retorna à entrada/seleção existente. Não se exige `.xmb-play` para uma abertura pelo item. Relógio e metadata dinâmica podem mudar sem remontar a UI.

Handoff de artwork é temporário e possui revision: o reverse espera o src do destino XMB, sem exigir a mesma URL da capa Now Playing. O render que restaura contexto não invalida o reverse atual. Uma seleção nova, categoria, entrada/saída de detalhes ou saída XMB invalida a revisão e limpa clones/targets; callbacks antigos não alteram revisão nova. Readiness/decode possui limite de 2 s para nenhum clone permanecer no body indefinidamente.

Abrir Now Playing pelo Quick Menu captura contexto atual de retorno (seleção/scroll/foco) sem reutilizar cegamente handoffContext. Handoff visual XMB → Now Playing só usa artwork associada à faixa atual, validada pelo isCurrentSpaceAmpTrack existente e restrita à categoria Música. Seleção de outra música ou outra categoria limpa handoff pendente e abre a apresentação real do SPACEAMP sem clone; nowEntry sem origem coerente abre normalmente. O reverse aplica a mesma validação de faixa.

## SPACEAMP / Now Playing / lyrics

Lyrics mantém `autoscroll` e `interpolate` do am-lyrics, sem `line-motion`/`no-blur` impostos pelo shell. O adapter aplica o perfil visual no Shadow DOM: active/pre-active/inactive, blur e destaque sem transformar geometria horizontal; scroll continua upstream. Clock visual interpola amostras do player; precisão de seek/ack/pausa pertence ao harness dedicado. Reduced-motion mantém o contrato existente.

O owner Now Playing estende o mesmo `spaceamp-now-playing-preferences-v1` com videoEnabled/romanizationEnabled/translationEnabled (defaults false; campos antigos ou inválidos usam defaults). São preferências globais, sem estado por faixa. Vídeo é apresentado somente com fonte YouTube/iframe compatível; indisponibilidade usa artwork sem desligar videoEnabled, e a próxima fonte compatível retoma vídeo. Fechar/reabrir e reload preservam o desejado; iframe/host não são recriados ou reparentados.

O adapter de lyrics inicializa showRomanization/showTranslation antes de conectar o novo am-lyrics, aproveitando seu processamento inicial. No componente atual, os comandos async nativos executam mudanças e o adapter reconcilia o desejado vivo após cada operação; troca de componente invalida trabalho visual antigo. Toggles nativos via mouse/teclado atualizam o mesmo owner. Timestamp/offset conservam a âncora visual até o comando concluir e reencontram a linha atual após render, compensando somente o delta de scroll. Vendor, loading e autoscroll permanecem upstream; tradução usa o destino inglês do vendor. Menu lê metadata/progresso existentes; timer de apresentação de 400 ms apenas enquanto aberto relê o tempo real, sem clock paralelo. Trackchange não fecha/reabre o menu; promoção de top layer responde somente à promoção real do host de vídeo.

Now Playing mantém o mesmo stage montado, com geometria 1:1 para artwork e 16:9 para vídeo. Após preparo, a geometria transiciona com --motion-focus/--ease-xmb e o vídeo entra quando o frame atinge 16:9; sem lyrics, o frame se expande centralizado. A coluna de lyrics permanece montada e conserva scroll/cursor. Na saída, a geometria retorna após o fade do vídeo, com artwork por baixo. Reduced-motion troca geometria imediatamente. O host/iframe existente é promovido inicialmente transparente, posicionado e revelado após frames de preparo e saída do loading do owner. A artwork permanece sob o vídeo; saída usa fade curto com --motion-fast/--ease-xmb, imediato em reduced-motion. Revision, identidade do iframe e fechamento invalidam revelações antigas. Quick Menu conserva elemento focado (inclusive rail), seção e scroll na promoção; a supressão de animação permanece até a próxima abertura. Retorno XMB aceita foco de item salvo somente se ainda selecionado; focusin tardio de outra linha retorna à seleção lógica sem alterar categoria/scroll.

## XMB / Quick Menu / controller

Gamepad LEFT/RIGHT percorre controles horizontalmente sem wrap. A quick bar pertence à acessibilidade mouse/teclado e fica fora da malha principal do gamepad; UP/DOWN alterna transport/ranges; RIGHT só entra no pane disponível na borda direita de transport (Próxima) ou ranges (Volume), após navegar pelos controles internos. Ranges em ajuste conservam LEFT/RIGHT para alterar valor. Synced inicia na linha ativa; UP/DOWN só seleciona, primary ativa a linha nativa pelo `line-click` existente. Unsynced permite scroll manual sem seek. LEFT/B retorna ao controle anterior se conectado, visível e habilitado; caso hidden/inert/disabled, escolhe controle válido do player (ou o shell se nenhum existir). B no player fecha com a origem XMB preservada. Troca de componente descarta nodes antigos e reconcilia seleção. Loading/erro não impede navegação do player. Troca automática de faixa atualiza estado sem abrir Now Playing; abertura explícita pelo XMB continua válida.

DOM focus não é cursor de controle: `spaceamp-controller-selected` é marcado apenas pelo adapter de navigation, limpo em leave/reset/troca de componente e keyboard/pointer. Native focus-visible permanece upstream. O cursor pode ser suspenso pelo Quick Menu e restaurado para a origem lyrics; teclado/pointer não reintroduzem apresentação artificial.

Options abre o mesmo Quick Menu no XMB e no Now Playing (inclusive fora do XMB). Sem música, pode abrir Sistema quando existem ações reais; sem capacidades não abre menu vazio. B/Options fecha só o menu; origem XMB/player/lyrics conserva seleção/scroll/foco/surface. Abrir Now Playing fecha menu e usa a apresentação/handoff existente sem selecionar/reiniciar faixa. O menu lê estado vivo, chama playback/volume/navigation do SPACEAMP e preferencias do owner atual. LB/RB são `previous`/`next`, edge-trigger, consumidos no Now Playing ou menu; XMB normal não faz skip. Quick Menu/Now Playing nunca abrem por auto-next. Vídeo conserva iframe/host e usa top layer; o menu se promove após alterações de vídeo, sem recriar player.

Quick Menu tem rail explícito Música/Sistema: UP/DOWN escolhe seção, RIGHT/A entra nas linhas; LEFT em qualquer linha no estado normal retorna ao rail, que conserva a última linha válida por seção. Volume/enums entram em adjustment com A (ou RIGHT); somente nesse modo LEFT/RIGHT altera valor e A/B encerra sem fechar o menu. Booleanos alternam diretamente com A. Options fecha o menu; B no estado normal fecha uma camada. Abre em Play quando há música. Sistema recebe callbacks do owner XMB para fullscreen (estado da API nativa) e saída; saída fecha primeiro o menu. Fullscreen intencional não dispara Back/close do XMB; saída nativa de fullscreen com menu aberto fecha somente o menu. Nenhum registry ou estado persistido novo.

Triangle/tertiary faz um único play/pause no Now Playing, lyrics e menu, conservando superfície/foco; no XMB mantém página completa. Square/secondary no menu leva ao Volume em Música já em adjustment; A/B/Square encerra e conserva o foco nessa linha. No Now Playing abre ajuste do range Volume existente; LEFT/RIGHT ajusta e A/B/Square retorna à origem. Origem lyrics conserva seleção sem nodes antigos e suspende cursor/foco até retorno, inclusive com troca de componente. Quick bar continua fora da malha do gamepad.

O Quick Menu recebe origem explícita XMB/player/lyrics. XMB oferece apenas transporte/Volume/Abrir Now Playing e Sistema; player e lyrics oferecem as mesmas preferências de apresentação. Transliteração/Traduzir para inglês são ocultadas somente quando Letras está OFF, sem apagar o desejado. Loading/ausência de botões nativos não remove essas linhas nem altera foco/scroll. Desativar Letras limpa o cursor e retorna ao player ao fechar o menu.

## PARTY / ROOM / CALL

ROOM mantém sala, presença e chat; CALL possui lifecycle independente. Sair da CALL não implica sair da ROOM. `dist/spacevoice.js` compõe a UI; os módulos em `dist/voice/` possuem transporte e streams. Veja [arquitetura](architecture.md#party-e-voz) e [contrato de voz](../dist/voice/README.md).

## Aceite e limites

Aceite automatizado é [validate.ps1](../tests/validate.ps1); testes adicionais e limites estão em [tests/README.md](../tests/README.md). O fluxo de controller lyrics é certificado no handoff e no componente oficial, sem rede externa.
