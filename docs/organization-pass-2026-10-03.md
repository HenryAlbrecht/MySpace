# Organization / refactor pass — 2026-10-03

Trabalho sobre `refactory`, partindo do working tree limpo e do commit `9cc7e51`. Histórico recente, comparação `main...refactory`, relatórios dos health passes e documentação foram consultados antes das alterações. Sem merge, commit, push ou reescrita de histórico nesta tarefa.

## Mapa antes e depois

| Antes | Depois | Motivo |
|---|---|---|
| `music-bridge.js`: ações Collection, lookup, diálogo, dock/perfil | Fachada/coordenação em `music-bridge.js`; lookup/vínculo em `music-source-link.js`; apresentação em `spaceamp-global-ui.js` | Fontes de reprodução e apresentação são responsabilidades independentes |
| `extras.js`: persistência, seções, aparência e validação/aplicação de backup | Aparência em `profile-appearance.js`; validação sem escrita em `backup-validation.js`; composição/persistência/aplicação continuam em `extras.js` | Editor de aparência e validação podem ser entendidos e alterados isoladamente |
| `spacevoice.js`: chat DOM e coordenação ROOM/CALL | Chat visual em `party-chat-ui.js`; estado/protocolo em `voice/chat.js`; coordenação no compositor | Retira reconciliação de mensagens da orquestração de sala/mídia |
| `title-pages.js`: busca/ficha e galeria ampliada | Galeria em `title-gallery.js`; busca/ficha continuam em `title-pages.js` | Diálogo, seleção e foco possuem ciclo próprio |
| `extras.css`: seções do perfil mais regras de fichas/galerias no final | Trecho final em `title-pages.css`, imediatamente depois de `extras.css` | Localiza apresentação das fichas sem alterar a cascata |
| README com operação, contratos e histórico misturados | README curto; arquitetura/mapa e referência histórica em `docs/` | Encontrar como iniciar e onde alterar sem perder informação |
| Saídas de testes versionadas em `artifacts/` | Gerados locais ignorados; três narrativas selecionadas em `docs/history/` | Evita acumular mídia/diagnósticos no HEAD |

O fluxo geral permanece:

```text
index.html → app.js (perfil + SPACEAMP único)
           → extras.js (CollectionActions + views + playlist + PARTY)
           → Catalog / editor / TitlePages / DiscoveryPage

Collection ↔ MusicBridge → SPACEAMP
                         ├─ source link / lookup / diálogo
                         └─ dock / perfil (mesmo estado)

PARTY compositor → room / session / peers / media / signaling existentes
                 └─ chat view → voice/chat → transporte da sala

Catalog → server.cjs → providers existentes
Apple identidade → Last.fm texto/sugestões → Deezer foto opcional
```

## Arquivos novos e movimentos

Produção: seis JS (`backup-validation.js`, `music-source-link.js`, `party-chat-ui.js`, `profile-appearance.js`, `spaceamp-global-ui.js`, `title-gallery.js`) e `title-pages.css`, todos em `dist/`.

Validação: `tests/organization.test.cjs`, `tests/organization-visual.cjs`, `tests/README.md`.

Documentação: `docs/architecture.md`, `docs/module-map.md`, `docs/project-reference.md`, este relatório e três registros em `docs/history/`.

Nenhum arquivo de produção foi apagado ou renomeado. Foram movidos blocos de código para módulos internos, preservando fachadas. Narrativas históricas foram copiadas de artifacts, preservando também os originais locais.

## APIs e ownership preservados

- `MusicBridge.actions/link/initialize/autoLink` continuam disponíveis. `initialize` recebe os mesmos callbacks de fila/ativo/persistência.
- `Collection`, `CollectionActions`, `Catalog`, `TitlePages`, `SPACEAMP` e `PARTY_ROOM` mantêm seus consumidores.
- Views novas não criam um segundo áudio, YT.Player, queue, volume, socket ou peer.
- Source lookup mantém cache/tarefas e exige confirmação; resposta de título editado não atualiza indevidamente o item.
- Aparência lê o dado atual por callback, sem duplicar estado persistido. O save continua em extras.
- Backup mantém limites, IDs históricos, validação de estruturas/URLs e ausência de preferências em backups antigos. Escrita, confirmação e rollback continuam no compositor existente.
- Chat mantém texto seguro via textContent, linhas por ID, scroll, draft, unread e título da página. Contexto/mídia/room lifecycle permanecem em spacevoice.
- Galeria mantém foco, posição de leitura e estado dos blocos ao selecionar banner.

Ordem de scripts atualizada em index e nas fixtures VM/HTML que carregam os módulos diretamente. Um teste verifica módulos internos antes de seus consumidores e ausência de scripts duplicados.

## Server, parsers e front geral

Adapters Apple/Deezer já estavam separados de normalização. Requests/cache/ranking dos providers foram revisados e mantidos: nova divisão não traria ganho suficiente neste pass. `artist-artwork.cjs` continua apenas enriquecimento. O adapter Deezer histórico não foi excluído porque ainda possui consumidores de teste/diagnóstico.

Parser MP3/FLAC mantido: bounds checks, MIME, limites e truncamento não foram tocados. MediaStorage/MediaPackage mantêm ownership dos binários.

Collection já separa modelo e view; não foi fragmentada em modos que compartilham seleção/filtros. EditorUI foi mantido como decoração dos formulários. App continua contendo adapters de reprodução: movê-los isoladamente exigiria reorganizar o estado compartilhado de áudio/YouTube/perfil, maior do que as fronteiras seguras deste pass.

Trechos compactados de app, catalog e pontos de composição alterados foram formatados usando `.prettierrc.json`. Comparação de AST antes/depois confirmou neutralidade das quatro formatações por intervalo. Não foi formatado o repositório inteiro nem instalada dependência de tooling.

## Dead code e CSS

Removida a criação de `homeTitle` no dock: era um nó destacado, nunca anexado ao DOM e sem leitores além da própria definição. Não foram apagados providers, flags, regras ou caminhos de backup apenas por parecerem antigos.

O trecho CSS extraído foi movido integralmente. A concatenação `extras.css + title-pages.css` é byte a byte igual ao extras.css anterior; o novo link vem imediatamente depois de extras, antes de interface/XMB/PARTY/SPACEAMP. Não houve alteração de selectors, valores, media queries ou motion.

PARTY CSS ainda tem camadas de overrides de etapas anteriores. Sem prova de equivalência em todos os estados de mídia/fullscreen, consolidá-las seria arriscado; permaneceram. Tokens `--motion-fast`, `--motion-focus`, `--motion-standard`, `--ease-standard` e `--ease-xmb` foram preservados. Nenhuma nova animação.

## Higiene do repositório

- 252 arquivos gerados retirados do índice, cerca de **78,8 MiB** no estado atual; inclui screenshots, WAVs, pacote de fixture e relatórios JSON.
- `/artifacts/` adicionado ao `.gitignore`; `git ls-files artifacts` retorna vazio.
- Todos os arquivos locais preservados. Remoções são somente do tracking e estão staged; alterações de código/docs permanecem no working tree para revisão.
- Três documentos pequenos selecionados (redesign PARTY, relatório v1.0 e configuração Metered) preservados em `docs/history/`, com indicação de registro histórico.
- Histórico Git não foi reduzido; o ganho é não continuar carregando os arquivos no HEAD futuro.
- README anterior preservado integralmente na referência histórica, com arquitetura vigente apontada separadamente para evitar confundir etapas antigas com o catálogo atual.

## Validação

59 testes focados passaram, cobrindo busca/reserva/recomendações, fotos, identidade/edições, chat, sala/server, SPACEAMP e os módulos extraídos. Após os últimos ajustes de composição/validação, o subconjunto afetado de 23 testes passou novamente.

Smokes aprovados: FLAC, metadata, pacote de mídia (bytes, corrupção e rollback), fotos de artistas, descoberta personalizada, navegação e preferências de títulos.

Sintaxe: 65 scripts de produção/servidor e harnesses novos verificados, excluindo dependências vendorizadas. Todos os 55 caminhos locais JS/CSS declarados no HTML existem. `git diff --check` e verificação do diff staged sem erros.

Inspeção visual final após o CSS: um browser/context por execução, sequencial, encerrado em finally. Profile, Collection, Search e PARTY nas larguras 390/820/1440; chat aberto e detalhe/galeria no desktop. 14 screenshots por execução, um áudio em cada estado, nenhum overflow horizontal ou pageerror. Aparência/opacidade foi alterada pelo editor real; diálogo de vínculo e galeria foram operados; chat local enviou e manteve mensagem após reabrir, sem captura de microfone. Capturas finais foram inspecionadas. Evidências locais em `artifacts/organization-pass/`.

## Falhas históricas e limites

- `voice-ui.test.cjs` falhou na expectativa de chat após join direto da chamada. A mesma falha foi reproduzida executando o código anterior extraído do baseline; não foi alterado comportamento válido para acomodar a fixture.
- `page-smoke.cjs` falha em `SpaceAmp is not defined`: sua lista antiga omite dependências do app. Foi atualizada somente a localização dos módulos movidos. O boot real passou no harness visual.
- O harness visual anterior health-pass-3 parou por interceptação do clique de reabrir pelo aviso Undo. Não foi contornado com clique forçado nem corrigido por alteração visual neste pass. O harness novo cobre os fluxos extraídos sem essa expectativa histórica; essa sobreposição precisa de revisão UX específica.
- Primeiras tentativas do harness novo exigiram ajuste da fixture para abrir a aba Estilo e operar o range pelo teclado. A execução final passou.

Nenhum bug funcional de produção foi misturado ao refactor. Não houve alteração intencional de providers, ranking, cache, playback, presença, ICE/TURN, WebRTC ou UI aprovada. Os testes não constituem certificação de rede real, autoplay YouTube, desempenho ou todas as combinações de mídia.

Não executados: regressão full WebRTC, mesh/4 peers, stress, TURN relay, screen share/screen audio, suites pesadas ou benchmark. Nenhum processo/browser do usuário foi encerrado. Não houve consulta real aos providers durante este pass; os testes de catálogo usam fixtures.

## Arquivos ainda grandes

| Arquivo | Por que permanece / próxima fronteira possível |
|---|---|
| `extras.js` | Ainda compõe seções, editores pequenos e transação de persistência/importação. Menos misturado após aparência/validação. Próxima fronteira possível: UI de seções do perfil ou backup I/O, preservando save/rollback centralizados. Não está plenamente coeso ainda. |
| `spacevoice.js` | Compositor mantém participantes, telas, controles e coordenação de sala/mídia. Chat saiu; próximos candidatos são settings UI e participant rendering, exigindo contrato cuidadoso de elementos/streams. Ainda mistura UI, mas não deve assumir transporte novo. |
| `title-pages.js` | Coordena vários tipos de mídia, busca, ficha e recomendações. Galeria saiu. Renderizadores por domínio podem ser isolados futuramente; cache/rota/estado compartilhados devem continuar centrais. |
| `app.js` | Perfil/bootstrap e adapters áudio/YouTube compartilham estado. Trecho mais comprimido agora legível. Próxima separação exige explicitar ownership do host/adapters; evitar mover handlers sem seu estado. |
| `catalog.js` | Requests, normalização e caches da fachada de catálogo; a busca contextual compactada foi formatada. Uma separação futura por adapter pode valer, preservando caches/cancelamento/contratos. |
| `collection-view.js` | Capas/lista, seleção, filtros e ligação XMB compartilham estado real. Relativamente coeso como view; dividir só quando um modo tiver contrato independente. |
| `editor-ui.js` | Decoração de formulários e busca contextual. Coeso como UI de editor; não criar módulo por campo. |
| `profile-appearance.js` | Editor e aplicação das mesmas preferências. Grande, mas coeso em torno do domínio Appearance; mantido inteiro. |
| `spaceamp-global-ui.js` | Perfil/dock são duas apresentações do mesmo host/DOM. Coeso; não dividir layouts criando estado paralelo. |
| `extras.css`, `interface.css`, `spacevoice.css` | Restam regras gerais e overrides históricos. A ordem importa; novas extrações devem provar a cascata e validar estados, não somente reduzir linhas. |

Débitos: harnesses históricos, globals do app, composição grande dos três módulos principais, metadata de recomendações em propriedades de arrays e CSS acumulado. Foram documentados, sem abstrações artificiais para escondê-los.

Mapa de manutenção: [architecture.md](architecture.md), [module-map.md](module-map.md). Categorias de testes: [../tests/README.md](../tests/README.md).
