# PARTY / Voice — contrato atual

## Visão geral e ownership

Signaling WebSocket real, voz e compartilhamento de tela browser-native em mesh P2P entre múltiplos participantes, com seleção de dispositivos, medidores de voz, volumes individuais e chat por sala. O servidor recebe JSON de presença, mute, SDP, ICE e chat: não recebe MediaStream, não armazena nem retransmite áudio/vídeo.

`spacevoice.js` compõe UI e estado de sala/chamada; `party-chat-ui.js` possui DOM/composição/unread visual; `chat.js` possui mensagens/draft/typing. `room.js` é owner do transporte/presença e fornece proxy à CALL; `session.js` coordena peers, `peer.js` uma conexão. `state.js` coordena captura/operações; `media.js` captura, `devices.js` dispositivos/preferências, `levels.js` medição, `media-settings.js` constraints/encoding, `ice-config.js` configuração e `network.js` recovery/diagnóstico. Não há player, storage de mídia ou transporte paralelo nas views.

## ROOM, CALL e lifecycle

room-metadata.js centraliza limites/validação e URLs; room.js é dono do transport.
A sessão de voz recebe um proxy callTransport: send permanece no protocolo existente,
close remove somente o listener da call e não fecha o socket da sala. A mesma conexão
WS é reaproveitada por presence e voice, evitando sockets com clientIds concorrentes.
O adapter guarda presence metadata e joined separadamente para replay no reconnect.
Servidor mantém Map<roomId, Map<clientId, {socket, metadata, presence, inCall}>>.
Compatibilidade: join legado registra call diretamente, leave legado continua fechando
socket; join/leave de membros de presença altera somente inCall; presence-leave encerra a sala.

`room.js` mantém o único WebSocket e entrega mensagens/history/typing ao chat mesmo
sem call. `chat.start(roomId)` ocorre na entrada da sala; `chat.close()` somente na
saída/troca da sala. Entrar/sair da call atua apenas no `session.js`/WebRTC; painel,
mensagens, draft, scroll, typing e unread não são recriados. O servidor envia
`chat-history` após registro de presença e permite chat para membros da ROOM,
continuando a validar identidade, roomId, payload e rate limits. O lobby não cria PeerConnection.

Sair da CALL libera peers, reprodução, microfone, tela, analysers e listeners de captura, invalida operações pendentes e cancela recovery; preserva ROOM/chat. Sair ou trocar a ROOM encerra também o chat, timers de typing/presença, socket/listeners e cache ICE. Reentrada reutiliza os owners existentes, sem reload.

## Signaling e transportes

`signaling-ws.js` implementa a mesma interface `send(type, to, payload)`/`close()` do transporte local. A construção abre o socket; join solicitado enquanto conecta é enviado no open. As mensagens recebidas são filtradas por tipo, sala, remetente e destinatário. A sessão usa callbacks para receber o estado do transporte.

`session.js` usa `Map<clientId, entry>`: cada entry possui controller WebRTC, estado de conexão e estado ICE. `ensurePeer` é idempotente; `remove` limpa só aquele participante. Um snapshot cria IDs novos e preserva os presentes; IDs ausentes têm tolerância de reconexão, estendida enquanto seu P2P está conectado. Joins repetidos não geram offers repetidas. `peer.js` continua representando uma única conexão e independente do transporte; recebe `iceServers` e reporta estado ICE por callback. A UI injeta o transporte escolhido; a sala fornece ICE atual pelo cache em memória. Os testes diretos de peer continuam podendo usar iceServers vazio.

Envelope: `{ type, roomId, from, to?, payload? }`. Tipos de presença: `presence-join`, `presence-update`, `presence-leave` e `room-rename`. CALL usa `join`/`leave`; mídia usa `offer`/`answer`/`ice` e `participant-state`; recovery/configuração usa `ice-restart-request` e `ice-config-request`. Servidor emite `presence-snapshot`, `presence-error`, `peers` e `ice-config`, além dos tipos de chat descritos abaixo. `from` é um clientId efêmero criado por instância da interface, nunca username/autenticação. A interface gera um UUID em `?party=` quando ele não existe; `// geral` é apenas o nome visual da sala.

A primeira entrada válida registra a identidade na conexão; `presence-join` entra na ROOM e `join` ativa a CALL. Ao entrar na CALL, o servidor identifica os participantes já em chamada, marca o cliente como inCall e envia somente a ele `{ type: "peers", roomId, to: clientId, payload: { peers: [idA, idB] } }`. Em seguida, anuncia um join aos participantes anteriores. O snapshot não tem `from`, pois é emitido pelo servidor; mensagens `peers` enviadas por clientes são rejeitadas. Assim, C descobre A/B e A/B descobrem C sem depender de handshake ou timing acidental. BroadcastChannel preserva o handshake de join com `payload.reply`, pois não tem servidor. Para a conexão inicial de cada par, o menor clientId cria a offer. Após conectar, qualquer lado pode renegociar ao iniciar/parar tela; perfect negotiation resolve collisions por par. Offer/answer/ICE exigem destinatário e são enviados só para esse cliente na mesma sala. Joins direcionados respeitam `to`; não há eco ao remetente. `leave` de um membro de presença encerra somente a CALL; `presence-leave` e desconexão removem o registro da ROOM. O caminho legacy sem presença usa `leave` para fechar a sala/socket. Mensagens inválidas, binárias, tentativas de mudar identidade/sala e destinos em outra sala são ignorados. clientId duplicado na mesma sala fecha a nova conexão. O limite de mensagem é 64 KiB.

O servidor mantém apenas rooms/clientes em memória, sem persistência. Ping/pong a cada 15 segundos encerra conexões sem resposta na próxima verificação, evitando presença presa após perda abrupta de rede.

## Chat

`chat.js` mantém mensagens, deduplicação, draft, typing, unread e lifecycle sem
possuir socket ou conhecer WebRTC. `room.js` encaminha eventos
de aplicação e expõe `sendApplication`; os mesmos adapters WS/local transportam
chat e signaling com tipos separados. `session.js` mantém a compatibilidade de sua
API de aplicação, mas a UI usa a sala. `peer.js` permanece exclusivo
de mídia. `party-chat-ui.js`, composto por `spacevoice.js`, cria uma coluna IRC
à direita, recolhível, que se empilha em viewports menores. Mensagens/typing
atualizam somente seu container, sem render global ou alteração de srcObject.

Protocolo:

- `chat-message`: cliente envia `{text, authorName}`; servidor faz broadcast,
  incluindo o emissor, com `{id, roomId, authorId, authorName, text, createdAt}`.
  `id` é UUID do servidor, `createdAt` usa Date.now no servidor e `authorId/from`
  vêm da identidade vinculada ao socket. IDs/timestamps/autores fornecidos pelo
  cliente não determinam a mensagem final.
- `chat-history`: snapshot `{messages}` enviado somente ao cliente entrando na ROOM,
  também no rejoin automático após reconnect.
- `typing-start` / `typing-stop`: indicação transitória, filtrada pela sala.
- `chat-error`: erro discreto de payload, membership ou rate limit; não fecha WS.

O servidor mantém `Map<roomId, ChatMessage[]>`, últimas **50 mensagens**. A sala
vazia libera também seu histórico. Reiniciar o servidor apaga todas as mensagens.
Não existe persistência de chat em localStorage, IndexedDB, arquivos ou banco.
O cliente limita o log/dedup às últimas 100 mensagens; histórico e mensagens live
são conciliados por ID e ordenados por timestamp confirmado, preservando ordem
recebida em empates. Nomes antigos ficam no snapshot da mensagem.

Até **5 mensagens por janela de 5 segundos por socket**, texto máximo 2000
caracteres e nome máximo 64. O cliente também limita envios, mas a validação
autoritativa é server-side. Texto vazio/whitespace e excesso de tamanho são
rejeitados, sem truncamento silencioso; trim preserva quebras internas. Enter
envia, Shift+Enter insere nova linha, composição IME não envia prematuramente.
Nenhuma mensagem é renderizada otimisticamente nem reenviada automaticamente:
o eco confirmado é a mensagem do log. Erros são mostrados junto ao input.

Typing tem throttle próprio: refresh no máximo uma vez por segundo no cliente,
8 eventos por 5 segundos no servidor. Dois segundos de inatividade, limpar input,
envio ou saída emitem stop; estados remotos expiram em 4 segundos se o stop for
perdido. Saída da ROOM, reconnect e troca de sala limpam timers/presença typing;
sair apenas da CALL não interrompe o chat.
Reconnect preserva draft não enviado, recebe snapshot e deduplica mensagens;
envios durante desconexão são bloqueados. Sair voluntariamente da ROOM limpa o draft.
O primeiro snapshot não gera unread; mensagens novas recuperadas em snapshots
de reconnect contam quando o chat está oculto ou acima do final. Se o socket cair
entre envio e confirmação, a entrega é incerta: não há retry automático; consulte
o histórico reconciliado antes de reenviar manualmente.

Autoscroll só quando o painel está visível e a até 32 px do final. Scroll manual
é preservado. Mensagem remota com painel oculto/background ou scroll acima
incrementa unread. O botão de novas mensagens vai ao final; abrir o painel ou
voltar ao final visível zera unread. O título da página reflete unread, sem pedir
permissão de Notification API. Log tem label/role e aria-live off para não anunciar
o histórico inteiro; erros usam role status. URLs são texto, sem Markdown/autolink.
Texto e nome são construídos com DOM/textContent: HTML, inclusive
`<script>alert(1)</script>`, aparece literalmente e não executa.

`?voiceTransport=local` usa o mesmo BroadcastChannel da chamada, com IDs/timestamps
gerados localmente e eco explícito ao autor. Não tem servidor autoritativo nem
histórico anterior à entrada da aba. O log é limitado e sala/typing são filtrados;
a proteção contra spam do cliente não é segurança contra outra aba maliciosa.

## Presença, identidade e salas recentes

O UUID continua sendo a chave técnica e permanece no convite/URL. O código
visual é o prefixo hexadecimal de seis caracteres de um hash FNV-1a do roomId;
pode colidir e não permite ingresso por código. O nome é texto puro de até
48 caracteres, com fallback `geral`, renderizado via textContent.

Qualquer participante registrado pode renomear: não há owner, ACL ou banco.
O servidor valida `room-rename`, limita a frequência e envia o nome nos
snapshots de presence. O nome desaparece quando o último participante sai.
BroadcastChannel de desenvolvimento sincroniza nomes por versão temporal,
sem autoridade ou persistência central.

Metadata opcional: `statusText` (texto puro, até 80 caracteres), `idle`
(booleano), `activity` (`room`, `call`, `muted`, `sharing`, `speaking`).
O cliente reutiliza `getProfile().mood`; atualização de perfil emite o evento
local `myspace-profile-change`. Nenhum novo perfil ou armazenamento é criado.
O servidor valida tipos/tamanhos e normaliza activity para `room` quando o
participante não está em call. Isso é informação visual, não autenticação.
O adapter WebSocket guarda a última metadata para reapresentar na reconexão.

A UI escolhe um estado principal: speaking, sharing, muted, call, room.
Idle substitui o estado básico de lobby por `ausente`; uma atividade de call
continua prioritária. O usuário local mantém a identificação `você` e
`fora da chamada`. Idle não muda as contagens nem encerra streams ou sockets.

`presence.js` centraliza o prazo de cinco minutos. Pointer/teclado/toque
atualizam o último acesso; há apenas um timer de prazo, sem polling e sem
usar visibilitychange como prova de ausência. Voltar a interagir restaura
ativo. Entrada inicia e saída remove timer/listeners. Updates usam as
transições reais de estado, são deduplicados e coalescidos em até um por
segundo, respeitando o rate limit existente.

Mood e estado usam fade suave e slide de 6 px com tokens XMB existentes;
reduced motion desativa a animação. Não há histórico de atividade.

Rename, convite e recentes usam os tokens XMB existentes e respeitam reduced-motion. Selecionar um recente usa o mesmo lifecycle de saída/entrada de sala, sem capturar mic; detalhes de armazenamento estão em Persistência.

## Microfone e dispositivos

`media.js` enumera audioinput/audiooutput com enumerateDevices, sem solicitar permissão para preencher listas. Antes da captura podem existir IDs/labels ocultos: o padrão do sistema permanece selecionável, e dispositivos sem label recebem nomes genéricos. Após getUserMedia a lista é atualizada. `devices.js` mantém uma assinatura devicechange, renovada na entrada/foco do seletor e removida na saída. Dispositivos salvos que desapareceram são corrigidos para default quando a lista está exposta; NotFoundError/OverconstrainedError na primeira captura de uma preferência antiga também tentam default.

Escolher mic fora da chamada salva a preferência. Dentro da chamada, `state.switchMicrophone()` obtém **uma** nova captura com deviceId exact e aplica o mute atual. `session.replaceMicrophone()` chama replaceTrack no sender de propósito microphone de todos os peers: não faz addTrack/removeTrack, não renegocia, não recria PCs e não modifica screen-video/screen-audio. Somente após todos os senders confirmarem, o estado/analyser local migra e a captura anterior é parada. Novos participantes durante a troca aguardam o commit, com SDP/ICE/metadata pendentes preservados.

Se a captura ou uma substituição falhar, a nova captura é liberada e a preferência anterior permanece. Falhas parciais tentam rollback de todos os senders para o mic anterior. Caso o browser também rejeite esse rollback, apenas o par afetado é fechado/recriado com o mic anterior; não há garantia de rollback nativo infalível. Saída da chamada invalida operações pendentes e libera resultados tardios.

Ao desaparecer o mic ativo (devicechange ou track ended), tenta-se default uma vez. Falha deixa o microfone indisponível, com aviso e possibilidade de seleção manual, preservando peers e captura de tela. Eventos repetidos não ficam recapturando um device ausente. Desaparecimento de outro device só atualiza a lista.

`setSinkId` é detectado por feature detection. A saída escolhida é aplicada aos elementos de voz remota e aos vídeos com system audio remoto, inclusive criados após a escolha. Preview local muted é excluído. A operação tenta restaurar a saída anterior em caso de falha e só salva uma nova preferência após sucesso. Se a API não existir, aparece “saída controlada pelo sistema”; permissões/política do browser podem impedir uma saída não padrão mesmo com suporte à API.

## Níveis, speaking e volumes

`levels.js` usa **um AudioContext por sessão**, iniciado/resumido na ação de entrar, com MediaStreamSource → AnalyserNode independente para o mic local e a voz de cada peer. Nenhum node conecta ao destination; os elementos HTML existentes continuam responsáveis pela reprodução. Mídia de tela não cria monitor de voz.

A cada 50 ms (20 Hz), RMS dos samples time-domain vira nível visual 0–1 pela escala dB de −60 a −10, com clamp. A suavização usa 65% do novo nível ao subir e 20% ao cair. Speaking usa RMS ≥ 0,02 sustentado por 100 ms, com release/hangover de 400 ms. É heurística de energia, não reconhecimento de fala; música/ruído no próprio microfone podem ativá-la. Mute zera nível e speaking imediatamente. Volume/deafen locais não mudam o detector remoto. Atualizações escrevem somente meter/texto/data attribute dos indicadores, sem render global por sample ou aria-live de nível.

Mute é explícito: `participant-state {micMuted:boolean}` via WebSocket/BroadcastChannel. Cada peer recém-descoberto recebe o estado atual, incluindo late join/reconnect. O servidor valida o socket/room/from registrados e encaminha apenas micMuted boolean; falsificar outro sender/room ou enviar tipo inválido não altera estado. Deafen permanece local.

Cada participante tem um controle de volume recolhido, aplicado à sua voz e tela. Deafen, volume zero, preview local e tela fora de foco determinam muted local, sem sobrescrever a preferência de volume. Sair desconecta nodes, cancela o intervalo, fecha AudioContext e remove o listener de dispositivos; reentrar cria um único contexto/loop e um monitor por voz.

Referências: [W3C Media Capture](https://www.w3.org/TR/mediacapture-streams/), [replaceTrack](https://www.w3.org/TR/webrtc/#dom-rtcrtpsender-replacetrack), [Audio Output](https://www.w3.org/TR/audio-output/), [Web Audio](https://www.w3.org/TR/webaudio/).

## Screen share e screen audio

Clique em **compartilhar tela** somente depois de entrar na chamada. `media.js` chama `navigator.mediaDevices.getDisplayMedia()` dentro da ação explícita do usuário. O picker do browser escolhe tela/janela/aba; não existe captura automática na aplicação. Cancelamento/permissão negada, API ausente e vídeo ausente geram status próprio sem encerrar a voz. Sem áudio de sistema, o vídeo continua normalmente.

`state.js` mantém `localStream` (microphoneStream) separado de `screenStream`, sem storage. No máximo uma captura de tela ativa por participante; pedidos simultâneos são bloqueados. Resultados atrasados depois de sair/cancelar são imediatamente parados. O evento `ended` da video track chama o mesmo cleanup do botão **parar tela**; parar tela encerra video/system audio e remove apenas os senders de tela. O microfone e as PeerConnections continuam ativos. Sair da chamada encerra ambas as capturas.

A área central mostra um vídeo por vez, com tabs discretas para as telas disponíveis. Cada share possui seu próprio `<video autoplay playsinline>`; preview local permanece muted. Só a tela remota em foco reproduz system audio, evitando mistura de múltiplas telas. Deafen silencia voz e todos os vídeos remotos sem parar tracks nem afetar o transmissor. Se autoplay for bloqueado, o botão de reprodução tenta retomar voz e vídeo focado. Se a tela focada parar, outra é selecionada; sem shares, a área fica vazia novamente.

O status usa **getSettings() reais**: width/height/frameRate/displaySurface quando informados. Os presets são preferências, não garantias:

| Preset | Resolução ideal | FPS ideal/máximo | maxBitrate solicitado por peer |
| --- | --- | --- | --- |
| 720p60 | 1280×720 | 60 | 4 Mbps |
| 1080p30 | 1920×1080 | 30 | 6 Mbps |
| 1080p60 (padrão) | 1920×1080 | 60 | 10 Mbps |
| 1440p60 | 2560×1440 | 60 | 14 Mbps |

A captura usa constraints ideal para resolução, ideal/max para frameRate e `contentHint="motion"` por padrão quando suportado. Browser/OS/superfície podem entregar valores diferentes; 1440p60 não é garantia. Cada sender de screen-video tenta aplicar maxBitrate com getParameters/setParameters depois da negociação. Limites podem ser ignorados/reduzidos; falhas desse ajuste são não fatais. Em mesh, 1080p60 com limite de 10 Mbps e três remotos pode demandar até aproximadamente **30 Mbps** de upload do sharer (mais voz/overhead). Não é uma taxa medida ou prometida.

`peer.js` representa uma conexão, com `Map<purpose, {sender, track, stream}>`: **microphone**, **screen-video**, **screen-audio**. `session.setScreen()` distribui a mesma captura e as mesmas tracks a todos os peers; não repete getDisplayMedia por destinatário. Ao criar um novo peer, a sessão fornece o microfone e a captura de tela atualmente viva. Se um peer precisar ser recriado após reconnect/recovery, recebe a captura viva existente, sem outro picker; snapshots preservam os pares conectados.

Offer/answer preservam type/sdp e adicionam `media: [{purpose, mid, trackId, streamId}]`. MID associa cada track ao propósito, com trackId como fallback explícito; não se usa ordem de chegada, aparência ou número de tracks para identificar mídia. Os metadados viajam com a descrição correspondente, antes de processar ontrack. O servidor apenas roteia esses JSONs, sem conhecer/transportar a mídia. Screen sharing requer clientes que entendam essa metadata de propósitos; áudio legado sem metadata ainda é aceito.

Os receptores são identificados pela identidade do transceiver, cujo MID pode mudar após rollback. A sessão associa `entry.remoteShare = {stream, videoTrack, audioTrack, state}` ao peer correto e a UI mantém suas entradas por peerId. Microfone remoto e tela remota são streams separados; duas pessoas podem compartilhar independentemente. A ausência de screen-video na nova descrição remove a share correspondente, inclusive quando removeTrack somente silencia o receiver sem emitir ended.

Screen-audio pede `echoCancellation: false`, `noiseSuppression: false`,
`autoGainControl: false` e `channelCount: {ideal: 2}`, com `contentHint: music`.
Essas opções são preferências dependentes do suporte do browser/fonte. Seu sender
prefere Opus reordenando capacidades nativas sem remover codecs de fallback; após
negociação, aplica o teto solicitado ao encoding do sender. O default de 192 kbps é um teto,
não garantia de bitrate mínimo: VBR e adaptação de rede continuam ativos. Rejeição
de tuning não bloqueia SDP. Microphone e screen-video mantêm seus parâmetros.

Não há edição de SDP/fmtp ou campos obsoletos para forçar estéreo/DTX. Conforme
[RFC 7587](https://www.rfc-editor.org/rfc/rfc7587.html), `opus/48000/2` aparece
inclusive em áudio mono; `stereo` ausente significa preferência mono e `usedtx`
ausente significa DTX desligado por padrão. `channels`/fmtp não são parâmetros
graváveis de `setParameters`. Capturar dois canais não garante estéreo negociado.

Para comparar qualidade, mantenha a fonte capturada ativa e ouça somente o receptor,
preferencialmente em outro PC com fones. No mesmo PC, ouvir o original e o retorno
WebRTC simultaneamente soma sinais com atraso e causa eco/comb filtering, mesmo
com stream íntegro. A prévia local do SPACEVOICE já fica muted, mas não silencia o
player original. Isole as saídas com roteamento de áudio/dispositivos distintos;
mutar o player ou mixer pode também eliminar o sinal capturado, dependendo da fonte.
Evite capturar o próprio retorno WebRTC no áudio do sistema; silencie esse retorno
no cliente emissor. Validar ainda música/vídeo reais, imagem estéreo, captura por
aba/tela/SO, browsers diferentes e rede entre PCs com perda/jitter reais.

## Configurações avançadas de mídia

O botão `[ mídia avançada ]` abre um painel separado no rodapé funcional da PARTY.
Não altera a estrutura da chamada, chat, viewer ou toolbar principal. O painel herda
os tokens de tipografia, accent, bordas e uma superfície translúcida.

`media-settings.js` centraliza defaults, validação, opções, constraints do microfone
e recomendações de encoding. `media.js` contém apenas resolução/FPS nos presets de
captura. Defaults: mic EC/NS/AGC ligados, bitrate automático; screen audio 192 kbps;
screen video recomendado pelo preset (4/6/10/14 Mbps), contentHint motion.

O vídeo possui três escolhas distintas: **recomendado** acompanha o preset,
**manual** mantém o teto escolhido ao mudar o preset e **automático** remove
`encodings[0].maxBitrate`. Isso evita tratar automático como um valor manual de 10 Mbps.
O botão restaurar recomendados repõe esses defaults e aplica-os à mídia ativa.

`state.applyMicrophoneSettings()` tenta `applyConstraints()` na track ativa,
preservando suas constraints de dispositivo. Quando a API falta, rejeita ou informa
settings diferentes do pedido, usa a troca de mic existente: captura com as novas
constraints, conserva mute, faz replaceTrack para todos os peers e só então para a
captura anterior. Falha mantém a captura anterior e tenta restaurar suas constraints.
Sair durante uma operação invalida o resultado para impedir captura atrasada.
O rollback mesh já existente continua responsável por recuperar falhas de replaceTrack.

`session.setMediaSettings()` guarda a preferência vigente e distribui-a aos peers;
late join/reconnect recebe a mesma configuração. `peer.js` aplica limites somente ao
sender identificado por propósito: microphone, screen-audio ou screen-video.
Ajustes usam getParameters/setParameters, preservam os outros campos do objeto e são
serializados fora da fila de negociação. Encoding indisponível antes da negociação
é aplicado após offer/answer. Falhas são avisos discretos, não falhas de conexão;
um pedido de bitrate de mic rejeitado tenta remover o teto anterior.
Mudar encoding não chama getDisplayMedia nem addTrack/removeTrack.
`contentHint` muda a track existente, quando suportado; áudio de tela mantém music,
EC/NS/AGC desligados e preferência nativa por Opus.

Limitações: constraints podem ser ignoradas ou rejeitadas; contentHint pode não
existir; setParameters depende de encodings negociados e pode rejeitar o ajuste.
O fallback de microfone depende de conseguir uma segunda captura. Uma restauração
de constraints também é best effort. O bitrate solicitado é teto por destinatário,
não taxa medida/prometida: 10 Mbps com três remotos estima até 30 Mbps de upload de
vídeo, além de voz e overhead. Não há SDP munging, DSP, controle adaptativo próprio
ou controle de congestionamento custom.

Durante aplicação pendente, restaurar recomendados fica indisponível para evitar pedidos concorrentes descartados.

## WebRTC, peers e negociação

`polite = localClientId > remoteClientId`. A eleição inicial pelo menor ID é mantida, e offers posteriores podem partir de ambos os lados. Depois, negotiationneeded é atendido em ambos os lados.

Cada endpoint possui makingOffer, ignoreOffer e isSettingRemoteAnswerPending, com operações serializadas. O impolite ignora uma offer colidida e seus candidatos; o polite aceita a offer usando rollback implícito de setRemoteDescription. Após responder, se o rollback deixar senders locais ainda sem MID, o endpoint cria uma nova offer para negociar essas tracks pendentes: uma answer não pode adicionar m-lines. Isso é condicionado ao estado dos transceivers, sem delays/setTimeout para esconder colisões. negotiationneeded continua cuidando das alterações normais.

Referência do padrão: [W3C — Perfect Negotiation](https://www.w3.org/TR/webrtc/#perfect-negotiation-example).

## ICE, TURN e recovery

`ice-config.js` centraliza defaults, normalização, policy e cache em memória. ROOM solicita configuração via `ice-config-request`/`ice-config` pelo WS existente; `server/party/ice-config.cjs` fornece Coturn ou Metered, conforme ambiente. Credenciais são temporárias; secrets/API keys ficam no backend. O cache é consultado antes de novos peers e ICE restart; atualizar configuração não reinicia outros pares. Sem TURN configurado, usa STUN-only; BroadcastChannel usa STUN e não certifica TURN.

Policy padrão `all`; `?voiceIcePolicy=relay` força relay para diagnóstico. `network.js` identifica selected candidate pair, tipos host/srflx/prflx/relay, transporte e RTT quando disponíveis, tolerando stats incompletos. A UI não mostra IP, SDP ou credenciais; diagnóstico é solicitado por ação, sem polling constante.

`disconnected` espera 5 s, cancelados se recuperar; `failed` inicia recovery. Menor ID inicia restart e o outro solicita ao líder. `restartIce()`/`createOffer({iceRestart:true})` passam pela fila de perfect negotiation e usam configuração atual. Até três tentativas, com esperas de 12/15/18 s; esgotar oferece retry apenas no participante afetado. Falha A–B não encerra A–C nem a CALL.

Queda de signaling preserva peers e mídia P2P, pausando recovery que depende do transporte. O WS tenta reconectar a cada 1,5 s e reapresenta presence metadata e intenção de CALL, recebendo snapshots atuais. Uma offer local ainda pendente pode ser reenviada ao reconectar. Ausência inesperada tem tolerância de 30 s, estendida enquanto P2P continua conectado; saída explícita remove imediatamente. Joins/snapshots repetidos não duplicam peers nem recapturam mídia.

Deployment, credenciais/TTL, Origin/rate limits, portas, diagnóstico, Metered e teste entre duas redes estão no [runbook ICE/TURN](../../server/coturn/README.md).

## SPACEAMP / atividade compartilhada

`spaceamp/spaceamp.js` normaliza title, artist, artwork, source e sourceUrl para o shell
atual do player. Local e YouTube usam a mesma capa quadrada; a thumbnail do
YouTube é cropada por object-fit cover. O player externo permanece uma ação
secundária, sem thumbnail gigante. A playlist continua única com source discreta.
Troca de faixa usa fade/slide de 8 px; foco/seleção da playlist avança 6 px,
com tokens existentes e reduced motion. A surface genérica de vídeos não muda.

`window.SPACEAMP.getState()` fornece o estado atual. Os eventos locais
`spaceamp:trackchange`, `spaceamp:playstate` e `spaceamp:privacy` notificam a
PARTY sem polling. O `<audio>` real confirma playing/pause/ended/emptied/error;
play sem playing confirmado ou buffering não publica uma faixa como tocando.
troca de source pausa o áudio antigo. Trackchange não presume reprodução.

Presence recebe somente `nowPlaying: {title, artist, playing:true}` ou null.
Título/artista têm limite de 80 caracteres; servidor rejeita tipos inválidos,
controle e campos adicionais (URLs, arquivos, artwork, blobs). Renderização
usa textContent. Updates reutilizam a deduplicação/coalescência de presença
(até um por segundo), incluindo snapshot/reconexão e isolamento por room.
Pause, stop, fim/erro e preferência OFF limpam a metadata. Aparecer/trocar/sair
usa motion de 6 px; remoção aguarda a animação visual, sem atrasar a metadata.

O clique no iframe YouTube carrega a IFrame Player API uma vez, com enablejsapi
e origin, mantendo a UI do provider. onReady verifica o estado atual;
somente PLAYING confirma Now Playing. Pause, end, buffering, cue, autoplay
bloqueado e erro limpam o estado. Sem polling. Se a API falhar, o iframe
continua disponível e não se presume playback. Spotify permanece sem confirmação.

getVideoUrl identifica mudanças de vídeo nos eventos; a metadata é obtida pelo
endpoint existente, uma requisição por mudança. Callbacks de source antigo são
descartados; pause durante carregamento não volta a publicar ao resolver.
Trocar source destrói o YT.Player anterior. Abas externas não são controladas.

Media Session é feature-detected. Title/artist/artwork usam a faixa atual.
Play/pause atuam no áudio local ou YT.Player pronto; previous/next reutilizam
stepTrack. Stop limpa metadata e define playbackState none; pause define paused
e reprodução confirmada define playing. A preferência da PARTY é independente.
Actions não suportadas são ignoradas individualmente. Não há seek adicional.

No data-mode screen, um wrapper secundário colapsa com grid 1fr/0fr, fade e
slide de 6 px usando tokens XMB. Mood e Now Playing permanecem montados e na
metadata, mas ocultos também para acessibilidade; voltam no modo voice.
Identificação você e volume não ocupam o rail. Reduced motion remove transições.

## Persistência

`preferredAudioInputId`, `preferredAudioOutputId`, `remoteVolumes` e `mediaSettings` são salvos no JSON `spacevoice-audio-preferences` do localStorage. Falha/bloqueio de storage preserva controles em memória. Volumes são limitados a 0–1 e 100 entradas. O identificador é o peerId efêmero: a preferência sobrevive à reentrada/reconnect daquele peer, mas um reload do participante gera novo ID, sem identidade persistente entre pessoas.

`devices.js` salva somente valores simples em `mediaSettings`, dentro do JSON já
existente `spacevoice-audio-preferences`, preservando dispositivos e volumes.
Valores fora das opções válidas voltam individualmente aos defaults. Storage
bloqueado mantém as configurações em memória; nenhum stream, track ou sender é salvo.

`party-recent-rooms-v1` guarda no localStorage somente roomId, name e lastVisited
das cinco últimas salas. Renomear atualiza o nome sem alterar a ordem de visita;
selecionar um recente reutiliza a mesma saída/entrada de nova party, sem mic.
Uma sala recente que já desapareceu retorna com nome geral e chat vazio.
Storage indisponível não impede entrar na sala.

`mostrar música na PARTY` é ON inicialmente e persiste apenas um booleano
em `spaceamp-party-music-v1`. OFF não pausa o player. Apenas título/artista
curtos de reprodução confirmada são publicados, nunca dados de arquivo local.

Rooms, presence e chat no servidor ficam em memória e desaparecem quando a sala esvazia ou o servidor reinicia. Streams/tracks/senders, credenciais TURN e histórico de atividade não são persistidos.

## Segurança e privacidade

**Privacidade:** voz/tela continuam P2P entre peers. Chat em modo WebSocket passa
pelo signaling/application server e **não é E2E encrypted**. WSS protege apenas
o transporte até o servidor. `clientId` é identidade técnica efêmera, não usuário
autenticado; displayName é metadata visual e pode ser repetido/falsificado. Sem
login, banco, upload, edição/delete, reactions, bots ou criptografia própria.

Identidade técnica é vinculada ao socket/ROOM, com validação de payload/destinatário e limites; isso não implementa login, ACL ou moderação. Avatar/displayName são metadata limitada por `room-metadata.js`, não prova de identidade. O servidor de signaling não termina TLS: deployment remoto requer HTTPS/WSS e proxy apropriado. Origin/limites ICE não autenticam clientes não-browser; secrets/keys não são enviados ao frontend.

## Iniciar e configurar

O caminho normal é **iniciar.cmd** (launcher.bat), conforme [README raiz](../../README.md#iniciar). O launcher inicia frontend/API em `http://localhost:3000` e signaling em 8787; Ctrl+C encerra os dois. Usa Node do sistema ou runtime portátil, sem npm ou alteração de PATH. Requisitos em outra máquina: Node.js 22+ com suporte a `--use-system-ca` e dependência local `server/node_modules/ws`; não instalar tooling apenas para executar o projeto.

Execução separada, na raiz:

```powershell
node server.cjs
node server/party/signaling-server.cjs
```

Cada processo ocupa seu próprio terminal. O signaling não serve o frontend; lê `.env` da raiz, com ambiente tendo precedência. O setup local define `VOICE_HOST=127.0.0.1` e `VOICE_PORT=8787`; sem `VOICE_HOST`, o entrypoint usa `0.0.0.0`. Confira o bind antes de um teste LAN. `VOICE_PORT` altera o servidor; configure também a URL do cliente se usar outra porta.

WebSocket é o transporte padrão. A URL padrão é `ws://<hostname-do-frontend>:8787`, ou `wss://<host>/party-signaling` se o frontend estiver em HTTPS.

Para apontar para outro computador, use:

```text
http://localhost:3000/?voiceWsUrl=ws%3A%2F%2F192.168.1.10%3A8787
```

A URL acima aponta para `ws://192.168.1.10:8787`. Substitua pelo IP LAN do servidor. Alternativamente defina, antes de criar PARTY, uma configuração global:

```js
window.SPACEVOICE_CONFIG = {
  transport: 'websocket',
  url: 'ws://192.168.1.10:8787'
};
```

Os parâmetros `voiceTransport` e `voiceWsUrl` têm prioridade sobre a configuração global. Para desenvolvimento local: `http://localhost:3000/?voiceTransport=local`. BroadcastChannel permanece disponível, limitado à mesma origem e partição de armazenamento do navegador. Não há fallback automático que esconda erros de rede.

### Teste manual em dois PCs na LAN

1. Disponibilize/abra o projeto em ambos os PCs. Execute `node server.cjs` em cada um e abra o frontend em `localhost:3000`. Isso permite microfone em contexto seguro sem configurar certificados LAN.
2. Execute o signaling somente no PC A, com `VOICE_HOST` apontando para uma interface LAN ou `0.0.0.0`. Descubra seu IP LAN (ex.: `192.168.1.10`) e permita a porta TCP 8787 no firewall para a rede de teste.
3. Abra PARTY no PC A com `?voiceWsUrl=ws%3A%2F%2F192.168.1.10%3A8787#spacevoice` e copie o convite gerado. Abra no PC B o mesmo convite, ajustando apenas o host do frontend local se necessário; preserve `party` e `voiceWsUrl`.
4. Entre na chamada nos dois PCs e permita o microfone. Aguarde signaling conectado, descoberta do convidado e WebRTC conectado.
5. Use headset; confirme áudio nos dois sentidos, mute e deafen. Se autoplay bloquear, clique em reproduzir áudio remoto.
6. Saia e reentre. Feche uma aba e confirme remoção no outro PC. Pare/reinicie o signaling e confirme que peers conectados são preservados e a sala reconcilia ao voltar.

Para servir um único frontend a ambos os PCs, publique-o em HTTPS com certificado confiável. HTTP por IP LAN não permite getUserMedia normalmente. Em HTTPS, use WSS: este servidor mínimo não termina TLS, portanto configure um proxy TLS com suporte a upgrade WebSocket. Não basta trocar `ws` por `wss` contra a porta sem TLS. Fora da LAN, o endpoint também precisa ser alcançável pelos dois clientes.

## Validação focada

Seleção e classificação completas estão em [tests/README.md](../../tests/README.md) e [INVENTORY.md](../../tests/INVENTORY.md). Não executar wildcard de `.cjs`/`.test.cjs`.

| Tipo | Comando / contrato |
|---|---|
| Local determinístico, servidor/transportes | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 party`: ROOM, chat server/transport e ICE server; sem captura/negociação de mídia real |
| Local determinístico, ROOM/chat/UI | `node --test --experimental-test-isolation=none tests/party/party-room-ui.test.cjs tests/party/voice-chat.test.cjs tests/party/voice-ui.test.cjs` |
| Local determinístico, dispositivos/mídia/níveis | `node --test --experimental-test-isolation=none tests/party/voice-media-settings.test.cjs tests/party/spacevoice.test.cjs` |
| Local determinístico, recovery/provider ICE | `node --test --experimental-test-isolation=none tests/party/party-network.test.cjs tests/party/party-metered.test.cjs tests/party/party-ice-server.test.cjs` |
| Local determinístico, SPACEAMP/activity | `node --test --experimental-test-isolation=none tests/spaceamp/spaceamp.test.cjs tests/spaceamp/spaceamp-integrations.test.cjs tests/party/party-room.test.cjs` |
| Browser integration adicional/manual | `node tests/party/party-room-chat-integration.cjs`: chat/lifecycle ROOM e CALL; revisar fixture e requisitos |
| Browser integration adicional/manual, mídia avançada | `node tests/party/party-media-settings-integration.cjs`: dois contexts, mic fake e tela/audio sintéticos com WebRTC nativo |
| Harness integrado histórico/manual | `node tests/party/spacevoice-integration.cjs`; seleções `--chat-only`, `--audio-only`, `--screen-only` e `--screen-audio-only`; revisar fixture antes de usar como aceite |
| Dois PCs, devices, autoplay/permissões reais | Roteiro LAN acima; hardware, som audível e picker/toolbar exigem verificação manual |
| TURN real / duas redes físicas | Runbook ICE/TURN; relay deve ser observado, host/srflx não certifica TURN |

`--screen-audio-only` coleta settings/constraints, parâmetros dos senders/receivers, codec, canais, bytes, bitrate por intervalo, packetsLost, jitter e RTT específicos de screen-audio. Campos ausentes ficam null; RTT do candidate pair descreve o transporte ICE compartilhado e é separado do RTT RTCP de áudio. O modo `--baseline` muda o destino e desativa asserts específicos, sem restaurar código anterior.

Os harnesses de mídia usam Edge/Playwright nos caminhos declarados nos arquivos; fora desse ambiente, revise os paths existentes. A integração SPACEVOICE usa flags de mic/display fake e WAV de tom/silêncio; fallback sintético é exclusivo do teste. Pode certificar RTP/frames e lifecycle no ambiente escolhido, mas não hardware, fidelidade musical, FPS sustentado, travessia de NAT ou permissões normais. Track ended disparado pelo harness não valida o botão nativo da toolbar. Queda de socket não simula perda física da rede.

`party-room-chat-integration.cjs` imprime seu resultado na saída direta. `party-media-settings-integration.cjs` e `spacevoice-integration.cjs` declaram suas pastas de saídas em `artifacts/`. São saídas ignoradas geradas pela execução, não dependências de clones novos. Servidores/browser/contexts são encerrados no cleanup; relatórios de rodadas anteriores ficam no histórico.

## Limitações atuais

- Labels, IDs e outputs podem estar ocultos antes da permissão. DeviceIds podem mudar. setSinkId e seleção de saída dependem de browser, contexto seguro, política, permissões e OS; suporte à API não garante acesso a todas as saídas. Speaking é heurística por nível, não distinção semântica entre fala, ruído ou música no microfone.
- Testar hardware USB/headset, troca real de input/output, desconexão/reconexão, permissões normais, sidetone/eco e qualidade audível. Bluetooth pode mudar perfil/qualidade quando seu mic é ativado, dependendo do SO/dispositivo. Nenhum DSP próprio foi adicionado.

- getDisplayMedia exige ação do usuário e contexto seguro. Permissão de screen capture não é persistida; browser/OS/superfície determinam áudio de sistema disponível. Mídia fake não confirma captura de som real do OS.
- O teste com fonte fake não valida desktop físico, legibilidade, qualidade audível, FPS sustentado, performance em jogos ou qualidade em redes lentas. Testar picker real (tela/janela/aba), toolbar de parada, som do sistema, autoplay padrão e permissões manualmente.

- Mesh para grupos pequenos, sem limite rígido de quatro: cada cliente mantém N − 1 PeerConnections e a sala N × (N − 1) / 2 pares únicos. O número total de conexões cresce O(N²), com custo de CPU e upload por cliente aumentando com N. Não há garantia de desempenho para 5/6 ou mais participantes. Screen share aumenta principalmente o upload do sender. Para grupos maiores, considerar SFU/LiveKit no futuro; nenhum servidor de mídia foi implementado.
- STUN ajuda a descobrir endereços públicos, mas não garante conectividade. Sem TURN, NATs restritivas, redes corporativas, bloqueios UDP e algumas combinações de redes podem impedir áudio mesmo com signaling funcionando.
- Sem autenticação, controle de acesso ou TLS próprio; destinado a desenvolvimento/rede de teste. Username é apenas visual. TURN e chat têm os contratos acima; não há SFU, gravação, webcam, remote control ou persistência de mídia.
- Testes automatizados validam protocolo/lifecycle; áudio físico e travessia de NAT precisam de teste manual entre PCs.

Resultados de milestones e validações anteriores estão no [histórico PARTY/voice](../../docs/history/party-voice-evolution.md).
