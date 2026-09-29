# PARTY — redesign visual

PARTY mantém o front HTML/CSS/JavaScript, os tokens de tema, os botões entre colchetes, o wallpaper e o footer. A rota e os identificadores internos continuam `spacevoice`.

## Layout

Sem tela: participantes centralizados, foto de perfil em destaque, estado de voz, indicação local “você” e volumes individuais. Uma pessoa recebe a indicação de espera. Quatro pessoas usam 2×2; cinco/seis usam três colunas em desktop largo. O chat começa recolhido.

Com tela: a mesma lista ocupa a esquerda, o vídeo ocupa o centro e o chat abre à direita no desktop. O seletor mantém múltiplas telas. O botão de tela cheia atua no vídeo focado. Resolução, FPS e áudio vêm das tracks, quando disponíveis; valores desconhecidos são omitidos.

Mic, deafen, compartilhar/parar tela e sair ocupam a primeira linha. Devices, meter e qualidade ficam na segunda. No mobile, participantes, tela e chat se empilham.

## Motion e identidade

O reflow muda somente atributos de layout e CSS. Os participantes existentes são reutilizados; vídeos e `srcObject` ficam intactos. Avatares têm transição de tamanho/borda com `--motion-standard`, `--motion-focus` e `--ease-xmb`; a tela usa fade/scale discreto definido em `motion.css`. O sistema global de reduced motion desativa essas transições. A troca de posição entre grid e coluna é reflow de CSS, sem animação espacial FLIP.

O avatar local usa `getProfile().avatar`, o mesmo campo do perfil. Imagem inválida ou falha de carregamento recebe iniciais. Não se adicionou identidade ao signaling: remotos usam nomes disponíveis ou “Convidado N”, com iniciais. Não há avatares mock em produção.

## Preservação e testes

Nenhum arquivo de `dist/voice/` foi alterado. Peer, signaling, negociação, captura, codecs e processamento de áudio não foram reescritos.

- `node --test --test-isolation=none tests/*.test.cjs`: 81 testes passaram.
- `node tests/page-smoke.cjs` e `node tests/navigation-smoke.cjs`: passaram. O harness antigo foi atualizado para carregar devices/levels/chat, usar seu BroadcastChannel simulado e aguardar a entrada assíncrona.
- `node tests/party-visual.cjs`: passou; quatro clientes WebRTC reais, mudança voice/screen/voice, identidade dos elementos e streams durante chat, dois sharers, mobile sem overflow e reduced motion. Zero erros de console/pageerror.
- Regressões integradas de screen, áudio e chat têm relatórios nas pastas `party-screen-validation`, `party-audio-validation` e `party-chat-validation`.
- `node tests/spacevoice-integration.cjs --synthetic-screen`: regressão completa passou, com 49 verificações e zero erros de console/pageerror. RTC e ICE conectados, signaling estável, RTP de voz e vídeo em todos os pares, BroadcastChannel, reconnect, late join, perfect negotiation, troca de mic com replaceTrack e chat verificados. Relatório completo em `artifacts/spacevoice-v07-validation/report.json`.
- `node tests/spacevoice-integration.cjs --screen-audio-only`: três verificações passaram com captura nativa de áudio da tela. Áudio separado do microfone, parâmetros reais/codec/bitrate e RTP medidos; parar a tela preserva voz e peers. Relatório em `artifacts/spacevoice-screen-audio-validation/after/report.json`.

## Capturas

1. `01-fora-da-chamada.png`
2. `02-uma-pessoa.png`
3. `03-voz-quatro-pessoas.png`
4. `04-tela-quatro-pessoas.png`
5. `05-multiplas-telas.png`
6. `06-wallpaper.png`
7. `07-sem-wallpaper.png`
8. `08-mobile.png`

As capturas usam quatro clientes reais, mic fake do Chromium e telas de canvas exclusivamente no teste. O wallpaper de teste usa uma imagem já incluída no projeto; nenhuma preferência do usuário é gravada. Permissões de saída do browser headless podem produzir a mensagem de dispositivo visível em algumas capturas, sem erro de console. A captura nativa de tela/áudio do sistema depende do seletor e das permissões do navegador; a regressão de tela usa a opção explícita `--synthetic-screen`.

## Arquivos

Produção: `dist/extras.js`, `dist/spacevoice.js`, `dist/spacevoice.css`, `dist/motion.css`.

Testes: `tests/voice-ui.test.cjs`, `tests/page-smoke.cjs`, `tests/spacevoice-integration.cjs`, `tests/voice-screen-integration.cjs`, `tests/voice-chat-integration.cjs`, `tests/party-visual.cjs`.

Artefatos: oito capturas, este documento e os relatórios JSON das regressões.
