# Boot/loading — 2026-10-06

Working tree usado sem reset/checkout; medições locais antes da produção, com 100 livros e 24 fotos, quatro cold routes e `?party`. Sem provider real, commit ou push. Harness: `tests/boot-performance-browser.cjs`; relatórios completos ignorados em `artifacts/performance/before.json`, `initialization.json` e `after.json`.

## Implementado

Collection dirty/primeiro render pertence ao view owner; extras invalida por items e mudança de categoria. Gallery é montada na primeira entrada e invalidada por photos. PARTY é criada na primeira rota/deep link e reutilizada, mantendo show/hide/leave e scripts/globals disponíveis. SPACEAMP continua singleton. Formatos/persistência, TitlePages, discografia progressiva, Artwork, catálogo e protocolos não mudaram.

Static GET/HEAD usa ETag fraco de size/mtime/ctime e `Cache-Control: no-cache`; revalidação 304 e HEAD evitam readFile/corpo. Arquivo alterado troca ETag; APIs mantêm no-store. Testes cobrem validators em lista, fraco/forte, wildcard, HEAD e diretório inválido.

| Fixture local | Antes | Depois |
|---|---:|---:|
| JS solicitados no boot | 59 | 59 |
| Bytes de fonte JS solicitada | 686.124 | 685.728 |
| Elementos DOM em perfil | 1.686 | 586 |
| Imagens em perfil | 130 | 5 |
| Renders completos Collection em perfil | 1 | 0 |
| Renders completos Collection em colecao direct | 2 | 1 |
| Gallery em perfil | 1 render / 24 imagens | 0 / 0 |
| PARTY init em perfil | 1 | 0 |
| PARTY após entrada e saída/volta | instância eager | 1 criação, mesmo node |
| Reload de app.js | 200 / 26.077 bytes | 304 / 0 bytes |

Bytes variam incidentalmente pelo código/format dos trechos: nenhum script foi removido. Browser sem interceptação de assets confirmou 59 JS revalidados em 304; transferSize inclui headers. Interceptação do harness de renders altera corpos JS, portanto bytes de fonte e reload real são registrados separadamente. Métricas incluem CSS, scripts por domínio, long tasks, DCL/load, paint e superfície com controles utilizáveis; não existem thresholds absolutos.

Diagnóstico pontual perfil: DCL ~446 → 379 ms, load ~454 → 383 ms, usable ~414 → 363 ms. Tempos variam e nem toda rota mostrou redução; a remoção de trabalho/DOM e counts é o aceite determinístico. A medição intermediária isolou lifecycle antes de avaliar script loading.

## Oportunidades futuras

- PARTY: 17 scripts / 146.984 bytes; top-level sem init teve custo muito pequeno na medição (~0,2 ms em uma execução, exclui parse/compile). Manter ordem clássica/globals nesta rodada; lazy script exige fronteira e harnesses próprios. XMB/Catalog/Now Playing também ficam separados; lazy atmosphere/lyrics existente preservado.
- Fontes DM Sans/Space Grotesk continuam em @import com display=swap, initiator CSS observado. Harness bloqueia rede externa; latência real de fontes/preconnect e benefício de mudar para head não foram certificados. Tipografia permanece intacta. CSS feature-specific também preservado para evitar FOUC.
- Gzip local diagnóstico: ~687 KB → 203 KB, ~12 ms de CPU por compressão de todos os scripts. Sem benefício local de transferência demonstrado contra esse custo; revalidação elimina corpos no reload. Avaliar compressão para acesso remoto/túnel, sem implementá-la por convenção.

## Aceite

Focados boot/cache/Collection e PARTY PASS. Browsers: cold routes/deep link/dirty/reuso/cache, route visibility (12 transições, zero superfícies misturadas), navigation-camera, collection-title-return, PARTY visual-state-continuity e XMB handoff PASS. Quick PASS: 37 arquivos / 194 testes, guard sem fetch externo; smoke PASS: 9 arquivos; syntax/static e diff-check PASS. Sem nova captura/WebRTC real ou fontes remotas certificados.
