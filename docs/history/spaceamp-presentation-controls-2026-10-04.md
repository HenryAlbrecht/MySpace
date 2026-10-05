# SPACEAMP Now Playing — presentation controls

Continuação na branch `feature/spaceamp-now-playing`. A camada de apresentação mantém o Core, adaptadores e APIs públicas do am-lyrics existentes.

- Controles compactos com SVG inline: fechar, Lyrics ON/OFF, Visualizer e Interface. Seletores nativos e foco visível permitem operação por teclado.
- Lyrics OFF mantém o componente atualizado e montado, retira a região da interação/acessibilidade e expande o layout para artwork, metadata e controles centralizados. A troca de faixa continua isolando respostas antigas com um componente novo.
- Visualizer Automático usa PCM disponível ou ambiente; Áudio não faz fallback; Ambiente ignora a análise; Desligado oculta o canvas e retorna antes de qualquer desenho. O ciclo existente continua atualizando o relógio das lyrics e do progresso.
- Interface Automático mantém idle de 4,5 s, respeitando foco, pointer pressionado e menus abertos. Sempre visível desativa idle automático. Ocultar UI agora fecha menus, transfere foco ao shell e permite acordar por interação.
- `spaceamp-now-playing-preferences-v1` guarda somente `lyricsEnabled`, `visualizerMode` e `uiMode`, com validação independente e defaults seguros. Normal e XMB compartilham o mesmo shell e preferências.
- Transições usam os tokens existentes e são desativadas com reduced motion. Nenhum estado de playback é persistido por esta camada.

Validação: 20 testes unitários de Now Playing/Core/integrations/Artwork/XMB; teste de navegador com um browser/context e fontes simuladas (controles, relógio, troca de faixa, modos, idle, foco/menu/pointer, persistência, XMB, reduced motion e layouts 390/820/1440); motion stability com 63 cenários sem deslocamentos; nove smokes; syntax/static e diff check. Não foram executados WebRTC pesado, TURN, mesh, screen share ou providers reais.
