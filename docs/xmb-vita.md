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

V/R3 abre o overlay; o Y conserva a ação já contratada do XMB. Mouse, teclado e
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
o shader/Canvas nativo e as suas sombras dinâmicas não são reproduzidos integralmente.
Com fundo em vídeo, a folha usa capa estática e revela o vídeo ao descolar.

Validação focada: `node --test tests/xmb/vita.test.cjs` e
`node tests/spaceamp/spaceamp-browser.cjs vita`.
