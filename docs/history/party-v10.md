> Registro histórico selecionado. Screenshots e relatórios gerados continuam locais em `artifacts/party-v10`; não são dependências da aplicação.

# PARTY v1.0 — relatório

Implementação de conectividade concluída no código; deployment TURN e teste entre
duas redes físicas permanecem pendentes de infraestrutura real. A UI aprovada foi
preservada, com retry contextual por participante e diagnóstico dentro da mídia.

## 1. Arquivos desta milestone

Criados:

- `dist/voice/ice-config.js`: defaults, normalização, policy e cache em memória.
- `dist/voice/network.js`: diagnóstico e recovery independente por peer.
- `server/ice-config.cjs`: env, HMAC e limites por socket/IP.
- `server/coturn/turnserver.conf.example`: referência Coturn sem secret real.
- `server/coturn/README.md`: deployment, segurança, banda e roteiro manual.
- `tests/party-network.test.cjs`, `tests/party-ice-server.test.cjs`.
- `artifacts/party-v10/relatorio.md`.

Alterados nesta fase:

- `.env.example`, `README.md`, `dist/voice/README.md`.
- `dist/index.html`, `dist/spacevoice.js`, `dist/spacevoice.css`.
- `dist/voice/room.js`, `peer.js`, `session.js`, `signaling-ws.js`, `signaling-local.js`.
- `server/signaling-server.cjs`.
- `tests/page-smoke.cjs`, `voice-peer.test.cjs`, `voice-ws.test.cjs`,
  `voice-ui.test.cjs`, `party-room-ui.test.cjs`.

O workspace já continha alterações das milestones anteriores. Os outros arquivos
modificados no Git não representam mudanças novas da v1.0.

## 2–4. ICE, credenciais e proteção do secret

`PARTY_STUN_URLS`, `PARTY_TURN_URLS`, `PARTY_TURN_SECRET`, `PARTY_TURN_TTL` são lidos
no servidor. A sala registrada solicita `ice-config-request`/`ice-config` pelo
WebSocket existente. STUN-only se TURN estiver ausente. Um único módulo guarda o
default STUN; todos os peers recebem config atual. Policy padrão `all`; somente
`voiceIcePolicy=relay` força relay.

Username `<expiry-segundos>:<UUID>` e credential Base64 HMAC-SHA1(secret, username).
TTL padrão 1 h, limitado a 120–86400 s. Shared secret não é enviado. Cache só em
memória, renovado a 60 s da expiração e consultado antes de novos peers/restarts.
Atualização não reinicia os outros pares. A resposta a uma offer remota também
consulta o cache e aplica config atual antes da negociação.

Payload fechado, identidade vinculada ao socket/sala, limites 6/socket/minuto e
30/IP/minuto; allowlist de Origin obrigatória em produção com TURN. Sem auth,
isso reduz abuso mas não autentica clientes não-browser. Não há credenciais em
localStorage, logs, diagnóstico ou arquivos versionados.

## 5. Coturn

Referência configura 3478 UDP/TCP, 5349 TCP/TLS, fingerprint, use-auth-secret,
realm, cert/pkey, stale-nonce, quotas, bloqueio de multicast/redes privadas e
relay UDP 49160–49200. Substituir placeholders, usar certificado público válido,
configurar firewall e external-ip explicitamente atrás de NAT. Secret do Coturn
e signaling precisam ser iguais. Docker não é obrigatório.

## 6. Candidate diagnostics

Helper independente `PARTY_NETWORK.getPeerConnectionDiagnostics(pc)` identifica
selected pair por transport, selected ou nominated/succeeded. Retorna tipos
host/srflx/prflx/relay, protocol, relayProtocol, networkType e RTT quando disponíveis,
além de connection/ICE/gathering/signaling states. Tolera stats incompletos.
UI avançada exibe nome, estado amigável, rota/protocolo e RTT; nunca IP/SDP/secret.

## 7–9. Recovery, backoff e independência

Grace de 5 s em disconnected, cancelada se recuperar. Failed inicia recovery.
Menor ID inicia restart; polite solicita ao líder. Restart serializado com perfect
negotiation, usando restartIce e createOffer({iceRestart:true}), com atualização
ICE via setConfiguration. Máximo 3 tentativas com esperas 12/15/18 s; sem
sobreposição enquanto busca credencial. Depois oferece retry naquele participante.
Falha A–B não encerra A–C nem a call.

Queda de signaling mantém peers e mídia; pausa recovery que requer signaling.
Offers pendentes podem ser reenviadas ao reconectar. Ausência inesperada ganha
30 s de tolerância, estendida enquanto P2P estiver conectado. Saída explícita
remove imediatamente. Novos snapshots/joins preservam pares existentes.

## 10. Verificação executada

27 testes leves distintos aprovados, entre:

```powershell
node --test tests/party-network.test.cjs tests/party-ice-server.test.cjs tests/voice-peer.test.cjs tests/voice-ws.test.cjs tests/party-room-ui.test.cjs tests/voice-ui.test.cjs
node tests/page-smoke.cjs
git diff --check
```

Cobertura: HMAC/env/TTL, secret ausente, cache/expiry, all/relay, selected pair
host/srflx/prflx/relay e UDP/TCP, stats incompletos, grace/cancel, restart/fallback,
backoff/limites, glare, renovação no answerer, isolamento, broker WS real,
Origem/rate limits, lobby sem ICE antecipado, reconexão sem duplicação e retry UI.
Smoke DOM aprovado; diff sem erros de whitespace.

## 11–13. Integração e carga

Integração browser TURN não executada: turnserver/Docker não encontrados e WSL
não instalado. Nenhum candidate pair real observado; RTP relay não foi medido.
Nenhum browser/context foi criado nesta milestone. Servidores temporários dos
testes foram encerrados. Não houve regressão pesada, multi-browser, screen share,
screen audio, 4 peers ou stress.

## 14. Limitações

Não valida fisicamente CGNAT/firewall, mudança de rede, TLS Coturn ou banda relay.
Campos de diagnóstico dependem do browser. Sem autenticação completa; proxies
compartilham limite IP e devem aplicar limites próprios. Deploy exige HTTPS/WSS,
certificado TURN, secret, relógios e portas corretos. Mesh consome banda por
destinatário: fluxo relay de 10 Mbps implica aproximadamente 10 Mbps inbound e
10 Mbps outbound no TURN. Não existe SFU ou relay custom.

## 15. Teste entre dois PCs/redes

Roteiro exato em [server/coturn/README.md](../../artifacts/party-v10/../../server/coturn/README.md): deployment,
PC A residencial e PC B hotspot, lobby/presença, áudio bidirecional, diagnóstico
default, ambos relay-only, transporte UDP/TCP/TLS isolado, mudança de rede, queda
curta de signaling e retorno ao lobby. Um teste relay válido deve mostrar relay;
host/srflx não valida TURN. Não foi alegada validação física automática.
