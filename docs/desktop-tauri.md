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

## Revisão da ponte nativa V1

Esta revisão descreve o escopo original; Folder Picker V1 abaixo acrescenta
referências de pastas e uma consulta restrita de metadata.

A PoC já atende à ponte mínima desta etapa. `dist/desktop/desktop-poc.js`
detecta `window.__TAURI__?.core?.invoke` antes de acessar o DOM do diagnóstico;
sem essa API, retorna sem montar UI ou acessar storage. O global é habilitado
por `withGlobalTauri` na configuração do host.

O único consumidor atual é o diagnóstico: consulta `plugin:app|version` e chama
`plugin:dialog|open` com seleção explícita de um arquivo, sem diretórios ou
múltipla seleção. Cancelamento retorna `null`; erro aparece no status; o botão
é reabilitado em ambos os casos. O caminho selecionado é exibido como texto,
sem leitura, execução, cadastro ou persistência. O Rust registra o plugin
oficial existente, sem comandos próprios adicionais.

Não foi criada outra fachada/global nem outro módulo: ainda não existem
operações usadas por múltiplos consumidores. Quando um fluxo real precisar
compartilhar a seleção, extrair somente essa operação e a detecção para o
mesmo domínio desktop, fazendo o diagnóstico consumir a implementação única.
Não expor um dispatcher genérico de comandos nativos.

Permissões mantidas na janela `main`: `core:app:allow-version` e
`dialog:allow-open`, sem acesso remoto, filesystem ou shell. Selecionar caminho
não concede leitura arbitrária de arquivos. Nenhum scanner, menu, alteração
no XMB ou pasta persistida participa desta etapa.

Validação focada: `node --test tests/project/desktop-poc.test.cjs` cobre web sem
Tauri/API parcial, seleção, cancelamento, falha, nova tentativa e escopo da
configuração. A bridge é simulada nesses testes; o boot nativo validado acima
não substitui o aceite manual do diálogo do Windows.

Próximo passo recomendado: definir um primeiro fluxo real de seleção e seu
contrato de leitura/ação antes de ampliar a ponte ou suas permissões.

## Folder Picker V1

A mesma janela desktop (Ctrl+Shift+D) permite adicionar múltiplas pastas de
Músicas ou Jogos, listar caminhos e remover somente referências. Usa o mesmo
`plugin:dialog|open`, agora com `directory: true` e `multiple: true`.
`DesktopFolders` possui persistência em localStorage (`myspace-desktop-folders-v1`,
schema version 1), reutilizando o armazenamento da origem WebView2, separado do
browser. A view não grava preferências. Essas referências da máquina não entram
no pacote .myspace ou na Collection.

Duplicatas dentro de cada categoria ignoram caixa, separador e barra final.
A mesma pasta pode servir a ambas as categorias. Links simbólicos/junctions e
aliases de caminho não são resolvidos. Cancelamento não grava; falhas de gravação
preservam o estado anterior; dados salvos ilegíveis bloqueiam mutações para não
sobrescrevê-los silenciosamente.

`check_folders` consulta somente metadata de até 100 caminhos absolutos por
chamada, em tarefa bloqueante separada; não enumera diretórios nem lê conteúdo.
Permissão `allow-check-folders` exclusiva da janela local `main`, sem plugin FS
ou shell. Estados: disponível, indisponível, sem acesso ou não é uma pasta.
Falha de IPC exibe não verificada. Referências indisponíveis são conservadas;
há botão para verificar novamente. Não há monitoramento ou scanner.

Validação: cinco testes focados (owner e PoC) passaram. Build Rust locked/offline
passou, com aviso de cache incremental sem hard links (Cargo copiou os arquivos).
Smoke no WebView2 passou com seleção simulada, consulta Rust real de diretório
existente/inexistente, deduplicação, reload e remoção de referências. O harness
usou somente metadata de pastas; não modificou seus conteúdos. Restaurou o ambiente,
encerrou os nove processos rastreados da instância e confirmou a porta 19347
liberada, sem processos de teste remanescentes. Log: `artifacts/desktop-tauri/folders-native-smoke.log`.

A suite quick encontrou falhas em `tests/xmb/xmb.test.cjs`, sem alterações nesse
domínio; saída em `artifacts/desktop-tauri/folders-quick.log`. O primeiro smoke
expirou por simulação incorreta do seletor; o segundo passou após corrigir o
harness, com cleanup validado nas duas execuções.

Aceite manual Windows pendente: multisseleção e cancelamento no diálogo real,
pastas UNC/unidades removíveis/permissões negadas e persistência após fechar e
reabrir o aplicativo. Os testes do owner recriam a instância sobre os dados salvos;
o smoke nativo valida reload. Próximo passo: validar esses casos antes de definir
um scanner ou execução de jogos, que continuam fora desta versão.

## Comandos de build

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
