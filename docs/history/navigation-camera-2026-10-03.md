# Navigation camera / keyboard scroll — 2026-10-03

Branch `feature/front-polish`. Revisão de câmera e navegação, sem alterações de
providers, Player Core, networking PARTY ou modelo da Collection.

## Política de entrada

`dist/navigation.js` conserva a readingKey compartilhada `#colecao`. Categorias
continuam no mesmo contexto e preservam o viewport/clamp existente.

Conforme a correção final do usuário, entrar numa ficha e voltar dela começa
no topo. Não existe mais exceção de restauração para o contexto pai. Entrar em outra superfície principal começa
no topo, inclusive pelos cabeçalhos e Back/Forward. A mesma regra cobre Perfil,
Collection, Fotos, Buscar, Descobrir e PARTY, conforme o follow-up solicitado.
Uma ficha originada na Busca não restaura uma posição antiga da Collection.

A instrumentação isolou as chamadas `window.scrollTo` do app durante Back: com
`history.scrollRestoration=auto`, o browser ainda moveu a viewport para Y=49;
com `manual`, permaneceu em Y=0. Navigation agora define `manual` para eliminar
essa segunda política de restauração. O probe é reproduzível por argumento.

## Teclado da lista

Itens intermediários mantêm `nearest`. O foco usa `preventScroll`, evitando que
a transferência de foco acrescente outro movimento. ArrowUp ao chegar ao primeiro
item, ou já no limite, chama a câmera para Y=0, mostrando o chrome completo.
A duração usa `--motion-focus` (180 ms na configuração atual); reduced motion é
imediato. Wheel, touch, mudança de rota ou reversão pelo teclado cancelam o
movimento. Não foi criado framework de scroll.

ArrowDown no último item e a seleção já clampada não recriam detalhes. O teste
contou zero mutações e preservou o nó da imagem.

Durante a verificação surgiu uma segunda causa: linhas passavam sob o ponteiro
parado e `mouseenter` roubava a seleção por teclado. Agora o hover aguarda
movimento real do ponteiro após navegação por teclado.

## Validação

- `navigation-camera-visual.cjs`: um browser/context, fixtures locais e modo
  Lista. Testa cabeçalhos com posições antigas salvas, entrada em cinco
  superfícies e volta à Collection em Y=0; categorias em Y=900; ficha e retorno
  em Y=0; Back/Forward; teclado para baixo e de volta ao topo; ArrowUp no
  limite; reduced motion; último item sem mutações. Zero page errors.
- `navigation-native-probe.cjs auto` e `manual`: comparação do browser isolado.
- `navigation-smoke.cjs`: política de todas as superfícies, pai da ficha,
  proteção de restauração atrasada e motion normal/reduzido.
- 15 testes Collection/XMB; nove smokes; syntax/static e diff check.
- Scroll continuity: 900→900; clamp suave da categoria curta continua aprovado.
- Route visibility: 12 transições, zero superfícies misturadas.
- Motion design, motion stability e visual state continuity: aprovados.

Evidências locais ignoradas: `artifacts/navigation-camera/after/report.json` e
saídas dos harnesses de regressão. Somente Edge headless e fixtures, sem mídia
capturada, providers reais ou negociação entre peers.

## Reabrir a mesma ficha

`TitlePages.open` agora solicita topo explícito quando o hash da ficha já é o
atual. A posição salva dessa ficha é zerada antes do reload, impedindo que a
restauração posterior volte ao Y antigo. Refresh de metadata e buscas não usam
essa intenção. O teste abre uma ficha longa, rola até Y=400 e clica novamente
na mesma ficha, verificando Y=0 sem criar outra entrada no histórico.

## Follow-up: Collection → ficha → browser Back → item da Collection

O teste anterior da mesma ficha ativa não cobria esse caminho. O novo cenário
usa o item real da lista, abre a ficha, rola até Y=400, volta pelo histórico e
abre novamente o mesmo item; também abre outro item e usa o botão voltar.
Esse cenário falhou antes da correção.

A causa era uma segunda chamada de restore disparada por detalhes em cache,
antes do primeiro frame. Ela anulava a entrada no topo e usava o Y antigo salvo.
Navigation agora zera a posição na entrada e não substitui uma restauração já
pendente pela mesma rota. Após a correção, o cenário real passou; também passaram
navigation smoke, page smoke, scroll continuity (categorias 900→900), route
visibility (12 transições, zero mistura), syntax/static e diff check.
