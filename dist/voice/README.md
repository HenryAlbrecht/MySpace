# SPACEVOICE v0.7

Signaling WebSocket real, voz e compartilhamento de tela browser-native em mesh P2P entre múltiplos participantes, com seleção de dispositivos, medidores de voz, volumes individuais e chat por sala. O servidor recebe JSON de presença, mute, SDP, ICE e chat: não recebe MediaStream, não armazena nem retransmite áudio/vídeo.

## Chat por sala — v0.7

`chat.js` mantém mensagens, deduplicação, draft, typing, unread e lifecycle sem
possuir socket ou conhecer WebRTC. `session.js` encaminha eventos de aplicação
para `onApplication` e expõe `sendApplication`; os mesmos adapters WS/local
transportam chat e signaling com tipos separados. `peer.js` permanece exclusivo
de mídia e não foi modificado nesta versão. `spacevoice.js` cria uma coluna IRC
à direita, recolhível, que se empilha em viewports menores. Mensagens/typing
atualizam somente seu container, sem render global ou alteração de srcObject.

Protocolo:

- `chat-message`: cliente envia `{text, authorName}`; servidor faz broadcast,
  incluindo o emissor, com `{id, roomId, authorId, authorName, text, createdAt}`.
  `id` é UUID do servidor, `createdAt` usa Date.now no servidor e `authorId/from`
  vêm da identidade vinculada ao socket. IDs/timestamps/autores fornecidos pelo
  cliente não determinam a mensagem final.
- `chat-history`: snapshot `{messages}` enviado somente ao cliente entrando,
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
perdido. Leave, snapshot/reconnect e troca de sala limpam timers/presença typing.
Reconnect preserva draft não enviado, recebe snapshot e deduplica mensagens;
envios durante desconexão são bloqueados. Sair voluntariamente limpa o draft.
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

**Privacidade:** voz/tela continuam P2P entre peers. Chat em modo WebSocket passa
pelo signaling/application server e **não é E2E encrypted**. WSS protege apenas
o transporte até o servidor. `clientId` é identidade técnica efêmera, não usuário
autenticado; displayName é metadata visual e pode ser repetido/falsificado. Sem
login, banco, upload, edição/delete, reactions, bots ou criptografia própria.

Testes: `node --test --test-isolation=none tests/*.test.cjs` e
`node tests/spacevoice-integration.cjs --chat-only` com frontend em 3000, servidor
em 8787 e Edge/Playwright disponíveis. Execução sem flag também inclui o cenário
de chat na regressão completa. Evidências em `artifacts/spacevoice-v07-validation`.
Validar entre PCs/rede real e diferentes browsers antes de uso público; limites
por socket são simples e não substituem autenticação/moderação futura.

Validação v0.7 neste ambiente: 81 testes automatizados passaram; regressão Edge
real/headless com mídia fake passou em 49 verificações (39 anteriores + 10 de
chat), sem erros de console/pageerror. Durante chat, RTC/ICE ficaram connected,
SDP stable e bytes RTP cresceram nos três clientes. Chat não gerou offers nem
recriou elementos/srcObject de voz/tela; captura local de tela permaneceu única.
Capturas desktop com quatro participantes e mobile de 390 px foram inspecionadas,
sem overflow horizontal. Relatório completo preservado em `full-report.json`;
`report.json` registra a última execução, inclusive testes com `--chat-only`.

## Áudio diário — v0.6

`media.js` enumera audioinput/audiooutput com enumerateDevices, sem solicitar permissão para preencher listas. Antes da captura podem existir IDs/labels ocultos: o padrão do sistema permanece selecionável, e dispositivos sem label recebem nomes genéricos. Após getUserMedia a lista é atualizada. `devices.js` mantém uma assinatura devicechange, renovada na entrada/foco do seletor e removida na saída. Dispositivos salvos que desapareceram são corrigidos para default quando a lista está exposta; NotFoundError/OverconstrainedError na primeira captura de uma preferência antiga também tentam default.

Escolher mic fora da chamada salva a preferência. Dentro da chamada, `state.switchMicrophone()` obtém **uma** nova captura com deviceId exact e aplica o mute atual. `session.replaceMicrophone()` chama replaceTrack no sender de propósito microphone de todos os peers: não faz addTrack/removeTrack, não renegocia, não recria PCs e não modifica screen-video/screen-audio. Somente após todos os senders confirmarem, o estado/analyser local migra e a captura anterior é parada. Novos participantes durante a troca aguardam o commit, com SDP/ICE/metadata pendentes preservados.

Se a captura ou uma substituição falhar, a nova captura é liberada e a preferência anterior permanece. Falhas parciais tentam rollback de todos os senders para o mic anterior. Caso o browser também rejeite esse rollback, apenas o par afetado é fechado/recriado com o mic anterior; não há garantia de rollback nativo infalível. Saída da chamada invalida operações pendentes e libera resultados tardios.

Ao desaparecer o mic ativo (devicechange ou track ended), tenta-se default uma vez. Falha deixa o microfone indisponível, com aviso e possibilidade de seleção manual, preservando peers e captura de tela. Eventos repetidos não ficam recapturando um device ausente. Desaparecimento de outro device só atualiza a lista.

`setSinkId` é detectado por feature detection. A saída escolhida é aplicada aos elementos de voz remota e aos vídeos com system audio remoto, inclusive criados após a escolha. Preview local muted é excluído. A operação tenta restaurar a saída anterior em caso de falha e só salva uma nova preferência após sucesso. Se a API não existir, aparece “saída controlada pelo sistema”; permissões/política do browser podem impedir uma saída não padrão mesmo com suporte à API.

Somente `preferredAudioInputId`, `preferredAudioOutputId` e `remoteVolumes` são salvos no JSON `spacevoice-audio-preferences` do localStorage. Falha/bloqueio de storage preserva controles em memória. Volumes são limitados a 0–1 e 100 entradas. O identificador é o peerId efêmero: a preferência sobrevive à reentrada/reconnect daquele peer, mas um reload do participante gera novo ID, sem identidade persistente entre pessoas.

## Nível e speaking

`levels.js` usa **um AudioContext por sessão**, iniciado/resumido na ação de entrar, com MediaStreamSource → AnalyserNode independente para o mic local e a voz de cada peer. Nenhum node conecta ao destination; os elementos HTML existentes continuam responsáveis pela reprodução. Mídia de tela não cria monitor de voz.

A cada 50 ms (20 Hz), RMS dos samples time-domain vira nível visual 0–1 pela escala dB de −60 a −10, com clamp. A suavização usa 65% do novo nível ao subir e 20% ao cair. Speaking usa RMS ≥ 0,02 sustentado por 100 ms, com release/hangover de 400 ms. É heurística de energia, não reconhecimento de fala; música/ruído no próprio microfone podem ativá-la. Mute zera nível e speaking imediatamente. Volume/deafen locais não mudam o detector remoto. Atualizações escrevem somente meter/texto/data attribute dos indicadores, sem render global por sample ou aria-live de nível.

Mute é explícito: `participant-state {micMuted:boolean}` via WebSocket/BroadcastChannel. Cada peer recém-descoberto recebe o estado atual, incluindo late join/reconnect. O servidor valida o socket/room/from registrados e encaminha apenas micMuted boolean; falsificar outro sender/room ou enviar tipo inválido não altera estado. Deafen permanece local.

Cada participante tem um controle de volume recolhido, aplicado à sua voz e tela. Deafen, volume zero, preview local e tela fora de foco determinam muted local, sem sobrescrever a preferência de volume. Sair desconecta nodes, cancela o intervalo, fecha AudioContext e remove o listener de dispositivos; reentrar cria um único contexto/loop e um monitor por voz.

Referências: [W3C Media Capture](https://www.w3.org/TR/mediacapture-streams/), [replaceTrack](https://www.w3.org/TR/webrtc/#dom-rtcrtpsender-replacetrack), [Audio Output](https://www.w3.org/TR/audio-output/), [Web Audio](https://www.w3.org/TR/webaudio/).

## Iniciar

Requer Node.js 22+ e npm ou pnpm. Na raiz do projeto:

```sh
node server.cjs
```

Frontend: http://localhost:3000. Em outro terminal:

```sh
cd server
npm install
npm start
```

Alternativa: `pnpm install` e `pnpm start`. O lockfile pnpm está versionado. O servidor escuta em `0.0.0.0:8787`; `VOICE_HOST` e `VOICE_PORT` alteram endereço/porta. Ele não serve o frontend. Ctrl+C encerra o servidor e desconecta clientes.

## Configuração

WebSocket é o transporte padrão. A URL padrão é `ws://<hostname-do-frontend>:8787`, ou `wss://<hostname>:8787` se o frontend estiver em HTTPS.

Para apontar para outro computador, use:

```text
http://localhost:3000/?voiceWsUrl=ws%3A%2F%2F192.168.1.10%3A8787
```

A URL acima aponta para `ws://192.168.1.10:8787`. Substitua pelo IP LAN do servidor. Alternativamente defina, antes de criar SPACEVOICE, uma configuração global:

```js
window.SPACEVOICE_CONFIG = {
  transport: 'websocket',
  url: 'ws://192.168.1.10:8787',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
```

Os parâmetros `voiceTransport` e `voiceWsUrl` têm prioridade sobre a configuração global. Para desenvolvimento local: `http://localhost:3000/?voiceTransport=local`. BroadcastChannel permanece disponível, limitado à mesma origem e partição de armazenamento do navegador. Não há fallback automático que esconda erros de rede.

## Teste em dois PCs na mesma rede

1. Instale/abra esta versão do projeto em ambos os PCs. Execute `node server.cjs` em cada um e abra o frontend em `localhost:3000`. Isso permite microfone em contexto seguro sem configurar certificados LAN.
2. Execute o signaling somente no PC A. Descubra seu IP LAN (ex.: `192.168.1.10`) e permita a porta TCP 8787 no firewall para a rede de teste.
3. Abra em ambos o frontend local com `?voiceWsUrl=ws%3A%2F%2F192.168.1.10%3A8787`.
4. Entre em SPACEVOICE e em `geral` nos dois PCs; permita o microfone. Aguarde signaling conectado, descoberta do convidado e WebRTC conectado.
5. Use headset; confirme áudio nos dois sentidos, mute e deafen. Se autoplay bloquear, clique em reproduzir áudio remoto.
6. Saia e reentre. Feche uma aba e confirme remoção no outro PC. Pare/reinicie o signaling e confirme limpeza e nova negociação automática.

Para servir um único frontend a ambos os PCs, publique-o em HTTPS com certificado confiável. HTTP por IP LAN não permite getUserMedia normalmente. Em HTTPS, use WSS: este servidor mínimo não termina TLS, portanto configure um proxy TLS com suporte a upgrade WebSocket. Não basta trocar `ws` por `wss` contra a porta sem TLS. Fora da LAN, o endpoint também precisa ser alcançável pelos dois clientes.

## Protocolo e presença

Envelope: `{ type, roomId, from, to?, payload? }`. Tipos de cliente: `join`, `leave`, `offer`, `answer`, `ice`; snapshot do servidor: `peers`. `from` é um clientId efêmero criado por instância da interface, nunca username/autenticação. `geral` é a sala padrão; o servidor suporta outras salas sem UI adicional.

O primeiro join registra a identidade na conexão. O servidor captura os IDs existentes, registra o novo cliente e envia somente a ele `{ type: "peers", roomId, to: clientId, payload: { peers: [idA, idB] } }`. Em seguida, anuncia um join aos participantes anteriores. O snapshot não tem `from`, pois é emitido pelo servidor; mensagens `peers` enviadas por clientes são rejeitadas. Assim, C descobre A/B e A/B descobrem C sem depender de handshake ou timing acidental. BroadcastChannel preserva o handshake de join com `payload.reply`, pois não tem servidor. Para a conexão inicial de cada par, o menor clientId cria a offer. Após conectar, qualquer lado pode renegociar ao iniciar/parar tela; perfect negotiation resolve collisions por par. Offer/answer/ICE exigem destinatário e são enviados só para esse cliente na mesma sala. Joins direcionados respeitam `to`; não há eco ao remetente. Leave e desconexão removem o registro e anunciam saída à sala. Mensagens inválidas, binárias, tentativas de mudar identidade/sala e destinos em outra sala são ignorados. clientId duplicado na mesma sala fecha a nova conexão. O limite de mensagem é 64 KiB.

O servidor mantém apenas rooms/clientes em memória, sem persistência. Ping/pong a cada 15 segundos encerra conexões sem resposta na próxima verificação, evitando presença presa após perda abrupta de rede.

## Lifecycle e arquitetura

`signaling-ws.js` implementa a mesma interface `send(type, to, payload)`/`close()` do transporte local. A construção abre o socket; join solicitado enquanto conecta é enviado no open. As mensagens recebidas são filtradas por tipo, sala, remetente e destinatário. A sessão usa callbacks para receber o estado do transporte.

Em queda/erro do signaling local, `session.js` fecha todos os peers daquele cliente e remove seus áudios/participantes. Nos demais clientes, o leave emitido pelo servidor remove apenas o peer que caiu; as conexões entre os demais continuam intactas. Após queda, o cliente tenta reconectar a cada 1,5 segundo e envia um novo join para obter um snapshot atual e reconstruir seus pares; SDP/ICE antigos não são enfileirados nem reutilizados. O microfone permanece ativo enquanto o usuário ainda está na chamada, permitindo recuperação automática. Sair cancela o timer e desliga listeners/socket, peers, reprodução e captura; não reconecta. Reentrada funciona sem reload.

`session.js` usa `Map<clientId, entry>`: cada entry possui controller WebRTC, estado de conexão e estado ICE. `ensurePeer` é idempotente; `remove` limpa só aquele participante. Um snapshot remove IDs ausentes e cria IDs novos, preservando os já presentes. Joins repetidos não geram offers repetidas. `peer.js` continua representando uma única conexão e independente do transporte; recebe `iceServers` e reporta estado ICE por callback. A UI injeta o transporte escolhido e STUN (configurável) na sessão existente. `media.js` e `state.js` permanecem intactos. Os testes diretos de peer continuam podendo usar iceServers vazio.

## Captura de tela e UI v0.5

Clique em **compartilhar tela** somente depois de entrar na chamada. `media.js` chama `navigator.mediaDevices.getDisplayMedia({video: constraints, audio:true})` dentro da ação explícita do usuário. O picker do browser escolhe tela/janela/aba; não existe captura automática na aplicação. Cancelamento/permissão negada, API ausente e vídeo ausente geram status próprio sem encerrar a voz. Sem áudio de sistema, o vídeo continua normalmente.

`state.js` mantém `localStream` (nome anterior para microphoneStream) separado de `screenStream`, sem storage. No máximo uma captura de tela ativa por participante; pedidos simultâneos são bloqueados. Resultados atrasados depois de sair/cancelar são imediatamente parados. O evento `ended` da video track chama o mesmo cleanup do botão **parar tela**; parar tela encerra video/system audio e remove apenas os senders de tela. O microfone e as PeerConnections continuam ativos. Sair da chamada encerra ambas as capturas.

A área central mostra um vídeo por vez, com tabs discretas para as telas disponíveis. Cada share possui seu próprio `<video autoplay playsinline>`; preview local permanece muted. Só a tela remota em foco reproduz system audio, evitando mistura de múltiplas telas. Deafen silencia voz e todos os vídeos remotos sem parar tracks nem afetar o transmissor. Se autoplay for bloqueado, o botão de reprodução tenta retomar voz e vídeo focado. Se a tela focada parar, outra é selecionada; sem shares, a área fica vazia novamente.

O status usa **getSettings() reais**: width/height/frameRate/displaySurface quando informados. Os presets são preferências, não garantias:

| Preset | Resolução ideal | FPS ideal/máximo | maxBitrate solicitado por peer |
| --- | --- | --- | --- |
| 720p60 | 1280×720 | 60 | 4 Mbps |
| 1080p30 | 1920×1080 | 30 | 6 Mbps |
| 1080p60 (padrão) | 1920×1080 | 60 | 10 Mbps |
| 1440p60 | 2560×1440 | 60 | 14 Mbps |

A captura usa constraints ideal para resolução, ideal/max para frameRate e `contentHint="detail"` quando suportado. Browser/OS/superfície podem entregar valores diferentes; 1440p60 não é garantia. Cada sender de screen-video tenta aplicar maxBitrate com getParameters/setParameters depois da negociação. Limites podem ser ignorados/reduzidos; falhas desse ajuste são não fatais. Em mesh, 1080p60 com limite de 10 Mbps e três remotos pode demandar até aproximadamente **30 Mbps** de upload do sharer (mais voz/overhead). Não é uma taxa medida ou prometida.

## Propósitos, shares remotos e late join

`peer.js` representa uma conexão, com `Map<purpose, {sender, track, stream}>`: **microphone**, **screen-video**, **screen-audio**. `session.setScreen()` distribui a mesma captura e as mesmas tracks a todos os peers; não repete getDisplayMedia por destinatário. Ao criar um novo peer, a sessão fornece o microfone e a captura de tela atualmente viva. Reconnect limpa os pares afetados e anexa novamente essa captura após o snapshot; não abre outro picker.

Offer/answer preservam type/sdp e adicionam `media: [{purpose, mid, trackId, streamId}]`. MID associa cada track ao propósito, com trackId como fallback explícito; não se usa ordem de chegada, aparência ou número de tracks para identificar mídia. Os metadados viajam com a descrição correspondente, antes de processar ontrack. O servidor apenas roteia esses JSONs, sem conhecer/transportar a mídia. Ambos os clientes devem estar em v0.5 para screen sharing; áudio legado sem metadata ainda é aceito.

Os receptores são identificados pela identidade do transceiver, cujo MID pode mudar após rollback. A sessão associa `entry.remoteShare = {stream, videoTrack, audioTrack, state}` ao peer correto e a UI mantém suas entradas por peerId. Microfone remoto e tela remota são streams separados; duas pessoas podem compartilhar independentemente. A ausência de screen-video na nova descrição remove a share correspondente, inclusive quando removeTrack somente silencia o receiver sem emitir ended.

## Perfect negotiation por par

`polite = localClientId > remoteClientId`. A eleição inicial pelo menor ID é mantida, mas os filtros que rejeitavam offers posteriores do maior ID foram removidos da sessão. Depois, negotiationneeded é atendido em ambos os lados.

Cada endpoint possui makingOffer, ignoreOffer e isSettingRemoteAnswerPending, com operações serializadas. O impolite ignora uma offer colidida e seus candidatos; o polite aceita a offer usando rollback implícito de setRemoteDescription. Após responder, se o rollback deixar senders locais ainda sem MID, o endpoint cria uma nova offer para negociar essas tracks pendentes: uma answer não pode adicionar m-lines. Isso é condicionado ao estado dos transceivers, sem delays/setTimeout para esconder colisões. negotiationneeded continua cuidando das alterações normais.

Referência do padrão: [W3C — Perfect Negotiation](https://www.w3.org/TR/webrtc/#perfect-negotiation-example).

## Testes

Após instalar a dependência do servidor, na raiz:

```sh
node --test tests/*.test.cjs
```

Se o ambiente restringir subprocessos, use `node --test --test-isolation=none tests/*.test.cjs`. Os testes incluem sockets reais com porta efêmera, registro/isolamento de salas, roteamento SDP/ICE, destinatários, identidade vinculada ao socket, leave/disconnect, adapter/filtragem/cleanup/reconexão e integração da sessão. Os testes BroadcastChannel, WebRTC, captura e UI anteriores permanecem. A cobertura mesh inclui 3/4 clientes, eleição por par, roteamento independente de answer/ICE, manutenção de A–B na entrada/saída de C, snapshot/reconciliação, reconexão, captura compartilhada, deafen multi-áudio e cleanup total.

## Teste integrado de browser

Com frontend e signaling iniciados, execute:

```sh
node tests/spacevoice-integration.cjs
```

No ambiente atual, o script usa Playwright do runtime Codex e Edge instalado (caminhos no início do arquivo). Fora deste ambiente, ajuste esses caminhos para Playwright/Chromium local. Usa `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--use-file-for-fake-audio-capture`, `--auto-select-desktop-capture-source=Entire screen` e autoplay liberado: não acessa microfone físico nem perfil pessoal. O WAV gerado pelo harness tem tom de três segundos/silêncio de um segundo, pois os bipes curtos padrão não satisfazem o attack de fala. Relatório e screenshots: `artifacts/spacevoice-v06-validation/`.

O teste preserva os cenários de dois clientes e adiciona 3 e 4 contextos independentes: quantidade de participantes/peers, todos connected, ICE connected/completed, track remota e RTP em cada caminho, pares únicos e menor clientId como offerer. Verifica C sair/reentrar mantendo A–B, D entrar sem recriar pares existentes, mute/deafen, queda de socket de C com novo snapshot e cleanup sem duplicações. Também testa mesh BroadcastChannel em três abas do mesmo contexto.

A integração v0.5 adiciona quatro contextos, getDisplayMedia nativo com fake device, shares A/B, late join de C/D, RTP de vídeo e frames decodificados, parar apenas A, reconectar B mantendo a captura, glare real com offers retidas/liberadas só pelo harness, stop/start repetido, seletor, deafen e layouts desktop/mobile com aparência/wallpaper. `node tests/spacevoice-integration.cjs --screen-only` executa só os cenários de tela. O harness também permite fallback de canvas/áudio injetado somente no teste se o browser não disponibilizar desktop capture fake; a aplicação de produção não é alterada para simular captura.

O evento ended é testado encerrando a track real e despachando o evento no harness; o botão do toolbar nativo do navegador ainda requer validação manual. O fechamento forçado do socket é um teste de desconexão/reconexão, não simula perda física de rede. A mídia fake confirma transporte RTP, não qualidade audível, dispositivos físicos, NAT externo ou política normal de autoplay/permissões.

## Resultado da validação v0.6

- **67 testes automatizados e 39 verificações integradas passaram**, sem erros de console/JavaScript no Edge 154.0.4258.37. Inclui as 28 verificações anteriores de voz/tela e 11 de áudio diário. `node tests/spacevoice-integration.cjs --audio-only` isola os novos cenários.
- O browser expôs dois inputs e dois outputs fake. A troca para **Fake Audio Input 2** fez um getUserMedia e dois replaceTrack em A–B/A–C, sem nova offer/PC. Os pares permaneceram RTC connected, ICE connected e signaling stable; contadores RTP de áudio cresceram após a troca.
- Default e **Fake Audio Output 2** funcionaram via setSinkId em todos os elementos remotos de voz e tela. Isto valida a API no ambiente fake, não o roteamento audível em hardware real.
- Remoção de mic foi simulada filtrando enumerateDevices e disparando devicechange somente no harness; a captura default e o replaceTrack subsequentes permaneceram nativos. O fallback ocorreu uma vez e não recriou os peers. Desconexão física USB/Bluetooth ainda é pendente.
- Medidor/speaking local e remoto reagiram ao WAV da captura fake; mute foi anunciado explicitamente ao quarto participante que entrou depois. Uma tela com system audio continuou viva sem entrar nos analysers de voz.
- Volume 25% de B afetou voz/tela de B, preservando os outros. Deafen/undeafen restauraram preferências. Leave zerou contextos ativos, sources conectados, timer e device listener; reentrada teve um contexto/loop/listener e quatro monitores (local + três vozes).
- Desktop/mobile, lista com quatro pessoas, speaking/mute, medidor, tela e múltiplos shares foram verificados. Wallpaper/cores e glare/reconnect de tela continuam passando.
- Relatório: `../../artifacts/spacevoice-v06-validation/report.json`; visuais: `audio-with-screen.png`, `audio-mobile.png`, `audio-muted.png`, `screen-two-sharers.png` e `screen-appearance.png` no mesmo diretório.

## Resultado da validação v0.5

- **50 testes automatizados e 28 verificações integradas passaram** no Edge 154.0.4258.37, com frontend em localhost:3000 e signaling real em localhost:8787.
- getDisplayMedia nativo com fake device retornou vídeo 1920×1080 a 60 fps, superfície monitor, e áudio simulado. O fallback de canvas não foi necessário.
- Quatro contextos independentes receberam shares simultâneas e late join, recuperaram reconnect/glare e mantiveram voz. Os pares ativos terminaram connected, ICE connected e signaling stable; o cleanup terminou closed.
- Screen RTP teve bytes enviados/recebidos e frames decodificados: um snapshot registrou 78.046 bytes e 13 frames recebidos. São amostras breves de teste, não medição de qualidade ou throughput sustentado.
- Nenhum erro de console/JavaScript. Desktop, mobile, seletor, preview local, wallpaper e cores personalizadas foram verificados.
- Evidências: `../../artifacts/spacevoice-v05-validation/report.json` e screenshots no mesmo diretório.

## Regressão de voz/mesh v0.4 preservada

- Na v0.4, 42 testes de regressão/unitários/protocolo passaram; v0.5 acrescenta captura e renegociação.
- 17 cenários/verificações integradas passaram no Edge 154.0.4258.37 headless com mídia fake.
- 3 contextos independentes: 2 peers por cliente e 3 pares únicos, com RTP recebido nos seis caminhos direcionais.
- 4 contextos independentes: 3 peers por cliente e 6 pares únicos, com RTP recebido nos doze caminhos direcionais.
- RTCPeerConnection: new → connecting → connected; ICE: new → checking → connected; gathering: new → gathering → complete; signaling estabilizou em stable.
- C saiu/reentrou sem recriar A–B. A entrada de D preservou os pares existentes. A reconexão de C em uma sala de quatro refez somente os seus três pares.
- Sem erros de console/JavaScript. Mesh local BroadcastChannel também passou com três abas.
- Relatório detalhado: `../../artifacts/spacevoice-v05-validation/report.json`; screenshot: `../../artifacts/spacevoice-v05-validation/mesh-four-connected.png`.

## Limitações

- Labels, IDs e outputs podem estar ocultos antes da permissão. DeviceIds podem mudar. setSinkId e seleção de saída dependem de browser, contexto seguro, política, permissões e OS; suporte à API não garante acesso a todas as saídas. Speaking é heurística por nível, não distinção semântica entre fala, ruído ou música no microfone.
- Testar hardware USB/headset, troca real de input/output, desconexão/reconexão, permissões normais, sidetone/eco e qualidade audível. Bluetooth pode mudar perfil/qualidade quando seu mic é ativado, dependendo do SO/dispositivo. Nenhum DSP próprio foi adicionado.

- getDisplayMedia exige ação do usuário e contexto seguro. Permissão de screen capture não é persistida; browser/OS/superfície determinam áudio de sistema disponível. Headless fake retornou vídeo e áudio, mas isso não confirma captura de som real do OS.
- O teste com fonte fake não valida desktop físico, legibilidade, qualidade audível, FPS sustentado, performance em jogos ou qualidade em redes lentas. Testar picker real (tela/janela/aba), toolbar de parada, som do sistema, autoplay padrão e permissões manualmente.

- Mesh para grupos pequenos, sem limite rígido de quatro: cada cliente mantém N − 1 PeerConnections e a sala N × (N − 1) / 2 pares únicos. O número total de conexões cresce O(N²), com custo de CPU e upload por cliente aumentando com N. Esta versão é validada principalmente com 3/4 participantes, sem garantia de desempenho para 5/6 ou mais. Screen share aumenta principalmente o upload do sender. Para grupos maiores, considerar SFU/LiveKit no futuro; nenhum servidor de mídia foi implementado.
- STUN ajuda a descobrir endereços públicos, mas não garante conectividade. Sem TURN, NATs restritivas, redes corporativas, bloqueios UDP e algumas combinações de redes podem impedir áudio mesmo com signaling funcionando.
- Sem autenticação, controle de acesso ou TLS próprio; destinado a desenvolvimento/rede de teste. Username é apenas visual. Não há TURN, SFU, gravação, webcam, chat, remote control ou persistência de mídia.
- Testes automatizados validam protocolo/lifecycle; áudio físico e travessia de NAT precisam de teste manual entre PCs.
# Revisão de qualidade do áudio de tela

O áudio de tela continua em track, sender e MID separados do microphone. Antes,
`getDisplayMedia` recebia `audio: true`, sem constraints de processamento ou limite
de bitrate para esse sender. Não havia reaproveitamento de constraints do mic,
mas os defaults de captura do browser podiam incluir processamento de voz.

Apenas screen-audio agora pede `echoCancellation: false`, `noiseSuppression: false`,
`autoGainControl: false` e `channelCount: {ideal: 2}`, com `contentHint: music`.
Essas opções são preferências dependentes do suporte do browser/fonte. Seu sender
prefere Opus reordenando capacidades nativas sem remover codecs de fallback; após
negociação, aplica somente `encodings[].maxBitrate = 192000`. É um teto de 192 kbps,
não garantia de bitrate mínimo: VBR e adaptação de rede continuam ativos. Rejeição
de tuning não bloqueia SDP. Microphone e screen-video mantêm seus parâmetros.

Não há edição de SDP/fmtp ou campos obsoletos para forçar estéreo/DTX. Conforme
[RFC 7587](https://www.rfc-editor.org/rfc/rfc7587.html), `opus/48000/2` aparece
inclusive em áudio mono; `stereo` ausente significa preferência mono e `usedtx`
ausente significa DTX desligado por padrão. `channels`/fmtp não são parâmetros
graváveis de `setParameters`. Capturar dois canais não garante estéreo negociado.

Validação integrada: `node tests/spacevoice-integration.cjs --screen-audio-only`.
Usa Edge real/headless, dois contexts independentes, WebSocket real em 8787 e mídia
fake. Instrumentação de teste, sem alterar tracks, coleta `getSettings`, constraints,
sender/receiver `getParameters`, SDP e `getStats` especificamente do screen-audio:
codec, canais de captura/recepção/capacidade, bytes, bitrate por intervalo, packetsLost,
jitter e RTT. Valores ausentes ficam `null`; RTT do candidate pair é identificado
como transporte ICE compartilhado, diferente do RTT RTCP específico de áudio.
Relatórios: `artifacts/spacevoice-screen-audio-validation/{before,after}`. A opção
`--baseline` só muda o destino e desativa asserts novos; não restaura código antigo.

No baseline medido antes da alteração, captura fake mono/48 kHz com EC/NS/AGC
ativos, Opus, sem maxBitrate: ~18 kbps. Após ajuste, captura 2 canais/44,1 kHz,
EC/NS/AGC desativados, Opus/48 kHz e maxBitrate 192000 aceito: ~142 kbps no mesmo
tom/silêncio sintético de seis segundos. Recepção ainda reportou 1 canal e nenhum
`stereo=1` negociado: estéreo ponta a ponta continua pendente. Nos dois testes:
RTC/ICE connected, signaling stable, áudio remoto recebido, perda zero, jitter
até ~1 ms e RTT RTCP ~1 ms. Isso não determina a causa da degradação no hardware
real nem prova fidelidade musical; fonte fake não é captura física do áudio do SO.

Para comparar qualidade, mantenha a fonte capturada ativa e ouça somente o receptor,
preferencialmente em outro PC com fones. No mesmo PC, ouvir o original e o retorno
WebRTC simultaneamente soma sinais com atraso e causa eco/comb filtering, mesmo
com stream íntegro. A prévia local do SPACEVOICE já fica muted, mas não silencia o
player original. Isole as saídas com roteamento de áudio/dispositivos distintos;
mutar o player ou mixer pode também eliminar o sinal capturado, dependendo da fonte.
Evite capturar o próprio retorno WebRTC no áudio do sistema; silencie esse retorno
no cliente emissor. Validar ainda música/vídeo reais, imagem estéreo, captura por
aba/tela/SO, browsers diferentes e rede entre PCs com perda/jitter reais.
