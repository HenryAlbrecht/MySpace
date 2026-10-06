# Contratos vigentes

O working tree define a implementação. [Arquitetura](architecture.md) e [mapa](module-map.md) localizam ownership; histórico registra estados anteriores.

| Estado/contrato | Owner e consumidores |
|---|---|
| Collection e gravação dos itens | `dist/extras.js` compõe CollectionActions; `dist/collection.js` valida; views recebem ações e dados |
| Playback, volume e controles | SPACEAMP único criado em `dist/app.js`, modelo em `dist/spaceamp.js`; playlist e adapters existentes executam a reprodução |
| Busca/cache/CORE/enrichment | `dist/catalog.js`; respostas antigas não substituem rota/seleção atual; CORE não perde campos ricos |
| TitlePage/rota/fases async | `dist/title-pages.js`; Navigation possui retorno, scroll e foco |
| Preferências de títulos | `dist/title-preferences.js`; capa escolhida ainda possui leitura/gravação direta legacy em TitlePages |
| Preferências de apresentação | Views existentes ainda gravam suas chaves; extrações não criam novas chaves/stores |
| Perfil/backup | `dist/app.js` e `dist/extras.js`; MediaStorage/MediaPackage possuem blobs; rollback e formatos permanecem |
| PARTY | ROOM mantém presença/chat; CALL possui ciclo independente; módulos voice possuem transporte e streams |
| Discovery musical local | `dist/music-discovery-view.js` mantém pool/visible/seen/rotation; Catalog mantém requests/cache; `dist/music-collection-matches.js` reconcilia gêneros sem persistir |
| Analyser/visualizer | `dist/spaceamp-visualizer.js` mantém context/bins/tap do áudio existente; shell possui lifecycle e chama a função visualizer |
| Perfil visual de lyrics | `dist/spaceamp-lyrics-profile.js` mantém paint/observers no Shadow DOM; shell fornece validade do componente e chama apply/clear, mantendo clock/seek/importação |
| Apply/rollback de backup | `dist/backup-restoration.js` recebe persist/save; compositor possui confirmação e atualização pós-transação |

Identidade musical pertence ao YouTube Music. `sameItem` e `sameWork` não são intercambiáveis; releases usam `kind=album` e `albumType=album/ep/single`. Itens Apple/Deezer antigos continuam compatíveis nos caminhos existentes. Não criar identidade alternativa durante enrichment.

Views delegam ações ao owner. Nenhum módulo visual cria SPACEAMP, Audio, YT.Player, queue ou storage paralelo. Novas extrações usam callbacks explícitos, sem service locator. Cache/pending existentes mantêm escopo e limites; não adicionar requests/N+1.

Reconciliação local mantém nós, scroll, foco, Back e seleção. Motion mantém tokens e reduced-motion; CSS mantém cascata. Fachadas públicas incluem Collection, CollectionActions, Catalog, TitlePages, MusicBridge, SPACEAMP, SpaceAmpNowPlaying e PARTY_ROOM. Ordem em `dist/index.html` também deve valer nos harnesses isolados.

Now Playing retorna o foco ao controle que o abriu. No XMB, o contexto salvo mantém categoria, seleção e scroll; um opener ainda conectado recebe foco de volta (item, botão de detalhes ou entrada Now Playing conforme o fluxo). Sem opener conectado, retorna à entrada/seleção existente. Não se exige `.xmb-play` para uma abertura pelo item. Relógio e metadata dinâmica podem mudar sem remontar a UI.

Lyrics mantém `autoscroll` e `interpolate` do am-lyrics, sem `line-motion`/`no-blur` impostos pelo shell. O adapter aplica o perfil visual no Shadow DOM: active/pre-active/inactive, blur e destaque sem transformar geometria horizontal; scroll continua upstream. Clock visual interpola amostras do player; precisão de seek/ack/pausa pertence ao harness dedicado. Reduced-motion mantém o contrato existente.

Lookup de playback usa YouTube Music primeiro. Resultado confiante retorna `matched`; ambiguidade retorna `choose` sem fonte automática. Fallback MusicBrainz confiante de YouTube também pode retornar `matched`; áudio direto permanece sujeito à escolha. Falha dos dois providers retorna `not-found` com `unavailable`, sem impedir vínculo manual. Fonte/identidade canônica e estado persistido permanecem distintos; testes não exigem vínculo manual para todo resultado confiante.

Aceite automatizado é [validate.ps1](../tests/validate.ps1); testes adicionais e limites estão em [tests/README.md](../tests/README.md). Nenhuma alteração deliberada de comportamento faz parte deste pass.
