# XMB-inspired motion design — 2026-10-03

Branch mantida: `feature/front-polish`. Pass exclusivamente de apresentação, sem skin de console, novos providers, captura, Player Core, persistência ou protocolos.

## Gramática e mapa espacial

A ordem visual Profile → Collection → Photos → PARTY → Search → Discover define o eixo lateral. Avançar entra pela direita; voltar entra pela esquerda. Ficha é aprofundamento: capa ganha protagonismo com escala de .97 para 1 e pequeno deslocamento; retorno usa direção inversa. Metadata recebe deslocamento menor. Background permanece estático.

Tokens existentes: fast=150 ms, focus=180 ms, standard=200 ms, ease-xmb. Único token novo: motion-step=20 ms, para stagger de até 60 ms nos primeiros quatro resultados. Layout final é aplicado antes do movimento. Animações JS usam Web Animations e são canceláveis; reduced-motion cancela as ativas e evita novas.

`dist/motion-design.js` concentra a responsabilidade de apresentação, com fallback quando Web Animations não existe. Não passa a ser dono da navegação ou da visibilidade. `dist/motion.css` define apresentação de dialogs, indicador, stagger e feedback de foco. `dist/index.html` carrega o módulo após os consumidores existentes.

## Aplicação por área

- Navegação global: entradas laterais direcionais e indicador único de seleção, com FLIP simples. O indicador recebe posição/tamanho finais e interpola somente transform. Resize reposiciona imediatamente, inclusive quando as abas quebram linha.
- Collection: entrada do contexto, foco de teclado reduz discretamente a presença dos vizinhos e troca Capas/Lista conduz ao rail ou shelf final. Proporções e seleção deliberada da lista preservadas.
- Search/Discover: stagger curto e limitado sobre a entrada existente; item acionado fornece feedback de saída. Atualizações de imagem não recriam cards nem repetem sua entrada.
- Title Pages: origem da seleção orienta deslocamento da capa, limitado a 48 px; não é clone/shared-image completo. Capa e metadata entram primeiro. Apenas a primeira composição da rota recebe entrada; dados enriquecidos não repetem a animação. Disclosures abertos recebem movimento curto nos conteúdos, sem animar dimensões.
- Profile: coluna de perfil entra discretamente no acesso inicial. Ao retornar, painéis recebem deslocamento menor, excluindo o contêiner e ancestrais do SPACEAMP. Sem cascata de todos os cards.
- SPACEAMP: preservados entrada, troca de faixa e artwork/vídeo já existentes. Adicionado feedback de pressão nos controles. Não houve FLIP do dock, width/height animadas ou transformação de seu containing block.
- PARTY: mesmos nós de avatar usam FLIP ao mudar de posição no contexto. Captura anterior, layout final, transform inverso com origin top-left; novas mudanças cancelam o efeito anterior antes da medida final. Rail recebe entrada lateral sem interpolar colunas. Lobby/call usam o mesmo feedback contextual; nenhuma alteração de mídia.
- Dialogs: chrome entra com deslocamento vertical curto e escala .98 → 1; conteúdo interno tem entrada menor. Fechamento continua imediato e nativo, sem atrasar foco/Escape.
- Microinterações: seleção das abas avança 2 px, transporte responde à pressão e foco de teclado diferencia protagonista/vizinhos. Não alteradas as ações de favorite/like.

## Onde não animar

Não mantemos snapshots/clones da página anterior: poderiam duplicar media, foco ou estado. A navegação continua imediata; continuidade vem da direção de entrada, indicador persistente e feedback do item. Não há animação de saída completa das páginas.

Não adicionados FLIP de iframe/dock, participantes clonados, timeline de dezenas de cards, animação de banner/galeria no decode, movimento de background, alterações do grid durante o efeito ou animação a cada resposta de rede. Não há framework de shared transitions. Medidas FLIP alteram exclusivamente apresentação; as caixas finais não interpolam layout.

## Inspeção e validação

Antes: harness de coesão percorreu Profile, Collection, Search, Discover, PARTY, fichas, galeria, Appearance, temas e XMB em 390/820/1440 px; screenshots inspecionadas. Depois: mesmo percurso passou sem erros de página/overflow, com um único áudio e fixtures locais.

Checks:

- `node tests/motion-design-visual.cjs`: direção ida/volta, sequência 0/80/200 ms, ficha sem reentrada no enriquecimento, PARTY FLIP alinhado ao avatar anterior, dialog e reduced-motion. Passando.
- `node tests/motion-stability-visual.cjs after`: 63 sequências; shifts=[], artworkShift=0, railShift=false, banner300 px preservado. Passando.
- Collection, voice UI, PARTY room UI, SPACEAMP integrations e XMB: 26 testes passando.
- Grupo smoke: nove smokes passando.
- Syntax/static audit e diff check: passando.

Cada execução visual usa um browser/context, fecha apenas seus próprios recursos e bloqueia HTTPS externo. YouTube e compartilhamento são apresentação simulada; não certificam playback ou screen share reais. Sem full WebRTC, TURN, mesh, stress ou providers reais. Sem commit/push/merge.

Evidências locais ignoradas, geradas pelo harness (não necessárias em clones):

- `artifacts/motion-design/collection-0.png`, `collection-80.png`, `collection-200.png`: sequência com a animação real pausada nos tempos declarados.
- `artifacts/motion-design/title-entry.png`: entrada da ficha.
- `artifacts/motion-design/party-context.png`: avatar no início do FLIP.
- `artifacts/motion-design/dialog.png`: entrada do editor.
- `artifacts/motion-design/report.json`: frames/assertions.
- `artifacts/front-polish/after/`: estados finais do percurso geral.

Screenshots estáticas mostram geometria e hierarquia; a avaliação de timing é complementada pelos keyframes e pelo navegador, não apenas pelo estado final.
