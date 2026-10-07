# PARTY — ICE/TURN deployment e teste de rede

STUN permite descobrir candidatos de rota pública; TURN retransmite mídia quando
o ICE não consegue uma rota direta. TURN não substitui o WebSocket de signaling
e presence. A PARTY continua mesh, com uma conexão independente por par.

```text
Browser ── WSS ── signaling/presence + credenciais temporárias
   └──── WebRTC ── direct/STUN ou TURN UDP/TCP/TLS ── outro browser
```

## Configuração

1. Instale Coturn em um servidor público, pelo gerenciador de pacotes do servidor.
   Docker é opcional e não é necessário para rodar a PARTY.
2. Aponte `turn.example.com` ao IP público e obtenha um certificado TLS válido.
   Copie `turnserver.conf.example` para `/etc/turnserver.conf`, substituindo hostname,
   caminhos do certificado e o placeholder do secret por um valor aleatório forte.
   Coturn não expande `${ENV}` nesse arquivo. Proteja-o e não o versione.
3. Configure no processo de signaling o MESMO secret em `PARTY_TURN_SECRET`:

   ```dotenv
   NODE_ENV=production
   PARTY_STUN_URLS=stun:turn.example.com:3478
   PARTY_TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:5349?transport=tcp
   PARTY_TURN_SECRET=SUBSTITUIR_POR_SECRET_PRIVADO
   PARTY_TURN_TTL=3600
   PARTY_ALLOWED_ORIGINS=https://party.example.com
   VOICE_HOST=127.0.0.1
   VOICE_PORT=8787
   ```

   O entrypoint `node server/signaling-server.cjs` lê `.env` da raiz quando a
   versão do Node oferece `process.loadEnvFile` (use Node 22+). Variáveis do
   ambiente têm precedência. Não coloque esse arquivo no diretório estático.
4. Libere no firewall/cloud/NAT: **3478 UDP e TCP**, **5349 TCP**, e
   **49160–49200 UDP**, além de HTTPS 443 da aplicação. O range pequeno atende
   desenvolvimento e poucos pares; dimensione portas, quotas e banda para produção.
   TURN TCP/TLS é o transporte browser → Coturn; a allocation de mídia WebRTC
   continua UDP no relay, por isso o range UDP é necessário também nesses casos.
5. Se Coturn estiver atrás de NAT, configure explicitamente
   `external-ip=PUBLIC_IP/PRIVATE_IP` e encaminhe as portas mantendo seus números.
   Não há autodetecção. Verifique IPv6, DNS, regras de nuvem e sincronização de relógios.
6. Inicie Coturn com `turnserver -c /etc/turnserver.conf` ou seu serviço de sistema.
   Configure renovação do certificado e reinício/reload adequado do serviço.
7. Publique `dist/` via HTTPS. Encaminhe `/party-signaling` por um proxy WSS
   ao signaling interno. O proxy deve preservar o header `Origin`:

   ```nginx
   location /party-signaling {
       proxy_pass http://127.0.0.1:8787;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Origin $http_origin;
       proxy_read_timeout 60s;
   }
   ```

   Em HTTPS o cliente usa `wss://<mesmo-host>/party-signaling` por padrão.
   Localmente usa `ws://localhost:8787`. `SPACEVOICE_CONFIG.url` ainda permite
   configurar outro endereço WSS; carregue essa configuração antes dos scripts.
   Um certificado self-signed não é a recomendação para clientes reais.

## Credenciais e segurança

O cliente registrado na sala solicita `ice-config-request`; o servidor responde
`ice-config`, com `iceServers` e `expiresAt` em milissegundos. Username:
`<expiry-segundos>:<UUID-aleatório>`; credential: Base64 de
`HMAC-SHA1(shared-secret, username)`, compatível com TURN REST do Coturn.
TTL padrão: 3600 s; intervalo permitido: 120–86400 s.

O secret nunca sai do servidor. O browser recebe somente a credencial efêmera,
em cache na memória, com renovação quando faltam 60 s. Novo peer consulta o cache;
uma renovação não reinicia os pares existentes. Antes de ICE restart, consulta
novamente e aplica `setConfiguration` quando suportado. Erros de atualização
não derrubam outros pares. Não há credencial em localStorage, logs ou diagnóstico.

Sem TURN/config secret, o servidor retorna STUN-only. Isso mantém desenvolvimento
funcional, mas não resolve NATs que exigem relay. O transporte local BroadcastChannel
usa apenas STUN e não valida TURN nem redes distintas.

Requisições exigem a identidade vinculada ao socket/sala, requestId limitado e
payload fechado. Limites: 6 por socket/minuto, 30 por IP/minuto, incluindo novos
sockets. A origem é conferida por allowlist; em produção com TURN ela é obrigatória.
O IP é o socket real, sem confiar em X-Forwarded-For. Atrás de proxy, o limite por
IP é compartilhado entre seus clientes: dimensione isso e limite também no proxy.
Sem auth, um cliente autorizado pela origem/sala ainda pode pedir credenciais;
Origin não autentica clientes não-browser. Quotas Coturn e limites de borda são
necessários; isto não implementa autenticação completa.

## Diagnóstico e recuperação

Policy padrão: `all`; o browser seleciona o candidate pair. Para validar TURN,
abra **ambos** os clientes com `?party=teste&voiceIcePolicy=relay#spacevoice`.
Em **mídia → diagnóstico de conexão → atualizar diagnóstico**, veja rota, transporte
e RTT. Não mostra IPs, SDP nem credenciais. Campos ausentes do browser são tolerados;
`relayProtocol` descreve browser → TURN, enquanto `protocol` pode ser UDP no relay.
O helper `PARTY_NETWORK.getPeerConnectionDiagnostics(pc)` também retorna os quatro
estados brutos e candidate types. Sem polling constante.

`disconnected` espera 5 s, cancelados se recuperar sozinho. `failed` inicia recovery
sem essa espera. O menor ID inicia ICE restart; o outro solicita ao líder.
No máximo 3 tentativas, com esperas de 12, 15 e 18 s. `restartIce()` e fallback
`createOffer({iceRestart:true})` passam pela fila de perfect negotiation existente.
Ao esgotar, somente o participante afetado oferece `[ tentar novamente ]`.
Queda de WSS pausa recovery que depende de signaling, mas mantém mídia P2P.
Ao voltar, snapshots reconciliam os pares sem duplicá-los. Ausências inesperadas
têm 30 s de tolerância, estendida enquanto o par estiver conectado; saída explícita
fecha imediatamente. Não depende de Network Information API.

TURN trafega aproximadamente 10 Mbps inbound + 10 Mbps outbound para um fluxo
de tela a 10 Mbps. Em mesh cresce por destinatário, incluindo relay independente
para cada par. Não existe SFU ou controle de congestionamento custom.

## Teste manual exato: dois PCs em redes diferentes

1. Faça o deployment acima e confira certificado, firewall, secret e relógios.
2. PC A na rede residencial: abra
   `https://party.example.com/?party=teste-rede#spacevoice`.
3. PC B em outra rede/hotspot: abra o mesmo link. Abra PARTY e entre na sala.
   Confira os dois nomes no lobby; ainda não deve pedir microfone nem criar PC.
4. Ambos entram na chamada e autorizam microfone. Use fones; confirme áudio nos
   dois sentidos. Atualize o diagnóstico em cada lado e anote rota/protocolo/RTT.
5. Saia da chamada em ambos e repita com
   `https://party.example.com/?party=teste-rede&voiceIcePolicy=relay#spacevoice`.
   Ambos devem conectar e mostrar **relay**. Host/srflx não valida TURN.
6. Para isolar cada transporte, configure temporariamente apenas uma URL TURN
   (UDP, depois TCP, depois TLS) no servidor, reinicie signaling e recarregue ambos.
   Repita o passo 5. Não infira TCP/TLS somente de `protocol=udp`; veja `relayProtocol`
   quando disponível e as allocations do Coturn sem publicar credenciais.
7. Durante áudio, mude B entre Wi-Fi e hotspot/VPN. Aguarde recovery; confirme
   retorno de áudio/rota. Se falhar definitivamente, use retry no participante.
8. Interrompa apenas o signaling por poucos segundos, mantenha Coturn ativo e
   confirme que áudio P2P continua se sua rota permanecer funcional. Reative-o:
   presence/call devem reconciliar sem duplicar participantes.
9. Saia da call; confirme lobby e mídia avançada disponíveis; chat, mensagens e draft conservam o lifecycle da ROOM.

Teste entre duas redes físicas e relay exigem infraestrutura TURN real.
Mocks não provam atravessamento de CGNAT/firewall, TLS ou RTP via relay.

Referências oficiais: [Coturn config](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf),
[TURN REST](https://github.com/coturn/coturn/blob/master/README.turnserver),
[WebRTC restartIce/setConfiguration](https://www.w3.org/TR/webrtc/).


## Provider Metered

Selecione `PARTY_ICE_PROVIDER=metered` e defina `METERED_DOMAIN` (origem HTTPS) e
`METERED_TURN_API_KEY` exclusivamente no backend/ambiente privado. Coturn continua
suportado com `PARTY_ICE_PROVIDER=coturn`, o default. O frontend e a arquitetura de
mídia continuam usando `getIceConfiguration()` pelo signaling existente.

O backend usa [Get TURN Credential oficial](https://www.metered.ca/docs/turn-rest-api/get-credential/),
valida o array e remove campos extras. Só URLs ICE, username e credential TURN
são enviados ao browser; a API key nunca é enviada. Não loga URL autenticada nem
corpo/erro da API. Redirects são recusados; timeout de 6 s e resposta limitada a
64 KiB. Origin/rate limits do fluxo ICE também se aplicam ao Metered.

Cache compartilhado em memória por processo por 5 minutos, com deduplicação de
requests simultâneas; a API não é consultada por PeerConnection. Esse prazo é de
refresh do cache, **não** o expiry da TURN Credential configurada no Metered.
Gerencie expiração/rotação no provider. Falha HTTP/timeout/JSON inválido retorna
STUN-only e tem cooldown de 30 s; o cliente volta a consultar, sem persistir
credenciais. Em relay-only, STUN-only não pode validar relay.

Verificação leve: `node --test tests/party/party-metered.test.cjs tests/party/party-ice-server.test.cjs`.
Integração única, dois contexts e apenas áudio fake: `node tests/party/party-metered-integration.cjs`.
O harness lê ambiente/.env local e só registra estado, route/protocol, candidate
type e se os bytes RTP aumentaram; não gera trace, screenshot ou dump de secrets.

Em ambientes Windows com CA corporativa confiável instalada, Node pode precisar
de `node --use-system-ca server/signaling-server.cjs` (Node 24.18+ disponível
localmente), ou `npm run start:system-ca` na pasta `server`, e
`node --use-system-ca tests/party/party-metered-integration.cjs`. Isso usa
o trust store do sistema e mantém TLS verificado. Não use
`NODE_TLS_REJECT_UNAUTHORIZED=0`.
