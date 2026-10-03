> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Legibilidade e modularização seletiva

03/10/2026. Pass de apresentação do código, sem mudança intencional de comportamento, stack, UI, persistência, providers, ranking, cache ou reprodução. O repositório estava limpo no início. CommonJS e extensões `.cjs` foram preservados.

## Arquivos limpos

| Arquivo | Trabalho |
| --- | --- |
| `server/deezer.cjs` | Requests, validação, buscas, ranking e enriquecimento em etapas multilinha; normalização extraída |
| `server/music.cjs` | Requests, pacing, resolução e ranking Apple legíveis; normalização extraída |
| `server/music-catalog.cjs` | Fluxo de enriquecimento/reserva/falhas expandido; comparação de nomes com helper |
| `server/artist-artwork.cjs` | Cache, requests, evidências e matching visual expandidos |
| `server/lastfm.cjs` | Validação, requests, descrições e recomendações multilinha |
| `dist/audio-tags.js` | Parte FLAC dividida por formato; parte ID3 já legível preservada |
| `dist/spaceamp.js` | Estado, controles e snapshots legíveis; origem da faixa em helper |
| `dist/spaceamp-integrations.js` | Callbacks YouTube e Media Session expandidos |
| `dist/music-bridge.js` | Dialog, fonte de reprodução e view do dock deixam de ser linhas gigantes |
| `dist/voice/chat.js` | Mensagens, typing, unread e timers legíveis |
| `dist/voice/room-metadata.js` | Metadata/recents/validação expandidos |
| `dist/discovery-page.js` | Atualização dos cards, foco e lifecycle multilinha |
| `dist/catalog-discovery.js` | Cache, consultas compartilhadas e descoberta por coleção multilinha |
| `dist/spacevoice.js` | Somente intervalos com statements excessivamente compactados |
| `dist/title-pages.js` | Somente intervalos compactados de detalhes, recomendações e navegação |
| `dist/collection-view.js` | Somente intervalos compactados de apresentação, filtros e ações |

Nos três últimos arquivos, foram formatados respectivamente 20, 38 e 24 intervalos, em vez de reformatação global. Não foram alterados CSS, HTML ou testes existentes.

## Padrões ruins encontrados

- Declaração, condição, mutação de cache e `return` na mesma linha.
- Objeto de modelo com dezenas de campos em uma única linha.
- `Promise.all` contendo workers, while, matching, mutação e tratamento de erro comprimidos juntos.
- Callbacks DOM com criação de elementos, configuração, persistência e ações impossíveis de revisar por etapa.
- Ternário em cascata para origem de faixa.
- Cursores binários atualizados na mesma linha que leitura e retorno; nomes como `v`, `little`, `type` sem contexto do formato.

Os statements e callbacks passaram a ter linhas próprias, objetos multilinha e encadeamentos quebrados. O alvo de largura foi 110 caracteres, sem tentar quebrar strings ou regex de forma artificial.

## Modularização aplicada

Foram criados apenas dois módulos, com dependências unidirecionais:

- **`server/apple-normalize.cjs`:** transforma registros Apple em artista/álbum/música do modelo interno. Não contém rede, cache, fila ou ranking.
- **`server/deezer-normalize.cjs`:** transforma registros Deezer no modelo usado pelo adapter histórico; inclui a normalização HTTPS e os tipos de recurso necessários à conversão. Não contém requests, cache ou ranking.

Os clients importam os normalizadores. Os normalizadores não importam os clients, portanto a extração não introduz ciclos. Os exports existentes `createMusicClient` e `createDeezerClient` permanecem iguais, assim como os consumidores atuais. A extração não reativa Deezer como catálogo de produção.

Essa separação representa uma responsabilidade real e permite testar/alterar conversão sem envolver requests. Não foram criados `utils.js`, layers, classes, index intermediário ou abstração genérica de cache. Os caches diferentes não foram unificados, pois possuem contratos distintos.

## Helpers e funções divididas

- `matchesRecommendationNames()` nomeia a comparação de título/artista já repetida no catálogo; não altera os critérios de matching.
- `trackSource()` troca o ternário em cascata por retornos explícitos para as mesmas origens.
- O fluxo FLAC foi dividido em `readFlacTags()`, `readFlacComments()` e `parseFlacPicture()`, com `decodeFlacText()` para a decodificação comum. `readUint32`, `readUint32LE` e `readBytes` continuam locais ao bloco que controla seu cursor.
- `pictureView`, `pictureType`, `mimeType`, `imageLength`, `blockType`, `blockLength` e `commentCount` substituem nomes ambíguos na parte FLAC.

FLAC permaneceu no módulo de áudio existente: separar arquivos browser acrescentaria dependências de carregamento ao parser standalone sem necessidade neste pass. Preservados offsets, bounds checks, MIME permitido, preferência pela capa frontal, limite de imagem de 5 MiB, limite de base64 de 8 MiB, teto de 10.000 comentários e tolerância aos blocos truncados.

Funções de composição grandes do dock e PARTY não foram reorganizadas em vários arquivos apenas por tamanho: suas closures e lifecycle compartilhados exigiriam uma refatoração mais ampla. Nesta tarefa, seus passos foram tornados legíveis.

## Preservação de comportamento

- A primeira formatação de 12 arquivos teve a árvore sintática comparada antes/depois, ignorando somente posições, comentários e metadados do parser.
- Na revisão final, oito desses arquivos continuam com AST normalizada idêntica; quatro receberam as extrações pequenas descritas acima.
- Os três arquivos formatados por intervalos também tiveram AST normalizada idêntica.
- Comparação diferencial dos parsers anterior/novo: **600 entradas curtas/truncadas determinísticas**, incluindo cabeçalhos ID3 e FLAC, com saídas iguais.
- Normalizadores antigo/extraído: **24 casos**, contemplando os três tipos, campos ausentes, versões, imagens e datas; saídas iguais.
- Origem/snapshot da faixa: **12 casos**, com saídas iguais antes/depois.

Essas verificações dão evidência de neutralidade; não constituem prova de equivalência para toda entrada possível. Nenhuma correção de bug de produto foi misturada à limpeza.

## Testes executados

- Rodada principal: **65 testes, 63 passaram e duas falhas preexistentes**. Cobriu busca/normalização Deezer, qualidade/reserva/resolução/recuperação/editorial musical, artwork, SPACEAMP, integrações, chat e room/UI. Os testes de room são leves; não houve mesh/RTC real.
- Rodada após os intervalos de UI: **12 testes, nove passaram e três falhas preexistentes**. Os sete testes de UI da sala e o teste de Collection passaram. Essa rodada repete alguns testes da primeira; os números não devem ser somados como casos únicos.
- Os **seis testes de SPACEAMP/integrações** foram repetidos após extrair `trackSource`, todos passaram.
- Smokes passaram: FLAC, media metadata, artwork, descoberta personalizada e navegação.
- Syntax check: **71 scripts** em `dist`/`server`; os três arquivos formatados posteriormente por intervalos foram checados novamente. `git diff --check` sem erro de whitespace.
- Browser e regressão WebRTC pesada não foram executados: HTML/CSS e comportamento visual não foram alterados.

## Falhas existentes, separadas da limpeza

1. `tests/deezer-unified-search.test.cjs`: o primeiro caso fornece `lastfm.details`, mas o contrato atual usa `lastfm.summary`. A falha foi reproduzida carregando a implementação anterior do catálogo.
2. `tests/music-editorial.test.cjs`: um caso espera 24 itens no lote inicial; o comportamento anterior já retorna seis. A mesma falha foi reproduzida com a implementação anterior.
3. `tests/deezer-smoke.cjs`: chama `catalog.deezerDetails`, ausente também na implementação anterior. O smoke não passou; não foi alterado para mascarar a incompatibilidade.
4. Três casos de `tests/spacevoice.test.cjs` falham na fixture de captura (`audio: true`), com contagem inesperada e callbacks não inicializados. Esses testes carregam `voice/media.js` e `voice/state.js`, que não foram alterados neste pass; reproduzem as falhas também isoladamente.

Nenhuma dessas falhas foi corrigida nesta tarefa porque atualizar testes/contratos ou comportamento de captura misturaria outro escopo à limpeza pedida. Devem ser investigadas em um pass específico de testes legados.

## Ferramentas e limites

Uma cópia temporária de formatter foi usada como ferramenta da tarefa, sem instalar dependências no projeto, criar configuração, package.json, build ou lint obrigatório. Uma futura adoção de formatter pode ser discutida separadamente; esta tarefa não depende de sua instalação para continuar desenvolvendo.

`app.js` e `extras.js` ainda contêm trechos compactados, mas não receberam reformatação ampla nesta rodada. Melhor tratá-los por fluxo coeso, preservando o código já legível. Não há promessa de que todas as funções longas foram eliminadas; o objetivo foi remover os principais trechos quase minificados e separar apenas responsabilidades comprovadas.
