# Continuidade das recomendações na primeira abertura

A conclusão tardia dos detalhes, incluindo o texto do Last.fm, reconstruía a página e descartava a seção de recomendações já aberta. Isso produzia uma aparência de recarregamento.

A atualização conserva a seção de recomendações do mesmo título, seus cards, imagens e requisição em andamento. Após interação com a seção, sua posição na janela é preservada quando os detalhes chegam, sem devolver o foco ao título nem restaurar uma posição antiga de navegação.

Validação: teste de navegador com detalhes deliberadamente atrasados, recomendações carregadas antes da descrição, identidade dos elementos e posição visual preservadas. Nenhuma alteração no scroll ou vendor das lyrics.
