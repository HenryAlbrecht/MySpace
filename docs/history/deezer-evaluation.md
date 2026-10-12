> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Avaliação isolada: Deezer + Last.fm

Avaliação histórica anterior à autorização de migração. A decisão aplicada e os testes posteriores estão em [deezer-unified-catalog.md](deezer-unified-catalog.md).

Data: 2026-10-01. Não altera o catálogo padrão do aplicativo.

Scripts usados nesta avaliação histórica: tests/deezer-catalog-evaluation.cjs (removido na limpeza de 2026-10-07) e tests/lastfm-enrichment-evaluation.cjs (preservado). Resultados completos em artifacts/deezer-evaluation/results.json e lastfm.json. Não são unit tests nem regressão pesada: fazem consultas reais aos provedores.

## Experimento

O candidato usa somente Deezer para busca: query específica track:/album:, ordenação RANKING_DESC, consulta de artistas em paralelo e expansão de top tracks/álbuns somente quando há nome exato. Álbuns também combinam a busca textual normal do mesmo provedor. Preserva IDs, fotos de cada artista, versões nomeadas e distinção bôa/BoA. Nenhum resultado é emprestado de Apple/Last.fm.

Foram testadas oito consultas em duas rodadas (primeiro uso do cache local e repetição): músicas Wonderwall, Oops!...I Did It Again, Oasis e Duvet; álbuns Oasis e (What's the Story) Morning Glory?; artistas Oasis e bôa. O experimento foi refinado e repetido três vezes. Chamadas anteriores e caches dos fornecedores podem afetar os tempos: não é benchmark de rede fria nem medição estatística.

## Resultados finais

| Consulta | Posição esperada, atual | Posição esperada, candidato | Tempo candidato |
| --- | --- | --- | --- |
| Wonderwall / Oasis | 1 | 1 | 712 ms |
| Oops / Britney Spears | 1 | 1 | 327 ms |
| Oasis em músicas | 2 | 9 | 826 ms |
| Duvet / bôa | 1 | 1 | 591 ms |
| Oasis em álbuns | 2 | 9 | 800 ms |
| Morning Glory / Oasis | 1 | 5 | 365 ms |
| Artista Oasis | 1 | 1 | cache já usado |
| Artista bôa | 1 | 1 | 388 ms |

Para músicas/álbuns o fluxo atual mediu 37–217 ms nessa rodada, o candidato 327–826 ms. Repetições usaram zero requisições externas nos dois fluxos. Os oito resultados esperados foram encontrados; os três títulos de música de referência ficaram em primeiro no candidato. As capas vieram nos resultados; não foi feita avaliação perceptiva comparativa de compressão/qualidade de todas as imagens.

A conclusão anterior de que Deezer não encontrava Wonderwall precisa ser qualificada: a busca genérica usada antes perdia esse resultado, mas a consulta estruturada encontrada no experimento retornou a gravação Oasis/15596500 em primeiro.

Morning Glory revelou que existir no catálogo não garante bom ranking: o resultado exato de outro artista (BubbleVerse) fica acima da edição Oasis. Buscar Oasis também mistura títulos chamados Oasis e músicas/álbuns do artista. Resolver isso exige explicitar agrupamentos ou melhorar relevância, sem mapas especiais/hardcodes para estas músicas. O candidato ainda não é superior ao padrão em todos os casos.

## Last.fm

Descrições reais de Wonderwall, Oasis e Morning Glory retornaram resumo e cinco tags. Artista Oasis retornou oito artistas similares. Recomendações de Wonderwall retornaram 12 músicas em 328 ms. Recomendações de álbum retornaram 12 álbuns populares de artistas similares em 1465 ms — não é uma API de similaridade direta entre álbuns. Esses enriquecimentos devem ficar fora do tempo da busca principal.

## Decisão

Deezer + Last.fm é uma alternativa coerente e viável para catálogo, fotos e descoberta, mas não se justifica uma migração imediata apenas por consistência. Os problemas de relevância em álbuns e consulta por artista precisam de validação adicional antes de trocar o padrão. Nenhuma configuração/implementação de produção foi alterada nesta avaliação.

Este teste não demonstra reprodução de áudio completo. Deezer fornece metadata, página de catálogo e prévia; Last.fm fornece descoberta. Isso não substitui o resolvedor de fonte completa do SPACEAMP nem garante links diretos de áudio disponíveis.
