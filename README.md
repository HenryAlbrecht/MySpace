# MySpace pessoal

Um espaço pessoal com estética retrô/Y2K, coleção de mídias, descoberta musical, SPACEAMP e salas PARTY. HTML, CSS e JavaScript puro, com serviços locais Node/CommonJS; sem build ou framework.

## Iniciar

Dê dois cliques em **iniciar.cmd** (launcher.bat). O launcher inicia signaling na porta 8787 e frontend em **http://localhost:3000**, abre o navegador e encerra os dois servidores com Ctrl+C. Se uma porta estiver ocupada, confirme o encerramento somente se reconhecer o processo informado.

Usa Node.js do sistema ou o runtime portátil disponível em %USERPROFILE%, sem chamar npm ou alterar PATH. Em outra máquina, disponibilize Node.js 22+ com suporte a --use-system-ca e a dependência local server/node_modules/ws. Configurações opcionais ficam em .env, conforme .env.example.

Pelo terminal, `node server.cjs` inicia o frontend. PARTY também precisa do servidor de signaling; o launcher é o caminho completo. Os serviços escutam localmente.

Se já usava dist/index.html diretamente, exporte seu backup naquele endereço e importe no site local. Os armazenamentos são separados por origem.

## Recursos

- Perfil com avatar, banner, fotos, blocos, favoritos e aparência configurável.
- Collection com capas, lista, filtros, acompanhamento e apresentação XMB fullscreen.
- Busca por jogos, anime/mangá, livros, filmes/séries, músicas, álbuns e artistas.
- YouTube Music como catálogo e identidade musical; Last.fm para editorial, tags e discovery; Apple somente para compatibilidade legacy.
- SPACEAMP compartilhado entre perfil/compacto, playlist, áudio local e YouTube vinculado.
- PARTY com salas, presença, chat e chamadas WebRTC; ROOM e CALL têm ciclos separados.
- Backup JSON e pacote .myspace com arquivos locais, validação e rollback.

Dados pessoais ficam neste navegador. JSON não inclui os bytes de áudio/vídeo; use o pacote com arquivos. Consultas de catálogo precisam de internet, e reprodução/captura dependem das permissões do navegador e da disponibilidade da fonte.

## Código e documentação

A ordem de scripts clássicos está em dist/index.html. dist/ contém o código editável servido, server/ contém providers e signaling, tests/ contém testes e docs/ descreve os fluxos. Fachadas públicas existentes e um único SPACEAMP são preservados. .prettierrc.json define o estilo; não há tooling de build novo.

- [Arquitetura atual](docs/architecture.md) e [onde alterar cada responsabilidade](docs/module-map.md).
- [Categorias e comandos de testes](tests/README.md).
- [Catálogo musical canônico](docs/music/architecture.md) e [contratos](docs/contracts.md).
- [Backup e restauração](docs/backup-restoration.md).
- [Protocolo e limites de voz](dist/voice/README.md), [ICE/TURN](server/coturn/README.md).
- [Referência detalhada e histórico do README anterior](docs/history/project-reference.md), incluindo configuração opcional IGDB.
- [Relatório do organization pass](docs/history/organization-pass-2026-10-03.md).

artifacts/ guarda saídas locais de testes (screenshots, mídia de fixture e diagnósticos), ignoradas pelo Git. docs/ contém documentação vigente; relatórios e etapas concluídas ficam no [histórico](docs/history/README.md).
