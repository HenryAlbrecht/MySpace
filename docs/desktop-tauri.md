# MySpace Desktop — PoC Tauri 2

## Contrato atual — Persistent Folder Access V1

O registro Rust substitui a persistência de referências em localStorage das
versões anteriores. `authorize_folders(category)` abre o diálogo oficial já
instalado e registra somente os caminhos retornados por ele; não existe comando
para autorizar um caminho fornecido pelo JavaScript. Multisseleção e cancelamento
continuam disponíveis. Referências antigas precisam ser selecionadas novamente;
não são apagadas nem usadas como autorização. Nenhuma leitura automática delas.

Registro privado: `authorized-folders-v1.json` em AppLocalData do identificador
Tauri atual. Cada grant tem UUID, categoria, caminho canônico e identidade do
diretório (volume serial + file index). Duplicatas de identidade são ignoradas
por categoria. Nova seleção de pasta substituída no mesmo caminho emite outro ID.
`list_folders` retorna somente ID, categoria, caminho para exibição e estado.
O frontend não persiste grants. `discover_steam(id)` aceita somente grants de
Jogos; `revoke_folder(id)` remove o grant, sem alterar conteúdo da pasta.
O comando antigo `check_folders(paths)` foi removido.

Persistência usa JSON versionado, temporário exclusivo, sync e substituição
atômica no Windows. Erro de gravação não confirma autorização/revogação. Registro
malformado falha fechado, sem sobrescrita silenciosa. Locks de mutex e arquivo
serializam listagem, alterações e descoberta, inclusive entre instâncias; uma
revogação aguarda a leitura ativa terminar antes de confirmar. IDs desconhecidos
ou revogados são recusados pelo Rust, independentemente do estado do frontend.

Somente o registro privado/lock são escritos. Bibliotecas permanecem somente
leitura. Identidade é conferida em cada acesso; pastas ausentes, sem acesso ou
substituídas permanecem listadas como indisponíveis. Na volta da mesma unidade/
pasta, o acesso pode ser retomado. Troca de identidade requer nova autorização.

Windows: cada componente de diretório é aberto com handle de leitura e sem
compartilhar escrita/exclusão, mantido até concluir a operação. Todos os reparse
points são recusados, inclusive raiz/ancestrais, junctions, symlinks e caminhos
legítimos baseados neles. Manifestos são abertos sem seguir reparse points e
checados pelo handle antes de ler. Componentes relativos, traversal e ADS são
recusados. Não há permissões FS/shell genéricas nem leitura por caminho IPC.

Limites: o registro é confiável no perfil do usuário do Windows; não protege
contra outro programa com acesso de escrita a AppLocalData ou privilégios de
administrador. Não é criptografado e não é um backup portátil. Dispositivos,
shares SMB e sistemas de arquivos com IDs instáveis, reparse points ou sharing
incompatível podem ficar indisponíveis; falha é fechada. Não há migração de grants
por cópia do backup do perfil. A revogação não desfaz resultados já exibidos.

Validação automatizada: testes Rust em fixtures isoladas verificam persistência
ao reabrir registro, revogação, IDs/categoria inválidos, pasta ausente/substituída,
traversal, renomeação bloqueada pelo handle, junction na raiz/interna e descoberta
Steam sem diálogo. Testes JS verificam ausência de autorização via localStorage,
categorias, cancelamento/falhas, revogação e apresentação; versão web retorna
antes de usar APIs nativas. Seleção real, reinício completo do app com biblioteca
real, UNC/removíveis/ACLs e interação entre duas janelas exigem aceite manual.

As seções de revisão V1 abaixo registram o fluxo anterior da PoC/Folder Picker/
Game Discovery; os detalhes de autorização e persistência acima os substituem.

Resultado desta etapa: 5 testes Rust e 7 testes JS passaram; build locked/offline,
syntax e diff-check passaram. Smoke no WebView2 confirmou que localStorage é
ignorado, IDs/caminhos desconhecidos e categoria inválida são recusados e o
comando antigo foi removido. O teste não abriu seletor nem autorizou pastas reais.
Cleanup: 8 processos da instância encerrados, ambiente restaurado e nenhum
listener restante na porta 19347. A suite quick parou nas falhas preexistentes
de `tests/xmb/xmb.test.cjs` (incluindo relógio/fixtures); nenhum código XMB mudou.
Evidências em `artifacts/desktop-tauri/`: `persistent-access-tests.log`,
`persistent-access-build.log`, `folders-native-smoke.log` e
`persistent-access-quick.log`. O primeiro teste com diretório temporário foi
bloqueado pelo sandbox; os testes nativos passaram fora dele após reforçar os
handles contra renomeação e corrigir os separadores da fixture de junction.

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

## Game Discovery V1 — Steam

Em Ctrl+Shift+D, cada referência de Jogos tem “Descobrir jogos Steam”. A view
reutiliza DesktopFolders e a mesma integração Tauri. Não há busca automática,
Collection, XMB, execução, capas, rede ou gravação dos jogos encontrados.

Segurança: caminhos persistidos no frontend não concedem leitura nativa.
`discover_steam` abre o diálogo oficial já instalado, posicionado na pasta
registrada; o usuário precisa selecionar a mesma pasta para confirmar o acesso
em cada descoberta, inclusive depois de reiniciar. Cancelamento não lê manifestos.
Nenhuma permissão genérica FS foi adicionada; `allow-discover-steam` permite esse
comando somente à janela local `main`. A autorização é transitória.

São aceitas a raiz de uma biblioteca (contendo `steamapps`) ou a pasta `steamapps`
diretamente. Não pesquisa pais, `common`, registro do Windows ou outras unidades,
nem segue `libraryfolders.vdf`. Apenas `appmanifest_*.acf` do primeiro nível é
lido. Extrai AppID, nome e installdir de AppState; valida AppID contra o nome do
manifesto, estrutura/chaves obrigatórias e diretório como um único componente.
Objetos internos de KeyValues são aceitos, com strings citadas e comentários //.

Limites: 10000 entradas por biblioteca, 1 MiB por manifesto e profundidade 32.
Erros de manifesto são exibidos individualmente e não interrompem os demais.
Diretórios ausentes, inacessíveis e caminhos fora do escopo têm estado explícito;
“presente” significa somente que o diretório existe, sem provar instalação
completa ou executável válido. AppIDs iguais em bibliotecas distintas permanecem
separados por origem. Resultados não são persistidos e são descartados ao
remontar a lista/remover referências.

Contenção usa caminhos canônicos antes de enumerar/abrir; links para fora da
raiz são recusados. Não há escrita de conteúdo no fluxo de produção. A V1 não
oferece proteção por handle contra troca concorrente de junctions/symlinks entre
a validação e a abertura; evitar modificar a biblioteca durante a descoberta.

Testes: três cenários JS do owner, quatro da PoC/UI e dois Rust (parser e fixture
isolada), incluindo dados malformados, traversal, pasta ausente, diretório
presente, arquivo grande, escopo e preservação do manifesto. `serde` passou a
dependência direta para serializar resultados, reutilizando a versão já no lock;
nenhuma crate nova ou ferramenta foi baixada.

Aceite manual Windows pendente: diálogo real de confirmação/cancelamento,
biblioteca Steam real, ACL negada, junctions e unidades removíveis/UNC. Os testes
automatizados usam fixtures próprias e bridge simulada para UI. As falhas já
registradas da suite quick/XMB pertencem ao harness existente e não foram
corrigidas por esta mudança.

## Build local

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
