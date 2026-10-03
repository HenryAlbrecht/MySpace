> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# SPACEAMP: término YouTube e capa

O callback ENDED da IFrame API agora chama o mesmo controlador da fila. Antes, ele só atualizava o estado parado; apenas o elemento audio avançava a playlist. Eventos repetidos de término, erros, stop e callbacks de players antigos não avançam a fila. Um pedido de play anterior a onReady é aplicado quando a API confirma que o player está pronto. A opção de repetição atual é respeitada.

O botão usar capa / mostrar vídeo fica na titlebar tanto no perfil quanto no compacto. A preferência é persistida em spaceamp-youtube-cover-v1. Usa a artwork da faixa (capa da coleção quando disponível; thumbnail YouTube como fallback). A alternância só oculta a superfície visual via CSS, sem recriar o iframe nem reiniciar o áudio.

Limitação: a opção de iframe oculto foi solicitada explicitamente pelo usuário, mas contraria a política da API YouTube sobre reprodução por player não exibido. Referência: https://developers.google.com/youtube/terms/developer-policies (III.I.9). Não extrai nem separa o áudio do vídeo.

Validação: seis testes unitários focados; Edge headless, um contexto, IFrame API simulada. Confirmados avanço para a próxima faixa, capa no perfil/compacto, preservação do iframe e playback na alternância e zero pageerrors. O teste não confirma disponibilidade dos vídeos reais nem permissões de autoplay do YouTube; bloqueio do navegador ainda pode exigir interação do usuário.
