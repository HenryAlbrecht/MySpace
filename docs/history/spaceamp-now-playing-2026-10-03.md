# SPACEAMP Now Playing — 2026-10-03

Branch `feature/spaceamp-now-playing`, criada a partir de `dev` após fetch e fast-forward de `origin/dev` (já atualizada).

## Arquitetura

A nova superfície é um `dialog` modal, sem rota. SPACEAMP continua sendo o único proprietário de reprodução, fila e estado. Capa do perfil/mini-player abre o shell; Esc fecha e devolve foco com `preventScroll`. O modal nativo impede Tab na página abaixo. O scroll da página permanece preservado durante o bloqueio de overflow.

O Core ganhou apenas uma fachada de leitura `getPlaybackTime()`: consulta diretamente o adapter existente, com fallback ao progresso publicado. Áudio usa o mesmo `#audio`; YouTube usa `getCurrentTime`, `getDuration` e `seekTo` no mesmo YT.Player. Não há novo player, áudio, timer de playback ou estado de playback na view. Metadata opcional de álbum/ISRC acompanha o snapshot e a seleção da fila.

O XMB ganha um botão de reprodução em músicas com fonte vinculada. Usa `MusicModel.queueTrack` e `SPACEAMP.play`, mantém o XMB montado e abre Now Playing por cima. Esc/Backspace retorna ao mesmo detalhe/item, seleção, scroll e foco. O XMB ignora suas próprias teclas enquanto o modal está aberto. Se o navegador intercepta Esc para sair do fullscreen, fecha apenas Now Playing e mantém o XMB na viewport.

## am-lyrics

Import direto do Web Component oficial `@uimaxbai/am-lyrics@1.7.4` via jsDelivr, sob demanda. Nenhum source foi copiado ou forkado. A versão e URL foram verificadas. [Contrato oficial](https://github.com/binimum/am-lyrics).

A view fornece título, artista, query, álbum e ISRC quando presentes, duração e tempo em milissegundos. `currentTime` é atualizado pelo RAF com o relógio real do Core; `current-time` também é publicado como atributo. A propriedade evita depender de aliases de atributo entre versões. Pausa cancela RAF e mantém o último tempo: `duration=-1` não é usado para pausar, pois o componente reseta o tempo nesse caso. Seek local e `line-click.detail.timestamp / 1000` refletem imediatamente no componente. Fontes não compatíveis ignoram seek e desabilitam o progresso.

Cada troca de identidade cria uma instância limpa de am-lyrics; respostas tardias não podem mostrar a letra anterior na view nova. Os efeitos, tamanho responsivo, skeleton de carregamento, no-match, gaps instrumentais e attribution permanecem nativos. Só APIs/propriedades/CSS variables públicas são usados. Falha de import tem feedback discreto independente de playback.

## Artwork, visualizer e idle

`Artwork.set` preserva pixels prontos até o decode da próxima capa. O fundo só recebe a nova imagem após a capa estar pronta. A geometria quadrada permanece estável. O shell usa os tokens existentes de motion, fundo desfocado e layout amplo; mobile mantém espaço útil para lyrics. Reduced motion remove animação do shell e movimento do visualizer.

Áudio local conhecido (blob/mesma origem), com APIs disponíveis: Web Audio `AnalyserNode` recebe `HTMLAudioElement.captureStream()` do elemento já existente. Não captura a aba e não conecta saída à destination; o áudio audível mantém seu caminho original. O stream reconecta o tap quando recebe novas tracks. A ativação aguarda AudioContext ativo; falhas/APIs ausentes usam fallback. Não se usa MediaElementSource para evitar que fontes remotas posteriores sejam silenciadas por CORS. Recursos ficam associados ao mesmo elemento para a vida da página; fechar o shell cancela desenho, sem parar playback.

YouTube/PCM indisponível: curvas de apresentação baseadas no tempo real, sem simular espectro. `data-visualizer` distingue `analyser` e `presentation`. Nenhum PCM do iframe é acessado.

Idle após 4,5 segundos reduz opacity dos controles, metadata, progresso e botão de saída, sem desmontar DOM. Pointer, wheel, touch, teclado e foco revelam o chrome. Pointer pressionado ou foco em controles/lyrics impede esconder. Lyrics, capa, fundo e visualizer continuam presentes.

## Arquivos

- `dist/spaceamp-now-playing.js`, `dist/spaceamp-now-playing.css`: shell, sincronização, idle e visualizer.
- `dist/index.html`: carrega a nova apresentação.
- `dist/spaceamp.js`, `dist/app.js`, `dist/spaceamp-integrations.js`: fachada de relógio, delegação de seek e metadata opcional.
- `dist/playlist.js`: encaminha álbum/ISRC da seleção, sem alterar o modelo de Collection.
- `dist/xmb.js`: botão de reprodução e isolamento do teclado/modal/fullscreen.
- `tests/spaceamp-now-playing.test.cjs`, `tests/spaceamp-now-playing-browser.cjs`: testes focados.
- `tests/validate.ps1`, `tests/INVENTORY.md`, `tests/README.md`: registro dos testes.
- Este documento e `docs/history/README.md`.

## Validação

- Unitários SPACEAMP, integrations, Now Playing, Artwork e XMB: 20 testes passaram.
- `node tests/spaceamp-now-playing-browser.cjs`: um browser/context por execução; abertura pela artwork, controles, relógio/ms, pausa, seek, reset de lyrics, decode/retention, idle/foco, scroll, XMB com botão real e retorno por Backspace, analyser local/fallback YouTube, 1440/820/390 px, reduced motion, falha de CDN e componente oficial com TTML local. Sem page errors. Providers de reprodução/letras reais não são consultados; somente o módulo oficial CDN é baixado no último cenário.
- `node tests/motion-stability-visual.cjs after`: 63 cenários, zero shifts e page errors.
- `tests/validate.ps1 smoke`: todos os nove smokes passaram.
- `tests/validate.ps1 syntax`: sintaxe e auditoria estática passaram.
- `git diff --check`: passou.

Não foram executados full WebRTC, TURN, mesh, screen share ou providers pesados. Evidências visuais locais em `artifacts/spaceamp-now-playing/` e `artifacts/motion-stability/after/`, ignoradas pelo Git.

## Limitações conhecidas

O componente não publica evento público de resolução de lyrics. Sua UI agrupa ausência de resultado e falhas de provider em “No lyrics found”; não é possível distinguir confiavelmente provider error, faixa inteiramente instrumental e no-match no shell sem acessar estado privado ou duplicar resolução. Gaps instrumentais continuam nativos; falha de CDN é distinguida pelo shell. Matching e animações com providers reais não foram certificados: a renderização oficial foi verificada com TTML local.

Album/ISRC só são enviados quando já existem no snapshot; não se infere álbum a partir da URL da capa. O visualizer real depende de captureStream/Web Audio e media local acessível; fallback é apresentação. Animação de abertura simples, sem FLIP; fechamento imediato preserva estabilidade/foco. A última artwork decodificada é mantida se a próxima estiver ausente ou falhar.
