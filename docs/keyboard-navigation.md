# Navegação por teclado

Nas capas da coleção, resultados de busca e grids de recomendações, Tab coloca o foco em um card; setas seguem a posição visual dos cards, sem voltar ao início quando chegam à borda. Enter usa a ação nativa do botão. Grupos de mídia navegam separadamente. A lista e o modo XMB mantêm seus handlers existentes.

Os campos de texto não são interceptados. Dialogs usam Escape e contenção de foco nativos; ao fechar, o foco retorna ao controle de abertura se ele ainda existir e não houver outro dialog aberto. O destaque de foco usa o accent atual e respeita reduced motion.

Teste: `tests/keyboard-navigation-browser.cjs`, um contexto Edge headless. Valida setas nas capas e recomendações, Enter, caret em campo de texto, Escape/retorno de foco e ausência de pageerrors. Provedores musicais simulados.
