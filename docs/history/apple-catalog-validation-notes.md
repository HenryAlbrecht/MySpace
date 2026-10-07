> Histórico: decisões e validações de fases anteriores. O contrato atual está em [music](../music/apple-canonical-catalog.md) e [vínculo de reprodução](../music/music-automatic-source.md).

# Arquitetura musical atual

- Apple/iTunes: catálogo de músicas, álbuns e artistas, metadata, IDs itunes: e capas.
- Deezer: somente foto de artista por nome normalizado, com cache; não cria entidades na coleção.
- Last.fm: descrições/biografias e recomendações. As sugestões são resolvidas para IDs Apple antes de serem exibidas. Até 24 candidatos alimentam uma grade de 12 cards. Itens já presentes são omitidos por identidade ou título + artista, sem fundir IDs da coleção nem remover qualificadores live/remix.
- MusicBrainz: somente relações de links de reprodução compatíveis. Mesmo um único resultado exige selecionar e salvar. Não altera metadata ou identidade Apple. Link manual e arquivo local permanecem disponíveis.

## Consistência e limites

A capa salva é preservada na página do título. A lista consulta o Last.fm apenas para o item selecionado, com cache e proteção contra resposta de seleção anterior. Descrição ausente é diferente de serviço indisponível. Não se usa descrição da faixa-base para outra versão automaticamente.

Discografia Apple classifica Single/EP pelos sufixos do lançamento e os demais como álbum. O tipo não é inferido pela quantidade de faixas; o filtro atua apenas sobre os lançamentos carregados.

SPACEAMP usa um controlador global. Perfil e compacto compartilham reprodução, fila, volume e a opacidade configurada dos painéis. Reprodução local e YouTube permanecem distintas. Now Playing depende de reprodução confirmada; a preferência de presence não controla Media Session. ENDED do YouTube avança a fila uma única vez. O browser ainda pode bloquear autoplay.

A interface informa carregamento, bloqueio e erro por eventos da IFrame API, sem polling. O modo capa mantém o iframe carregado; conforme documentado em spaceamp-youtube-playlist.md, ocultá-lo durante reprodução contraria as políticas YouTube e foi solicitado explicitamente pelo usuário.

## Validação focada (2026-10-02)

37 testes Node passaram: identidade Apple, fotos, metadata, recomendações, discografia, coleção, sugestões de reprodução, controlador global e integrações. HTTP smoke foi atualizado para o contrato atual. Dois testes Edge sequenciais, um contexto cada: busca -> coleção -> vínculo manual -> reprodução local; e YouTube simulado -> término -> próxima faixa -> capa/vídeo -> navegação -> feedback de buffering/autoplay bloqueado. Zero pageerrors.

O teste de YouTube simula os eventos da API; não prova disponibilidade de cada vídeo real, anúncios ou latência de buffering na rede do usuário. Os testes antigos ligados às arquiteturas Deezer/Last.fm como catálogo permanecem históricos e não compõem essa suíte. Não foi executada regressão pesada nem alterada a PARTY/WebRTC/ICE/TURN.

Comando da suíte Node: node --test --experimental-test-isolation=none tests/apple-canonical.test.cjs tests/apple-discography.test.cjs tests/music-unified-search.test.cjs tests/music-editorial.test.cjs tests/music-collection-polish.test.cjs tests/playback-suggestions.test.cjs tests/music-v16.test.cjs tests/spaceamp.test.cjs tests/spaceamp-integrations.test.cjs tests/collection.test.cjs

Browsers: tests/music-unified-search-browser.cjs e tests/spaceamp-youtube-browser.cjs. HTTP: tests/music-flow-http-smoke.cjs.

Nota da Leva B: tests/music-unified-search-browser.cjs passou a certificar Catalog YouTube Music → editorial → Collection → override manual para áudio direto → playback real pelo SPACEAMP, preservando identidade. Não é mais owner de catálogo Apple/default.

## Estados de interface

Busca e descoberta têm limites separados. Falhas da consulta auxiliar de artistas/discografia não descartam resultados da busca principal Apple. Falha principal continua sendo erro visível. Uma consulta foreground não aguarda a mesma requisição que esteja na fila de recomendações; respostas bem-sucedidas ainda compartilham cache. Sem fallback de provedor.

Last.fm fornece reserva de até 48 sugestões (álbuns: até 12 de cada um de quatro artistas similares). Primeiro são resolvidos 24 candidatos. Se após os filtros faltarem cards, a página pede lotes adicionais de seis, até obter 12 cards ou esgotar a reserva. Edições distintas permanecem distintas; limite visual 6 × 2. Resultados anteriores e recuperação incremental são preservados. Os caminhos de busca e resolução são ambos mantidos em music.cjs, mas não têm a mesma dependência de sucesso nem fila de espera. Não foram adicionados serviços, novas camadas ou bibliotecas.

Validação histórica: tests/music-search-reserve.test.cjs cobre falha auxiliar, falha principal e independência da fila; o antigo harness browser de reserva cobria busca das três categorias e 12 cards após filtros, sem pageerrors. Na reauditoria da Leva B, seus contratos vigentes foram mapeados para tests/music-search-reserve.test.cjs, tests/music-search-pagination-browser.cjs, tests/music-final-recommendations-browser.cjs e tests/music-pages-evolution-browser.cjs. Consulta real de Wonderwall, Oasis e Republic retornou 12 resultados em cada categoria. Isso não elimina indisponibilidade externa da Apple.

Recuperação incremental: o servidor mantém até 40 listas de sugestões por cinco minutos, com estado resolvido/sem correspondência/falha por item. Nova tentativa consulta somente falhas e reutiliza os resultados anteriores; tentativas simultâneas compartilham a mesma operação. Consultas Apple para recomendações são serializadas com intervalo mínimo de 750 ms entre inícios, aproveitando cache e consultas compartilhadas por artista. A busca comum não recebe esse atraso adicional. Isso reduz rajadas, sem garantir aceitação pelo provedor.

Diagnóstico da resolução inclui timeout, network, rate-limit (429), http com código e unknown, sem URLs ou credenciais. Falha total também expõe resolution na resposta 503. Os cards são preservados na UI durante a recuperação e o aviso parcial é discreto. Teste real New Order/Republic: seis cards -> sete após retry; resultados anteriores preservados, falhas restantes HTTP 403 Apple. Evidência em artifacts/music-real-services/recovery.json. Testes focados cobrem recuperação só dos itens falhos, concorrência, identidade dos cards no Edge e categorias de falha.

Para recomendações Last.fm de músicas, a consulta usa primeiro o título exato. Apenas se a resposta estiver vazia, um sufixo reconhecido de masterização (por exemplo, “(2024 Digital Master)”) pode ser removido numa segunda consulta. Live/remix/acoustic não são removidos; erros não acionam esse fallback. A UI informa a faixa-base utilizada. Nenhuma alteração no título salvo, capa, descrição ou identidade. Caso real Weirdo: título exato retornou zero sugestões Last.fm; faixa-base retornou 24, das quais oito foram identificadas na Apple no teste integrado, com falhas parciais sinalizadas. Quinze testes focados passaram, incluindo fallback, versão exata, falha de serviço e qualificadores preservados.

A busca distingue carregamento, resultados vazios e falha, com tentativa novamente após erro. O resumo editorial da coleção permite repetir uma consulta que falhou. O vínculo de reprodução mantém link e arquivo manual disponíveis durante indisponibilidade da busca. Uma faixa local sem arquivo apresenta a ação de vincular arquivo, respeitando fileRef separado do ID da fila. Os estados usam motion XMB e respeitam reduced motion.

Validação adicional: 12 testes Node focados passaram e playback-suggestions-browser.cjs validou falha/retry da busca, vazio, confirmação do vínculo, persistência e ação de arquivo ausente em um contexto Edge, sem pageerrors. As respostas externas foram simuladas; isso não comprova disponibilidade dos provedores na rede real.
