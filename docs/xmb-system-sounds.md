# Sons do shell: comportamento do Xora

Referências no checkout `C:/Projetos/xora-master`:

- `app/src/main/kotlin/com/arcadia/shell/audio/UiSoundController.kt`:
  SoundPool com dez vozes, ganho padrão 0.7, cursor com debounce de 30 ms,
  cancelamento de loops em background e supressão de cliques genéricos do Vita.
- `core/input/src/main/kotlin/com/arcadia/shell/input/UiOneShot.kt`:
  eventos semânticos dos efeitos específicos.
- `feature/home/src/main/kotlin/com/arcadia/shell/feature/home/HomeViewModel.kt`:
  sons por mudança de estado, abrir/fechar/paginar Vita e confirmação da LiveArea.
- `VitaLiveAreaPeel.kt`, no mesmo diretório: velocidade suavizada em 0.3;
  abaixo de 450 px/s não toca sample; 450–1400 usa `peel_mid`, acima usa `peel_fast`.

## Eventos integrados

| Evento | Sample em `dist/xmb-sounds/` |
|---|---|
| Direção/foco no XMB, editor e Quick Menu | `selection.wav` |
| Confirmar no XMB/editor/menu | `select.wav` |
| Voltar no XMB/editor/menu/LiveArea | `nav_back.wav` |
| Abrir / fechar a grade Vita | `vita_open.wav` / `vita_menu_close.wav` |
| Trocar página Vita | `vita_page_navigate.wav` |
| Abrir uma bolha | `bubble_launch.wav` |
| Confirmar a LiveArea | `boot_vita.wav` |
| Dobra média / rápida | `peel_mid.wav` / `peel_fast.wav` (loop exclusivo) |

Os WAV são os recursos correspondentes de `app/src/main/res/raw/` do Xora.
Não há clique genérico sobre os efeitos específicos de bolha/página/fechamento.
O fim da animação não repete o som de boot nem toca fechamento de menu por cima.
Avisos musicais são silenciosos, conforme o Xora.

Sons de amigos/perfil, alertas Android, scan de ROMs, RetroAchievements e boot de
emulador têm handlers próprios no Xora. Esses eventos não existem no shell do
MySpace; não são associados a toasts ou ações diferentes só para reproduzir samples.
Vibração e BGM não fazem parte deste banco de efeitos.

## Owner e preferências

`app.js` instancia `createSystemSounds` uma vez. Views chamam comandos do SPACEAMP;
não criam Audio/AudioContext nem filas musicais. O banco Web Audio é somente de
efeitos curtos, com dez vozes e loop de dobra substituível; não usa a trilha de foco
dos jogos. O ganho de efeitos é independente do volume musical.

Em Aparência, **Sons do sistema (XMB e PS Vita)** grava
`appearance.xmb.systemSoundsEnabled`. O engine observa o atributo aplicado pelo
owner e interrompe imediatamente ao desligar. Não persiste preferências.
Ocultar a página também cancela sons pendentes e ativos. As políticas de autoplay
do navegador são respeitadas; não há reprodução tardia de cliques bloqueados.
