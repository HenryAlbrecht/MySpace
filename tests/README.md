# Validação atual

Execute na raiz, com Node 24 neste ambiente. Não use wildcard para executar todos os `.cjs` ou `.test.cjs`: existem diagnósticos externos, fixtures históricas e regressões de mídia. A classificação de cada harness está no [inventário](INVENTORY.md).

## Comandos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 quick
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 smoke
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 syntax
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 visual
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 party
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate.ps1 legacy
```

`default` inclui 32 arquivos unitários atuais, nove smokes (incluindo boot DOM) e sintaxe/auditoria estática. Interrompe no primeiro erro; não ignora falhas. Cada arquivo roda em processo próprio, evitando vazamento de globals entre fixtures, com isolamento interno desabilitado para compatibilidade com a sandbox. Não instala dependências ou tooling.

`party` contém quatro harnesses de servidor/transportes locais, sem captura ou negociação de mídia real. `legacy` valida o adapter Deezer retido; não autoriza Deezer como catálogo de produção. `visual` usa um único browser/context e três capturas de Profile/SPACEAMP, Collection e PARTY, com providers locais simulados.

Focado em um arquivo:

```powershell
node --test --experimental-test-isolation=none tests/music-editorial.test.cjs
node tests/page-smoke.cjs
```

## Contratos e fixtures

- `page-smoke.cjs` lê a ordem de scripts de `dist/index.html`, verifica fachadas, boot e um único áudio. O DOM é simulado; eventos/observers são stubs, sem certificar comportamento visual.
- `voice-ui.test.cjs` entra na ROOM antes da chamada, recebe chat pelo transporte da sala e verifica que sair da CALL mantém a ROOM. `party-room-ui.test.cjs` também cobre chat sem captura.
- `music-editorial.test.cjs` cobre resolução progressiva de seis candidatos, reserva até 24, textos Last.fm e identidade Apple. `artist-search-photos.test.cjs` cobre foto como enriquecimento de artistas Apple.
- `deezer-smoke.cjs` e `deezer-unified-search.test.cjs` cobrem o adapter histórico ainda existente, com mocks. Não chamam rotas de catálogo Deezer removidas.
- `premerge-audit.cjs` verifica paths HTML/CSS, requires relativos e links Markdown. Os módulos internos devem carregar antes dos consumidores.

## Histórico e manual

`page-legacy-manual.cjs` preserva integralmente o antigo harness de interações, com aviso histórico. Não é aceite atual; parte de seus seletores e contratos de navegação exige revisão. Nenhuma cobertura de produção foi removida.

`music-search-review.test.cjs` registra ranking MusicBrainz anterior; `voice-peer`, `voice-mesh`, `voice-ws` e `voice-audio` contêm fixtures históricas de transportes/constraints e não estão certificados como suite atual. O inventário marca explicitamente esses arquivos. Não adaptar produção aos mocks antigos. Revisá-los é um trabalho separado de testes de mídia.

Arquivos `*-live`, `*-diagnostic`, avaliações e `music-real-*` são diagnósticos manuais: podem consultar serviços e requerer `.env`. Não são unitários. Browser harnesses antigos/versionados e os demais smokes fora da lista default são validações adicionais, não certificados neste pass.

Full WebRTC, mesh 3/4 peers, TURN real, screen share, screen audio e stress permanecem manuais; não fazem parte de nenhum comando default. Antes de executar, revise a fixture e os requisitos em [voz](../dist/voice/README.md) e [TURN](../server/coturn/README.md).

## Ambiente e saídas

`node tests/motion-stability-visual.cjs after` é o harness manual de estabilidade:
um browser/context, 390/820/1440 px, áudio local e YouTube simulado. Mede geometria
em frames consecutivos nas transições do SPACEAMP, decode de artwork, fallback
de banner, rail PARTY e reduced-motion. Não captura mídia nem consulta providers.
Gera `artifacts/motion-stability/after/frames.json` e uma screenshot final.
Os argumentos `before`/`audit` registram comparações sem exigir as assertions finais.
Não faz parte do default; usa o mesmo runtime portátil dos harnesses abaixo.

`node tests/front-cohesion-visual.cjs after` é a verificação visual leve de coesão:
um browser/context, fixtures locais, 390/820/1440 px, estados de busca, temas,
aparência, SPACEAMP, PARTY/chat e XMB. Gera sete screenshots em
`artifacts/front-polish/after/`. O layout de compartilhamento é apenas uma fixture
de DOM: não solicita microfone/tela nem negocia peers. Não faz parte do default.
O argumento `before` desativa apenas as assertions específicas do polimento para
comparação com a base, mantendo os checks de boot/layout.

O browser usa o Playwright portátil no perfil do usuário e Edge no caminho declarado em `premerge-visual.cjs`. Em outro ambiente, ajuste esse caminho local. A sandbox pode exigir autorização para iniciar o browser. Servidor e browser são encerrados em `finally`.

`artifacts/` contém somente saídas locais ignoradas. Testes default criam seus dados ou diretórios; não dependem de uma captura antiga. Links históricos de evidências são apresentados como caminhos locais, sem exigir esses arquivos em clones novos. Veja [arquitetura vigente](../docs/architecture.md) e [histórico](../docs/history/README.md).
