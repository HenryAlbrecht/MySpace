# Revisão visual — 27/09/2026

Verificação no navegador do Codex usando localhost:3001 e uma coleção de teste separada do perfil principal.

- Viewports de 390 × 900 e 1440 × 900; largura útil de 375 e 1425 pixels com a barra de rolagem. Nenhuma das dez fichas ultrapassou a largura útil.
- Perfil, favoritos com ordenação e coleção com listas pessoais conferidos no tema Papel.
- Editores de perfil, coleção e banner conferidos no celular.
- Busca real por Duvet retornou bôa, Twilight e ano da edição informado pela Deezer. Outros resultados mostram artista, álbum e indicação de letra explícita.
- Ficha real de Persona 3 Reload na Steam: descrição recolhível e galeria com dez screenshots. Ampliar, avançar e selecionar banner funcionaram; a galeria foi conferida em tela grande e pequena.
- Corrigidos durante a revisão: captura de rolagem durante mudança de página, cabeçalho excessivamente alto no celular, proporção da prévia de capas musicais, largura da galeria e estilo do seletor de arquivos.

As imagens repetidas do arquivo visual-fixture.json são ilustrativas. A verificação de largura das dez categorias usa esses dados locais; ela não representa validação de todas as respostas de APIs ou de todos os navegadores.

### Revisão de capas e coleção — 27/09/2026

Fichas das dez mídias e favoritos: borda calculada 0px e altura da imagem igual à do contêiner. Prévia do editor também sem diferença de altura. Busca real Duvet no Deezer e ficha com capa quadrada revisadas. O mosaico chegou a ser avaliado, mas a grade tradicional foi restaurada por preferência do usuário. A organização por mídia mantém os dez itens e não gerou rolagem horizontal durante a revisão anterior. Agrupamento é opcional para evitar prateleiras vazias em coleções pequenas. Cenários de fichas usam o arquivo ilustrativo existente; esta rodada não valida o conteúdo de todas as APIs externas.

