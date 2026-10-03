> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Revisão da busca musical

Histórico: substituído por [deezer-unified-catalog.md](deezer-unified-catalog.md). O padrão atual usa Deezer nas três categorias; Apple/iTunes permanece para itens antigos.

Esta revisão substitui a estratégia descrita em music-catalog-consistency.md: músicas/álbuns usam Apple/iTunes; artistas usam Deezer, com fotos e número de fãs próprios de cada ID. A escolha é fixa por categoria, sem mistura de resultados nem fallback silencioso. IDs antigos Deezer/Last.fm/MusicBrainz continuam abrindo suas fichas.

## Diagnóstico e decisão

O fluxo antigo consultava artistas Deezer, detalhes/top tracks, três buscas de catálogo e enriquecimento de capas antes de responder. Medições desta sessão: Wonderwall 5752 ms, Oasis/música 4830 ms, Oasis/álbum 1505 ms. A Deezer direta retornava covers de Wonderwall, enquanto Apple retornava Oasis.

O fluxo novo consulta títulos e artistas em paralelo no mesmo catálogo; só busca as faixas/álbuns do artista quando há nome exato. Correspondência por título tem prioridade; há espaço reservado para resultados do artista para evitar que títulos homônimos escondam suas faixas. Sem requisições por resultado para capa, biografia ou data. Cache com TTL de 15 minutos e compartilhamento de requisições em andamento.

Medições após a mudança: Wonderwall 1081 ms, Oasis/música 746 ms, Oasis/álbum 494 ms, artistas/Oasis 174 ms. São observações locais sujeitas à rede/cache do fornecedor, não uma garantia de latência. Repetições no mesmo cliente usam cache. Apple documenta aproximadamente 20 chamadas por minuto: esta solução é adequada ao app pessoal, não a tráfego público grande sem infraestrutura adicional.

Apple fornece identidade/capas de músicas e álbuns, prévias e navegação entre artista/álbum/faixa. Como musicArtist não fornece fotografia, a categoria Artistas usa uma consulta Deezer sem enriquecimento por resultado. Fotos ficam vinculadas ao ID Deezer correspondente; homônimos são preservados e diferenciados pelo número de fãs, sem emprestar fotos pelo nome. Na validação real, Oasis/927 apareceu primeiro com foto em 510 ms. Se um artista não tiver foto, o fallback permanece. Last.fm fornece descrições/recomendações fora da busca.

## Reprodução

Identidade de catálogo não equivale a áudio completo. Prévias permanecem prévias e nunca são vinculadas automaticamente como a faixa completa.

O resolvedor independente consulta links cadastrados no MusicBrainz, exigindo título e artista correspondentes. Só vincula automaticamente uma única fonte de versão segura; ambiguidades continuam exigindo escolha. Agora aceita também links HTTPS diretos de formatos de áudio reconhecidos em relações de streaming/download, além de YouTube. Não transforma páginas Deezer/Apple/Spotify em streams, não extrai áudio do YouTube. A disponibilidade/permissão real de playback só é confirmada pelo browser; o cadastro do link não garante que permaneça acessível.

O diálogo permite URL direta MP3/M4A/AAC/OGG/WAV/FLAC/Opus, YouTube e arquivo local, preservando edição manual. Sem serviço de playback autorizado, não há cobertura universal de faixas completas sem chave/conta.

## Validação

26 testes focados: catálogo único inclusive vazio/falha, títulos versus artistas homônimos, três categorias, cache/requisições compartilhadas, relações/versões, áudio direto, coleção e controles existentes. Dois scripts de browser executados sequencialmente, cada um com um contexto: fluxo existente de áudio/YouTube e Search/detalhes/vínculo de áudio. Sem regressão pesada PARTY.

Fontes oficiais consultadas: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html, https://musicbrainz.org/doc/MusicBrainz_API, https://www.last.fm/api.
