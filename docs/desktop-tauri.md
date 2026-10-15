# MySpace Desktop — PoC Tauri 2

## Direção

Desktop com HTML/CSS/JavaScript vanilla e WebView2, sem servidor HTTP Node
obrigatório nem runtime Node empacotado. Providers e lógica musical continuam
em JS quando viável; plugins e comandos Rust cobrem necessidades nativas.
Executáveis auxiliares como yt-dlp/FFmpeg exigem avaliação própria: sua presença
não implica manter o servidor Node. PARTY remoto usa sinalização na internet.

## Estado desta PoC

- `src-tauri/` contém o host Tauri 2 e o plugin oficial de diálogo.
- `frontendDist` aponta diretamente para `dist/`; sem bundler, devUrl Node,
  beforeDevCommand ou externalBin.
- Janela local `main`; permissões somente para ler a versão e abrir o seletor.
  Nenhuma capability para conteúdo remoto ou execução de shell.
- O diagnóstico nativo abre na entrada. Ctrl+Shift+D reabre. Selecionar um arquivo
  comprova a ponte nativa, sem executar nem cadastrar o arquivo escolhido.
- O browser continua usando `server.cjs`; o diagnóstico não monta fora do Tauri.
- A interface, XMB/Vita, SPACEAMP, Collection e seus owners são os mesmos.

**Build e boot nativos validados em 15/10/2026:** Rust/Cargo 1.99.1, MSVC
14.51.36231 e Windows SDK 10.0.26100.0. Binário de diagnóstico em
`src-tauri/target/debug/myspace-desktop.exe`, com assets embutidos.
WebView2 carregou os 72 scripts locais; versão nativa, fechar/reabrir diagnóstico
e localStorage após reload passaram. O teste não iniciou servidor Node.
Seletor nativo interativo, persistência entre sessões, pacote .myspace, controle
físico e playback ainda exigem aceite próprio.

Primeiro build: falha de rede do sandbox ao acessar crates.io. Segundo build:
dependências compiladas, mas faltava `icons/icon.ico` para o recurso Windows.
Foi adicionado um ícone mínimo da PoC; o terceiro build passou offline e locked.
Evidências: `artifacts/desktop-tauri/build-sandbox-network-error.log`,
`build-missing-icon.log`, `build.log` e `native-smoke.log` no mesmo diretório.
O Cargo.lock gerado fixa 421 pacotes externos, todos com origem crates.io.

## Ambiente e execução

Windows: Rust stable MSVC (mínimo 1.90 para o plugin atual), Visual Studio Build
Tools com C++ e Windows SDK e WebView2 Runtime. Tauri CLI 2 é opcional para
o build direto usado nesta PoC; nenhuma ferramenta foi instalada nesta validação.

Com o ambiente instalado, na raiz:

```powershell
$env:PATH = "$env:USERPROFILE/.cargo/bin;$env:PATH"
cargo build --locked --offline --manifest-path src-tauri/Cargo.toml --features custom-protocol
& ./src-tauri/target/debug/myspace-desktop.exe
```

Tauri CLI pode servir assets durante desenvolvimento por seu próprio mecanismo;
o release usa assets embutidos e protocolo do WebView, sem servidor HTTP local.
O modo offline requer as dependências já baixadas; na primeira compilação,
omitir `--offline`. Manter `src-tauri/Cargo.lock` no versionamento.
Instalador, ícone definitivo, assinatura e atualização ficam para depois.

## Armazenamento e migração

localStorage e IndexedDB são isolados por origem/perfil. O Desktop não consegue
ler o storage de localhost no Zen/Edge por trocar a janela. Não apontar o WebView
para o perfil do navegador nem copiar arquivos internos de IndexedDB.

Transferência suportada: exportar **pacote .myspace** no browser e importar no
Desktop pelo fluxo existente, que mantém owners, validação e rollback. JSON
sozinho não transfere os blobs de artwork/áudio/vídeo. O identificador desta PoC
é separado (`local.myspace.desktop.poc`); decidir o identificador final antes de
tratar seu armazenamento como definitivo. Não há migração automática nesta etapa.

## Dependências a migrar

| Domínio | Dependência atual | Direção a investigar |
|---|---|---|
| Busca/detalhes musicais | `/api/music/*`, backend YouTube Music | Transport nativo/JS sem trocar identidade, parser ou cache owner |
| Artwork remota | `/api/music/artwork` | Transporte/cache de imagens com limites e CORS tratados explicitamente |
| Jogos | `/api/steam/*`, `/api/igdb/*`, `/api/xmb/game-art` | Plugins HTTP/comandos; credenciais fora do bundle web |
| Enrichment/tradução/metadata | APIs de recomendações, tradução e mídia | Migrar por domínio preservando CORE/FULL e cancelamento |
| Downloads | `/api/xmb/media-download*` + yt-dlp/FFmpeg | Processo nativo, progresso e cancelamento; avaliar binários auxiliares |
| Lyrics | Proxy/backend e repositório local | Preservar privacidade, IndexedDB e isolamento do am-lyrics |
| PARTY | Signaling WS local/configurado | Endpoint WSS remoto; manter separação ROOM/CALL |
| Launcher | Atualmente abre ficha de jogo | Cadastro via CollectionActions e comando nativo restrito; ainda fora desta PoC |

As APIs acima não foram migradas: ações que dependem delas ainda não funcionam
no Desktop sem backend. Não existe fallback escondido para localhost nem mock
de provider no produto. Esta etapa não deve ser apresentada como desktop completo.

## Aceite nativo pendente

1. Build e abertura sem `server.cjs`/`iniciar.cmd`: concluídos.
2. Confirmar seletor nativo e cancelamento manualmente. A inspeção de filhos
   diretos da instância testada não encontrou Node; o Node usado pelo harness
   de automação é externo ao aplicativo e não é empacotado.
3. Importar uma cópia do pacote .myspace; comparar coleção, preferências e mídias.
4. Fechar/reabrir e confirmar persistência; repetir exportação/importação.
5. Exercitar XMB/Vita, controle, fullscreen, áudio local, sons e fundos em vídeo.
6. Registrar limitações de WebView2/CSP/YouTube e providers antes de migrá-los.

Referências oficiais: [configuração](https://v2.tauri.app/reference/config/),
[diálogo](https://v2.tauri.app/plugin/dialog/),
[pré-requisitos](https://v2.tauri.app/start/prerequisites/).
