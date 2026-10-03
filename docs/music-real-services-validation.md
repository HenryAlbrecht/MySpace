# Validação musical com serviços reais — 2026-10-02

Dois contextos Edge headless, sequenciais e descartáveis. Servidor frontend real criado em porta local temporária, .env existente e Node com --use-system-ca. Nenhuma resposta de catálogo ou áudio foi simulada. Nenhum dado da coleção pessoal foi alterado. Sem alterações de implementação nesta validação.

## Resultados

- Wonderwall/Oasis: primeiro resultado correto, 1.345 ms. Descrição Last.fm disponível.
- Oops!…I Did It Again/Britney Spears: primeiro resultado correto, 531 ms. Sem descrição Last.fm; consulta adicional com pontuação ASCII também sem texto.
- Duvet/bôa: primeiro resultado correto, 775 ms. Descrição Last.fm disponível.
- Artistas Oasis: 1.517 ms; Lily Chou-Chou: 1.482 ms. Ambos com URL de foto Deezer de 1000 px; Apple retornou homônimos com IDs diferentes. A biografia de Lily Chou-Chou está disponível.
- Álbum Morning Glory: 574 ms, resultados Oasis. Recomendações: 14 músicas em 5.447 ms, 9 artistas em 4.098 ms e zero álbuns em 3.148 ms.
- Link automático Wonderwall: MusicBrainz retornou zero sugestões em 4.563 ms; não houve falha HTTP.
- Coleção: adicionar duas vezes preservou uma entidade Apple. Capa salva igual à capa aberta, imagem efetivamente carregada; persistência após reload confirmada.
- Reprodução: prévia real Apple tocou. Em um segundo contexto, URLs de duas prévias reais foram vinculadas manualmente somente nos dados descartáveis do teste para exercitar fila/controles. Perfil, compacto, pausa/retomada, fechar/reabrir sem interromper e volta ao perfil passaram. Seek próximo ao final provocou evento ended real e avanço para a próxima faixa.
- Zero pageerrors e zero mensagens console.error nos dois contextos.

## Pontos encontrados

A resolução de recomendações de álbuns merece revisão. Last.fm trouxe 24 sugestões. Consultas Apple adicionais encontraram resultados correspondentes para alguns títulos, nenhum para outros, e houve uma indisponibilidade temporária da Apple. O resolver atualmente captura e ignora cada falha de consulta, podendo retornar lista vazia sem indicar serviço indisponível. Não foi estabelecida uma causa única para os zero álbuns da primeira execução.

Homônimos de artistas recebem fotos por correspondência de nome; isso não comprova que cada homônimo recebeu a foto correta. Não deduplicar cegamente por nome.

## Limitações e evidências

Não foi validado playback YouTube real nem seu avanço automático, pois a consulta MusicBrainz de Wonderwall não retornou link. A fila foi validada com áudio de prévias Apple, não com faixas completas. Headless confirma download/playback e eventos, não qualidade auditiva humana. Tempos são amostras desta execução, não benchmark.

Relatórios: artifacts/music-real-services/report.json, controls.json e diagnostic.json. Screenshots: detail.png e player.png. Scripts: tests/music-real-services-browser.cjs, tests/music-real-controls-browser.cjs e tests/music-real-recommendation-diagnostic.cjs. Não executar esses testes continuamente: dependem de disponibilidade e limites dos serviços externos.
