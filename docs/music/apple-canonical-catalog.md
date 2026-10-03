# Catálogo musical vigente

- Apple/iTunes fornece músicas, álbuns, artistas, metadata, capas e identidade `itunes:`.
- Deezer fornece somente foto de artista; não cria entidades da coleção. Nome/evidência de faixas Apple ajudam a validar homônimos; sem confiança, mantém imagem indisponível.
- Last.fm fornece descrições/biografias e recomendações. Sugestões são identificadas na Apple antes de aparecerem como entidades.
- MusicBrainz fornece relações de links de reprodução, sempre sujeitos à [confirmação](music-automatic-source.md).

## Busca e coleção

Não há fallback de catálogo para Deezer/Last.fm. Busca vazia e indisponível são estados diferentes. IDs canônicos são preservados. Edições live/remix/remaster permanecem distintas; filtragem de descoberta não funde registros salvos. A capa salva é preservada na ficha.

A foto é enriquecimento opcional e pode ser repetida quando indisponível. A descrição consulta Last.fm, com cache e proteção contra resposta de seleção anterior. Descrição ausente é diferente de erro; não se usa descrição da faixa-base para outra versão automaticamente.

## Recomendações

A resolução Apple avança em blocos de seis candidatos, com reserva de até 24 para alimentar uma grade de até 12 cards e compensar filtragem de itens coletados. Resultados parciais são preservados. Retry consulta falhas restantes; chamadas iguais compartilham trabalho pendente. Diagnósticos distinguem timeout, network, 429, HTTP e unknown sem expor credenciais.

Para músicas, Last.fm recebe primeiro o título exato. Somente uma resposta vazia permite tentar sem sufixo reconhecido de masterização; live/remix/acoustic são preservados. Erros não acionam fallback. A UI informa quando usa a faixa-base, sem alterar o título ou identidade.

## Compatibilidade

Rotas de catálogo Deezer removidas não voltam a produzir itens. O adapter histórico continua disponível para seus testes isolados. Backups/IDs históricos não são apagados. O modelo não transforma uma página de catálogo em fonte de áudio.

Veja [arquitetura](../architecture.md), [mapa](../module-map.md) e [testes](../../tests/README.md). Medições e casos reais de etapas anteriores ficam nas [notas históricas](../history/apple-catalog-validation-notes.md); não garantem disponibilidade externa atual.
