# SPACEAMP — dynamic artwork atmosphere

Continuação em `feature/spaceamp-now-playing`. A correção de escopo mantém Kawarp exclusivamente como background da artwork, separado do visualizer de áudio.

## Distribuição e integração

Usado `@kawarp/core` 1.3.1 oficial, ESM autocontido e sem dependências runtime, incluído localmente em `dist/vendor/kawarp` com licença MIT e metadados. O tarball foi verificado contra o SHA-512 do registry npm. Não há bundler, framework, CDN em runtime ou código copiado do Monochrome. [API oficial](https://github.com/better-lyrics/kawarp).

`spaceamp-atmosphere.js` é um adaptador fino. Recebe a capa confirmada pelo Artwork lifecycle e entrega um snapshot à API pública `loadImageElement`, sem novo fetch de artwork. Usa a transição interna de 1000 ms do Kawarp; não implementa crossfade paralelo. Mantém apenas proteção contra respostas antigas e lifecycle do canvas.

Configuração: warpIntensity 1, blurPasses 8, animationSpeed 1, transitionDuration 1000, saturation 1.5, dithering .008 e scale 1.25. Não há beat detection, analyser, energia, currentTime ou caminhos distintos por source no adaptador. A lógica do visualizer de ondas permanece independente.

## Play/pause e recursos

Playing chama `start()`. Pause chama `stop()` e conserva o último frame visível, sem mudar `data-atmosphere=kawarp`, esconder o canvas ou retornar à palette fallback. Resume volta a chamar `start()`. Uma capa carregada enquanto pausado recebe um único frame estático. Local e YouTube usam exatamente a mesma configuração.

Framebuffer limitado a 960 × 540, DPR máximo 1 e resize agrupado. O desenho para com document.hidden; ao fechar, os recursos são liberados. Reduced motion usa o background estático existente. Falhas de import, WebGL ou CORS voltam silenciosamente ao fallback e não afetam playback. Uma artwork segura pode recuperar Kawarp após falha de CORS.

Layers: palette/deep background, artwork Kawarp fullscreen, washes/scrim, ondas opcionais e conteúdo. Lyrics OFF/idle alteram somente opacidade via CSS. Paleta, layout, controles, am-lyrics, playback, Core, preferências e contratos XMB foram preservados.

## Validação focada

Um browser/context com biblioteca oficial local e fixtures: artwork carregada, canvas visível, pixels brutos via WebGL readPixels da mesma faixa em 0/2/5/10 s, pause com frame congelado sem remoção, resume, troca de artwork, mesma política em local/YouTube, parada ao fechar/ocultar, reduced motion, import/WebGL/CORS fallback, ausência de page errors e playback intacto. Mantidos os testes existentes de apresentação, XMB e 390/820/1440. Removidos os testes de PCM/beat para Kawarp.

Também executados testes unitários afetados, smokes, syntax/static e diff check. A regressão de motion stability anterior passou em 63 cenários; a simplificação não modifica layout. Nenhum provider real ou WebRTC pesado foi executado.

## Correção da visibilidade temporal

O teste anterior de screenshot do elemento era insuficiente: capturava a composição e podia incluir ruído de UI. Diagnóstico com a instância oficial confirmou start ativo, tempo interno avançando, framebuffer atualizado e identidade entre canvas da instância e canvas no DOM. Não houve stop acidental ou recriação durante a observação. Com opacity 1 e camadas estáticas/scrim removidos, grandes massas da artwork se deslocaram claramente.

Causa raiz: composição CSS. A opacidade .68–.76 do canvas, combinada com washes estáticos fortes (tint 78/86%), filtros e imagem estática, abafava a mudança espacial. Correção mínima: canvas .92–.96; wash ativo com opacity .18; artwork estática invisível somente durante Kawarp. Scrim de contraste preservado. Nenhuma alteração do loop, velocidade ou API da biblioteca nesta correção.

Teste substituído por médias RGB em grade 32×18 dos pixels brutos, com limiares de diferença média >3/255 e >20% das regiões materialmente alteradas. Mesma artwork, palette constante, lyrics OFF, ondas OFF e Hide UI. Resultado: diferenças médias 13.44 / 29.67 / 45.15 nos tempos 2/5/10 s; regiões alteradas 61% / 75% / 88%. Pause por 3 s: pixels idênticos e nenhuma draw call nova. Resume por 3 s: diferença média 31.10 e 88% de regiões alteradas, mantendo a mesma instância. Fixtures isoladas, playback ativo pelo contrato SPACEAMP, sem provider remoto.

Inspeção adicional da composição final: recorte exclusivo de background em x1060/y120, 300×600, fora da artwork frontal, sem UI/lyrics/ondas. Em 10 s, diferença RGB média passou de 11.31 antes para 20.88 após a correção, com migração visível da região magenta para cyan. Capturas e métricas em artifacts/kawarp-isolated; diagnóstico temporário removido ao encerrar o browser. O scrim final permanece ativo. Testes SPACEAMP unitários: 8/8; browser focado completo passou.

## Comparação dos vídeos e correção CORS

A conclusão anterior de CSS como causa única estava incompleta. Os vídeos enviados pelo usuário mostram o MySpace praticamente fixo e o Monochrome com migração espacial evidente usando a mesma artwork. O fixture de data URL não exercitava o caminho de capas remotas. Reproduzido com imagem de outra origem e Access-Control-Allow-Origin permitido: a capa frontal sem crossOrigin aparece, mas seu ImageBitmap permanece tainted; texImage2D lança SecurityError e o adaptador entra silenciosamente em fallback. A paleta funcionava por usar outro Image com crossOrigin anonymous.

Correção: reutilizar o Image anonymous já carregado pela paleta como entrada do Kawarp. Nenhuma nova requisição independente, proxy ou mudança global de Artwork; capa frontal e fallback continuam suportando imagens sem permissão CORS. Retida apenas a imagem segura atual; o cache de paletas continua contendo somente cores. Proteções de revisão/source e descarte do ImageBitmap preservadas.

Prova adicional com a artwork extraída do vídeo, servida como imagem remota com CORS: antes SecurityError/static; depois Kawarp ativo. Pixels brutos em 0/2/5/10 s: diferenças médias 42.26/34.70/40.72 e regiões alteradas 95%/100%/98%. Instância start=1, stop=0, canvas correto e tempo avançando de 1.89 a 12.30 s. Recortes exclusivos de background final mostram migração do campo escuro/amarelo. Evidências em artifacts/video-comparison/corrected. Fixture reproduz o contrato do player; não foi controlada a sessão Zen do usuário.

## Lyrics e transporte após seek

Configurado o modo público line-motion=uniform em am-lyrics 1.7.4 para sincronizar o movimento das linhas, removendo os atrasos em cascata. currentTime é escrito somente pela propriedade e quando muda; eliminado o atributo current-time redundante, que essa versão não observa. Sem clock próprio, acesso a Shadow DOM ou override de métodos privados em produção. Teste novo usa biblioteca oficial e TTML local determinístico, mede posições temporais no DOM real e valida movimento material/continuidade, seek e reduced motion.

O estado confirmado SPACEAMP permanece falso durante buffering YouTube. Somente a ação de apresentação permanece Pausar enquanto playbackStatus=loading após playback confirmado. Pausa explícita, erro, bloqueio e parada continuam liberando a ação. A largura do botão é estável e mudanças reais recebem a animação XMB existente; sem debounce temporal que esconderia uma pausa real. Testados slider, line-click, buffering/resume e pausa explícita.

Verificação final: browser completo passou com CORS permitido/negado explícito, import/WebGL fallback, frames brutos, pause/resume, slider/line-click e apresentação responsiva. Biblioteca am-lyrics real: deslocamento de 145 px durante troca de linha; desvio relativo entre linhas de 78.01 px em cascata contra <0.001 px no modo uniforme. Clique real em uma linha, seek pelo slider e pausa explícita durante buffering passaram. Testes unitários SPACEAMP 8/8; syntax e diff check passaram.

## Preferência de fundo estático

Menu Aparência → Fundo: Dinâmico (padrão) / Estático. Estático restaura a composição anterior de paleta e artwork com blur; não congela um frame Kawarp. A escolha é validada e persistida nas preferências existentes, compartilhadas pelo mesmo Now Playing em XMB. Ao desativar, a instância é parada e seus recursos liberados; updates, resize e visibility não reativam rendering. Ao voltar ao modo dinâmico, carrega a imagem segura atual, inclusive após mudar faixa no modo estático. O guard de preferência também protege imports e artwork pendentes. Reduced motion continua respeitado.

## Transporte durante próxima/anterior

A troca de trackKey zerava transportPlaying, além de existir uma fase de troca com playing=false antes do status loading. As ações Próxima e Anterior agora mantêm a intenção de transporte de apresentação durante seleção e buffering da nova faixa. Estado confirmado do player, clock, presença e Media Session permanecem intactos. O estado transitório é encerrado por playback confirmado, pausa explícita, fechamento, indisponibilidade, parada, erro/bloqueio ou seleção local concluída sem reprodução. Sem debounce ou timer para esconder estado real.

Teste inclui ambas as direções, troca de identidade da faixa, fase intermediária sem playbackStatus seguida de loading, MutationObserver para detectar qualquer flash de Reproduzir, pausa durante navegação e autoplay bloqueado.

## Duração tardia do YouTube e timeline compartilhada

A chegada da duração do YouTube alterava song-duration no am-lyrics 1.7.4. Esse atributo participa da consulta do provider e dispara fetchLyrics novamente, recriando visualmente a apresentação das letras. Agora song-duration é informado somente na criação do componente, quando já disponível; duration e currentTime continuam atualizados para sincronização. A chegada tardia da duração preserva o componente e as letras carregadas. Nenhum método da biblioteca foi alterado em produção.

Perfil e player compacto agora usam getPlaybackTime e seek do SPACEAMP para áudio local e YouTube, com slider e relógio no mesmo desenho. Os eventos do áudio publicam progresso pelo contrato existente. Duração desconhecida desabilita seek até ficar disponível; fontes sem suporte não oferecem seek. A apresentação acompanha o relógio do adaptador durante reprodução, sem outro player ou tempo inventado. Durante o gesto e a confirmação tardia de seek, o thumb é preservado, com limite de 1,5 s para confirmação; os textos continuam usando o tempo real. Escritas de texto são condicionais para evitar ciclos no MutationObserver existente.

Validação: am-lyrics oficial mantém o mesmo elemento e a mesma contagem de buscas após duração 0 → 42 s. Browser da timeline passou com YouTube IFrame API simulado, duração tardia, teclado, seek pausado com confirmação tardia e áudio WAV real com suporte a Range; perfil/compacto, desktop/mobile, mesma geometria e único host de playback. Browser YouTube existente e 8 testes unitários passaram. Browser completo Now Playing também passou; syntax e diff check sem erros. Providers remotos não foram reproduzidos nesta verificação.
