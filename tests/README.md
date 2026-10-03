# Validação por responsabilidade

Os arquivos continuam nesta pasta para preservar os caminhos dos harnesses. Não executar todos os `.cjs`: há diagnósticos de rede e testes pesados de mídia misturados aos unitários.

| Categoria | Exemplos | Execução |
|---|---|---|
| Modelo/parser | `collection.test.cjs`, `audio-tags.test.cjs` | Node test runner |
| Catálogo musical | `music-search-quality.test.cjs`, `music-search-reserve.test.cjs` | Node test runner, serviços simulados |
| Recomendações | `music-recommendation-recovery.test.cjs`, `music-recommendation-resolution.test.cjs` | Node test runner |
| Player/integrations | `spaceamp.test.cjs`, `spaceamp-integrations.test.cjs` | Node test runner, eventos simulados |
| PARTY estado/UI | `voice-chat.test.cjs`, `party-room-ui.test.cjs` | Node test runner, sem captura |
| PARTY server | `party-room.test.cjs` | Node test runner, servidor/socket local; sem mídia real |
| Organização/limites | `organization.test.cjs` | Node test runner |
| Smokes | `flac-smoke.cjs`, `media-package-smoke.cjs`, `title-preferences-smoke.cjs`, `navigation-smoke.cjs` | `node tests/nome.cjs` |
| Visual focado | `organization-visual.cjs` | Um browser/context, fixtures, 390/820/1440; sem microfone |
| Serviços reais | arquivos `*-live.cjs` e diagnósticos musicais | Manual; depende de internet/serviços |
| WebRTC/integração pesada | `spacevoice-integration.cjs`, `voice-*-integration.cjs`, testes mesh/TURN | Somente quando a alteração justificar e houver escopo explícito |

Conjunto curto para os módulos reorganizados:

```sh
node --test --experimental-test-isolation=none tests/organization.test.cjs tests/party-room-ui.test.cjs tests/spaceamp.test.cjs tests/spaceamp-integrations.test.cjs tests/voice-chat.test.cjs
node tests/flac-smoke.cjs
node tests/media-package-smoke.cjs
node tests/title-preferences-smoke.cjs
node tests/navigation-smoke.cjs
node tests/organization-visual.cjs
```

O flag de isolamento foi usado com Node 24 no ambiente restrito desta revisão. Fora dele, o isolamento padrão pode ser utilizado. O harness visual requer o runtime Playwright portátil e Edge no caminho declarado no arquivo; ele inicia/fecha seu próprio servidor e browser.

## Fixtures e compatibilidade

Harnesses VM precisam carregar os módulos internos antes das fachadas, assim como `dist/index.html`. Atualizar a lista explícita quando uma responsabilidade for extraída. O teste de organização protege essa ordem. HTML isolado de PARTY também precisa de `party-chat-ui.js` antes de `spacevoice.js`.

`artifacts/` recebe screenshots, áudio de fixture e JSONs de diagnóstico e está ignorado. Testes não devem depender de resultados de execuções anteriores nessa pasta. Documentação histórica selecionada fica em `docs/history/`.

## Testes históricos conhecidos

Não usar estes arquivos como motivo para alterar o comportamento atual:

- `voice-ui.test.cjs`: pressupõe que entrar diretamente na chamada habilita chat sem sala. Falha no código anterior e atual; o contrato ROOM/CALL é coberto por `party-room-ui.test.cjs`.
- `page-smoke.cjs`: a lista antiga omite `spaceamp.js`/integrações antes de `app.js`; falha com `SpaceAmp is not defined` antes de exercitar as extrações. As referências dos módulos extraídos foram atualizadas, mas o DOM simulado completo ainda precisa ser modernizado.
- `deezer-unified-search.test.cjs`, `deezer-smoke.cjs`, `music-editorial.test.cjs`: registram fases anteriores do catálogo/contratos musicais. Limitações descritas no relatório de legibilidade anterior.

Nenhum teste foi removido. `organization-visual.cjs` verifica o boot real e os fluxos movidos enquanto esses harnesses históricos aguardam manutenção própria.
