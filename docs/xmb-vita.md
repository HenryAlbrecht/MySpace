# PS Vita: referência e integração

Referência lida no checkout `C:/Projetos/xora-master`, em
`feature/home/src/main/kotlin/com/arcadia/shell/feature/home/`:

- `HomeScreen.kt`: tray e LiveArea sobre o XMB.
- `HomeViewModel.kt`: abrir/fechar, foco, edição, mover/cancelar, pin picker e handoff.
- `VitaShortcutTray.kt`: dez bolhas, linhas 3–4–3, pitch 379/253 e bolhas de 233.256
  no artboard 1920×1080; máscara de vidro Overlay girada 165 graus.
- `VitaTrayMotion.kt`: entrada, inclinação por sensor, bounce e suspensão em background.
- `VitaShortcutLaunchPage.kt`, `VitaLiveAreaPeel.kt`, `VitaLiveAreaChrome.kt`:
  bolha gira/amplia por 1000 ms, LiveArea com wallpaper/capa, descolar por 620 ms,
  confirmação pelo controle ou gesto; cancelar não executa o jogo.
- `VitaShortcutIconSheet.kt`: arquivo/GIF, busca de ícone, reset e remover atalho.

## Comportamento no MySpace

Y no controle e V no teclado abrem o overlay; R3 também é aceito. O continua
abrindo a ficha pelo teclado. Mouse, teclado e
gamepad usam o mesmo fluxo de estados: grade → LiveArea → ficha existente do jogo.
O navegador não executa o launcher Android nem emuladores do Xora.

Os atalhos apontam para IDs existentes da Collection. A ordem independente
`xmbVitaOrder` passa por CollectionActions e pelo backup normal dos itens.
Ícone usa `xmbArt.bubble`, depois capa customizada e capa da coleção. A LiveArea
usa fundo/capa e alinhamento existentes. Não há playtime fictício: o subtítulo
mostra a plataforma. Relógio é o mesmo elemento do XMB, sem bateria.

Select entra na edição. Confirmar levanta a bolha; direções ou arraste mudam sua
posição; confirmar/soltar grava; B restaura a ordem anterior. O botão de adicionar
abre jogos disponíveis com filtro de plataforma. Select na edição permite arquivo,
busca de ícones pelo endpoint de arte existente, reset e remoção do atalho.

Sem giroscópio, vibração ou player BGM adicional no PC. O áudio musical continua
no SPACEAMP. A máscara de peel é uma adaptação CSS da dobra diagonal do Xora;
o shader/Canvas nativo é substituído por recortes CSS calculados em pixels.
O verso cresce como um quadrado com a profundidade da dobra, com sombra e
contorno do recurso original. Confirmar anima a mesma geometria do arraste em
620 ms; soltar antes do limiar de 32% retorna em 420 ms. A ação do jogo só ocorre
quando a folha termina de sair. Fechar cancela o frame pendente.
A LiveArea mantém um único wallpaper contínuo, inclusive em vídeo. A folha
recorta somente o conteúdo e revela a textura de fundo na área descolada.
O header reúne a indicação de retorno e o relógio existente, sem bateria.

Validação focada: `node --test tests/xmb/vita.test.cjs` e
`node tests/spaceamp/spaceamp-browser.cjs vita`.
