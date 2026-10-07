# PARTY / Voice — evolução e validações anteriores

Material extraído do README de voz em 2026-10-07. Descreve o estado de cada rodada, inclusive contratos substituídos e resultados inconclusivos; o contrato vigente está em [PARTY / Voice](../../dist/voice/README.md). Artifacts citados são evidências locais e não requisitos para clones novos. Comandos antigos aqui registrados, incluindo wildcard, não são instruções de aceite atual.

## Registros históricos reutilizados

O [redesign visual PARTY](party-visual.md) preserva layout, capturas e regressões de áudio/tela/chat. O [relatório de ICE/TURN](party-v10.md) preserva implementação, resultados, limites de infraestrutura e teste de duas redes daquela milestone; esses blocos não são copiados aqui.

## SPACEVOICE v0.4, v0.5 e v0.6

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

## Chat v0.7

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

## Seleção e cobertura de testes registradas na época

## Testes

Após instalar a dependência do servidor, na raiz:

```sh
node --test tests/*.test.cjs
```

Se o ambiente restringir subprocessos, use `node --test --test-isolation=none tests/*.test.cjs`. Os testes incluem sockets reais com porta efêmera, registro/isolamento de salas, roteamento SDP/ICE, destinatários, identidade vinculada ao socket, leave/disconnect, adapter/filtragem/cleanup/reconexão e integração da sessão. Os testes BroadcastChannel, WebRTC, captura e UI anteriores permanecem. A cobertura mesh inclui 3/4 clientes, eleição por par, roteamento independente de answer/ICE, manutenção de A–B na entrada/saída de C, snapshot/reconciliação, reconexão, captura compartilhada, deafen multi-áudio e cleanup total.

## Harness integrado de mídia e ambiente da rodada

Com frontend e signaling iniciados, execute:

```sh
node tests/spacevoice-integration.cjs
```

No ambiente atual, o script usa Playwright do runtime Codex e Edge instalado (caminhos no início do arquivo). Fora deste ambiente, ajuste esses caminhos para Playwright/Chromium local. Usa `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--use-file-for-fake-audio-capture`, `--auto-select-desktop-capture-source=Entire screen` e autoplay liberado: não acessa microfone físico nem perfil pessoal. O WAV gerado pelo harness tem tom de três segundos/silêncio de um segundo, pois os bipes curtos padrão não satisfazem o attack de fala. Relatório e screenshots: `artifacts/spacevoice-v06-validation/`.

O teste preserva os cenários de dois clientes e adiciona 3 e 4 contextos independentes: quantidade de participantes/peers, todos connected, ICE connected/completed, track remota e RTP em cada caminho, pares únicos e menor clientId como offerer. Verifica C sair/reentrar mantendo A–B, D entrar sem recriar pares existentes, mute/deafen, queda de socket de C com novo snapshot e cleanup sem duplicações. Também testa mesh BroadcastChannel em três abas do mesmo contexto.

A integração v0.5 adiciona quatro contextos, getDisplayMedia nativo com fake device, shares A/B, late join de C/D, RTP de vídeo e frames decodificados, parar apenas A, reconectar B mantendo a captura, glare real com offers retidas/liberadas só pelo harness, stop/start repetido, seletor, deafen e layouts desktop/mobile com aparência/wallpaper. `node tests/spacevoice-integration.cjs --screen-only` executa só os cenários de tela. O harness também permite fallback de canvas/áudio injetado somente no teste se o browser não disponibilizar desktop capture fake; a aplicação de produção não é alterada para simular captura.

O evento ended é testado encerrando a track real e despachando o evento no harness; o botão do toolbar nativo do navegador ainda requer validação manual. O fechamento forçado do socket é um teste de desconexão/reconexão, não simula perda física de rede. A mídia fake confirma transporte RTP, não qualidade audível, dispositivos físicos, NAT externo ou política normal de autoplay/permissões.

## Revisão de qualidade do screen audio

O áudio de tela continua em track, sender e MID separados do microphone. Antes,
`getDisplayMedia` recebia `audio: true`, sem constraints de processamento ou limite
de bitrate para esse sender. Não havia reaproveitamento de constraints do mic,
mas os defaults de captura do browser podiam incluir processamento de voz.

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

## PARTY v0.8 — validação de mídia avançada

Validação específica:
- `node --test --test-isolation=none tests/voice-media-settings.test.cjs tests/voice-ui.test.cjs`
- `node tests/page-smoke.cjs`
- `node tests/party-media-settings-integration.cjs`: integração focada com um browser,
  dois contexts, microfone fake nativo e tela/audio sintéticos, WebRTC P2P nativo.
  Relatório e screenshot em `artifacts/party-v08`; cleanup em finally.

Resultado desta rodada: 14 testes específicos/UI e page smoke passaram. A única
integração confirmou mic 48 kbps/EC false, áudio de tela 256 kbps, vídeo 14 Mbps,
detail, identidade de track/PC e nenhuma nova negociação/captura por encoding;
remover teto de vídeo também passou. A espera combinada pelo reset completo expirou:
reset nativo e a checagem mobile posterior são inconclusivos. Não houve repetição.
O botão de reset agora fica indisponível durante aplicação pendente para evitar
pedidos descartados; reset da UI é coberto em DOM simulado. Report mantém a falha,
sem declarar a integração inteira como aprovada. Contexts/browser/server encerrados.

## Estados operacionais substituídos

### Início e dependências anteriores

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

### Queda de signaling antes do recovery independente

Em queda/erro do signaling local, `session.js` fecha todos os peers daquele cliente e remove seus áudios/participantes. Nos demais clientes, o leave emitido pelo servidor remove apenas o peer que caiu; as conexões entre os demais continuam intactas. Após queda, o cliente tenta reconectar a cada 1,5 segundo e envia um novo join para obter um snapshot atual e reconstruir seus pares; SDP/ICE antigos não são enfileirados nem reutilizados. O microfone permanece ativo enquanto o usuário ainda está na chamada, permitindo recuperação automática. Sair cancela o timer e desliga listeners/socket, peers, reprodução e captura; não reconecta. Reentrada funciona sem reload.

### Limites anteriores a chat e TURN

- Mesh para grupos pequenos, sem limite rígido de quatro: cada cliente mantém N − 1 PeerConnections e a sala N × (N − 1) / 2 pares únicos. O número total de conexões cresce O(N²), com custo de CPU e upload por cliente aumentando com N. Esta versão é validada principalmente com 3/4 participantes, sem garantia de desempenho para 5/6 ou mais. Screen share aumenta principalmente o upload do sender. Para grupos maiores, considerar SFU/LiveKit no futuro; nenhum servidor de mídia foi implementado.
- Sem autenticação, controle de acesso ou TLS próprio; destinado a desenvolvimento/rede de teste. Username é apenas visual. Não há TURN, SFU, gravação, webcam, chat, remote control ou persistência de mídia.

### Presence v1.4 e playback v1.5

Na v1.4, SPACEAMP não foi integrado: o player não expunha contrato comum de
nowPlaying que cubra áudio local e embeds. Uma futura integração deve usar
eventos do player com opt-in, sem polling nem presumir que a música do
perfil está tocando. Nenhum nowPlaying fictício é publicado nesta versão.

Limitação na v1.5: o iframe YouTube/Spotify não expunha um estado de
playback verificável ao SPACEAMP. Seu link/player funciona e usa o shell comum,
mas clicar em reproduzir não publica Now Playing. Não foi adicionada API de
provider, polling, Spotify integration ou presunção de que um embed está tocando.

Testes leves: spaceamp.test.cjs, party-room.test.cjs, party-room-ui.test.cjs,
media-embeds-smoke.cjs e party-v15-browser.cjs (dois contexts, WAV local real,
sem WebRTC/captura). Screenshots em artifacts/party-v15.

Rename, convite e recentes reutilizam os tokens de motion XMB existentes,
com redução de movimento respeitada. Verificação leve: party-room.test.cjs,
party-room-ui.test.cjs e party-v13-browser.cjs (dois contexts, sem mídia).

### Validação de playback e rail v1.5.1

Testes: spaceamp-integrations.test.cjs e party-v151-browser.cjs, mais testes
leves existentes. Dois contexts, WAV real, Media Session real com handlers
invocados pelo harness. Contrato YT.Player simulado; rail aplicado como fixture
visual sem captura. Não valida teclas físicas do SO nem vídeo real do YouTube.
Screenshots em artifacts/party-v151. Referências:
https://developers.google.com/youtube/iframe_api_reference
https://developer.mozilla.org/en-US/docs/Web/API/MediaSession
