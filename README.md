# MySpace pessoal

Dê dois cliques em **`iniciar.cmd`**. Ele inicia o servidor local e abre **http://localhost:3000** no navegador. Mantenha a janela aberta enquanto usa o site; Ctrl+C encerra o servidor. Não precisa criar conta, configurar chave de API ou instalar dependências. O iniciador usa Node.js do sistema ou o runtime já disponível do Codex; em outro computador, instale Node.js 22 ou mais recente.

Se preferir o terminal, execute `node server.cjs` e abra http://localhost:3000. A porta e o endereço ficam fixos para manter os dados do navegador no mesmo lugar.

**Já usava o HTML diretamente?** Abra `dist/index.html`, exporte seu backup e importe-o no site em http://localhost:3000. Os dois endereços têm armazenamentos separados. Arquivos de áudio precisam ser vinculados novamente, pois não entram no backup. O HTML direto continua permitindo editar dados e usar os outros catálogos, mas a busca Steam precisa do servidor local.

- **Navegação**: Perfil, Coleção e Fotos são áreas separadas. Dentro da coleção, Jogos, Animes, Mangás e os demais tipos têm navegação própria por URL (`#colecao/game`, `#colecao/anime`, etc.).
- **Buscar**: área independente para pesquisar títulos por tipo de mídia. Clicar num resultado abre uma página com capa, resumo, gêneros e informações disponíveis, além da ação de adicionar à coleção. Clicar na capa de um item da coleção também abre sua página. Os resumos aparecem no idioma fornecido pelo catálogo; nem todo título tem todos os campos.
- **Páginas de títulos**: usam URLs próprias, por exemplo `#titulo/anime/anilist%3A1`. Títulos de catálogo podem ser reabertos diretamente por esses links; itens manuais dependem dos dados salvos no navegador. Voltar mantém a pesquisa anterior. A página reconhece itens já adicionados e mostra sua capa personalizada e suas notas.
- **Seções do perfil**: o botão no fim do perfil permite ocultar blocos e adicionar favoritos, selinhos e blocos livres. Top 8 e selinhos vazios não aparecem. A lista da playlist começa recolhida.
- **Personalizar**: nome, bio, avatar, banner, mood e música.
- **Aparência**: fundo por arquivo ou link, GIF, textura repetida, fonte, cores, bordas, transparência e altura do banner.
- **Editores**: adicionar mídia abre uma ficha com capa e status. Progresso, nota e anotações ficam recolhidos. Perfil tem abas Perfil / Imagens e tema / Música; Aparência tem Fundo / Estilo / Perfil / Cores.
- **Busca de títulos**: jogos usam a loja Steam, sem chave. As páginas mostram resumo, gêneros, desenvolvedores, lançamento e plataformas disponíveis na loja. Capas verticais usam a imagem da loja como alternativa quando indisponíveis. O catálogo cobre títulos da Steam; outros jogos podem ser adicionados manualmente. Não há troca automática para Wikipedia quando a Steam falha. Animes e mangás usam AniList; séries usam TVmaze; livros usam Open Library. Esses três têm alternativa pela Wikipedia em caso de indisponibilidade. Filmes e outros usam Wikipedia. Itens antigos da Wikipedia continuam acessíveis. Sua nota é sempre pessoal, e não são inventados tempos para terminar jogos. Consultas precisam de internet.
- **Capas**: depois de escolher um título, use “trocar capa” para enviar uma imagem ou “link / remover capa” para informar uma URL. “Usar capa do catálogo” restaura a imagem original, preservada separadamente da capa personalizada.
- **Formato das capas**: no editor de cada item, escolha Vertical ou Horizontal. Steam oferece imagem da loja e capa vertical quando disponível; IGDB oferece capa e uma imagem de gameplay quando disponível. Trocar o formato mantém capas personalizadas; “usar capa do catálogo” seleciona a imagem original do formato escolhido.
- **Vitrine no perfil**: use “☆ destacar” na coleção ou marque “Exibir no perfil” no editor. Até oito títulos aparecem na seção Coleção em destaque. Desmarcar remove somente da vitrine. A seção pode ser ocultada em Seções do perfil.
- **Visualização da coleção**: capas conservam a proporção e não são cortadas para virar quadrados. O modo lista mostra linhas selecionáveis e uma ficha contextual com os dados disponíveis; no celular, a ficha aparece abaixo das linhas. A preferência entre capas e lista fica salva no navegador. Na lista, use ↑/↓ para navegar, Enter para abrir, E para editar, F para favoritar, Esc para voltar às capas e ←/→ para trocar de categoria. Os atalhos não interferem na digitação em campos.
- **Minha coleção**: jogos, animes, mangás, livros, filmes, séries e outros. Cada item tem status, capa, progresso, total, unidade, nota, plataforma e anotações. Busca, filtros e ordenação; visualização por capas ou lista.
- **Top 8**: até oito amigos, personagens ou sites, com imagem e link.
- **Selinhos**: imagens e GIFs de 88 × 31 ou pequenos selinhos de texto.
- **Fotos**: imagens com legendas e visualização ampliada.
- **Blocos livres**: títulos, textos e links. Use as setas para mudar a ordem.
- **Playlist**: arquivos de áudio ou links diretos, capas ID3 de MP3 e blocos de imagem FLAC, ordenação, faixa inicial, anterior/próxima e repetição. Editar a capa ou os dados da faixa atual mantém a reprodução e a posição. Os links precisam apontar para áudio, não para páginas do Spotify ou YouTube.

Os dados ficam neste navegador. A playlist tenta guardar os arquivos de áudio no IndexedDB; quando isso não estiver disponível, use **vincular arquivo** para selecioná-los novamente. Imagens comuns são redimensionadas; GIFs preservam animação e têm limite de 1 MB.

**Exportar backup** baixa um JSON com perfil, coleção, imagens e informações da playlist. Arquivos de áudio não entram no JSON. **Importar backup** substitui os dados atuais após confirmação; guarde um backup antes de limpar dados do navegador.

O site continua sendo HTML, CSS e JS. `collection.js` contém as regras da coleção; `audio-tags.js` lê as tags MP3. `extras.js` e `extras.css` adicionam os novos recursos sem substituir o perfil anterior.

## Verificação

### Modo XMB v0.1

Na coleção, `[ modo XMB ]` abre uma apresentação própria em tela cheia (ou na viewport, se o navegador recusar fullscreen). ←/→ trocam categoria, ↑/↓ selecionam itens e Enter entra nos detalhes dentro do XMB. Nos detalhes, ↑/↓ rolam o conteúdo e Esc ou Backspace retorna à mesma categoria, item e posição de rolagem. Esc na raiz restaura a coleção e o foco. O ou `[ página completa · O ]` usa a abertura existente fora do XMB. A seleção por categoria fica guardada enquanto a página estiver aberta. Perfil e Fotos usam os dados e ações existentes; Outros também permanece acessível.

O XMB lê os dados atuais por callbacks e reutiliza `Collection.filterItems`, mantendo os filtros da coleção e substituindo apenas a categoria consultada. Não grava dados ou altera a preferência Capas/Lista. Os dois níveis reutilizam o mesmo renderizador de metadados. `dist/xmb.js` controla a apresentação e fullscreen; `dist/xmb.css` tem estilos isolados e usa os tokens de `dist/motion.css`. Tab permanece dentro do nível ativo; inputs e modificadores Ctrl/Alt/Meta não acionam seus atalhos. Se o navegador interceptar Esc para sair do fullscreen nativo nos detalhes, o shell permanece na viewport e volta à raiz.

Validação de navegação, filtros e ciclo de fullscreen: `node tests/xmb.test.cjs`. Os testes usam DOM simulado; fullscreen nativo depende do navegador.

```sh
node --test tests/audio-tags.test.cjs tests/collection.test.cjs tests/catalog.test.cjs
node tests/page-smoke.cjs
node tests/steam-smoke.cjs
node tests/flac-smoke.cjs
node tests/igdb-smoke.cjs
```

O smoke test da página usa DOM simulado; o da Steam verifica o caminho pelo servidor HTTP real com respostas da Steam simuladas. Não fazem inspeção visual de navegador.

## Organização do código

Nomes e APIs internos em inglês; textos da interface em português. `collection.js` valida dados; `collection-view.js` cuida da apresentação; `catalog.js` consulta e normaliza buscas e detalhes dos catálogos; `title-pages.js` cuida da busca independente e das páginas de títulos; `playlist.js` controla a fila; `media-storage.js` guarda áudios locais; `editor-ui.js` organiza os editores. `extras.js` coordena as seções e ainda comporta os editores menores e o backup. Não há dependências de produção nem etapa de build. `.prettierrc.json` define a formatação.

`server.cjs` serve somente os arquivos de `dist` e duas rotas de consulta à Steam; `server/steam.cjs` controla as consultas, timeouts e cache de 15 minutos. O servidor escuta apenas neste computador. Os endpoints públicos da loja não fazem parte da API documentada do Steamworks e podem mudar; estão isolados nesse módulo para facilitar ajustes.

## IGDB opcional

A busca de jogos tem um seletor Steam / IGDB. Steam continua funcionando sem cadastro. Para habilitar IGDB:

1. Cadastre um aplicativo no [Twitch Developer Console](https://dev.twitch.tv/console/apps), com autenticação de dois fatores habilitada, tipo de cliente Confidential e URL de redirecionamento `http://localhost:3000`.
2. Copie `.env.example` para `.env` na pasta do projeto e preencha `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`. Essas credenciais ficam apenas no servidor e não devem ser colocadas no HTML nem enviadas em mensagens.
3. Feche o servidor e abra `iniciar.cmd` novamente. Escolha IGDB na busca.

`server/igdb.cjs` cuida da autenticação, renovação de token, cache e consultas. Sem credenciais, a interface apresenta uma mensagem de configuração e não troca silenciosamente de catálogo. Referência: [documentação IGDB](https://api-docs.igdb.com/).

A busca IGDB considera mais resultados e prioriza correspondências exatas, jogos principais, remakes e remasters antes de DLCs e edições. Nomes parciais têm uma segunda consulta quando a busca normal não encontra nada. As fichas mostram artworks/key art, screenshots, vídeos selecionáveis, notas dos usuários e da crítica (IGDB), plataformas, expansões e mods vinculados ao jogo no catálogo. “Usar como capa” abre o editor com a imagem escolhida; capas por região também aparecem no seletor do editor quando disponíveis. Os novos campos entram no backup. Não existe um catálogo completo de mods fora do IGDB.

Artworks e screenshots agora oferecem “usar como banner”; “usar como capa” fica nas capas regionais. O banner preenche a largura com recorte proporcional; “restaurar banner do catálogo” retorna à imagem inicial. A escolha de banner fica neste navegador e é incluída no backup JSON do perfil. O editor de capas permite restaurar a capa original ou escolher uma capa regional sem substituí-la permanentemente. Capas regionais aparecem em miniaturas verticais.

As relações IGDB identificam jogo original/base, edições, remakes/remasters, expansões, DLCs e mods quando vinculados no catálogo. Tempo para zerar vem de `game_time_to_beats`: história principal, história com extras e 100%, com número de registros. Quando indisponível, a ficha informa a ausência; não estima tempos por conta própria. Jogos IGDB têm apenas uma seção de recomendações, identificada pelo catálogo correto.

As recomendações mostram até 12 títulos em seis colunas no desktop, reduzindo colunas em telas menores. A sinopse fica somente em Sobre, sem bloco separado de história. A troca de capa regional fica abaixo da capa principal, com opção de voltar à original; essa escolha é aplicada ao adicionar/editar a coleção e a prévia fica neste navegador. Artworks e screenshots têm um ícone discreto no canto para definir o banner, com rótulo acessível, sem repetir legendas genéricas.

Em **editar banner**, na ficha de cada título, ajuste altura (160–600 px), zoom e posição horizontal/vertical com prévia. Também é possível escolher uma imagem própria por link ou arquivo PNG/JPEG/WebP/GIF de até 8 MB (redimensionado para armazenamento local). **Restaurar original** remove a personalização. Os ajustes ficam separados por título neste navegador e entram no backup do perfil, incluindo a imagem enviada. Backups antigos continuam aceitos e mantêm as preferências de títulos existentes quando não incluem esse campo.

Conteúdo relacionado dos jogos aparece em grupos com contagem: jogo base/original, expansões, DLCs, pacotes, mods, edições, remakes, remasters, versões expandidas, ports e outros conteúdos. Grupos vazios são omitidos e os cards mostram ano quando disponível. Pacotes incluem registros do tipo Pack e relações de bundles do IGDB; não são confundidos com edições. A seção isolada “tipo de lançamento” foi removida.

As buscas musicais priorizam nomes exatos e artistas correspondentes. Artistas são agrupados apenas quando repetem o identificador do catálogo: homônimos e nomes com acentos diferentes são preservados (por exemplo, bôa e BoA). A grafia acentuada exata tem prioridade na busca. Versões com títulos diferentes (como Live ou Deluxe) e faixas de artistas diferentes são preservadas. No catálogo Deezer, popularidade desempata resultados equivalentes. Capas ausentes são buscadas também por correspondência de artista e título; fotos usam alternativas Last.fm/Deezer. Falhas de imagem mostram um marcador, sem quebrar o card.

As fichas mantêm Sobre, informações essenciais e descoberta visíveis. Fichas técnicas, galerias, personagens, requisitos e conteúdos relacionados ficam em blocos recolhíveis com controles nativos de teclado. Em telas pequenas, as fichas usam uma coluna; buscas, editores, navegação e grades se reorganizam. O novo backup inclui as preferências de títulos e vídeos vinculados por link, valida os dados antes de importar e restaura as preferências anteriores se faltar espaço. Arquivos binários locais de áudio/vídeo continuam fora do JSON.

**Descobrir** combina até seis títulos da coleção, priorizando favoritos e boas notas e variando os tipos de mídia. Cada sugestão explica qual título a originou; registros repetidos e já salvos são omitidos. Consulte e atualize pelo botão da página. Falhas de uma fonte não impedem as demais sugestões; uma atualização indisponível mantém os resultados anteriores.

**Artistas e discografia**: resultados Deezer mostram uma faixa conhecida, sem juntar artistas com IDs diferentes. Álbuns mostram ano quando o catálogo fornece a data; músicas identificam seu álbum. Na ficha do artista, use “favoritar artista” ou adicione à coleção. A discografia Deezer é carregada em páginas de 20, ordenada por ano entre os lançamentos já carregados e filtrável por álbum, EP ou single. Abra um álbum para navegar às faixas e voltar ao artista. Campos indisponíveis não são inventados.

**Backup com arquivos** baixa um pacote `.myspace` com perfil, coleção, preferências e os arquivos locais de música/vídeo atualmente vinculados. É um formato próprio, sem dependências e sem converter binários em base64. Use “importar backup” para abrir JSON ou `.myspace`. A importação pede confirmação antes de substituir os dados; grava os arquivos juntos no IndexedDB e recupera os anteriores se a gravação dos dados do perfil falhar. Limites: 200 MB por arquivo, pacote de até 2 GB e manifesto de até 50 MB, sujeitos ao espaço do navegador. Arquivos já ausentes são informados ao exportar. URLs de serviços externos continuam links; o pacote não baixa músicas/vídeos dessas plataformas.

Buscas e fichas preservam o conteúdo disponível se uma consulta falhar, mostram estado de carregamento e permitem tentar novamente. A discografia e a descoberta pessoal também mantêm os resultados anteriores durante uma atualização.

- **Links de música**: na aba Música do editor, cole um link de faixa, álbum ou playlist do Spotify, ou um vídeo/playlist do YouTube Music ou YouTube. O player oficial aparece no perfil; a disponibilidade de reprodução depende da plataforma e da conta. Links não são convertidos em arquivos de áudio. Arquivos locais continuam no player original.
- **Vídeo em destaque**: em “editar seções do perfil”, escolha “＋ vídeo” e cole um link do YouTube. A legenda é opcional. Deixar o link vazio remove o bloco; a seção também pode ser ocultada.
- **Avatar e posição do perfil**: em APARÊNCIA → Perfil, escolha avatar quadrado/redondo, borda do avatar, borda da janela e perfil na lateral ou no banner. O modo banner leva também o nome, frase e botão de edição para a capa. Essas preferências e o vídeo entram no backup.

### Players e vídeo local

Spotify usa o embed compacto e escuro. YouTube mostra primeiro uma capa com botão no estilo do perfil; o player oficial só é carregado ao clicar. A marca e os elementos internos do YouTube continuam sendo controlados pela plataforma. Vídeos MP4/WebM/OGV enviados em “editar vídeo” usam o player nativo e ficam no IndexedDB deste navegador (limite de 200 MB por arquivo; sujeito ao espaço disponível). Links diretos MP4/WebM também são aceitos. Os arquivos binários não entram no backup JSON: use o pacote com arquivos para restaurar o vídeo em outro navegador.

A consulta `/api/media/metadata` usa os serviços oEmbed públicos de Spotify e YouTube, sem chave. Preenche título e capa; no YouTube, o campo artista vem do nome do canal e pode ser ajustado. Spotify não fornece artista no oEmbed. Dados manuais são preservados. Faixas antigas sem título são atualizadas ao selecioná-las. Reinicie `iniciar.cmd` após esta atualização para ativar a rota de metadados.

- **Ordem das seções**: em “editar seções do perfil”, use ↑/↓ para reorganizar a coluna principal e a lateral. A janela do perfil pode mudar de lugar na lateral; o modo banner continua em Aparência. Blocos livres são movidos como uma seção. Seções ocultas conservam sua posição, e a ordem entra no backup.
- **Favoritos no perfil**: a antiga Coleção em destaque agora se chama Favoritos. Marque “☆ favoritar” na coleção e escolha Todos, Jogos, Animes, Mangás ou outro tipo no filtro da vitrine. O filtro fica salvo e entra no backup. Favoritos antigos foram mantidos. As capas têm altura consistente, sem cortar a imagem.

- **Largura e cantos**: em APARÊNCIA → Estilo, escolha Original, Amplo ou Expandido (tela toda). O arredondamento dos blocos e banner pode variar de 0 a 24 px. As preferências ficam salvas e entram no backup. O filtro dos favoritos acompanha as cores do tema.

### Fichas completas de títulos

Jogos Steam usam `about_the_game` / `detailed_description`, com alternativa pelo resumo curto. A página também mostra Metacritic quando fornecido, idiomas, avisos de DRM de terceiros, imagens, DLCs, edições/pacotes, recursos e requisitos de PC. Os avisos de DRM e sugestões “mais como este” vêm opcionalmente da página pública da Steam; ausência do aviso não prova que o jogo seja livre de DRM. Nomes de DLCs e relacionados são carregados pelo botão da seção; dados podem variar por edição e região.

Anime e mangá: sinopse, nota AniList, status, formato, datas, estúdio quando disponível, duração/volumes, nomes alternativos e obras relacionadas com links próprios. Séries: nota TVmaze, idioma, emissora, datas e duração. Livros: descrição completa, publicação e assuntos disponíveis. Wikipedia agora fornece a descrição além da introdução, para filmes e outros títulos; esses registros não têm uma nota inventada. Quando há gêneros em comum, aparecem também sugestões da sua coleção. Dados não fornecidos pelo catálogo não são inventados. Reinicie o servidor após atualizar para ativar os novos campos Steam.

- **Descobertas e personagens**: fichas AniList mostram personagens com imagem, papel e link, além de recomendações da comunidade que ainda não estão na coleção. Recomendações são distintas das relações da franquia. Outras fichas mantêm sugestões disponíveis e a ação de explorar o catálogo.
- **Banner do título**: usa a imagem de banner AniList ou a imagem horizontal Steam, quando disponível. Não estica capas verticais para criar um banner.
- **Tradução do sobre**: traduz o texto original do catálogo pelo MyMemory, com escolha de idioma de origem e botão para restaurar o original. Não consulta artigos da Wikipedia para substituir a descrição. A tradução é acionada pelo usuário e pode estar indisponível por limite de uso.

### Música, álbuns e descobertas

Coleção e busca agora incluem Músicas e Álbuns. O catálogo iTunes fornece título, artista, capa, lançamento e faixas de álbuns, além de prévia quando disponível. É uma coleção pessoal com notas, status e favoritos; a playlist do perfil continua separada. Cadastros manuais e capas próprias continuam funcionando.

Nas páginas de livros, “carregar recomendações” busca obras do mesmo assunto na Open Library. Jogos usam sugestões da Steam, com alternativa por tag/gênero da loja; IGDB usa jogos similares fornecidos pelo catálogo. Títulos já salvos são omitidos. Disponibilidade depende do catálogo.

O botão de tradução mantém o texto do catálogo e envia trechos ao serviço público MyMemory, sem criar chave ou conta. Escolha o idioma original e use “traduzir para português”. Erros ou limites do serviço mantêm a descrição original. Não existe mais substituição por artigos da Wikipedia. Reinicie o servidor para ativar as rotas de música, recomendações Steam e tradução.

- **Catálogo musical principal**: busca artistas, músicas e álbuns na Deezer, com IDs próprios, fotos, capas e prévias. Last.fm complementa biografias/descrições e recomendações de faixas e artistas similares. Se a Deezer não responder ou não encontrar resultados, usa Last.fm e depois iTunes para músicas/álbuns. Registros antigos Last.fm, iTunes e MusicBrainz continuam acessíveis. A playlist do perfil permanece separada da coleção.
- **Homônimos**: artistas distintos podem compartilhar um nome. Resultados repetidos pelo mesmo ID são eliminados; o número de fãs aparece quando a Deezer fornece esse dado. Não juntamos artistas diferentes só porque o nome é igual. O catálogo Deezer não exige nova chave para estas consultas públicas.
- **Configuração Last.fm**: preencha `LASTFM_API_KEY` no arquivo `.env` da pasta do projeto e reinicie `iniciar.cmd`. Não precisa do Shared Secret nem de autorização da conta para estas consultas públicas. A chave é usada somente pelo servidor local; o arquivo não é servido pelo site. Sem chave Last.fm, a busca Deezer continua disponível; as alternativas para músicas/álbuns incluem iTunes.
- **Descobertas musicais**: nas fichas de músicas, carregue faixas similares do Last.fm. Nas fichas de álbuns, carregue álbuns populares de artistas similares. São sugestões do catálogo, não recomendações personalizadas pelo histórico do usuário. Descrições, faixas e estatísticas aparecem quando disponíveis; o servidor mantém cache e espaça consultas.
- **Artistas**: selecione Artistas na busca ou use “ver artista” na ficha de uma música/álbum. A página mostra biografia, ouvintes, reproduções, músicas e álbuns populares e artistas similares. São dados públicos Last.fm; não há comparação entre contas de amigos.
- **Imagens musicais**: resultados e recomendações completam capas ausentes pelo iTunes e pelos detalhes Last.fm. Fotos de artistas ausentes na API são consultadas na página pública Last.fm, com cache; artistas sem foto continuam navegáveis. Essa consulta depende do formato da página pública. Cards de músicas, álbuns e artistas usam moldura quadrada e preservam a imagem inteira.
- **Alternativa para fotos**: quando a página Last.fm não fornece uma imagem válida, consulta artistas na Deezer e aceita somente correspondência exata do nome. Imagens genéricas conhecidas do Last.fm são descartadas. Sem foto nas duas fontes, permanece o placeholder.
- **Vídeo completo da faixa**: na ficha de uma música, use “buscar no YouTube” e vincule o link do vídeo desejado. O player oficial carrega somente ao clicar em reproduzir. O Last.fm não fornece um campo de vídeo confiável na API; não associamos automaticamente vídeos encontrados por nome. A associação fica neste navegador, separada da playlist, e entra no backup JSON e no pacote com arquivos.



# Acompanhamento pessoal e descoberta

- A coleção oferece atalhos por status e favoritos, média das notas pessoais e progresso médio dos títulos em andamento que têm um total conhecido. Os atalhos aplicam os filtros à própria coleção.
- O editor aceita datas opcionais de início e conclusão e notas de até 2.000 caracteres. A conclusão rápida preenche a data de hoje se ainda estiver vazia. Datas, nota e comentários aparecem na ficha; quebras de linha das notas são preservadas. Esses campos acompanham os backups existentes.
- Em **Buscar** e no editor, artistas podem ser encontrados por uma música conhecida e livros por autor. Jogos podem ser filtrados por plataforma informada pelo catálogo; itens sem essa informação não entram no filtro. A filtragem consulta detalhes dos resultados disponíveis, sem prometer abranger todo o catálogo.
- **Descobrir** filtra as sugestões por mídia e permite marcar “não tenho interesse”. A preferência fica neste navegador; “rever sugestões descartadas” limpa esses descartes. Ela não altera os favoritos nem os catálogos.
- O aviso **desfazer** guarda até 15 passos de coleção, favoritos, perfil, capas, banners e descartes. Ao desfazer, a página recarrega e os passos restantes continuam disponíveis na mesma aba. O histórico de desfazer usa até 2 MB de armazenamento da sessão, reduzindo o número de passos para imagens grandes; se uma única alteração exceder esse limite, ela só pode ser desfeita na página atual. Importar backup, alterar vídeo local ou remover/substituir um arquivo de áudio limpa esses passos, pois arquivos binários não entram nesse histórico.
- Os controles de busca, filtros, ações e notas receberam ajustes para telas pequenas. Verificação funcional feita em DOM simulado e revisão visual posterior em navegador, em telas pequenas e grandes; detalhes em tests/visual-review.md.

### Organização e manutenção

A interface usa uma camada comum em `dist/interface.css` para controles, navegação e hierarquia visual. A coleção exibe busca, status e visualização; ordenação, favoritos e filtros adicionais ficam no botão **filtros**, com indicação de quantos estão ativos. **Selecionar títulos** abre a edição em lote com um menu de ação e um único botão de aplicar. As métricas extras estão em **meu acompanhamento** e o histórico permanece recolhido. Botões, campos, foco de teclado e avisos seguem as cores do perfil.

O tema claro **papel** está em **Personalizar → Imagens e tema**: fundo creme, tinta escura e detalhes terrosos. Os temas existentes e as cores personalizadas continuam disponíveis; cores individuais configuradas em Aparência têm prioridade sobre o tema. A revisão visual em navegador foi realizada em telas pequenas e grandes; os cenários e limites estão em tests/visual-review.md.

- **Editar em lote** na coleção permite selecionar títulos visíveis (ou escolher cada um), alterar status, favoritar/desfavoritar e adicionar/remover uma lista pessoal. As seleções permanecem mesmo ao filtrar: o contador informa quantos títulos receberão a alteração. As mudanças são validadas antes de uma única gravação, respeitando os oito favoritos. Concluir em lote também preenche progresso e data quando disponíveis.
- **Listas pessoais** são nomes separados por vírgula no editor; cada item pode pertencer a até 20 listas. Os filtros de lista, gênero, plataforma e ano usam os dados existentes na coleção. Não precisam de uma nova consulta ao catálogo. Listas sem itens deixam de aparecer no filtro.
- **Histórico de acompanhamento** registra as últimas 100 inclusões, exclusões e mudanças de status, nota, progresso, datas, comentários e listas. Mostra os valores anteriores e posteriores para status, nota e progresso. Esse histórico é exportado junto da coleção; importar não cria registros artificiais de todas as diferenças.
- **Descobrir** intercala recomendações de diferentes títulos da coleção e alterna a ordem das fontes a cada atualização. Ao filtrar uma mídia, consulta até seis títulos daquele tipo, incluindo diferentes jogos, artistas, músicas, animes e outras obras. Indica o título de origem, o catálogo e gêneros em comum quando informados. A variedade depende das respostas dos catálogos; não são inventadas sugestões para preencher espaços.
- **Carregamento** reutiliza detalhes por até 15 minutos, inclusive entre recarregamentos da mesma aba (cache de até 1 MB). A atualização forçada ignora esse cache. Recomendações têm cache de cinco minutos. As imagens de screenshots e artworks recolhidos só recebem endereço quando sua seção é aberta; trailers continuam dependendo de um clique para reproduzir.
- **Estado do backup**, no rodapé, mostra quando a exportação foi solicitada e se era JSON ou pacote com arquivos. O navegador não confirma que o arquivo foi guardado no disco. “Verificar arquivos locais” mostra quantidade, tamanho e nomes dos arquivos vinculados que já não estão no armazenamento do navegador.


### Leitura e navegação

Os cards da coleção mostram capa, título e status. Concluir, favoritar, consultar nota, progresso, datas e listas ficam na ficha do título. Livros usam “sinopse” e artistas usam “biografia”; a tradução fica em um controle recolhível. A posição de leitura é lembrada por página nesta sessão (até 30 páginas), e voltar para a coleção mantém os filtros montados. `interface.css` concentra os controles comuns e as regras de acompanhamento e descoberta.

### Descoberta e personalização da coleção

- Descrições longas têm “ler mais”, sem cortar o conteúdo salvo ou traduzido.
- Imagens da Steam e do IGDB abrem uma galeria com anterior/próxima (também pelas setas do teclado), seleção de banner e indicação da imagem escolhida. Escape fecha a galeria.
- “Ordenar favoritos” mostra setas para trocar a ordem no perfil. A ordem é salva junto dos itens e vai no backup.
- “Listas pessoais” na coleção abre pequenas prateleiras; selecionar uma aplica seu filtro. Criar e editar listas continua no editor e nas ações em lote.
- A busca musical distingue álbuns diferentes e versões, e mostra artista, álbum, ano e indicação de letra explícita quando o catálogo fornece esses dados. Datas ausentes são buscadas no álbum, com cache e até três consultas simultâneas.
- Para revisão visual isolada: execute `node tests/visual-preview.cjs`, abra `localhost:3001` e importe `tests/visual-fixture.json`. As capas desse arquivo são imagens ilustrativas repetidas; ele serve para revisar layout, não informações de catálogo.

- **Filtros visíveis**: filtros ativos aparecem como etiquetas removíveis mesmo com o painel recolhido. Quando não há resultados, o atalho de limpar filtros permite recuperar a coleção. A edição em lote informa quando falta escolher o status ou escrever o nome da lista e direciona o foco ao campo.

- **Prateleira da coleção**: a estante em grade voltou a ser o padrão, com a base dos cards alinhada e as imagens inteiras. Em filtros, “separar por mídia” organiza pequenas prateleiras por tipo e salva a preferência neste navegador. O modo lista continua disponível. Fichas, favoritos, recomendações e prévias de capas não adicionam molduras à imagem.

