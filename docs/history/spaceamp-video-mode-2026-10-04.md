# SPACEAMP Now Playing — Video Mode — 2026-10-04

Implementação de apresentação na branch feature/spaceamp-now-playing. O botão inline SVG Exibir vídeo aparece somente para fonte YouTube com iframe disponível. Modo transitório: abrir novamente começa em Artwork; próxima faixa YouTube mantém o modo, enquanto áudio local/direct volta para artwork.

## Host e top layer

O dialog modal tornava o playback host externo inerte; z-index não resolveria. O Now Playing usa dialog.show com aria-modal, isolamento por inert restaurável e contenção de Tab. O musicEmbed existente recebe popover manual e é promovido à top layer no mesmo lugar do DOM. O iframe nunca é movido, clonado ou recriado pela apresentação. Os quick controls também são promovidos para que seus menus não fiquem atrás do vídeo. Fechar/toggle restaura os atributos e a apresentação do SPACEAMP global, incluindo a preferência usar capa existente.

A geometria do host segue o espaço 16:9 reservado no Now Playing via ResizeObserver. Com lyrics OFF, o vídeo cresce e centraliza; no mobile fica acima de metadata/controles e lyrics. Hide UI preserva vídeo, letras e atmosfera. O player oficial permanece diretamente interativo, sem overlay sobre o iframe. Motion de opacity/translateX usa a função XMB existente e respeita reduced motion.

Nenhuma alteração em Core, adaptador YouTube, fila, am-lyrics, Kawarp, paleta, visualizer ou navegação. Nenhuma chamada adicional de play, pause ou seek pelo toggle.

## Verificação

Teste tests/spaceamp-video-browser.cjs usa um browser/context com IFrame API simulado e áudio WAV real. Em reprodução iniciada em 1:20, registra identidade de player/iframe/contentWindow, quantidade de players, URL, volume, relógio e chamadas play/seek. Open, Video → Artwork → Video e close preservam essas garantias. Também valida toggle pausado, Lyrics ON/OFF, Hide UI, próxima YouTube, troca real para áudio local, XMB/Backspace, reabertura, reduced motion, hit-test do iframe, proporção 16:9 e viewports 390/820/1440. A mudança de faixa segue o lifecycle já existente do provider; o modo vídeo não adiciona players.

Regressão Now Playing passou com frames brutos Kawarp e todos os fallbacks. Teste YouTube existente passou; teste de letras com biblioteca am-lyrics oficial passou. Unitários SPACEAMP 8/8. Page smoke e media embeds smoke passaram, além de syntax e diff check. O fixture do page smoke recebeu requestAnimationFrame/cancelAnimationFrame que faltavam para a timeline já existente. Não foi executado WebRTC pesado nem reprodução remota real do YouTube.

## Correção do vazamento de transparência

A regra body.custom-panels dialog em extras.css aplicava a opacidade configurada dos painéis ao Now Playing. A remoção do backdrop modal para permitir o host de vídeo deixou a página subjacente visível. Excluído .amp-now-playing dessa regra; o background opaco próprio do Now Playing passa a prevalecer, preservando a transparência dos demais painéis/dialogs.

Regressão no browser com panel-opacity 55%: o background do Now Playing tem alpha 255 em Artwork/Video e nos três viewports. Após estabilizar a composição pausada, um recorte exclusivo de background é pixel-idêntico com uma camada magenta ou verde por trás. O teste completo de único player passou novamente.
