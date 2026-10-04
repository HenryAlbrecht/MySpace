# SPACEAMP — preservação de ISRC — 2026-10-04

Na branch feature/spaceamp-now-playing, os normalizadores Apple/Deezer preservam isrc quando fornecido pelo registro de música. MusicModel mantém o identificador na Collection e queueTrack, normaliza letras/formatos e rejeita códigos inválidos. Também aceita metadataSources.isrc em itens existentes. O fluxo playlist → state → Core → am-lyrics já possuía o campo; corrigidas as perdas na conversão e no salvamento de volta na Collection. Alterações manuais de arquivo/URL limpam o ISRC anterior. Uma atualização legítima de ISRC altera a identidade da consulta de lyrics no Now Playing.

Não há ISRC fixado por música, nova consulta de catálogo ou associação entre gravações por nome. Registros antigos e catálogos que não fornecem o identificador continuam com fallback de título/artista. Em particular, esta mudança não preenche automaticamente o código ausente na faixa já adicionada pelo usuário.

Validação: 15 testes unitários de ISRC/Collection/catálogo passaram. Browser de um contexto com YouTube simulado, am-lyrics oficial e TTML determinístico confirma Collection → queue → seleção real do adaptador → atributo isrc → requisição direta lrc.red → Source lrc.red. Save back e reload preservam identificador na Collection/fila. Page smoke, Deezer smoke, syntax e diff check passaram. Nenhuma letra real ou exceção de provider foi incorporada em produção.

## Correção após validação da faixa real

A preservação isolada não resolvia faixas Apple sem ISRC: a resposta real do lookup de itunes:1733408557 omite esse campo. Agora detalhes de música sem código podem obter apenas o identificador pelo cliente MusicBrainz existente, usando título normalizado exato, todos os artistas creditados (incluindo aliases), duração com tolerância de 1,5 s e ISRC único. Versões identificadas como live/remix, resultados incompletos e ambiguidades são rejeitados. Falha externa mantém a busca de lyrics por metadados. Identidade, catálogo Apple e playbackSource não são substituídos. O cliente existente mantém cache, deduplicação, timeout e espaçamento de requests.

Detalhes sem o marcador da nova resolução são atualizados em vez de reutilizar o cache antigo. MusicBridge incorpora o ISRC confirmado nos metadados do item já salvo ao abrir os controles enriquecidos; preserva o vínculo de reprodução e demais dados do usuário.

Validação real: detalhes de itunes:1733408557 retornaram JPK652300130, confirmado por gravação MusicBrainz ca8578d9-7db9-477e-82f2-74cbbf91ef27; TTML lrc.red respondeu 200. Sem identificador hardcoded em produção. Testes cobrem aliases, duração, título, versões, ambiguidade, erro de rede e identidade Apple. Browser cobre cache antigo, consulta lrc.red com am-lyrics oficial, atualização de item salvo, fila e reload. Esta correção inclui código de servidor; o processo Node precisa carregar a nova versão.

## Seleção direta da Collection/fila sem página de detalhes

A correção de enriquecimento dependia da consulta a Catalog.details. Tocar um item salvo ou da fila podia ignorar essa consulta e entregar um snapshot sem ISRC ao componente de lyrics. A seleção de tracks com metadataSources.catalogId Apple e sem código agora consulta os detalhes antes de publicar a nova faixa. Respeita o token de seleção para rejeitar resultados de navegações antigas; falha de metadata não impede playback. O identificador confirmado também atualiza o item salvo pela mesma identidade Collection/Apple.

Refeito o teste de browser com Collection inicialmente sem ISRC e sem chamar Catalog.details explicitamente. Passou no fluxo direto, incluindo armazenamento/fila/reload. Validação adicional com servidor padrão e APIs reais Apple/MusicBrainz/lrc.red também passou usando itunes:1733408557, am-lyrics oficial e YouTube simulado: o componente chegou a lyricsSource=lrc.red com JPK652300130. Sem TTML substituído nessa validação real. O teste anterior via detalhes não cobria este caminho.

## Edições dos Smiths

O requisito de ISRC único rejeitava Heaven Knows I'm Miserable Now: a gravação retorna vários códigos associados a edições diferentes. Quando há candidatos compatíveis, o servidor agora verifica metadados públicos lrc.red por código e só aceita uma correspondência única de título, conjunto de artistas, álbum e duração (tolerância de 1,5 s). Não escolhe o primeiro código disponível. Sem confirmação inequívoca, mantém o fallback anterior. A consulta é limitada a oito candidatos, com timeout, deduplicação e cache limitado de metadados válidos. O marcador de consulta foi atualizado para 2, invalidando resultados antigos sem ISRC.

APIs reais confirmaram itunes:799969786 (Hatful of Hollow) → GBCRL1300378 e itunes:799980298 (The Sound of The Smiths) → GBCRL0800305. Browser com servidor padrão, Apple/MusicBrainz/lrc.red reais e am-lyrics oficial confirmou Source lrc.red para a primeira edição pelo fluxo direto da Collection; salvar e recarregar mantiveram o código. Apenas o transporte YouTube foi simulado. Testes determinísticos também cobrem edições incompatíveis, ausência de metadados e ambiguidade. Nenhum destes títulos ou códigos foi fixado no código de produção.

## Gravação sem ISRC no MusicBrainz

Prime Time Golden Hour Show (Soundtrack) existe no lrc.red sob JPK652600601, mas sua gravação MusicBrainz não tem ISRC. A busca da gravação agora ignora apenas o sufixo classificatório (Soundtrack), mantendo versões live/remix distintas. Sem código, preserva os aliases dos créditos confirmados; a resolução pode consultar o índice lrc.red e exige título completo, álbum, duração e artistas compatíveis com esses aliases. Continua exigindo resultado único e limitado, sem códigos fixos. Marcador atualizado para 3. Browser com APIs e TTML reais confirmou Source lrc.red para itunes:6804558567, persistência e reload; transporte YouTube simulado.
