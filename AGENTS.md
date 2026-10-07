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

1. Siga este arquivo como contrato operacional do repositório.
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
- Não produza relatórios extensos salvo quando solicitado.
- Regras de testes, logs e artifacts: seção `Validação`.

## Como rodar

Ambiente principal: Windows/PowerShell.

Frontend/API local:

`node server.cjs`

→ `http://localhost:3000`

Fluxo completo com PARTY/signaling:

`iniciar.cmd`

Não instalar tooling novo apenas para executar o projeto.

## Validação

Escolha primeiro o harness do domínio em `tests/README.md`.

Nunca rode wildcard sobre `.cjs`/`.test.cjs`.
`*-live`, `*-diagnostic` e `music-real-*` ficam fora do aceite;
rede real somente quando a tarefa pedir.

Durante a implementação:
- rode somente o teste focado do comportamento alterado;
- se falhar, corrija antes de executar suites maiores;
- não repita teste/suite verde se o código relevante não mudou.

No fechamento, use a menor validação suficiente e pare na primeira falha.

| Mudança | Validação |
|---|---|
| Pequena: bugfix em um owner, UI, CSS, ergonomia | focused + `syntax` quando aplicável |
| Média: lifecycle, integração entre owners, contrato compartilhado | focused + quick do domínio, quando existir + `syntax` |
| Estrutural de produção / merge / release | focused + `quick` + `smoke` + `syntax` |

Para mudança média de um domínio, use `quick-music`, `quick-spaceamp` ou
`quick-party-ui` quando apropriado. Use `quick` global quando não houver grupo
apropriado, a mudança for cross-domain, merge/release ou houver risco concreto
atravessando domínios. Mudança estrutural ampla conserva os critérios existentes.

`quick` em mudança pequena e `smoke` em mudança média somente quando houver
risco concreto não coberto pela validação anterior.

`smoke` não é obrigatório apenas porque duas superfícies participam do fluxo.

Refactor estrutural de produção:
rode `quick` antes e depois, salvo se o mesmo revision já tiver baseline verde
confirmado nesta sessão.

Refactor exclusivamente da infraestrutura de testes:
- siga as regras de modularidade em `tests/README.md`;
- registre baseline somente dos harnesses afetados;
- valide os cenários extraídos isoladamente;
- valide o runner completo afetado no fechamento;
- use `node --check` nos executáveis de teste tocados;
- não rode `quick`/`smoke` globais apenas por ser um refactor estrutural.

Mudanças exclusivamente documentais não exigem baseline.

Comandos globais:

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick`

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 smoke`

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 syntax`

Logs usam saída direta por padrão.

Para harnesses browser ou suites de saída volumosa, limite o contexto exibido
sem mascarar o exit code nem ocultar o diagnóstico relevante da falha.

Use `artifacts/` somente para:
- saída volumosa que precise ser inspecionada;
- evidência de falha;
- benchmark/baseline solicitado;
- output de release.

Screenshots e logs diagnósticos são temporários por padrão.

Ao escrever ou refatorar testes, siga `tests/README.md`.

Não adaptar produção correta a fixture stale.

## Dúvida e limites

Se o pedido exigir ALTERAR um contrato existente de navigation, playback,
persistência, formato salvo, identidade canônica, CORE/FULL, PARTY/voice
ou API pública sem que essa mudança de contrato tenha sido solicitada,
pare e pergunte.

Não pare apenas porque um bugfix toca código desses domínios.
Se o comportamento esperado já estiver definido pelo contrato vigente,
corrija-o seguindo o padrão existente.

Para detalhes locais que não alteram contrato, faça a menor mudança coerente.

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