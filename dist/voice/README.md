# SPACEVOICE v0.3

Signaling WebSocket real, áudio WebRTC P2P entre dois participantes. O servidor recebe somente JSON de presença, SDP e ICE: não recebe MediaStream, não armazena nem retransmite áudio. A interface e os controles de microfone/deafen foram preservados.

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

Envelope: `{ type, roomId, from, to?, payload? }`. Tipos: `join`, `leave`, `offer`, `answer`, `ice`. `from` é um clientId efêmero criado por instância da interface, nunca username/autenticação. `geral` é a sala padrão; o servidor suporta outras salas sem UI adicional.

O primeiro join registra a identidade na conexão. O servidor envia os joins dos clientes já presentes ao novo cliente e anuncia o novo aos demais. A sessão mantém seu handshake de join com `payload.reply`; o menor clientId cria a offer. Offer/answer/ICE exigem destinatário e são enviados só para esse cliente na mesma sala. Joins direcionados respeitam `to`; não há eco ao remetente. Leave e desconexão removem o registro e anunciam saída à sala. Mensagens inválidas, binárias, tentativas de mudar identidade/sala e destinos em outra sala são ignorados. clientId duplicado na mesma sala fecha a nova conexão. O limite de mensagem é 64 KiB.

O servidor mantém apenas rooms/clientes em memória, sem persistência. Ping/pong a cada 15 segundos encerra conexões sem resposta na próxima verificação, evitando presença presa após perda abrupta de rede.

## Lifecycle e arquitetura

`signaling-ws.js` implementa a mesma interface `send(type, to, payload)`/`close()` do transporte local. A construção abre o socket; join solicitado enquanto conecta é enviado no open. As mensagens recebidas são filtradas por tipo, sala, remetente e destinatário. A sessão usa callbacks para receber o estado do transporte.

Em queda/erro, `session.js` fecha peers e remove áudios/participantes. Após queda, o cliente tenta reconectar a cada 1,5 segundo e envia um novo join; SDP/ICE antigos não são enfileirados nem reutilizados. O microfone permanece ativo enquanto o usuário ainda está na chamada, permitindo recuperação automática. Sair cancela o timer e desliga listeners/socket, peers, reprodução e captura; não reconecta. Reentrada funciona sem reload.

`peer.js` continua independente do transporte; a única extensão é receber `iceServers`. A UI injeta o transporte escolhido e STUN (configurável) na sessão existente. `media.js` e `state.js` permanecem intactos. Os testes diretos de peer continuam podendo usar iceServers vazio.

## Testes

Após instalar a dependência do servidor, na raiz:

```sh
node --test tests/*.test.cjs
```

Se o ambiente restringir subprocessos, use `node --test --test-isolation=none tests/*.test.cjs`. Os testes incluem sockets reais com porta efêmera, registro/isolamento de salas, roteamento SDP/ICE, destinatários, identidade vinculada ao socket, leave/disconnect, adapter/filtragem/cleanup/reconexão e integração da sessão. Os testes BroadcastChannel, WebRTC, captura e UI anteriores permanecem.

## Limitações

- A sessão continua limitada a um peer remoto (dois participantes); o servidor aceita múltiplos clientes/salas, mas não transforma a chamada em conferência.
- STUN ajuda a descobrir endereços públicos, mas não garante conectividade. Sem TURN, NATs restritivas, redes corporativas, bloqueios UDP e algumas combinações de redes podem impedir áudio mesmo com signaling funcionando.
- Sem autenticação, controle de acesso ou TLS próprio; destinado a desenvolvimento/rede de teste. Username é apenas visual. Não há TURN, SFU, gravação, vídeo, chat, screen share ou persistência.
- Testes automatizados validam protocolo/lifecycle; áudio físico e travessia de NAT precisam de teste manual entre PCs.
