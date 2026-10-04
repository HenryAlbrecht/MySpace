# Front cohesion / UX polish — 2026-10-03

Base: `dev`, sincronizada com `origin/dev` em `28eaa32`. Trabalho em
`feature/front-polish`, sem merge, push ou alteração de histórico.

## Inspeção e decisões

Antes das alterações, o front real foi aberto no Edge com fixtures locais,
em 390, 820 e 1440 px. Foram lidos architecture, module-map, tests/README e
o relatório de health pass 3. A inspeção confirmou que a base já é coerente;
o pass ficou limitado aos pontos abaixo, sem redesenhar as áreas.

Problemas observados:

- Buscar herdava a margem padrão do `h2`, criando um cabeçalho mais alto que Coleção.
- A seleção da lista usava `--accent-rgb`, que não acompanhava o accent personalizado.
- Transporte do SPACEAMP tinha alvos de 29–32 px no celular.
- Avisos e ações de saída usavam rosa fixo, inadequado aos temas claros.
- Restaurar aparência usava a classe visual de exclusão, embora seja uma ação secundária.
- Contagens de PARTY não podiam quebrar em telas intermediárias.
- Cards de descoberta tinham feedback diferente da estante e metadados com entrelinha apertada.

## Resultado por área

| Área | Ajuste / decisão |
| --- | --- |
| Profile | Identidade pessoal e janelas preservadas; navegação e toolbar têm alvos mobile maiores. |
| Collection | Destaque da lista segue `--accent` via color-mix; tabs e ações de cabeçalho têm alvos mobile maiores. Layout de estante preservado. |
| Search / Discover | Margens dos títulos alinhadas; títulos dos cards usam a fonte display existente; metadados e estados têm entrelinha e quebra adequadas. Artwork recebe movimento discreto em hover/foco. |
| Title Pages | Entrelinha dos avisos padronizada; avisos vazios não reservam espaço. Texto editorial, proporções e grade 6 × 2 preservados. |
| SPACEAMP | Transporte mobile de 44 px; chrome compacto de 36 px; notas mobile de 11 px. Sem alteração de core, fonte ou reprodução. |
| PARTY | Contagens podem quebrar; controles de edição e selects mobile de 44 px; saída/parar compartilhamento seguem o token de alerta. Nenhuma alteração de protocolo. |
| Appearance / XMB | Reset de aparência recebe classe secundária própria. XMB apenas inspecionado, sem alterações de CSS, navegação ou comportamento. |

## Temas, motion e CSS

`night`, `terminal`, `candy`, `paper`, accent customizado e opacidade de 75%
foram exercitados no mesmo contexto isolado. O novo token `--danger` distingue
temas escuros e claros. A seleção não depende mais de um RGB desconectado do accent.
Não foram alterados os tokens de painel, wallpaper, radius ou persistência.

Movimento usa os tempos e easing XMB já existentes. `prefers-reduced-motion`
remove a nova transformação de artwork e as animações existentes continuam desativadas.
O modo XMB permanece congelado.

Não houve divisão ou formatação geral de CSS. Regras de mobile do SPACEAMP foram
mantidas em um único bloco; os valores fixos de alerta foram substituídos localmente.
Mudança JS de produção: somente a classe do botão de reset em `profile-appearance.js`.
Seu callback e salvamento não mudaram.

## Validação

- `node tests/front-cohesion-visual.cjs after`: um browser, um contexto, fixtures locais;
  três larguras, busca/loading/vazio/erro, descoberta, coleção/lista, detalhes/galeria,
  SPACEAMP perfil/compacto, aparência, XMB e PARTY/chat/layout de compartilhamento.
- Layout de compartilhamento é uma fixture de DOM, sem captura ou alteração do controller.
  Envio e reabertura de chat foram exercitados em uma sala local de um único participante.
- Sem erros de página, overflow horizontal ou duplicação do elemento de áudio.
- Verificados: accent da seleção, alertas por tema, transporte de 44 px, foco por teclado,
  reset secundário e movimento reduzido.
- 11 testes focados: voice-ui, spaceamp-integrations, party-room-ui.
- `tests/validate.ps1 -Group smoke`: 9 smokes passaram.
- `tests/validate.ps1 -Group syntax`: sintaxe e static audit passaram.
- `git diff --check` passou.

Screenshots comparados: Profile e Busca mobile, Lista e ficha musical desktop,
Aparência mobile. PARTY tablet e XMB desktop inspecionados no resultado final.
Os sete screenshots finais e o JSON ficam em `artifacts/front-polish/after/`, ignorados
pelo Git. Fixtures usam artwork local; recursos HTTPS/fontes externas são bloqueados.

Não executados: full WebRTC, TURN, mesh, múltiplos peers, screen share real,
stress ou providers reais. Este pass não valida essas integrações.

## Antes parecia adicionado depois

- Buscar agora compartilha a altura visual dos cabeçalhos da Coleção.
- Descoberta usa a mesma linguagem de títulos, foco e movimento da estante.
- SPACEAMP mantém a janela desktop, com transporte confortável no mobile.
- Appearance deixa de apresentar restauração do tema como exclusão.
- Alertas e seleção pertencem ao tema ativo, em vez de a uma paleta paralela.

## Débitos restantes

- Wallpapers arbitrários muito claros e opacidade baixa ainda podem reduzir contraste;
  não foi imposta opacidade mínima nova ou recolorido conteúdo do usuário.
- O mini player flutuante pode cobrir conteúdo enquanto está aberto; seu fechamento e
  reserva mobile existentes foram preservados. Não foi criado outro modo de dock.
- CSS histórico ainda contém sobreposições deliberadas. Uma consolidação ampla exigiria
  outro escopo e não foi misturada com este polimento.
- Teclado virtual, dispositivos físicos, captura e negociação de chamadas continuam
  fora desta verificação visual local.
