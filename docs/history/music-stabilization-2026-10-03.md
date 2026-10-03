> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Estabilização de busca e descoberta musical

## Comportamento

- Apple continua sendo a única identidade de catálogo. Last.fm fornece recomendações e texto; Deezer fornece somente imagens opcionais.
- Busca parcial sem correspondências relevantes tenta uma única consulta Apple mais ampla, com no máximo 200 candidatos. Apenas candidatos compatíveis com o prefixo ou uma diferença de um caractere entram no resultado adicional. Isso melhora casos incompletos, mas não constitui correção universal de qualquer erro de digitação.
- Quando a busca por música/álbum encontra o título, músicas de um artista homônimo não ocupam o resultado através da expansão auxiliar. Buscar um artista ainda permite descobrir suas músicas e álbuns.
- Resultados de artistas com o mesmo nome ficam em grupos expansíveis nas duas interfaces de busca. IDs Apple distintos permanecem selecionáveis; nomes não são fundidos na coleção.
- Fotos ambíguas não são escolhidas pelo número de fãs. Na busca, homônimos Apple não recebem uma foto compartilhada por suposição. Fotos indisponíveis/ambíguas também usam cache negativo.
- Recomendações resolvem seis candidatos no primeiro lote, depois lotes de seis. A página apresenta os cards antes de preencher a grade de até 12. Edições são preservadas; itens já salvos continuam sendo omitidos.
- A página Descobrir apresenta resultados após cada origem consultada. Navegar para fora impede novos lotes/origens; uma consulta compartilhada já em andamento termina normalmente, sem abortar outros consumidores.
- Cache de busca tem validade de cinco minutos e não armazena resultados vazios. As duas telas compartilham limite de espera de 20 segundos.
- Entrada de cards com movimento lateral/escala XMB, destaque discreto de carregamento, grupos expansíveis responsivos e respeito a movimento reduzido. Cards existentes são mantidos ao acrescentar sugestões na página do título.

## Verificação

- 28 testes determinísticos passaram, incluindo busca parcial, identidade, foto ambígua, resolução exata de sugestões, recuperação de falhas e eventos do player.
- Teste de descoberta personalizada passou, incluindo entrega parcial e interrupção de novas origens.
- Navegador local: busca de músicas/álbuns/artistas com falha auxiliar, preenchimento de 12 recomendações, preservação de edição e exclusão de item salvo; nenhum erro de JavaScript. Screenshot: `artifacts/project-audit/progressive-discovery.png`.
- Consultas reais: `frost chil` encontra Frost Children; `wonderwall` prioriza Oasis e títulos correspondentes. Diagnóstico: `artifacts/project-audit/diagnostic.json`.
- Primeiro lote real de WHAT IS FOREVER FOR: 4.967 ms, cinco itens de seis candidatos, sem falhas. A auditoria anterior levou 24.744 ms para 24 candidatos. Comparação indica menor espera até o primeiro lote, não redução equivalente do custo total nem garantia de latência.
- 68 scripts passaram na verificação de sintaxe.

Não foi feita uma migração de stack nesta entrega. TypeScript/ES modules/Vite continua sendo uma evolução gradual proposta; player, WebRTC e armazenamento não foram reescritos. Testes antigos que ainda esperam catálogo Deezer ou fotos Last.fm não representam a arquitetura atual e precisam de migração separada.
