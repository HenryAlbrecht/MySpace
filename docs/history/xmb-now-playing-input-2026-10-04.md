# XMB + Now Playing: input e continuidade

Branch existente feature/spaceamp-now-playing. Escopo somente input/handoff; lyrics clock/providers/motion, Kawarp, playback/queue, YouTube binding, Media Session e PARTY preservados.

## Input

Um único XmbInput faz polling da Gamepad API, apenas mapping standard. Ações primary/back/secondary/tertiary são botões 0/1/2/3; direções vêm do D-pad 12–15 ou eixo dominante do stick esquerdo com deadzone .55. Face buttons disparam somente na borda; direções imediatamente, depois de 280ms e a cada 105ms. Menu/Start (botão standard 9) abre XMB pelo botão existente da Collection quando não há outro painel ativo. Controladores sem mapping standard ficam fora do mapeamento automático; teclado permanece disponível. Browser pode exigir uma primeira interação de controle antes de expor o dispositivo.

XMB decide ações contextuais: Primary/Enter em música toca pelo MusicModel.queueTrack/SPACEAMP e abre Now Playing; outras mídias mantêm detalhes. Secondary/D abre detalhes; tertiary/O página completa; Back/Esc/Backspace volta um nível. Hints alternam apenas por input real. Labels A/B/X/Y genéricos; sem heurística de fabricante.

## Now Playing

Back é consumido no painel para não sair simultaneamente do XMB. Direções horizontais navegam dentro de grupos, verticais entre presentation, transport e sliders. Primary ativa botão/summary; em select avança opção; em range alterna modo de ajuste, onde esquerda/direita ajustam posição/volume. Lyrics não entra na árvore de foco. Input acorda a UI; idle pode voltar quando a navegação cessa. Nenhum audio, iframe, player ou queue adicional.

## Contexto e motion

Snapshot explícito de categoria, ID estável, índice, scroll de lista/nav/detalhes, nível, foco e foco do indicador atual. XMB permanece montado/inert sob o painel. Na volta, coleção atual é comparada pelos IDs e a lista é reconstruída somente se necessário; scroll exato e foco são restaurados. Indicador discreto ♪ usa o estado do Core, acessível por Up no primeiro item; Down retorna à lista. Reabrir o painel pelo indicador não toca/reinicia a faixa.

Shared artwork usa clone temporário de imagem decodificada, rects reais, 200–260ms com tokens XMB, sem reparentear a imagem. Clone é removido na conclusão/cancelamento. Reverse usa apenas artwork correspondente à seleção; não força scroll. Reduced motion, viewport <600px ou imagem/rect ausente deixam a abertura funcionar sem clone. Contexto recua minimamente e chrome/lyrics entram com paint suave, sem grandes slides.

## Verificação

Testes unitários XMB/input/SPACEAMP/Now Playing, page smoke, syntax e diff check. Suíte browser concentrada em um browser/context, gamepad mock standard: entry Menu, teclado, Primary segurado, Back em um nível, D-pad repeat, stick deadzone/diagonal, hints, lista longa e scroll/foco preservados, coleção alterada enquanto painel está aberto, indicador sem restart, clone e cleanup, fallback/reduced-motion, estabilidade de artwork e screenshots em 390/820/1440. Playback fixture usa o Core e adapter atuais; não usa serviços externos/WebRTC pesado. Controle físico e navegador Zen ainda precisam validação manual.


### Artwork handoff continuity

Selecting the current available track now opens Now Playing without selecting or restarting playback. Source identity (file reference, URL or YouTube video ID) is checked with title and artist; local queue identity is used when the playback snapshot omits it. Opening and closing preserve the ready artwork state.

A valid shared artwork handoff suppresses the destination cover crossfade and keeps the final clone frame until the matching destination image has decoded. The one-browser regression records every opening frame for the same track at 1:30 and for different artwork with intentionally delayed decoding: no cover ghosts or uncovered destination gaps.


Follow-up: frame geometry exposed a separate flick missed by source/ready assertions. The shell's `np-enter` scale caused the clone to capture a smaller destination (about 10 px horizontal offset and 6 px width difference at 1440 px). A valid shared handoff now owns entry, measures the final shell geometry, covers the destination until reveal, and copies its border/shadow treatment. Regression compares the last clone frame with the first revealed destination, requiring less than 0.5 px difference in x/y/width; delayed decode remains covered.
