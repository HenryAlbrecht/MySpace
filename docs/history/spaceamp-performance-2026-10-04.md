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

## Fix exclusivo de horizontal glyph drift

Conforme especificação do usuário: separado X via --am-lyrics-horizontal-lift (default 1), mantendo Y via --am-lyrics-lift. Now Playing define horizontal-lift=0 e character-emphasis=0. Settles extraem somente Y quando horizontal-lift é 0. Não alterados Core, playback, providers, seek, autoscroll, Kawarp, visualizer, video ou layout nesta correção.

Antes da correção a assertion nova falhou: primeiro glifo drift [2,269; 5,369; 5,369; 0; 0] px. Depois passou exigindo <0,5 px para container, primeiro word, primeiro glyph e sete glyphs por linha durante seis segundos de transição word-synced. Movimento vertical e settle continuam presentes; scroll uniforme deslocou ~289 px. Sequência de screenshots com guia vertical temporária em -200/0/+100/+200/+400 ms foi adicionada ao teste; guia removida ao terminar.

## Baseline upstream simples — pedido de simplificação

Substituídos todos os patches do vendor pelo arquivo original @uimaxbai/am-lyrics@1.7.4, obtido de jsDelivr. SHA-256 local e original iguais: 1d5d51da190a5763c6cfacd824cea14c25a8b57c796f1149018a996d1714f3e6. Removidos smoothSeek, settles, horizontal-lift, emphasis e overrides de escala/lift da integração. Removido atributo line-motion. Sem no-blur. Autoscroll/interpolate, metadata, currentTime, duration e line-click→seek preservados. Apenas apresentação permitida (cores/font/glow) e dimensões 100% restantes.

Fonte Monochrome js/lyrics.js consultado: a criação do componente não passa line-motion; autoscroll/interpolate estão ativos. Existe diferença adicional no Monochrome atual: applyFullscreenLyricsShadowTweaks injeta CSS de curva/duração/opacidade e escala ativa 1.015 no fullscreen. Não copiado: esta rodada mantém distribuição e motion upstream originais como solicitado.

Browser/context únicos compararam A (snapshots anteriores em artifacts) e B (baseline sem ajuste) com TTML real de Prime Time Golden Hour Show, tempos 20–25.9 s e screenshots a cada 500 ms. B passou: carga, defaults, autoscroll real, interpolate, currentTime, line-click seek, pause/resume e troca de música. Sem page errors. Na ausência dos artefatos de diagnóstico o teste executa apenas B com TTML determinístico de autoria local. O teste não afirma eliminar toda variação horizontal nativa nem reproduzir exatamente CSS adicional do Monochrome.


### Perfil visual paint-only solicitado pelo usuário

O Now Playing aplica `applySpaceampLyricsMotionProfile` após o componente definir seu Shadow DOM. Um único style `spaceamp-lyrics-motion-profile` neutraliza transform/translate/scale/rotate dos containers e glyphs, inclusive transform originado em WAAPI, sem cancelar animações de paint. As linhas recebem opacidade 1/.72/.48 e blur inativo de .3px. Os transforms dos rows `.lyrics-line` continuam sob controle do upstream para autoscroll vertical. Nenhuma medição/reposicionamento corretivo em produção.

Vendor 1.7.4 original preservado: SHA256 `1d5d51da190a5763c6cfacd824cea14c25a8b57c796f1149018a996d1714f3e6`.

Teste focado: TTML real de Golden Hour nas transições 23.400/25.740/28.380s, amostras -200/-100/0/+100/+200/+400ms, screenshots e medidas em artifacts/spaceamp-lyrics-motion. Drift X observado 0px nos quatro pontos. Esse TTML é line-sync; fixture adicional word-sync verifica três transições com chars reais, transform neutro e paint temporal mudando. Seek, pause/resume, troca de faixa e scroll upstream verificados. Isto é evidência local em Edge headless, não confirmação perceptiva do usuário no Zen.


### Scroll vertical uniforme

Após o usuário confirmar que o recuo horizontal desapareceu, habilitado `line-motion="uniform"` na API pública do am-lyrics. Mantém o autoscroll upstream e elimina o atraso em cascata entre rows; perfil paint-only permanece. Teste adicional amostra cada frame durante a transição 23.4s, verifica movimento vertical real e deslocamento igual entre três linhas (<.5px), com X estável. Testes de line/word-sync e controles continuam passando. Não comprova sozinho a ausência de todo salto percebido no Zen; nenhuma alteração no vendor ou clock.


### Coordenação presentation clock / seek

Escopo do usuário: vendor e profile horizontal intactos; removido line-motion uniform. Now Playing mantém pendingSeek com revision/targetMs/startedAt antes de enviar amp.seek. O target fica protegido de leituras antigas até ACK dentro de 250ms ou timeout 1200ms. Último seek substitui o anterior. Lyrics usa base temporal/performance.now; confere drift a cada 500ms, corrige diferenças >350ms, congela ao pause, retoma da posição real e reinicializa em troca/abertura. Slider e clock textual continuam refletindo o player real.

Teste Edge com vendor real: player 188/188/188 após destino 80, ACK atrasado, cinco cliques em <1s, local ACK imediato, pause, cinco transições com relógio bruto em passos de 200ms. 2298 frames: maior passo de presentationTime 17.3ms, maior passo vertical da primeira linha 3.54px. Registros completos em clock-measurements.json. Isso valida coordenação e continuidade no mock; não prova ausência do flick nativo quando handleLineClick cancela spring em curso (diagnóstico anterior). Nenhum patch do vendor aplicado.


### A Way of Life / álbum localizado

Reproduzido com registro Apple itunes:1665512398 (Mayumi Fujita, 141s). LRC.red match com álbum inglês retorna hits vazio; título/artista/duração encontram original JPK650900100 com álbum japonês. Catálogo tenta fallback LRC.red quando MusicBrainz não resolve: título/artista exatos e duração ±1.5s, resultado único, preferindo álbum exato quando disponível. Não altera metadados Apple nem providers do vendor. ISRC lookup v4 invalida negativos anteriores. Testes rejeitam remix, artista diferente e resultados ambíguos. Consulta real pós-correção retorna ISRC JPK650900100/source lrc.red.


### Micro-polish visual das lyrics / transições de faixa

Pequena descontinuidade vertical residual do autoscroll am-lyrics permanece pendente para investigação em um pass futuro. Nenhuma alteração em clock/seek, scrollTop, autoscroll ou vendor nesta rodada. Entrada da linha ativa somente por opacidade .92 → 1, 140ms com ease-xmb; animação ligada à classe active, desativada em reduced-motion. Nenhum transform geométrico adicionado. Crossfade das artworks usa somente opacidade; o fundo decodificado anterior permanece durante o intervalo sem artwork nos metadados da próxima faixa, evitando retorno instantâneo ao fallback. Entrada do slot de lyrics entre faixas usa .92 → 1, sem translateY.


### Nobody's Fool / alias localizado e pontuação

Coleção Apple itunes:1626354269 resolvida em consulta real para USAR10200232. LRC.red registra artista como 艾薇儿; match com Avril Lavigne retorna vazio e search literal com apóstrofo também retorna vazio. Fallback consulta aliases oficiais Artist name de identidade MusicBrainz única e exata, normaliza pontuação apenas na consulta textual, e verifica título/artista/alias/duração em metadados LRC.red, rejeitando live e ambiguidades. Lookup v5 permite nova tentativa para itens antigos sem ISRC. Origem local/YouTube não participa dessa identificação; vendor e apresentação não alterados.


God knows...: Apple credits 涼宮ハルヒ(CV.平野綾), while lrc.red credits Haruhi Suzumiya (CV: Aya Hirano). Character CV aliases now require a unique MusicBrainz character, an alias confirming the exact character/voice pairing, and a unique voice-actor identity before composing official localized names. LRC matching retries verified aliases and retains exact title/duration/edition ambiguity checks. Real lookup resolved JPI100601012 (278.909 s, word sync); lookup version 6 retries previously unresolved collection entries.
