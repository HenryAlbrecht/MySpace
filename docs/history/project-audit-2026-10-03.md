> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Análise geral do projeto — 3 de outubro de 2026

## Conclusão

O projeto é viável, mas o custo de alteração está aumentando. O principal problema não é JavaScript puro: são responsabilidades misturadas, contratos implícitos, identidade/enriquecimento confundidos na apresentação e consultas externas acumuladas antes de mostrar resultados. Algumas correções recentes minhas aumentaram esse custo e a latência das recomendações.

Recomendo uma entrega coordenada de estabilização, com limites claros e critérios de aceitação. Não recomendo reescrever toda a aplicação nem migrar WebRTC, player e armazenamento simultaneamente. Nenhum arquivo de implementação foi alterado nesta auditoria; foram criados apenas diagnóstico e relatório.

## Evidências reproduzidas

Consultas reais, Apple/iTunes como catálogo, Deezer somente para foto e Last.fm para recomendações:

| Caso | Resultado | Tempo observado |
|---|---|---:|
| Artista `frost` | 12 IDs Apple distintos; Frost*, FROST, Frost e Fröst; 11 cards usam a mesma URL de foto | 845 ms |
| Artista `frost chil` | Nenhum resultado | 53 ms |
| Artista `frost child` | Frost Children e i h8 frost children | 314 ms |
| Música `wonderwal` | 12 resultados; primeiro Fypm, sem a tolerância esperada para Wonderwall | 777 ms |
| Música `wonderwall` | Wonderwall/Oasis em primeiro | 545 ms |
| Recomendações `WHAT IS FOREVER FOR` / Frost Children | 19 itens Apple de 24 candidatos, 5 sem correspondência, nenhuma consulta falhou | 24.744 ms |

Isso confirma que a demora pode ocorrer mesmo sem erro externo. Esses tempos são amostras de uma execução, não benchmark nem garantia de disponibilidade futura. Fonte completa: `artifacts/project-audit/diagnostic.json`.

## Achados prioritários

### P1 — Artistas homônimos parecem duplicatas porque a foto não está vinculada à identidade Apple

`server/music.cjs` deduplica artistas por ID Apple. Logo, os cards do exemplo não são necessariamente cópias do mesmo registro. `server/artist-artwork.cjs`, porém, resolve e armazena fotos por nome, prefere o resultado Deezer com mais fãs e permite comparação sem acentos. Não recebe evidência da discografia Apple para distinguir homônimos. Assim, vários artistas Apple distintos recebem a mesma foto; a interface mostra apenas nome e “Artista · iTunes”, sem contexto que permita diferenciá-los.

**Correção proposta:** preservar IDs; apresentar agrupamento de resultados homônimos com opção de inspecionar os registros, sem fundir entidades ou apagar itens da coleção. Usar metadados já disponíveis para contexto. Quando o enriquecimento visual for ambíguo, mostrar fallback honesto em vez de atribuir a mesma foto como se estivesse confirmada. Obter informações extras apenas quando o usuário abrir um grupo/artista, não consultar a discografia de todos os cards automaticamente.

**Aceitação:** Frost* e Frost Children continuam distintos; FROST/Frost não inundam a primeira tela de cards indistinguíveis; seleção mantém o ID correto; foto ambígua não serve como prova de identidade.

### P1 — Busca não oferece tolerância própria e o ranking é superficial

O termo é enviado quase literalmente à Apple. A normalização local é usada para ordenar/deduplicar resultados já recebidos; ela não recupera resultados que o provedor não trouxe. O ranking tem quatro níveis básicos: título exato, artista exato, prefixo e restante. Em músicas, a expansão de um artista homônimo pode ocupar espaços com faixas que não correspondem ao título procurado. A consulta `wonderwall` desta execução também trouxe músicas de artistas chamados Wonderwall junto com a faixa conhecida.

**Correção proposta:** contrato único de busca usado pelo modal e pela página Buscar; ranking por tokens, prefixos e intenção título/artista; aproveitar resultados conhecidos da sessão para sugestões aproximadas. Fallback Apple adicional somente para resposta vazia ou candidatos claramente fracos, limitado e cancelável. Mostrar “você quis dizer” quando houver evidência, em vez de corrigir silenciosamente ou inventar artista. Não prometer fuzzy search universal que a API externa não oferece.

**Aceitação:** testar frost, frost chil, frost child, Wonderwal/Wonderwall, bôa/BoA e títulos com pontuação, no modal e em Buscar. Medir qualidade dos primeiros resultados, não apenas status 200 e quantidade de cards.

### P1 — Recomendações bloqueiam a interface até completar trabalho excessivo

`server/music.cjs` serializa consultas de recomendação com intervalo mínimo de 750 ms. Cada música pode exigir duas buscas. `server/music-catalog.cjs` resolve inicialmente 24 candidatos antes de responder. A página pode pedir mais quatro lotes de seis para completar 12 cards. No limite de 48 músicas e duas consultas por música, apenas o espaçamento pode custar aproximadamente 71 segundos, antes de outros custos. Os lookups de álbuns por artista reduzem esse volume, mas não resolvem o caso geral.

`Catalog.forCollection` também consulta até seis sementes sequencialmente. O progresso contabiliza sementes terminadas; os cards chegam depois do conjunto. O aumento recente da reserva não foi acompanhado de uma arquitetura de entrega progressiva.

**Correção proposta:** manter a ordem de relevância do Last.fm, mas separar obtenção de candidatos de resolução Apple. Resolver um primeiro lote pequeno e entregar seus cards; completar o grid progressivamente conforme necessário. Continuar aproveitando lookup/cache por artista. Definir orçamento de consultas e tempo por tela, recuperar apenas falhas e reduzir trabalho quando a página deixa de estar ativa. Não simplesmente remover o controle de ritmo ou aumentar concorrência indiscriminadamente.

**Aceitação:** uma recomendação lenta não impede mostrar as já resolvidas; até 12 cards, edições preservadas, sem repetir sucessos no retry; métricas distinguem primeiro card, conclusão e falha externa. Meta inicial sugerida: primeiro conteúdo em poucos segundos quando os provedores respondem; não é garantia de rede.

### P1 — Cancelamento e estados de busca são inconsistentes entre telas

`dist/editor-ui.js` tem timeout de 12 segundos; `dist/title-pages.js`, 20 segundos. Ambos têm controle de geração na busca. Recomendações em `dist/catalog-discovery.js` não recebem AbortSignal nem deadline equivalente. O carregamento de recomendações da página de título não verifica se a seção ainda está ativa antes de solicitar a reserva seguinte. Resultado: navegar para outro título pode deixar consultas antigas consumindo a fila.

**Correção proposta:** uma política de carregamento/cancelamento compartilhada para catálogo, com resultado explícito (`ready`, `empty`, `partial`, `unavailable`, `cancelled`), preservação de resultados úteis e descarte de respostas obsoletas. Cancelar consumo de uma tela não deve destruir uma consulta compartilhada que outra tela ainda utiliza.

### P2 — Contratos de dados implícitos dificultam evolução

Recomendações são arrays com propriedades extras não enumeráveis (`resolution`, `seedTitle`, `reserveAvailable`). Operações comuns como spread/slice/serialização podem perder esses campos. Cache frontend, estado de recuperação do servidor e cache do provedor têm regras distintas e espalhadas. `MusicModel.sameItem` e `sameWork` têm propósitos diferentes, mas a distinção depende de disciplina de cada chamada.

**Correção proposta:** tipos/contratos explícitos para entidade Apple, enriquecimento, sugestão Last.fm, resultado de busca e resultado de recomendação. Retornar objetos com `items` e metadata, não propriedades ocultas em arrays. Nomear separadamente identidade de catálogo, comparação editorial e identidade da fila; manter edições distintas.

### P2 — Frontend depende de ordem de scripts e estado global

`dist/index.html` carrega dezenas de scripts clássicos em ordem fixa. `extras.js` (~71 KB), `title-pages.js` (~50 KB), `spacevoice.js` (~50 KB) e `collection-view.js` (~26 KB) concentram muita coordenação. Tamanho sozinho não prova defeito, mas a leitura confirma mistura de editor, backup, renderização, persistência e chamadas entre objetos globais. A função de abertura do editor chega a ser substituída por outro script. Isso torna regressões e dependências de inicialização menos visíveis.

**Correção proposta:** módulos com imports explícitos e composição central; separar armazenamento/ações da coleção de telas/editores/backup; separar consultas do catálogo de renderizadores de música, artista e álbum. Preservar o controlador SPACEAMP e módulos de mídia existentes. Não desmontar/recriar iframe ou streams por uma mudança de interface.

### P2 — Renderização e CSS merecem organização, sem redesenho

Sete folhas CSS são carregadas em ordem. `interface.css` sobrescreve apresentações de outras áreas; `spaceamp.css` contém regras globais de busca e foco da coleção. Parte da coordenação do player lê dimensões do DOM e escreve estilos durante atualizações; várias telas reconstroem grandes trechos via `replaceChildren`.

Não foi medido um problema global de FPS ou memória nesta auditoria, portanto isso é risco de manutenção/desempenho, não diagnóstico de vazamento confirmado.

**Correção proposta:** conservar tokens de accent, opacidade e motion XMB; separar base/tokens dos estilos de cada feature. Reutilizar renderizadores pequenos e atualizações por identidade, medir antes de otimizar. Manter reduced motion, foco e responsividade como critérios de aceite.

### P2 — Persistência está melhor isolada para binários, mas estado textual continua amplo

IndexedDB guarda mídias; os dados principais ficam em um grande documento localStorage. `save` serializa dados e calcula diferenças de histórico. Essa estrutura é funcional em coleções pequenas, mas aumenta trabalho síncrono e obriga múltiplas features a compartilhar o mesmo estado. URLs de mídia recebem limpeza em vários caminhos; não foi identificado vazamento geral nesta leitura. Backup já possui cuidados que devem ser preservados.

**Correção proposta:** repositório único de armazenamento, operações explícitas e validação/versionamento de esquema. Primeiro organizar as ações existentes; só migrar todos os dados para IndexedDB se medições ou requisitos justificarem. Qualquer migração precisa preservar backups, IDs, capas customizadas, ordem da fila e arquivos locais.

### P2 — Documentação e testes misturam gerações de arquitetura

Há 116 arquivos em tests, incluindo testes antigos dos catálogos Deezer/Last.fm e vários diagnósticos reais criados durante os ajustes. README ainda descreve restrições de playlist/backup e estados PARTY antigos que não refletem integralmente a implementação atual. `server/deezer.cjs` e operações antigas de catálogo Last.fm permanecem, embora o catálogo canônico não as use.

**Correção proposta:** separar suíte atual determinística, smoke de browser e diagnósticos de rede optativos; um comando curto por camada e documentação atual de responsabilidades. Remover/arquivar código legado apenas após verificar compatibilidade dos itens antigos e backups. Testes devem verificar qualidade da busca, identidade visual ambígua, primeiro resultado e latência controlada, não só a forma das respostas.

## O que merece ser preservado

- Apple como única identidade de novos itens; Last.fm como descoberta/textos; Deezer como enriquecimento visual opcional.
- Controlador SPACEAMP único, integração por eventos e separação preview/fila.
- Modelos de coleção, binários em IndexedDB, pacote de backup e validações de dados existentes.
- Módulos de voz já separados (peer, session, signaling, devices, room e chat). A camada de UI PARTY é grande, mas isso não justifica alterar ICE/TURN ou perfect negotiation nesta entrega.
- Servidor frontend com verificações de host/origin e acesso limitado a arquivos estáticos; signaling com capacidades/validação. Isso não substitui uma auditoria de segurança/deployment público.
- Launcher portátil, system CA e início sem npm global. A stack de desenvolvimento não deve passar a ser requisito para executar a versão pronta.
- Estética XMB/Y2K, wallpaper, opacidade, accent e reduced motion.

## Stack recomendada

Minha recomendação é **TypeScript + módulos ES, com Vite como ferramenta de desenvolvimento/build**, migrados gradualmente. Backend Node pode permanecer. Não é necessário adotar React para obter contratos, imports explícitos e organização.

| Opção | Benefício | Custo/limite neste projeto |
|---|---|---|
| JS organizado + JSDoc/checkJs | Tipagem gradual sem converter tudo | Mantém parte do custo de coordenação imperativa |
| TypeScript + Vite + DOM atual | Imports, contratos, tooling e build; CSS existente pode ser preservado | Requer etapa de build para desenvolver, não npm global para executar o resultado pronto |
| React + TypeScript + Vite | Componentes e estado declarativo podem ajudar a UI futura | Migração maior; exige cuidado especial com player/iframe/streams e motion |

TypeScript permite começar em JS por JSDoc e `@ts-check`: [documentação oficial](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html). Vite fornece ferramentas de desenvolvimento com módulos e geração de assets estáticos: [guia oficial](https://vite.dev/guide/).

React é uma opção futura para fronteiras de UI bem isoladas, não a correção inicial dos problemas observados. Não recomendo Next/SSR/banco remoto só para resolver catálogo local e reprodução. Não foi instalada dependência nem iniciada migração.

## Proposta de uma entrega coordenada

1. Registrar a base atual e consolidar testes dos fluxos aprovados; definir contratos e critérios antes das alterações.
2. Unificar busca das duas telas, melhorar ranking/aproximação limitada e resolver apresentação/fotos de homônimos sem fundir IDs.
3. Substituir o carregamento bloqueante de recomendações por lotes progressivos, com orçamento, cancelamento e recuperação incremental. Preservar edições e fonte Last.fm.
4. Organizar os módulos tocados e atualizar testes/documentação. Começar tipos pela área musical; migração completa de frontend em etapa separada, se útil depois das medições.

Uma única entrega pode conter esses blocos, mas implementá-los como uma reescrita indivisível tornaria a revisão e o rollback piores. Critérios finais: buscas nas três categorias e duas telas; homônimos distinguíveis; 6 × 2 quando há conteúdo suficiente; primeiro conteúdo progressivo; dados/backup preservados; player/compacto/XMB intactos; sem alterações WebRTC/ICE/TURN/chat lifecycle.

## Validação e limites desta auditoria

- 68 arquivos JS/CJS de dist e server analisados sintaticamente: nenhuma falha de sintaxe. Isso não prova ausência de falhas de lifecycle.
- 19 testes leves de coleção, SPACEAMP/Media Session e contratos de busca/recuperação passaram.
- Casos reais Frost/prefixo/typo e uma recomendação, com tempos e HTTP registrados, sem alterar coleção pessoal.
- Leitura estrutural de frontend, armazenamento, backup, launcher, servidor, módulos de voz, CSS e testes.
- Não foi rodada a regressão completa, nem teste entre dois PCs, qualidade auditiva humana, profiling completo de memória/FPS ou auditoria de segurança pública. Não há confirmação de problema geral de WebRTC.

Os três sintomas musicais têm causas reproduzidas; vários pontos gerais são riscos arquiteturais confirmados pela estrutura, não bugs reproduzidos. O relatório mantém essa distinção para evitar outra rodada de mudanças cegas.
