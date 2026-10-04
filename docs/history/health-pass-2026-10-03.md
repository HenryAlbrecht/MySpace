> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Health pass — 3 de outubro de 2026

Revisão incremental do projeto atual, HTML/CSS/JavaScript puro. Sem reescrita, troca de framework ou mudança de catálogo. Complementa a auditoria em `project-audit-2026-10-03.md`.

## 1. Principais problemas encontrados

- A proteção de fotos contra homônimos era excessiva: dois resultados Deezer chamados The Smiths faziam descartar a foto mesmo existindo evidência musical para distinguir os artistas.
- Agrupamento de homônimos duplicado em Search e no editor, com contagem repetida dentro de cada iteração.
- Resultados homônimos expandidos usavam capas grandes no celular, tornando a busca muito longa.
- Estilos de descoberta estavam em `spaceamp.css`, com durações/curvas próprias e fallbacks de cores específicos em vez dos tokens compartilhados.
- Eventos de progresso do player executavam posicionamento do dock e leitura de geometria sem mudança de layout.
- Restauração de leitura serializava e escrevia sessionStorage em cada evento de scroll.
- O smoke de fotos ainda verificava extração Last.fm, embora a arquitetura atual use Deezer exclusivamente para enriquecimento visual.

## 2. Melhorias aplicadas

- Fotos ambíguas podem ser resolvidas comparando faixas Apple já disponíveis com as dez faixas populares dos candidatos Deezer. São exigidas duas correspondências e um vencedor único; se algum candidato não puder ser consultado ou houver empate, mantém-se o fallback. No máximo quatro candidatos são comparados. Não é usado número de fãs como prova.
- Cache de foto inclui a evidência musical para não compartilhar decisões entre artistas homônimos. Consulta apenas por nome continua independente da consulta contextual.
- The Smiths foi validado com Apple `829538`; foto Deezer recuperada sem introduzir identidade Deezer na coleção.
- Busca, recomendações e busca de artista por música passam a obter faixas do ID Apple quando o nome sozinho não resolve a foto. Homônimos da Apple podem receber fotos somente com verificação contextual; `&`/`And` são equivalentes no matching visual. A identidade Apple continua intacta.
- Fotos ausentes nas recomendações podem ser reenriquecidas sem resolver o item Apple novamente; cards já existentes atualizam a imagem recuperada. Cache de recomendações no front não bloqueia nova tentativa quando ainda há artistas sem foto. O cache negativo de fotos mantém proteção contra repetição por um minuto.
- Agrupamento compartilhado entre as duas telas de busca; normalização consistente preserva acentos e pontuação.
- Leitura mantém atualização imediata em memória, com persistência agrupada a cada 150 ms durante scroll e flush na captura explícita/pagehide.
- Progresso musical continua atualizando controles, mas não recalcula o posicionamento do dock. Mudanças de faixa, estado, rota, resize e DOM continuam acionando o fluxo de layout existente.

## 3. Arquivos/módulos reorganizados

| Área | Responsabilidade verificada | Alteração |
|---|---|---|
| `app.js`, `extras.js` | Profile, Appearance, composição e persistência de preferências | Mantidos; arquivos grandes continuam dívida técnica |
| `collection.js`, `collection-view.js` | Regras/validação e apresentação da Collection | Mantidos |
| `catalog.js`, `catalog-discovery.js`, `title-pages.js`, `editor-ui.js` | Busca, detalhes, descoberta e editor | Apresentação de agrupamento extraída |
| `catalog-ui.js` | Agrupamento visual de resultados | Novo helper pequeno, sem regras de identidade/rede |
| `navigation.js`, `xmb.js` | Posição de leitura e modo XMB | Persistência de leitura agrupada; XMB mantido |
| `spaceamp.js`, `app.js`, `playlist.js` | Estado público, reprodução e fila | Mantidos |
| `music-bridge.js`, `spaceamp-integrations.js` | Views do player, Media Session e binding YouTube | Evitada leitura de layout nos eventos de progresso |
| `spacevoice.js`, `voice/room.js`, `voice/session.js`, `voice/peer.js` | UI PARTY, ROOM, CALL e peers | Mantidos; ownership/cleanup inspecionados |
| `voice/chat.js`, `voice/presence.js`, `voice/media.js`, `voice/levels.js` | Chat, presença, captura e medidores | Mantidos; sem redesenho de networking |
| `media-storage.js`, `media-package.js`, `title-preferences.js`, export/import em `extras.js` | Blobs IndexedDB, pacote e validação de backup | Mantidos |
| `server/music-catalog.cjs`, `server/artist-artwork.cjs` | Orquestração Apple/Last.fm e fotos Deezer | Matching contextual da foto |
| `interface.css`, `spaceamp.css`, `motion.css` | Apresentação e motion | Estilos de descoberta movidos para interface; tokens existentes reutilizados |

Dependências de scripts clássicos permanecem explícitas em `index.html`; `catalog-ui.js` carrega antes de suas duas views. Não foi criado um framework ou registro global de serviços.

## 4. Dead code removido

Removidos os blocos duplicados de agrupamento das duas views e o bloco de descoberta do stylesheet do player, substituídos pelos caminhos compartilhados.

Nenhum módulo legado foi apagado sem prova. `server/deezer.cjs` não participa do catálogo de produção, mas ainda é importado por testes e diagnósticos históricos; excluir agora quebraria essas ferramentas. Compatibilidade de IDs antigos no modelo e no backup também foi preservada.

## 5. Melhorias visuais

- Foto real do The Smiths restaurada no detalhe.
- Resultados homônimos em linhas compactas com imagem de 72 px, nome e contexto; desktop em duas colunas, celular em uma.
- Placeholder de artista informa “foto indisponível”, em vez de “sem capa”.
- Foco do agrupamento usa accent configurável, sem alterar a identidade aprovada das telas.

## 6. Motion/XMB e por quê

Entrada de recomendações passa a usar `--motion-standard` e `--ease-xmb`. Hover/foco utiliza `--motion-focus`; deslocamento discreto comunica seleção sem redesenhar a interface. A expansão nativa dos grupos mantém teclado e hierarquia; não foi adicionada animação complexa a details.

Não foram acrescentadas animações ao networking, aos streams ou a todos os elementos. Movimento reduzido continua desativando animações/transições.

## 7. Responsividade e acessibilidade

Inspeção em 1440 px e 390 px: detalhe do artista e agrupamento de busca. Inspeção móvel adicional: Profile/SPACEAMP, Collection vazia e PARTY lobby. Nenhum overflow horizontal de documento nos sete estados registrados.

Grupo abre com Enter; foco visível acompanha accent personalizado. Texto contextual quebra dentro da linha compacta. O layout principal aprovado não foi redesenhado.

## 8. Performance

- Contagem de homônimos feita uma vez por conjunto de resultados, em vez de varrer os resultados a cada card.
- Menos serialização/escritas síncronas durante scroll.
- Eventos frequentes de progresso evitam leituras de geometria do dock.
- Matching adicional de foto ocorre somente diante de ambiguidade com evidência disponível, com cache e timeout; ausência de foto continua opcional.

Não foram medidos ganhos de FPS, memória ou CPU; são reduções de trabalho comprovadas pela leitura do fluxo, não benchmarks.

## 9. Problemas não alterados por risco/tamanho

- `extras.js`, `app.js`, `title-pages.js` e `spacevoice.js` ainda concentram responsabilidades. A extração deve continuar por fluxos específicos, sem mover persistência e mídia simultaneamente.
- Há testes/diagnósticos de arquiteturas musicais antigas. O smoke diretamente afetado foi atualizado; o inventário inteiro não foi migrado.
- Metadata de recomendações ainda é transportada como propriedades de arrays. Alterar esse contrato exige atualizar consumidores em conjunto.
- Chamadas externas continuam sujeitas a timeout, cobertura incompleta e homônimos sem evidência suficiente. Nesse caso a foto fica indisponível; não se inventa correspondência.
- Observers do dock são de duração da aplicação. Não foram classificados como leak nem substituídos sem evidência.
- Segurança, recuperação de desastres e comportamento de chamadas reais não foram certificados por este pass.

## 10. Testes executados

- Testes unitários focados: catálogo, matching de foto, busca, lotes, recuperação de foto sem nova resolução e integrações do player.
- Smokes de fotos Deezer, navegação/posição de leitura e descoberta personalizada.
- Consulta real Apple + Deezer para The Smiths, além de biografia Last.fm na inspeção.
- Busca real recuperou fotos de Morrissey, Joy Division, New Order, Echo & The Bunnymen, The Stone Roses, The Psychedelic Furs e The Sound. Artefatos em `artifacts/health-pass/artist-search-photos*.json`. Uma foto de Joy Division falhou transitoriamente num lote de recomendações e foi recuperada em consulta seguinte: enriquecimento não garante disponibilidade externa.
- `health-pass-visual.cjs`: sete estados, teclado no grupo, accent personalizado, reduced motion, um elemento audio por página e nenhum pageerror.
- Inspeção visual realizada e repetida somente após corrigir a densidade móvel. Cada execução usou um browser/context isolado; nenhum contexto paralelo e todos fechados pela tarefa.
- Sintaxe de 84 scripts validada; `git diff --check` sem erros de whitespace.

## 11. Limites da regressão

Não foram executados stress, mesh, TURN relay ou regressão completa WebRTC/screen share. ICE/TURN, peer/session/signaling/media não foram alterados. Não foram encerrados processos ou browsers do usuário. A inspeção PARTY foi do lobby, sem iniciar microfone/chamada.

Não foi feito roundtrip pesado de backup nem teste de reprodução real YouTube nesta tarefa; player foi coberto por testes focados e inspeção da composição.

## 12. Screenshots

- The Smiths — desktop — evidência local ignorada: `../../artifacts/health-pass/artist-desktop.png`
- The Smiths — celular — evidência local ignorada: `../../artifacts/health-pass/artist-mobile.png`
- Busca agrupada — desktop — evidência local ignorada: `../../artifacts/health-pass/search-group-desktop.png`
- Busca agrupada — celular — evidência local ignorada: `../../artifacts/health-pass/search-group-mobile.png`
- Profile e SPACEAMP — celular — evidência local ignorada: `../../artifacts/health-pass/profile-mobile.png`
- Collection — celular — evidência local ignorada: `../../artifacts/health-pass/collection-mobile.png`
- PARTY lobby — celular — evidência local ignorada: `../../artifacts/health-pass/party-mobile.png`

Screenshots completos têm capas de álbuns lazy fora do viewport que podem ainda não ter carregado. A foto principal do artista foi explicitamente aguardada e validada. Relatório automático: `artifacts/health-pass/report.json`.

## Estado do projeto depois do health pass

**Pontos fortes:** identidade visual configurável, player central, ROOM separada da CALL, captura separada de transporte, validações de backup, previews separados da fila e catálogo canônico Apple.

**Débitos restantes:** módulos de composição grandes, scripts globais ordenados, contratos implícitos de descoberta, diagnósticos históricos e cobertura desigual de visualização com dados pessoais reais.

**Próximos passos recomendados:**

1. Atualizar o inventário de testes musicais para distinguir arquitetura atual de diagnósticos históricos.
2. Tornar o resultado de recomendações um objeto explícito com items/status, mantendo todos os consumidores sincronizados.
3. Extrair um fluxo específico de `extras.js`, como backup, preservando validação e compatibilidade.
4. Medir os casos lentos antes de acrescentar mais caches ou concorrência.

O projeto permanece na arquitetura HTML/CSS/JS existente, mais consistente nas áreas corrigidas; este pass não elimina toda a dívida técnica identificada.
