> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Health pass 3 — UX, coerência visual, mobile e XMB

03/10/2026. Lidos os relatórios dos passes 1 e 2 e as alterações recentes antes de editar. O repositório estava limpo no início. Mantida a stack HTML/CSS/JS, os providers, o core do player e os modos aprovados da Collection.

## Problemas de UX encontrados

- O mini-player levava sua composição lateral de desktop para o celular: capa de 200 px e janela de 244 px, cobrindo uma parcela grande da página.
- A página reservava um espaço fixo de 80 px para um dock muito maior. O rodapé podia ficar atrás do player.
- A notificação de desfazer assumia uma altura fixa do dock; não acompanhava expansão nem o modo YouTube.
- O recálculo de apresentação ocultava temporariamente o botão de expansão, causando perda de foco. A inspeção de teclado revelou o problema.
- O botão de editar o nome da sala podia quebrar em várias linhas no celular.
- Search, recomendações e Descobrir ainda podiam apresentar mensagens técnicas de exceções.
- O diálogo de vínculo de reprodução não possuía um limite explícito de altura baseado no viewport.
- A capa do mini-player não tinha fallback próprio para falha de imagem.

## Melhorias aplicadas

### Mini-player mobile

Até 600 px, o SPACEAMP fica recolhido como uma pequena janela de desktop: titlebar, capa de 48 px, título/artista e transporte. O botão □ expande os controles adicionais; − recolhe. Volume e tempo ficam na apresentação expandida para áudio local. No cenário de título longo testado, a altura recolhida foi 156 px, contra os 244 px anteriores; expandida, 229 px.

Não foi criado outro player. Faixa, volume, queue, playback, Now Playing e Media Session continuam usando o mesmo SPACEAMP. A flag nova controla somente apresentação e não é persistida como estado musical.

O espaço ao final da página acompanha a altura real do dock através do observer existente; `scroll-padding-bottom` ajuda a trazer controles focados para a área de leitura. A reserva desaparece quando o compacto é ocultado ou quando o player volta ao perfil. O rodapé foi verificado acima do dock ao chegar ao fim da página.

Um iframe YouTube existente mantém seu host e viewport de pelo menos 200 × 200 na fixture. A retração nova fica indisponível quando há iframe. Este pass não modifica os adapters nem adiciona ocultação do vídeo; o modo de capa preexistente não foi reimplementado.

### Foco e controles

- Expandir/recolher expõe `aria-expanded`, `aria-controls`, rótulo e title coerentes.
- Escape recolhe controles e devolve foco ao botão.
- Ocultar transfere foco para reabrir; reabrir volta ao controle visível do player.
- Foco usa accent configurável; botões da janela no celular passam a 30 px e transporte a 32 px.
- Não é mais ocultado temporariamente o botão durante o recálculo de posição.
- Falha de imagem mostra ♫; progresso não deve reexibir a imagem quebrada. Esse último detalhe foi revisado no código, sem teste de rede de imagem específico.

### Loading, empty e error

- Descobrir começa com uma orientação curta para carregar sugestões.
- Falhas de Descobrir explicam a possibilidade de tentar novamente e preservam conteúdo anterior, sem anexar a exceção técnica.
- Busca principal e editor apresentam mensagem útil de nova tentativa/adicionar manualmente. Diagnóstico técnico permanece no console.
- Falhas de recomendações usam mensagem curta; resultados já existentes permanecem disponíveis.
- Search vazio e carregando foram inspecionados; seus estados já existentes eram coerentes e foram preservados. Não foram acrescentados skeletons.
- Diálogo de vínculo tem altura limitada a `100dvh - 32px`, com scroll interno quando necessário.

### PARTY, camadas e consistência

O botão de editar sala não encolhe nem quebra seu texto. Editor, chat vazio e lobby foram inspecionados em mobile; não houve alteração de room, presence, chamada ou transporte.

A camada de desfazer passou de 10000 para 90: acima do dock 80/reabrir 81, abaixo do XMB fullscreen 100. Dialogs nativos continuam na top layer do browser. Não foi criado um sistema novo de z-index. No celular, a posição da notificação acompanha a altura atual do player, inclusive na apresentação YouTube.

## Antes parecia adicionado depois

- **Mini-player:** a composição de desktop esmagava o texto no celular. Agora tem uma apresentação minimizada própria, mantendo moldura e linguagem SPACEAMP.
- **Desfazer:** estava posicionado por uma altura antiga. Agora acompanha o componente que ocupa o rodapé.
- **Editar sala:** quebrava como um controle sem espaço reservado; mantém uma ação curta e legível.
- **Erros de catálogo:** exceções técnicas destoavam da interface pessoal. Agora explicam a próxima ação e conservam diagnóstico no console.

## XMB e CSS

A expansão dos controles usa entrada de 8 px com `--motion-standard` e `--ease-xmb`. Movimento comunica a área adicional, sem bounce, spring ou nova animação em todas as páginas. A preferência de movimento reduzido desativa a entrada. Mantidas as animações anteriores de resultados, seleção e artwork.

CSS foi ajustado localmente em `spaceamp.css`, `spacevoice.css` e `interface.css`: composição mobile, foco, dimensões dos controles, altura de diálogo e camadas. Nenhum bloco legado foi removido sem comprovação de ausência de uso. Não houve redesenho de Profile, Collection/capas/lista/XMB ou PARTY.

## Inspeção e testes

- **15 testes passaram:** catálogo, health-pass-2 e SPACEAMP/integrações.
- **Dois smokes passaram:** navegação/restauração de leitura e descoberta personalizada.
- Sintaxe dos quatro módulos JS alterados e do harness visual validada; `git diff --check` sem erro de whitespace.
- Browser com um contexto: Profile, Collection, Search, Discover e PARTY em **390, 820 e 1440 px**. Sem overflow horizontal; um elemento audio em cada captura automática.
- Sete verificações automáticas: expansão/Escape/foco, ocultar/reabrir, alcance do rodapé, erro amigável, diálogo mobile/Escape, reduced motion e viewport/host de iframe.
- Verificações adicionais no mesmo contexto: recolher pelo mesmo botão, nome da sala/Escape, chat, Search vazio e loading; capturas complementares.
- A primeira execução revelou a perda de foco e encerrou seu browser. Após a correção, a execução principal concluiu. As correções visuais seguintes foram inspecionadas recarregando CSS/página no mesmo contexto. Nenhum browser paralelo; contexto e servidor final encerrados.
- Zero `pageerror` nas verificações automáticas. Fixtures foram usadas para catálogo, imagem e snapshot de playback. O iframe da verificação é uma fixture vazia, não reprodução YouTube real.
- Wallpaper local foi forçado no harness, com accent verde e opacidade de 82%. Foi inspecionada a interação com fundos detalhados; isso não cobre todas as preferências pessoais. Capturas complementares após reload também mostram um fundo repetido, útil para avaliar contraste.

Não executados stress, mesh, TURN, chamadas reais ou regressão completa WebRTC. Networking não foi alterado. Nenhum processo do usuário foi encerrado.

## Screenshots

- Descobrir e dock recolhido — mobile — evidência local ignorada: `../../artifacts/health-pass-3/discover-390.png`
- Dock expandido — mobile — evidência local ignorada: `../../artifacts/health-pass-3/dock-expanded-390.png`
- Perfil — mobile — evidência local ignorada: `../../artifacts/health-pass-3/profile-390.png`
- Search — desktop — evidência local ignorada: `../../artifacts/health-pass-3/search-1440.png`
- Search — tablet — evidência local ignorada: `../../artifacts/health-pass-3/search-820.png`
- PARTY — edição mobile — evidência local ignorada: `../../artifacts/health-pass-3/party-rename-390.png`
- PARTY — chat mobile — evidência local ignorada: `../../artifacts/health-pass-3/party-chat-390.png`
- Vínculo de reprodução — mobile — evidência local ignorada: `../../artifacts/health-pass-3/link-dialog-390.png`
- Search vazio — mobile — evidência local ignorada: `../../artifacts/health-pass-3/search-empty-390.png`
- Search carregando — mobile — evidência local ignorada: `../../artifacts/health-pass-3/search-loading-390.png`
- Apresentação de iframe — mobile — evidência local ignorada: `../../artifacts/health-pass-3/youtube-presentation-390.png`

`artifacts/health-pass-3/report.json` contém os resultados da etapa automática. As capturas complementares feitas durante a inspeção não estão todas listadas nesse JSON.

Screenshots full-page podem mostrar o dock sobre uma parte intermediária do conteúdo: ele continua fixo. A mudança reduz a cobertura e torna o conteúdo alcançável por scroll; não elimina toda sobreposição em qualquer posição de leitura.

## Problemas não alterados por risco

Reprodução real, autoplay, políticas de embed, fullscreen XMB e comportamento de chamadas compartilhadas não foram modificados para obter uma melhoria cosmética. Os adapters e o networking exigem validação própria antes de mudanças estruturais. A estética e os modos aprovados foram mantidos.

## Débitos de UX restantes

### Baixo risco

- Metadados pequenos em alguns controles antigos ainda podem ser uniformizados gradualmente; não houve aumento geral de fontes.
- Há mensagens técnicas em fluxos de diagnóstico/backup que precisam ser avaliadas pelo contexto, sem eliminar informações úteis.

### Médio risco

- O dock ainda é flutuante e pode cobrir conteúdo na posição atual, sobretudo com vídeo; pode ser ocultado e o conteúdo pode ser alcançado por scroll. Tablet/desktop mantêm a composição existente.
- Notificações podem coincidir com conteúdo em leitura; mudar sua localização global exige avaliar mais fluxos de edição.
- Cobertura visual de playlist preenchida, call/share/media rails ativos, teclado virtual e viewport muito baixo permanece parcial.
- Combinações de wallpaper muito claro e baixa opacidade podem precisar de ajuste local adicional; não foi adicionado scrim global.

### Alto risco

- Redesenhar apresentação de iframe ativo, share/call ou fullscreen junto do player requer verificar mídia real e regras dos provedores. Não substituir fixtures por uma alegação de validação desses fluxos.
