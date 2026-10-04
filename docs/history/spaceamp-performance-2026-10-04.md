# SPACEAMP — otimização de navegação — 2026-10-04

Branch feature/spaceamp-now-playing. A consulta de ISRC era aguardada antes de selecionar a fonte, com force:true. Isso colocava catálogo/MusicBrainz/lrc.red no caminho crítico e repetia consultas mesmo com cache. O enriquecimento agora ocorre depois da apresentação/playback, com atraso de 150 ms para evitar trabalho em faixas atravessadas rapidamente, usa o cache de detalhes e cancela o fetch anterior ao selecionar outra faixa. Token de seleção impede respostas atrasadas de atualizarem state, Core ou Collection. ISRC confirmado atualiza as letras e a Collection sem renderizar novamente o player ou recriar o iframe.

A navegação usa a última faixa solicitada enquanto sourceFor/metadata inicial estão pendentes. Antes, cliques sobrepostos partiam da faixa antiga e apontavam repetidamente para o mesmo destino. Erros de audio.play de seleções superadas não geram toast sobre a faixa atual. Now Playing usa revisão de navegação para impedir promises antigas de finalizarem uma navegação posterior.

Core fornece getPlaybackState sem copiar a fila; getState e eventos públicos preservam fila e isolamento. Now Playing/player compacto usam a leitura leve. Atualizações do Now Playing não cancelam e recriam o requestAnimationFrame enquanto playback continua ativo.

Validação: browser com metadados atrasados 2 s confirma playback antes da resposta; 24 cliques rápidos avançam até o destino esperado, anterior/próxima também, ISRC e letras chegam depois e persistem em reload. O transporte YouTube é simulado nesse teste; não mede o tempo de buffering da rede real. Oito testes unitários passaram. Timeline browser confirma seek local/YouTube, pausa, teclado e geometria. Video browser passou; uma execução concorrente falhou na igualdade de screenshots do fundo pausado e a repetição passou (nenhuma alteração de opacidade/CSS nesta etapa). Now Playing browser final passou, incluindo pixels isolados de Kawarp em 0/2/5/10 s, pause/resume, fallbacks e responsividade. Não houve redução das features nem mudança na qualidade do Kawarp.

## Estabilidade das letras e leituras locais

Vídeo de referência inspecionado por sequência de frames. A escala padrão do am-lyrics nas linhas inativas é .98 e transita para 1 no destaque. Now Playing define a variável pública --am-lyrics-inactive-scale:1, mantendo a dimensão da linha durante a troca, sem patch de Shadow DOM e preservando autoscroll uniforme, destaque e efeitos por palavra. Teste com componente oficial mede largura estável (<0,5 px de variação) durante transições, deslocamento real ~145 px e movimento conjunto das linhas (diferença ~0,00006 px). Seek por linha, slider e reduced motion passaram.

O relógio só recebe texto quando muda; duration só é atribuída quando muda. Leituras concorrentes do mesmo arquivo local compartilham a promise e um único object URL, com proteção contra conclusão após descarte do controller e reutilização de URL criado por relink. Browser confirmou uma leitura de storage em três seleções simultâneas do mesmo arquivo, playback local, sliders, mobile e fonte unsupported. Navegação rápida/metadados assíncronos também passaram.

## Ajuste lateral de palavras — diagnóstico corrigido

Os testes anteriores observavam linha e largura, com TTML apenas por linha. Isso não detectava a animação interna dos glifos. A comparação do JS público lrc.red confirmou am-lyrics 1.7.4 com o mesmo movimento de caracteres, não outro motor. Fixture agora usa spans com timestamps por palavra; o primeiro glifo se deslocava até 5,37 px enquanto o contêiner ficava imóvel. Variável pública --am-lyrics-lift:0 reduz esse deslocamento a ~1,00 px, mantendo wipe, timing, brilho, scroll e escala de ênfase. A subida e expansão lateral dos caracteres foram desativadas deliberadamente; não é correto afirmar que toda a animação por palavra permanece igual. O teste mede os glifos e limita drift a 1,1 px. Não comprova eliminação absoluta de movimento nem equivalência visual completa ao site.

## Vídeo do usuário — transição para linha inativa

Inspecionada sequência do vídeo MySpace 16-12-03. O ajuste percebido acontece ao perder o destaque. Além da animação de glifos, o componente aplica blur nas linhas inativas: isso expande limites visuais do texto sem alterar getBoundingClientRect, portanto os testes de posição não provam estabilidade da aparência. Aplicado atributo público no-blur no Now Playing, preservando opacidade de destaque, scroll e timing. Teste verifica ausência de filtros nas linhas renderizadas, word sync, medidas horizontais e seek. A eliminação do movimento percebido pelo usuário ainda requer comparação do mesmo trecho; blur é hipótese baseada na transição observada, não causa raiz conclusivamente isolada.

## Comparação do fonte e correção da escala residual

Consultado fonte público https://github.com/binimum/am-lyrics/blob/main/src/AmLyrics.ts (commit 4676f22044bb16a9e548b1f0085b03ad747725c9) e bundle público do lrc.red /assets/am-lyrics-bVOjxtFa.js. Ambos usam escala de ênfase por caractere independente de --am-lyrics-lift. unfinishSyllables cancela character motion quando a linha sai de destaque. A escala residual medida era ~1 px; variáveis externas de escala de linha não atuavam nela.

Vendorizado bundle oficial 1.7.4 com uma substituição localizada: scale(1 + emphasis) passa a scale(calc(1 + emphasis * var(--am-lyrics-character-emphasis,1))). Now Playing define 0; default 1 mantém comportamento upstream. Sem patch de Shadow DOM em runtime, providers, parser ou scroll. Licença MPL-2.0 e NOTICE preservados. Blur restaurado conforme pedido. Testes agora usam explicitamente o bundle local modificado, não o CDN original; fixture por palavra mede glifos e exige drift menor que 0,1 px. Testes ISRC/Collection e vídeo passaram. A validação sintética identifica e remove esse deslocamento, mas não substitui a confirmação visual do usuário no trecho real.

## Saída de destaque suave a pedido do usuário

Movimento nativo de palavras restaurado. A saída de persist-highlight captura transform dos glifos e sílabas antes de remover finished/highlight, e anima o retorno ao estado final por 320 ms com curva XMB cubic-bezier(.22,1,.36,1). Reduced motion não anima. Linhas desconectadas/reativadas são ignoradas; movimentos reiniciados cancelam resets antigos. Teste ampliado para seis segundos e verifica existência real da animação de saída. Scroll uniforme, seek, duração tardia e controle play/pause passaram. Isso suaviza a mudança de pose; não afirma eliminar todo deslocamento lateral percebido no vídeo do usuário.

## Reprodução por clique e passagem automática

Vídeos 16-32-52 e 16-22-27 inspecionados. Reset de seek também usa resetSyllables, além de unfinishSyllables; adicionado settle nesse caminho e método público smoothSeek que captura pose antes do seek e suaviza transform se houver diferença após atualização. O teste sintético de clique continua verificando destino; não reproduziu animação observável nessa fixture e não comprova solução do recuo real. Blur mantido.

Troca automática publicava stopped antes do novo playback, interrompendo Kawarp. Runtime transitioning representa somente continuidade visual durante navegação/fim com próxima faixa. Ativado antes de publicar o fim YouTube e na navegação; encerra em playback confirmado/erro/blocked/arquivo ausente. Pausa/stop explícitos limpam o estado. Now Playing mantém transporte visual e Kawarp durante essa passagem, sem falsificar playing ou relógio. Browser de vídeo agora termina o player mock em vez de chamar next e confirma transição e limpeza ao tocar a próxima faixa.
