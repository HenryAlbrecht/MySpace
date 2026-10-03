> Registro histórico selecionado. Screenshots e relatórios gerados continuam locais em `artifacts/party-v10`; não são dependências da aplicação.

# PARTY — provider Metered

## Arquivos

- `server/ice-config.cjs`: seleção Coturn/Metered, REST backend, validação, cache,
  deduplicação, timeout, payload limitado e fallback sanitizado.
- `server/signaling-server.cjs`: resposta assíncrona pelo fluxo ICE existente;
  preserva vínculo ao socket, rate limit e validação de origem.
- `dist/voice/ice-config.js`: cache STUN de fallback volta a consultar após expiry.
- `.env.example`: nomes/valores vazios Metered, sem configuração privada real.
- `server/package.json`: comando opcional `start:system-ca` para trust store local.
- `server/coturn/README.md`: uso, cache, falha e TLS; Coturn preservado.
- `tests/party-metered.test.cjs`: testes focados do provider.
- `tests/party-metered-integration.cjs`: um browser, dois contexts, áudio fake,
  policy relay e verificação de selected pair/RTP, com cleanup em finally.
- `artifacts/party-v10/metered-relay.json`: resultado sanitizado da execução final.
- Este relatório.

## Provider

Backend usa GET `/api/v1/turn/credentials`, conforme a
[API oficial Metered](https://www.metered.ca/docs/turn-rest-api/get-credential/).
Não há chamada Metered ou API key no frontend, nem condições Metered em
peer/session/media. `getIceConfiguration()` permanece a interface.

Cache em memória por processo: 5 minutos, requests simultâneas deduplicadas.
Esse prazo é de cache, não uma promessa de validade da credential gerenciada no
Metered. Falhas retornam STUN-only com cooldown de 30 segundos e novo request
posterior. Não persiste credential em localStorage. Timeout 6 s, limite 64 KiB,
redirects recusados; erros da API/fetch e URLs autenticadas não são logados.

## Resultados

1. **API:** HTTP 200 e array ICE válido usando `--use-system-ca`, com TLS verificado.
2. **Relay-only:** não chegou a connectionState connected no prazo da integração.
3. **Candidate type selecionado:** não observado; não confirmado como relay.
4. **Protocolo selecionado:** não observado.
5. **RTP:** crescimento não validado; conexão não estabelecida.
6. **TURN:** não declarar validado neste ambiente.

Primeira integração: falha de confiança TLS local `SELF_SIGNED_CERT_IN_CHAIN`;
backend usou fallback STUN. Segunda execução foi explicitamente autorizada pelo
usuário e usou o trust store do Windows: API funcionou, mas WebRTC não conectou.
Não houve terceira execução nem regressão pesada. A causa da falha ICE após a API
responder permanece indeterminada; não atribuir automaticamente a código, Metered
ou firewall sem evidência adicional. Todos os contexts/browser/servidores criados
foram encerrados nas duas execuções.

## Segurança e compatibilidade

Oito testes focados aprovados: REST/shape/cache/expiry/falha/fallback/API key,
Coturn HMAC, WS ICE, Origin/rate limit e relay policy. Não rodou full WebRTC,
4 peers, screen share, screen audio ou stress.

Verificação de arquivos versionáveis (tracked e untracked não ignorados) não
encontrou os valores privados locais de API key/shared secret. Nenhum valor real
foi copiado para README, testes ou artifacts. Somente fixtures sintéticas em testes.
Browser recebe username/credential TURN porque o RTCPeerConnection precisa deles;
isso não inclui a API key. Não houve dump de stats, IP, SDP, resposta API ou traces.

Coturn continua default/suportado: `PARTY_ICE_PROVIDER=coturn`. No ambiente local
com CA corporativa, inicie signaling com `npm run start:system-ca` na pasta
`server`, ou `node --use-system-ca server/signaling-server.cjs`. Não foi
desabilitada a validação TLS.
