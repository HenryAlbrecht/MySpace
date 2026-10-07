# UX de recommendations e gêneros — 2026-10-06

Branch `mudanca_search`, working tree atual, sem commit.

## Movimento

A reconciliação reaproveitava nós, mas `insertBefore` mudava sua posição instantaneamente. Agora mede os retângulos por catalogId antes/depois e aplica FLIP nos nós retidos. Novos cards entram com opacity e translateY de 4px; músicas usam 2px. Saídas são imediatas. A atualização continua síncrona, sem fade da seção, clones ou novas bibliotecas.

WAAPI usa `--motion-focus` (180ms), com fallback ao token `--motion-standard`, e `--ease-xmb`. Reduced motion desliga entradas e FLIP e cancela animações em andamento. Navegação também cancela o movimento. Foco, artwork e identidade dos nós retidos são preservados.

O navegador verificou Música, Artista, Álbum, EP e Single: quatro retidos, oito entradas, atualização em 10–19ms, scroll e foco estáveis, opacity do grid sempre 1. A gravação usa fixtures determinísticas; não representa latência dos serviços públicos.

## Gêneros

Precedência: gêneros conhecidos → tags específicas Last.fm → tags do artista Last.fm → vazio. Artistas continuam consultando somente suas próprias tags. O fallback ocorre apenas no enrichment de músicas e releases vazios, preservando summary e identidade da obra; CORE não espera Last.fm.

Reutiliza `lastfm.summary` e seu cache/pending existentes. Tags específicas recebem `Last.fm`; herdadas recebem `Last.fm · artista`. O teste concorrente de cinco releases fez cinco consultas específicas e uma única consulta ao artista; revisitas não geraram novas chamadas.

Ao abrir um item salvo sem gêneros, o resultado preenche somente genres e, se ausente, genresSource. CollectionActions.patchCatalogMetadata possui allowlist e não muda updated, histórico ou campos pessoais. Não há migração, varredura de rede ou atualização de outros itens. A TitlePage recebe patch local sem redesenho.

## Exemplos públicos verificados

Todos tinham tags próprias vazias e retornaram fonte `Last.fm · artista`:

| Tipo | Obra | Artista | Tags herdadas |
|---|---|---|---|
| Música | 国道スロープ - Kokudouslope | Kinokoteikoku | shoegaze, japanese, dream pop, japan, post-rock |
| Álbum | Hokorobi | Beachside talks | dream pop, shoegaze, J-rock, indie rock, japanese |
| EP | Kasukani Soumatou | tokenainamae | japan, shoegaze |
| Single | Mado | Beachside talks | dream pop, shoegaze, J-rock, indie rock, japanese |
| Single | Next Chance to Move On | Shihoko Hirata | japanese, Soundtrack, video game music, female vocalists, Persona 4 |

Mado é classificado como Single pelo catálogo YouTube Music. As cinco decisões fizeram cinco requests específicos e quatro ao artista: Mado reutilizou o cache de Beachside talks. IDs e resultados estão em artifacts/music-ux-genres/live-genres.json.

## Validação e arquivos

100 testes unitários passaram (93 anteriores e sete novos). Passaram também music-ux-motion-browser, music-ux-backfill-browser, music-final-recommendations-browser, music-collection-genres-browser, music-duration-memory-browser e navigation-smoke, sem erros de console nos harnesses que os coletam.

Implementação: dist/title-pages.js, dist/extras.js, server/music-catalog.cjs. Novos testes: tests/music-ux-genres.test.cjs, tests/music-ux-motion-browser.cjs, tests/music-ux-backfill-browser.cjs, tests/music-ux-genres-live.cjs.

Artefatos em artifacts/music-ux-genres/: original-rotation.mp4 (trecho do capture real 10-19-51), rotation-five-types.mp4 (nova rotação), screenshots por tipo, motion-report.json, backfill-report.json e live-genres.json. O vídeo original mostra reconciliação abrupta; a gravação posterior verifica o movimento com dados controlados. Estratégia e budgets de recommendations permanecem intactos.
