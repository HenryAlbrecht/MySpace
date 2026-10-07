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

`default` seleciona 37 arquivos unitários determinísticos, nove smokes locais (incluindo boot DOM) e sintaxe/auditoria estática. O baseline V2.2 alinha as fixtures aos [contratos vigentes](../docs/contracts.md); resultados e antes/depois estão no [adendo V2.2](../docs/history/organization-pass-2026-10-06.md#acceptance-baseline-v22). Interrompe no primeiro erro; não ignora falhas. Cada arquivo roda em processo próprio, evitando vazamento de globals entre fixtures, com isolamento interno desabilitado para compatibilidade com a sandbox. Não instala dependências ou tooling.

`party` contém quatro harnesses de servidor/transportes locais, sem captura ou negociação de mídia real. `legacy` valida o adapter Deezer retido; não autoriza Deezer como catálogo de produção. `visual` usa um único browser/context e três capturas de Profile/SPACEAMP, Collection e PARTY, com providers locais simulados.

Focado em um arquivo:

```powershell
node --test --experimental-test-isolation=none tests/music-editorial.test.cjs
node tests/page-smoke.cjs
```

## Contratos e fixtures

`node tests/music-search-pagination-browser.cjs` usa client YouTube/Catalog/HTTP reais com respostas guest locais e imagens locais: uma request inicial/+uma por continuation, append/dedupe/contador/fim, retry, stale busca/rota, foco/scroll/card/imagem retidos, homônimos entre páginas, ciclos, 10 páginas/400 itens e picker first-page. Rede externa bloqueada. `youtube-music-catalog.test.cjs` cobre parser/page/cache/pending/token e legacy; `catalog.test.cjs` cobre cache compartilhado search Array/searchPage; `music-flow-http-smoke.cjs` cobre cursor/end/400 e caching HTTP preservado. Fixture mínima em `fixtures/youtube-music-search-continuation.json`, baseada na estrutura de shelf/continuation; diagnóstico real não recertificou configuração guest.

- `page-smoke.cjs` lê a ordem de scripts de `dist/index.html`, verifica fachadas, boot e um único áudio. O DOM é simulado; eventos/observers são stubs, sem certificar comportamento visual.
- `voice-ui.test.cjs` entra na ROOM antes da chamada, recebe chat pelo transporte da sala e verifica que sair da CALL mantém a ROOM. `party-room-ui.test.cjs` também cobre chat sem captura.
- `youtube-music-catalog.test.cjs` e `youtube-music.test.cjs` certificam catálogo vigente: search, identidade/source, relações artista/álbum, detalhes, Collection e ausência de fallback Apple implícito. `music-playback-resolver.test.cjs` cobre matched/choose, fallback e indisponibilidade.
- `music-editorial.test.cjs` cobre resolução canônica YouTube de sinais Last.fm, reserva progressiva e detalhes Apple legacy. `music-legacy-apple.test.cjs` substitui o nome anterior apple-canonical: acesso explícito `provider=itunes`, detalhes/normalização e Collection legacy. `apple-discography` e `artist-search-photos` mantêm contratos de adapters legacy suportados no quick; não exigem Apple como catálogo principal.
- `music-search-quality/reserve/unified-search` e `music-recommendation-recovery/resolution` misturam contratos atuais de resolução com unidades de adapters Apple explicitamente descritas como legacy. Apple/Deezer IDs em matching/backup são compatibilidade, não preferência de provider.
- `music-flow-http-smoke.cjs` usa servidor HTTP real em loopback, sem providers reais: search dos três kinds, details CORE/full, identifiers, editorial, rádio/playback, erros/status e rota de leitura Apple legacy explícita.
- `deezer-smoke.cjs` e `deezer-unified-search.test.cjs` cobrem o adapter histórico ainda existente, com mocks. Não chamam rotas de catálogo Deezer removidas.
- `premerge-audit.cjs` verifica paths HTML/CSS, requires relativos e links Markdown. Os módulos internos devem carregar antes dos consumidores.
- `organization.test.cjs` verifica ordem/duplicação de scripts, fachadas, SPACEAMP único, ausência de player/storage nas views extraídas, caminhos canônicos e transação/rollback de backup. Sua fixture source lookup agora considera a limpeza do status transient stale já presente no código.

## Histórico e manual

`page-legacy-manual.cjs` preserva integralmente o antigo harness de interações, com aviso histórico. Não é aceite atual; parte de seus seletores e contratos de navegação exige revisão. Nenhuma cobertura de produção foi removida.

`music-search-review.test.cjs` registra ranking MusicBrainz anterior; `voice-peer`, `voice-mesh`, `voice-ws` e `voice-audio` contêm fixtures históricas de transportes/constraints e não estão certificados como suite atual. O inventário marca explicitamente esses arquivos. Não adaptar produção aos mocks antigos. Revisá-los é um trabalho separado de testes de mídia.

Arquivos `*-live`, `*-diagnostic`, avaliações e `music-real-*` são diagnósticos manuais: podem consultar serviços e requerer `.env`. Não são unitários. Browser harnesses antigos/versionados e os demais smokes fora da lista default são validações adicionais, não certificados neste pass.

Full WebRTC, mesh 3/4 peers, TURN real, screen share, screen audio e stress permanecem manuais; não fazem parte de nenhum comando default. Antes de executar, revise a fixture e os requisitos em [voz](../dist/voice/README.md) e [TURN](../server/coturn/README.md).

## Ambiente e saídas

`node tests/route-visibility-visual.cjs after` verifica uma superfície principal
por frame nas transições e em respostas tardias de Search/Discover. Usa um
browser/context local; grava `artifacts/route-visibility/after/frames.json`.
`before` registra a reprodução sem assertions de atomicidade. É manual.

`node tests/scroll-continuity-visual.cjs after` mede scrollY em frames consecutivos
nas categorias Collection, header, categoria vazia, retorno de ficha e reduced
motion. Um browser/context com fixtures locais; saída em
`artifacts/scroll-continuity/after/frames.json`. `before` registra a reprodução
sem exigir as assertions finais. Usa o runtime portátil abaixo; é manual.

`node tests/motion-design-visual.cjs` verifica o motion de apresentação com um
browser/context: direção de navegação, ficha sem reentrada no enriquecimento,
categorias Collection sem animação do root e com indicador compartilhado,
FLIP de avatars PARTY, dialogs e reduced-motion. Gera sequência de frames
0/80/200 ms e screenshots em `artifacts/motion-design/`. Usa fixtures locais,
sem providers ou captura, com o runtime portátil descrito abaixo. É manual.

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

`node tests/visual-state-continuity.cjs` valida PARTY pending/ready e falha/retry,
limites do XMB, retorno de categoria vazia e navegação rápida com decode atrasado. Usa um browser/context,
transporte local e fixtures, sem captura, peers ou providers reais. Gera
`artifacts/visual-state/report.json` e duas screenshots. `artwork.test.cjs`
verifica reserva, revision e cancelamento de decode sem navegador.

`node tests/navigation-camera-visual.cjs` verifica cabeçalhos, entry/return,
Back/Forward e teclado da Collection em um browser/context local. Usa posições
antigas salvas e fixtures, sem providers/captura, e gera
`artifacts/navigation-camera/after/report.json`.
`node tests/navigation-native-probe.cjs auto` (ou `manual`) isola chamadas do
app para comparar a restauração nativa. A política também é testada pelo smoke
Navigation, incluindo abertura de ficha no topo e reduced motion.

`node tests/collection-title-return-visual.cjs` cobre a exceção de retorno da
ficha à Collection de origem: scroll anterior, foco em Capas/Lista e seleção
da Lista. Verifica Back, botão voltar e isolamento de entradas pelo cabeçalho
e pela Busca, em um browser/context com fixtures locais. Gera
`artifacts/collection-title-return/after/report.json`.

`node tests/spaceamp-now-playing-browser.cjs` valida o modal Now Playing em um
browser/context: controles e ms, pausa, seek, troca de lyrics/artwork, idle,
focus/scroll, XMB com reprodução e retorno, analyser local, fallback YouTube,
responsivo e reduced motion. Usa fixtures de playback e TTML local com o
módulo oficial am-lyrics 1.7.4 vendorizado. Não consulta
providers reais de letras ou playback. Evidências em `artifacts/spaceamp-now-playing/`.

No baseline V2.2, Now Playing verifica foco no opener real do XMB, nós/seleção/scroll preservados (clock/metadata podem mudar) e o perfil lyrics vigente sem `line-motion`. `spaceamp-lyrics-clock-browser` e `spaceamp-lyrics-motion-browser` certificam seek, interpolação, pause freeze, autoscroll upstream e ausência de drift; `xmb-handoff-browser` cobre entrada/retorno de apresentação, singleton e reduced motion.

V2.3 mantém o mesmo aceite (37 arquivos/186 testes quick). O perfil visual foi isolado em `spaceamp-lyrics-profile.js`; organization verifica ordem de carregamento e ausência de playback/storage nesse owner. Lyrics-motion passou antes/depois da extração; clock, Now Playing e XMB continuam validando a integração completa.

`node tests/artist-discography-browser.cjs` usa servidor/Catalog/client reais com respostas guest locais derivadas do diagnóstico de seções: CORE 3 → FULL 7, mesmos nós/cards, foco/scroll/filtro/ordenação e nenhum browse de release durante enrichment. Interações de intenção continuam com prefetch existente. Fixture em `fixtures/youtube-music-artist-sections.json`; evidência em `artifacts/artist-sections/`. `youtube-music-catalog.test.cjs` cobre handles, params/continuations, dedupe por ID, Singles/EPs, cache/pending/force, limites, falhas e preservação do CORE, sem rede externa.

`node tests/artist-discography-window-browser.cjs` certifica apresentação progressiva com CORE 20/FULL 65: 18 cards desktop, 8 mobile, imagens somente para cards criados, expansão local sem requests, filtro sobre todos os dados, sort sem reset, foco/scroll, preview previamente expandido, partial/unknown e paginação legacy separada. Usa respostas HTTP locais e gera `artifacts/artist-window/after.json`; `--measure` apenas registra a apresentação atual (referência anterior preservada em `before.json`). Tempos são diagnósticos, sem threshold instável.

Working set: UI de artista tem owner `dist/title-artist-view.js` (focados `artist-discography-window-browser.cjs` e `artist-discography-browser.cjs`); TitlePages só participa de CORE/FULL/rota. Profile extras têm owner `dist/profile-extras-view.js`: `node tests/profile-extras-browser.cjs` cobre edição/reordenação de top 8, badges, blocos, vídeo local, visibilidade/ordem e reload. `boot-performance-browser.cjs` cobre Gallery oculta/dirty/reentrada, Collection e PARTY; sua instrumentação acompanha o owner extraído. `organization.test.cjs` certifica ordem e limites de ownership dos dois módulos.

Closure: `node tests/music-final-recommendations-browser.cjs` certifica recomendações atuais da ficha (“ver outras recomendações”): rotação local/reserva, tipos, retenção, fonte esgotada e force. `node tests/music-recommendation-browser.cjs` foi atualizado para manter somente seu contrato distinto de descoberta da Collection: equilíbrio de seis mídias, ordem partial/final, descarte/restauração, filtro e preservação das sugestões em falha. O refresh/reorder antigo da ficha foi removido; trocar o label não preservaria esse contrato obsoleto. Ambos são focados locais, com rede externa do browser bloqueada; não são live/diagnostic nem entram automaticamente no quick/smoke.

`node tests/boot-performance-browser.cjs after` mede cold routes perfil/colecao/buscar/spacevoice e `?party`, usando 100 livros/24 fotos locais, instrumentação de renders/factories e recursos. Certifica ausência de render oculto, render único da Collection, mutações dirty, criação/reuso de PARTY e browser reload 304. Relatórios em `artifacts/performance/`; timings/long tasks são diagnósticos sem thresholds. `before` apenas registra a implementação corrente; a referência anterior foi preservada. `organization.test.cjs` certifica ETag/HEAD, arquivo alterado e APIs sem cache condicional.

Controller lyrics: `node tests/xmb-input.test.cjs`, `node tests/spaceamp-now-playing.test.cjs`, `node tests/xmb-handoff-browser.cjs`, `node tests/spaceamp-now-playing-browser.cjs`, `node tests/spaceamp-lyrics-clock-browser.cjs` e `node tests/spaceamp-lyrics-motion-browser.cjs`. Handoff usa linhas determinísticas no Shadow DOM para seleção ativa, navegação sem seek, line-click, retorno player/XMB, troca de componente, loading, unsynced e auto-next fechado. Now Playing também verifica seleção/ativação no vendor oficial. Rede externa abortada; nenhum harness novo.

Topologia do controller: `xmb-handoff-browser.cjs` verifica transport/ranges antes da borda, ausência de wrap, quick bar fora da malha principal (preservada para mouse/teclado), lyrics desligadas, ajuste de Volume e fallback de foco hidden/disabled/inert. `spaceamp-now-playing-browser.cjs` acessa as linhas do vendor pela borda de transport.

System Quick Menu: os harnesses existentes `xmb-handoff-browser.cjs` e `spaceamp-now-playing-browser.cjs` cobrem Options/B, origem XMB/player/lyrics, commands/preferences reais, abertura sem restart, vídeo/top layer/singleton, atualização durante track change, cursor explícito vs native focus fora do XMB e cleanup. `xmb-input.test.cjs` certifica LB/RB edge-trigger e repeat direcional preservado. Browser usa Gamepad API simulada, espera a amostragem e release real por frame, sem providers externos. Capturas em `artifacts/xmb-quick-menu/`.

Console UX pass 2: o mesmo handoff verifica rail Música/Sistema, fullscreen/saída com ordem de owners, Triangle/Square contextual, retorno player/lyrics após Volume e troca de componente, opções nativas e dialog continuamente aberto durante trackchange. O sampler certifica face buttons edge-trigger; o componente oficial e clock/motion preservam o aceite anterior. Controle físico/TV continua sendo verificação manual.
