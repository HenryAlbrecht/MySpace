# MySpace — regras para agentes

## Projeto

MySpace é um app pessoal/local-first para perfil, coleção e descoberta de
mídia, com SPACEAMP, XMB e PARTY. A linguagem visual mistura old web/MySpace,
PS3 XMB e UI desktop dos anos 2000.

Stack: HTML/CSS/JS vanilla no browser + Node/CommonJS.
Sem framework, bundler ou build step.
`dist/` é source editável servido diretamente.

Estrutura:
- `dist/`: browser/UI;
- `server/`: serviços/providers;
- `tests/`: validação;
- `docs/`: contratos, arquitetura e mapas.

Working tree é source of truth.
`docs/history/` é histórico, nunca contrato vigente.

## Comece aqui

1. Leia este arquivo inteiro antes de alterar qualquer coisa.
2. Use search/rg em `docs/module-map.md` pelo domínio ou módulo da tarefa.
3. Pesquise símbolo/string antes de abrir arquivos grandes.
4. Leia somente a seção relevante de `docs/contracts.md` se tocar identidade,
   persistência, playback, navigation, async lifecycle, CORE/FULL,
   API pública ou PARTY/voice.
   Música/provider: `docs/music/architecture.md`.
   WebRTC/PARTY: `dist/voice/README.md`.
5. Leia `docs/architecture.md` apenas para mudança estrutural.

Não leia por padrão:
`docs/history/`, `artifacts/`, `dist/vendor/`, fixtures grandes,
testes live/diagnostic ou módulos sem relação com a tarefa.

## Vocabulário

- CORE: dados necessários para first paint.
- FULL: enrichment tardio e monotônico.
- Collection: biblioteca pessoal persistida.
- CollectionActions: owner das mutações da Collection.
- TitlePages: fichas e rotas de títulos.
- SPACEAMP: único owner de playback.
- PARTY: sala/chat/call/screen share.
- ROOM: sala/presença/chat.
- CALL: voz/mídia; sair da CALL não implica sair da ROOM.
- sameItem: mesma entidade.
- sameWork: mesma obra.

## Identidade visual

Preservar old web/MySpace + PS3 XMB e os tokens existentes.

Manter:
- artwork como protagonista;
- bordas e controles com feeling desktop/old-web;
- labels/metadata monospace quando já usados;
- gradientes e composição existentes;
- motion discreto inspirado no XMB;
- cores/tokens globais em `dist/style.css`;
- motion em `dist/motion.css`;
- CSS específico da superfície tocada.

Evitar:
- SaaS/dashboard genérico;
- glass/neon/futurismo AI;
- cards arredondados genéricos;
- redesign flat sem relação com o projeto;
- modernizar algo deliberadamente retrô sem pedido explícito.

## Contratos essenciais

- YouTube Music possui identidade, busca, releases, artistas, artwork,
  discografia e playback identity.
- Last.fm possui editorial/tags/similaridade.
- MusicBrainz/lrc.red são auxiliares.
- Apple permanece somente em compatibilidade legacy; não remover adapters
  sem evidência de que deixaram de ser consumidos.

- Existe um único SPACEAMP.
- Views não criam playback, queue ou storage paralelo.
- CollectionActions centraliza mutações.
- Novas views não persistem estado por conta própria.
- Preferências diretas em views existentes são dívida preservada,
  não precedente para código novo.

- Não criar provider/identidade/cache paralelo ou N+1.
- Enrichment nunca empobrece CORE.
- Patch local > redraw global.
- Album/EP/Single = `kind=album` + `albumType`.

- Navigation, Back, scroll e focus são contratos.
- ROOM e CALL possuem lifecycles distintos.
- Motion usa tokens existentes e respeita reduced-motion.

## Código

Cohesion > file size.

Não criar abstração só para reduzir LOC.
Não introduzir DI/service locator/framework.

Uma operação por linha.
Seguir `.prettierrc.json` e o estilo do arquivo.
Formatar somente código tocado; não reformatar arquivos inteiros sem necessidade.

CSS persistente pertence ao CSS.
JS injeta CSS somente quando tecnicamente necessário
(ex.: Shadow DOM/vendor adapter).

Refactor estrutural não inclui feature, redesign, provider, ranking,
playback, WebRTC ou formato persistido sem pedido explícito.

## Economia de contexto

- Search/rg primeiro; abra apenas faixas relevantes.
- Não abra arquivos vizinhos por precaução.
- Não releia arquivos inalterados já vistos nesta sessão.
- Não leia `tests/INVENTORY.md` inteiro para escolher um teste.
- Teste focado primeiro.
- Baseline amplo somente quando a seção `Validação` justificar.
- Não repita teste/suite verde se o código relevante não mudou.
- Se o teste focado falhar, não rode suites maiores.
- Não execute suites sobrepostas apenas para acumular evidência.
- Prefira output direto para testes focados comuns.
- Use `artifacts/` para logs somente quando a saída for volumosa,
  quando for preciso preservar evidência de falha ou quando a tarefa pedir
  medição/baseline explícita.
- Leia apenas resumo/final/falha de logs volumosos quando forem gerados pela
  tarefa atual.
- Screenshots diagnósticos são temporários por padrão.
- Não produza relatórios extensos salvo quando solicitado.

## Como rodar

Ambiente principal: Windows/PowerShell.

Frontend/API local:
`node server.cjs`
→ `http://localhost:3000`

Fluxo completo com PARTY/signaling:
`iniciar.cmd`

Não instalar tooling novo apenas para executar o projeto.

## Validação

### Proporcionalidade dos testes

Preserve cobertura forte de regressão para contratos críticos, mas prefira
estender suites existentes do domínio em vez de criar novos harnesses.

Mudanças de UI/ergonomia devem usar cobertura automatizada focada + validação
manual. Não crie um novo `.cjs` para cada comportamento visual ou interação
quando uma suite existente puder certificar o contrato relevante.

Screenshots e artifacts de diagnóstico são temporários, salvo quando forem:
- baseline explícita usada por teste/comparação;
- output de release;
- evidência de falha;
- medição histórica solicitada explicitamente.

Não preserve artifacts apenas como prova de que um pass foi executado.

A profundidade da validação deve ser proporcional ao risco:
- identidade, persistência, playback, concorrência, stale async, backup/restore
  e contratos entre superfícies exigem regressão automatizada forte;
- feature comum deve preferir testes focados na suite existente do owner/domínio;
- aparência, ergonomia e feeling de controle devem usar teste focado para
  contratos objetivos + validação manual para experiência subjetiva.

Ao adicionar cobertura, prefira adicionar casos a um harness existente.
Crie um novo harness apenas quando existir um domínio/owner realmente novo ou
quando a suite existente não puder certificar o comportamento sem acoplamento
artificial.

Um teste focado que reproduz diretamente o bug reportado e passa após a correção
é evidência forte. Não duplique a mesma evidência em múltiplos harnesses
sobrepostos sem motivo concreto.

Não repita um teste focado que já passou se o código relevante não mudou.

Escolha primeiro os harnesses do domínio em `tests/README.md`.

Nunca rode wildcard sobre `.cjs`/`.test.cjs`.
Testes `*-live`, `*-diagnostic` e `music-real-*` não fazem parte do aceite;
rede real só quando a tarefa pedir ou para investigar divergência de provider.

### Profundidade de validação

Durante a implementação:
- rode primeiro somente os testes focados do owner/domínio tocado;
- se eles falharem, pare e corrija antes de rodar suites maiores;
- não rode baseline após cada pequena edição.

No fechamento, use a menor validação suficiente:

#### Mudança pequena/localizada

Exemplos:
- bug fix em um único owner;
- ajuste de UI/ergonomia;
- CSS/presentation;
- controller UX coberto por regressão focada existente.

Rode:
1. focused;
2. `syntax` quando código executável foi alterado.

`quick` é opcional nesse nível. Rode-o somente quando a mudança afetar uma
integração real, um contrato compartilhado não coberto pelo focused ou quando o teste focado não oferecer
confiança suficiente.

Se focused + syntax cobrem diretamente a alteração, pare ali.

#### Mudança média / integração

Exemplos:
- mudança real de lifecycle;
- integração entre owners;
- alteração de contrato entre superfícies;
- mudança com risco que não ficou totalmente coberto por focused + quick.

Rode:
1. focused;
2. `quick`;
3. `syntax`;
4. `smoke` somente se houver risco concreto adicional não coberto acima.

#### Mudança estrutural / cross-cutting / merge / release

Exemplos:
- refactor estrutural;
- mudança ampla de ownership;
- contratos críticos atravessando vários domínios;
- preparação de merge/release em que confiança ampla seja necessária.

Rode:
1. focused;
2. `quick`;
3. `smoke`;
4. `syntax`.

`smoke` NÃO é obrigatório apenas porque duas superfícies participam do fluxo.

Se focused + `quick` já cobrem diretamente o contrato alterado, pare ali,
salvo se houver motivo concreto para validação adicional.

Pare na primeira falha.

### Comandos

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick`

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 smoke`

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 syntax`

Refactor estrutural:
rode `quick` antes e depois, salvo se o mesmo revision já tiver baseline
verde confirmado nesta sessão.

Use `smoke` no fechamento somente quando a amplitude/risco real justificar.

Mudanças exclusivamente documentais não exigem baseline completo.

Não adaptar produção correta a fixture stale.

### Logs e artifacts

Não redirecione testes focados comuns para `artifacts/` por padrão.
Use output direto.

Use `artifacts/` para logs somente quando:
- a saída for grande demais para inspeção direta;
- houver necessidade de preservar evidência de falha;
- a tarefa pedir comparação, benchmark ou baseline explícita.

Logs temporários de validação não são entregáveis.
Não mantenha artifacts apenas como prova de que um teste passou.

## Dúvida e limites

Se a mudança tocar navigation, playback, persistência, formato salvo,
identidade canônica, CORE/FULL, PARTY/voice ou API pública sem pedido explícito,
pare e pergunte.

Para detalhes locais que não alteram contrato, siga o padrão existente
e faça a menor mudança coerente.

## Docs e entrega

Mudança arquitetural:
atualize `docs/architecture.md`, `docs/module-map.md` e `docs/contracts.md`.

Marco relevante:
pode ganhar registro datado em `docs/history/`.

Preserve APIs públicas e ordem de scripts quando aplicável.

Resumo final curto:
- o que mudou;
- testes executados;
- falhas/limites relevantes.

Não faça commit/push automaticamente.