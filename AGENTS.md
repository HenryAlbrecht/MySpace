# MySpace — regras para agentes

## Projeto

MySpace é um app pessoal/local-first para perfil, coleção e descoberta de
mídia, com SPACEAMP, XMB e PARTY. A linguagem visual mistura old web/MySpace,
PS3 XMB e UI desktop dos anos 2000.

Stack: HTML/CSS/JS vanilla no browser + Node/CommonJS.
Sem framework, bundler ou build step.
`dist/` é source editável servido diretamente.

Working tree é source of truth.
`docs/history/` é histórico, nunca contrato vigente.

## Comece aqui

1. Leia este arquivo.
2. Use search/rg em `docs/module-map.md` pelo domínio ou módulo da tarefa.
3. Pesquise símbolo/string antes de abrir arquivos grandes.
4. Leia somente a seção relevante de `docs/contracts.md` se tocar identidade,
   persistência, playback, navigation, async lifecycle ou API pública.
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
- tokens de `dist/motion.css` e CSS da superfície tocada.

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
- Não varra history/vendor/fixtures/diagnostics sem necessidade.
- Não leia `tests/INVENTORY.md` inteiro para escolher um teste.
- Teste focado primeiro; baseline completo somente no fim.
- Não repita teste/suite verde se o código relevante não mudou.
- Se o teste focado falhar, não rode suites maiores.
- Logs volumosos vão para `artifacts/`; leia apenas resumo/final/falha
  quando forem gerados pela tarefa atual.
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

Escolha primeiro os harnesses do domínio em `tests/README.md`.

Ordem única após a implementação:

focado → quick → smoke → syntax

Pare na primeira falha.

Comandos do baseline:

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick`

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 smoke`

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 syntax`

Durante a implementação, não rode o baseline após cada pequena edição.

Refactor estrutural:
rode `quick` antes e depois, salvo se o mesmo revision já tiver baseline
verde confirmado nesta sessão.

Mudanças exclusivamente documentais não exigem baseline completo.

Não adaptar produção correta a fixture stale.

## Dúvida e limites

Se a mudança tocar navigation, playback, persistência, formato salvo,
identidade canônica ou API pública sem pedido explícito, pare e pergunte.

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