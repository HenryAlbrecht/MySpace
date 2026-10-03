> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Catálogo musical consistente

Estratégia histórica substituída por [music-search-revision.md](music-search-revision.md). O padrão atual usa Apple/iTunes nas três categorias, sem mistura automática de fornecedores.

Na busca automática, Deezer tem prioridade para identidade, capa, álbum e prévia. iTunes e Last.fm continuam como fallback para músicas que faltam na Deezer; resultados correspondentes são combinados, sem substituir a identidade/capa Deezer. Last.fm continua fornecendo descrições e recomendações, com atribuição separada.

Uma consulta que corresponde exatamente ao nome de um artista Deezer inclui suas músicas populares ou álbuns, conforme a categoria selecionada, sem interromper a busca por título. Títulos exatos têm prioridade sobre a expansão por artista (por exemplo, Wonderwall/Oasis antes das músicas da banda Wonderwall). A categoria Artistas mantém sua busca e distinção de homônimos.

A coleção reconhece músicas de catálogos diferentes por título/artista normalizados, mantendo versões nomeadas distintas. Uma nova adição correspondente preserva status e fonte de reprodução existentes. Não há exclusão nem migração automática das duplicatas já salvas.

Validação focada: prioridade Deezer, fallback para Wonderwall, busca Oasis nas três categorias, identidade entre catálogos, versões distintas e preservação dos testes de reprodução/coleção. Consulta real Oasis retornou Wonderwall (Remastered), álbuns do Oasis e o artista Deezer 927.
