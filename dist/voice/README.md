# SPACEVOICE v0.5

Signaling WebSocket real, voz e compartilhamento de tela browser-native em mesh P2P entre múltiplos participantes. O servidor recebe somente JSON de presença, SDP e ICE: não recebe MediaStream, não armazena nem retransmite áudio. A interface e os controles de microfone/deafen foram preservados.

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

No ambiente atual, o script usa Playwright do runtime Codex e Edge instalado (caminhos no início do arquivo). Fora deste ambiente, ajuste esses caminhos para Playwright/Chromium local. Usa `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--auto-select-desktop-capture-source=Entire screen` e autoplay liberado: não acessa microfone físico nem perfil pessoal. Relatório e screenshots: `artifacts/spacevoice-v05-validation/`.

O teste preserva os cenários de dois clientes e adiciona 3 e 4 contextos independentes: quantidade de participantes/peers, todos connected, ICE connected/completed, track remota e RTP em cada caminho, pares únicos e menor clientId como offerer. Verifica C sair/reentrar mantendo A–B, D entrar sem recriar pares existentes, mute/deafen, queda de socket de C com novo snapshot e cleanup sem duplicações. Também testa mesh BroadcastChannel em três abas do mesmo contexto.

A integração v0.5 adiciona quatro contextos, getDisplayMedia nativo com fake device, shares A/B, late join de C/D, RTP de vídeo e frames decodificados, parar apenas A, reconectar B mantendo a captura, glare real com offers retidas/liberadas só pelo harness, stop/start repetido, seletor, deafen e layouts desktop/mobile com aparência/wallpaper. `node tests/spacevoice-integration.cjs --screen-only` executa só os cenários de tela. O harness também permite fallback de canvas/áudio injetado somente no teste se o browser não disponibilizar desktop capture fake; a aplicação de produção não é alterada para simular captura.

O evento ended é testado encerrando a track real e despachando o evento no harness; o botão do toolbar nativo do navegador ainda requer validação manual. O fechamento forçado do socket é um teste de desconexão/reconexão, não simula perda física de rede. A mídia fake confirma transporte RTP, não qualidade audível, dispositivos físicos, NAT externo ou política normal de autoplay/permissões.

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

- getDisplayMedia exige ação do usuário e contexto seguro. Permissão de screen capture não é persistida; browser/OS/superfície determinam áudio de sistema disponível. Headless fake retornou vídeo e áudio, mas isso não confirma captura de som real do OS.
- O teste com fonte fake não valida desktop físico, legibilidade, qualidade audível, FPS sustentado, performance em jogos ou qualidade em redes lentas. Testar picker real (tela/janela/aba), toolbar de parada, som do sistema, autoplay padrão e permissões manualmente.

- Mesh para grupos pequenos, sem limite rígido de quatro: cada cliente mantém N − 1 PeerConnections e a sala N × (N − 1) / 2 pares únicos. O número total de conexões cresce O(N²), com custo de CPU e upload por cliente aumentando com N. Esta versão é validada principalmente com 3/4 participantes, sem garantia de desempenho para 5/6 ou mais. Screen share aumenta principalmente o upload do sender. Para grupos maiores, considerar SFU/LiveKit no futuro; nenhum servidor de mídia foi implementado.
- STUN ajuda a descobrir endereços públicos, mas não garante conectividade. Sem TURN, NATs restritivas, redes corporativas, bloqueios UDP e algumas combinações de redes podem impedir áudio mesmo com signaling funcionando.
- Sem autenticação, controle de acesso ou TLS próprio; destinado a desenvolvimento/rede de teste. Username é apenas visual. Não há TURN, SFU, gravação, webcam, chat, remote control ou persistência de mídia.
- Testes automatizados validam protocolo/lifecycle; áudio físico e travessia de NAT precisam de teste manual entre PCs.
