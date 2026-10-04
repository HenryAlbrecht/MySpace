# XMB motion refinement — 2026-10-03

Branch `feature/front-polish`, sem features adicionais, redesign ou mudança de providers/playback/voz. Refinamento do pass anterior.

## Causa e correção principal

`routeEntrance()` tratava toda mudança de hash como entrada de página, inclusive Collection → categoria Collection. Agora normaliza a superfície principal (incluindo aliases) e distingue mudanças internas. Search interno não anima a página; categoria Collection cancela qualquer entrada pendente do root e anima somente `.collection-list-shell`.

Collection recebe um único indicador compartilhado nas tabs. Posição/tamanho finais são aplicados primeiro; FLIP interpola transform desde a posição visual anterior. Os botões, header, summary e toolbar não recebem animação. O loop de seleção percorre apenas botões, excluindo o indicador decorativo de atributos aria-pressed.

Conteúdo da categoria: 5 px, opacity .9, 200 ms, ease-xmb. Direção vem da ordem dos botões. O indicador usa focus=180 ms e não reinicia o indicador da navegação global em mudanças internas. Resize reposiciona sem animação. Reduced motion aplica geometria final imediatamente.

## Auditoria de intensidade

- Page: 8 px/.88, em vez de 14 px/.45. Context: 5 px/.9. Metadata: 2 px/.94. Durações/easing mantidos; não alongados.
- Search/Discover: removido slide do root; cards conduzem a entrada. Discovery usa 4 px/.9, sem scale; search usa 3 px/.92. Stagger existente limitado aos primeiros quatro resultados. Sem camada JS de página competindo com CSS de cards.
- Profile: removida entrada de cada panel. Aside recebe contexto; main-column usa apenas opacity .94 → 1, preservando o containing block do SPACEAMP.
- Title: capa mantém protagonismo, com offset máximo 20 px e scale .985 → 1; metadata menor. Dados tardios continuam sem reentrada.
- PARTY: FLIP de avatar preservado integralmente, inclusive continuidade e origem de escala. Rail passa a metadata (2 px/.94), apenas quando há contexto aberto, para não competir com participantes. Nenhum stream ou protocolo alterado.
- Dialogs: 4 px, scale .995, opacity .92; conteúdo interno somente opacity .96. Fechamento nativo preservado.
- Disclosures e troca Capas/Lista usam níveis menores; pressão de controles e foco existentes preservados. Nenhuma animação nova de fundo, banner, decode de capa ou dimensões.

## Validação e evidências

O harness de motion inclui explicitamente `#colecao → #colecao/game → #colecao/anime → #colecao/manga`, com fixtures de conteúdo. Verifica root sem animação/opacidade 1, posições estruturais de tabs/header/summary/toolbar, indicador único com deslocamento progressivo e conteúdo de baixa amplitude. Também verifica Search interno sem slide, Profile sem panel entrances, ficha sem replay, FLIP PARTY e reduced-motion das categorias.

- Motion design visual: passando.
- Motion stability visual: 63 sequências, shifts=[], artworkShift=0, railShift=false, banner300 px preservado.
- Percurso de coesão 390/820/1440 px: passando; sem erros/overflow, um áudio.
- Collection, voice UI, PARTY room UI, SPACEAMP integrations e XMB: 26 testes passando.
- Nove smokes; syntax/static audit; diff check: passando.

Frames de Anime, com indicador e conteúdo pausados nos tempos declarados: `artifacts/motion-design/category-0.png`, `category-80.png`, `category-180.png`. Inspecionados visualmente; o chrome permanece estável e o foco percorre as tabs. `report.json` registra geometria e keyframes. Evidências são locais e ignoradas, não dependências do projeto.

Cada execução usa um browser/context, fixtures locais, sem providers reais, captura, WebRTC pesado, TURN, mesh ou stress. Apenas recursos próprios são encerrados. Sem commit/push/merge.
