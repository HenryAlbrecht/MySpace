# Final pre-merge pass — 2026-10-03

Registro de estabilização da branch `refactory`, repositório HenryAlbrecht/MySpace. Início com working tree limpo, HEAD `8d4210d`. Antes de editar foram lidos organization pass, arquitetura, mapa de módulos, README de testes e diff contra `main`. Sem merge, push, commit ou reescrita de histórico.

## Testes históricos e atualizados

| Harness | Problema comprovado | Resultado |
|---|---|---|
| `page-smoke.cjs` | Lista de scripts incompleta, DOM antigo; mistura boot e muitos seletores históricos | Smoke atual deriva a ordem do HTML, verifica fachadas/um áudio/boot sem captura; fixture DOM atualizada. Conteúdo anterior preservado em `page-legacy-manual.cjs`, explicitamente histórico |
| `voice-ui.test.cjs` | Join da CALL pressupunha chat sem ROOM; prioridade de atividade antiga | Entra na ROOM antes da CALL, chat pelo transporte ROOM; saída da CALL preserva chat; saída da ROOM encerra. Sharing tem prioridade sobre mute no indicador |
| `spacevoice.test.cjs` | Mock exigia `audio:true`, anterior aos constraints EC/NS/AGC | Expectativa de captura atualizada, mantendo cobertura de permissão, late capture, mute e release |
| `music-editorial.test.cjs` | Esperava resolver 24 candidatos imediatamente | Verifica seis por etapa, reserva progressiva até 24; preserva Last.fm e identidade Apple |
| `music-unified-search.test.cjs` | Exigia expandir artista homônimo mesmo com título encontrado | Verifica que Wonderwall/Oasis permanece, sem Witchcraft do homônimo; duas consultas sem lookup desnecessário |
| `artist-search-photos.test.cjs` | Ainda tratava Deezer como catálogo de artista | Cobertura canônica Apple com foto opcional e evidência de faixas; IDs distintos preservados; falha Apple não muda provider |
| `deezer-unified-search.test.cjs` | Mock Last.fm usava `details` em vez de `summary` | Adapter histórico preservado; caso da fachada Apple corrigido |
| `deezer-smoke.cjs` | Chamava `deezerDetails` removido e busca Deezer pela fachada | Smoke do adapter isolado: IDs, cache, homônimos, edições, recuperação parcial e validação |

Nenhum teste útil foi apagado. Nenhum teste atual está marcado como falha esperada ou skip para passar. O harness antigo de página é a única cópia histórica nova. Demais arquivos permanecem no lugar para preservar imports.

Inventário completo: [tests/INVENTORY.md](../../tests/INVENTORY.md). Fixtures de `voice-peer`, `voice-mesh`, `voice-ws`, `voice-audio` e ranking antigo em `music-search-review` foram identificadas como históricas/manuais, fora do aceite atual. Isso não afirma que passam: precisam de revisão dedicada de testes de mídia. Browser harnesses versionados, diagnósticos e suites adicionais também têm classificação explícita.

## Suite default e comandos

[validate.ps1](../../tests/validate.ps1) oferece `default`, `quick`, `smoke`, `syntax`, `visual`, `party`, `legacy`. A lista é explícita; cada unitário executa em processo próprio para evitar contaminação de globals. Default não consulta providers reais, não captura mídia e não chama regressão mesh/TURN. Falha interrompe o comando.

Default: 32 arquivos unitários (146 testes), nove smokes, sintaxe e auditoria local. Browser leve separado para requerer somente Node no conjunto default; boot DOM está incluído nele.

## Docs e links

18 relatórios/referências antes na raiz de docs foram movidos para `docs/history/`: health passes 1/2/3, code readability, project audit, organization pass, project reference, avaliações Deezer, revisões/validações musicais e etapas SPACEAMP. Todos receberam aviso histórico. Dois documentos operacionais foram movidos para `docs/music/`.

Também foram preservadas duas versões antigas completas em `music-automatic-source-evolution.md` e `apple-catalog-validation-notes.md`. As versões vigentes foram reescritas como contratos operacionais: o texto antigo de vínculo ainda dizia que um resultado era salvo automaticamente e descrevia catálogo misturado. **Essa era uma inconsistência documental**, não bug de produção; agora explica confirmação obrigatória e Apple canônico.

Vigentes: `docs/architecture.md`, `docs/module-map.md`, `docs/backup-restoration.md`, `docs/keyboard-navigation.md`, `docs/music/apple-canonical-catalog.md`, `docs/music/music-automatic-source.md`, `dist/voice/README.md`, `server/coturn/README.md` e `tests/README.md`. README raiz permanece curto. Histórico possui índice próprio.

Links relativos e README/mapa/referências cruzadas corrigidos. Links de imagens ignoradas em relatos antigos viraram caminhos de evidências locais, sem depender de arquivos presentes somente nesta máquina.

## Artifacts, paths e Git

- `/artifacts/` e `.env` continuam ignorados; zero arquivos artifacts tracked; `.env.example` é template vazio.
- Três diagnósticos musicais agora criam seu diretório de saída. `music-real-controls-browser.cjs` consulta seus próprios seeds Apple em vez de ler relatório antigo de artifacts. Não foram executados contra serviços reais.
- HTML possui 47 scripts, sem duplicatas, e 55 referências locais JS/CSS existentes. Ordem de módulos internos coberta por `organization.test.cjs`; fachadas Collection/CollectionActions/Catalog/TitlePages/MusicBridge/SPACEAMP/PARTY_ROOM verificadas no DOM e navegador.
- Auditoria estática verifica links Markdown, requires locais e URLs relativas CSS. Launcher e scripts não apontam para docs movidas. Sem arquivos tracked vazios, temporários, dumps/logs ou mídia de fixture grande; `dist/profile-art.png` (~2,5 MB) é asset real de produção e foi mantido.
- Nenhuma credencial real encontrada na revisão de templates/diff e varredura de padrões de tokens/chaves privadas; não foram lidos valores do `.env`. Isso é uma verificação local de HEAD/working tree, não auditoria de todo histórico Git ou certificação de ausência de qualquer formato de secret.

## Validações

- 146 testes quick aprovados; nove smokes aprovados, incluindo FLAC, pacote/rollback, metadata HTTP local, artwork, descoberta, navegação, title preferences e boot.
- PARTY local: 22 testes em quatro arquivos aprovados, sem captura; adapter histórico: quatro testes e Deezer smoke aprovados.
- Sintaxe de todos os JS/CJS próprios em dist/server/tests e entrypoints, excluindo node_modules; paths/links e `git diff --check` aprovados.
- Visual leve: um Edge/context, três capturas (Profile/SPACEAMP, Collection, PARTY), 1440px; um áudio, zero pageerrors/overflow. Capturas inspecionadas. Nenhuma alteração estética.
- Saídas locais: `artifacts/premerge*.log` e `artifacts/premerge/`.

Uma execução inicial usou wildcard amplo demais e iniciou harnesses de mesh/signaling simulados fora do escopo; foi interrompida. Também expôs contaminação de globals/fixtures antigas quando múltiplos arquivos rodam sem isolamento. Não usar esse resultado como aceite; a execução final é explícita e isolada por arquivo. Não houve captura real, TURN relay, screen share real, stress ou regressão completa de WebRTC. Não houve chamadas reais Apple/Deezer/Last.fm neste pass.

O browser precisou sair da sandbox para iniciar Edge (`spawn EPERM` na primeira tentativa); execução autorizada do harness local terminou normalmente e fechou servidor/browser.

## Bugs e débitos

Zero mudanças de produção neste pass. Apenas testes, runners, documentação e criação de diretórios de diagnóstico. APIs, providers, ranking, cache, playback, PARTY, WebRTC, persistência e UI preservados.

Débitos: atualizar fixtures históricas de transporte/mídia antes de retomá-las como gate; reduzir dependência de runtime/Edge específico nos harnesses visuais quando houver demanda; globals e arquivos grandes permanecem candidatos futuros. Não houve nova modularização de app/extras/title-pages/spacevoice, formatter geral ou stack/tooling novo.

## Pronto para merge?

**Pronto para revisão/merge dentro do escopo deste pass**, com validação default passando e sem bloqueio de boot, paths, artifacts ou testes atuais encontrado. Alterações ainda estão no working tree para revisão; não foi feito merge ou push.

Isso não certifica rede/mídia real nem transforma os harnesses manuais antigos em testes aprovados. Se a política de merge exigir regressão completa WebRTC, será necessário um trabalho separado de atualização dessas fixtures e execução pesada autorizada. O diff total contra main inclui mudanças anteriores desta branch; este pass não repetiu a certificação de cada recurso histórico.
