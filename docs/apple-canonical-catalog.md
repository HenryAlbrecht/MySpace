## Atualização: enriquecimento Last.fm

Last.fm voltou exclusivamente para biografias/descrições e recomendações de músicas, álbuns e artistas. A busca e as identidades continuam Apple. Sugestões Last.fm são resolvidas por título + artista no catálogo Apple; sem correspondência válida, não viram entidades. As recomendações incluem itens já presentes na coleção, sem duplicar cards. Biografia usa getInfo, sem carregar discografia extra; falhas preservam os dados Apple. A configuração LASTFM_API_KEY existente é reutilizada, sem expor a chave ao browser. A resolução automática de playback continua desativada.

Validação real: Lily Chou-Chou retornou biografia (665 caracteres), Duvet descrição (949). Oasis: 12 artistas, 4 álbuns e 6 faixas resolvidos para IDs Apple. Disponibilidade varia conforme o Last.fm e o matching com Apple.

Os trechos históricos abaixo sobre recomendações desativadas foram substituídos por esta atualização.

# Apple como identidade única do catálogo

Apple/iTunes fornece novas buscas, músicas, álbuns, artistas, IDs e capas. Deezer é usada exclusivamente pelo adaptador artist-artwork.cjs para consultar /search/artist e retornar uma URL de foto, sem ID Deezer. O objeto enriquecido conserva catalogId itunes:, source iTunes e metadata Apple.

O adaptador prioriza nome exato NFC (inclusive acentos), depois comparação sem acentos; entre nomes correspondentes usa número de fãs como desempate. picture_xl é preferida. Foto por nome é uma heurística: o nome sozinho não comprova identidade entre homônimos. Não é feita fusão de entidades e uma foto ausente mantém o fallback. Cache positivo de uma hora, negativo de um minuto e requisições em andamento compartilhadas. Enriquecimento concorrente limitado a três trabalhos. Fotos também são aplicadas no contexto de busca de artista por música.

Novas buscas com provider Deezer/Last.fm/MusicBrainz/Spotify são rejeitadas. Rotas antigas desses catálogos retornam 410. Os adaptadores históricos permanecem nos arquivos, mas não estão conectados ao catálogo de produção. Nenhuma chamada a Last.fm, MusicBrainz ou Spotify é feita pelo catálogo. Recomendações externas e descoberta automática de fonte ficam desativadas; fontes já vinculadas, áudio local, URL direta e YouTube continuam funcionando manualmente.

Na coleção, identidade é kind + catalogId Apple (ou ID local para itens manuais). Foi removido o matching semântico entre provedores. Adicionar novamente o mesmo ID atualiza o item sem duplicar e preserva status/vínculo. Música, álbum e artista com ID externo não podem ser criados pelos fluxos de coleção. Registros antigos já armazenados não são apagados nem migrados; podem ser editados e reproduzidos, usando a metadata já salva, sem consulta ao catálogo antigo.

Importação de backup também não pode introduzir novas entidades de catálogo externo: é rejeitada com mensagem clara caso esses IDs não estejam na coleção atual. Backups Apple e itens manuais permanecem importáveis. Não foi feita migração de backups históricos.

Validação: 30 testes focados passaram, incluindo IDs canônicos, ausência de consultas secundárias, matching/cache/fallback de foto e controles de reprodução. Edge com um contexto confirmou Search, foto enriquecida, detalhes, duplicata por ID Apple, rejeição de nova entidade Deezer e reprodução real de URL de áudio; zero erros de página.

Consultas reais: Wonderwall/Oasis em primeiro (308 ms), Morning Glory/Oasis em primeiro (109 ms), artistas Oasis com IDs Apple e fotos Deezer (1264 ms). Tempos sujeitos a rede e caches. Resultados em artifacts/apple-canonical/live.json.

Arquivos principais: server/music-catalog.cjs, server/artist-artwork.cjs, server.cjs, dist/catalog.js, dist/music-model.js e dist/extras.js.

