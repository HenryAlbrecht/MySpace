> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Catálogo musical unificado

Histórico: substituído por [apple-canonical-catalog.md](../music/apple-canonical-catalog.md). O padrão atual é Apple/iTunes; Deezer serve somente para foto de artista.

Decisão aplicada em 2026-10-01 após avaliação e autorização: Deezer é o catálogo padrão de músicas, álbuns e artistas. Last.fm fornece descrições, tags e recomendações fora da busca principal. MusicBrainz permanece apenas como resolvedor de fontes de reprodução; não participa da busca de catálogo. iTunes permanece para leitura dos IDs antigos, sem fallback em novas buscas.

## Busca

Uma única entrada, createMusicCatalog.search, delega a createDeezerClient.searchCatalog. Somente auto/deezer são aceitos para novas buscas. O mesmo caminho atende o Search e adicionar à coleção.

As consultas de título e artista ocorrem em paralelo. A busca usa track:/album: com ranking do provedor; álbuns também usam a consulta textual Deezer. Quando há artista com nome exato, a busca inclui quatro músicas/álbuns dele perto do topo, sem substituir a busca de título. A resposta preserva o melhor título em primeiro, depois resultados do artista. O frontend respeita a ordem do servidor.

Rótulos de edição como Remastered/Deluxe/Anniversary são desconsiderados apenas no ranking de álbuns. Não se alteram títulos armazenados, IDs ou versões. Homônimos de artista têm IDs/fotos separados; acentos são considerados antes da normalização para manter bôa distinto de BoA.

Busca não faz enriquecimento por resultado com data, biografia ou detalhes de álbum. Cache de 15 minutos e compartilhamento de requisições simultâneas ficam no cliente Deezer. Falhas não ativam outro provedor silenciosamente.

## Compatibilidade e reprodução

Itens já salvos não são migrados/deletados. Leitores de IDs iTunes/Last.fm/MusicBrainz permanecem para abrir esses itens. Fontes de áudio local, URL direta e YouTube permanecem vinculadas independentemente da metadata. Prévias Deezer não viram faixa completa.

## Validação

Consultas reais: Wonderwall/Oasis em primeiro (831 ms), Oops/Britney Spears em primeiro (453 ms), Morning Glory/Oasis Remastered em primeiro (355 ms), bôa antes de BoA (392 ms). Oasis em músicas/álbuns apresenta um título homônimo em primeiro e conteúdo da banda a partir do segundo resultado. Tempos são observações locais, sujeitos a cache/rede do provedor.

31 testes focados passaram: provedor único, rejeição de fornecedores secundários para nova busca, leitura de IDs antigos, cache, versões, homônimos, ranking de edição e controles existentes. Smoke tests Deezer e HTTP passaram. Edge com um contexto confirmou Search, fotos, detalhes, salvamento e reprodução real de URL de áudio; zero erros de página. Não foi executada regressão pesada PARTY.

Resultados reais: artifacts/deezer-evaluation/unified-results.json. As avaliações anteriores são históricas, anteriores à migração.
