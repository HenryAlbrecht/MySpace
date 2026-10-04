> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# Health pass 2 — consolidação, performance e XMB

Revisão em 03/10/2026. O relatório `health-pass-2026-10-03.md` e as alterações recentes foram lidos antes de editar. Mantidos HTML/CSS/JS, os layouts aprovados e os contratos atuais dos provedores. Não houve migração, novo backend, banco ou feature de PARTY.

## Problemas encontrados e corrigidos

| Problema | Alteração | Evidência |
| --- | --- | --- |
| Descobrir recriava todos os cards a cada lote, perdendo nós e foco | Reconciliação por identidade; atualização dos elementos existentes e remoção apenas dos ausentes | Browser: mesmo elemento focado após novo lote |
| Carga de Descobrir podia terminar depois de sair e retornar à tela | Invalidação por geração na saída e proteção da resposta final | Browser: resposta atrasada não substitui a nova |
| Descartar uma sugestão removia o botão focado | Foco transferido para um card restante ou para carregar | Browser: foco recuperado após descarte |
| Busca curta no editor não cancelava a consulta anterior | Cancelamento antes da validação do novo termo | Revisão do fluxo de cancelamento/revisão existente |
| Recomendações equivalentes podiam repetir fetch | Compartilhamento das consultas padrão pendentes; callers com fetcher/signal próprios permanecem isolados | Teste: duas chamadas, um fetch |
| Resposta antiga menor podia substituir cache mais completo | Preservação da resolução com maior total | Teste: resultado de reserva permanece no cache |
| Matchings distintos da foto repetiam pesquisa e faixas do mesmo candidato Deezer | Compartilhamento das respostas brutas, cache de 60 s limitado a 100 entradas; falhas não são guardadas | Teste: dois matchings, duas consultas externas totais |

Os matchings continuam independentes: compartilhar uma consulta não faz artistas homônimos compartilharem identidade ou foto automaticamente. Apple permanece catálogo; Deezer, foto; Last.fm, descrições/recomendações. Nenhuma redução de resolução de imagem foi aplicada.

## Arquitetura, estado e lifecycle

- Catálogo: `catalog-discovery.js` coordena sugestões; o backend resolve identidade Apple e enriquecimentos. Preservados os limites e a recuperação incremental do primeiro pass.
- Collection: ações/persistência alimentam as views; filtros compartilhados continuam atendendo capas, lista e XMB. Os modos não foram redesenhados.
- Player: core/adapters controlam reprodução e queue; SPACEAMP, mini-player, Media Session e PARTY consomem/controlam esse fluxo. Snapshots de apresentação não foram tratados como players independentes. Regressões de fim do YouTube, callbacks atrasados e Media Session passaram.
- PARTY: revisados ownership de room/session e caminhos de encerramento de peers, timers e transporte. Networking não foi alterado. O browser usou somente lobby local, sem iniciar chamada.
- Persistência/mídia: revisados armazenamento binário e operações agrupadas. Não houve mudança de formato ou migração.
- Appearance/motion: reutilizados os tokens e o accent configurável. Mantido o sistema atual de aparência.
- Entradas externas: mantido `textContent` e validação de URLs; não foi introduzido HTML externo. O uso encontrado de `innerHTML` para ícones estáticos não justificou uma alteração.

Listeners de duração da aplicação não foram removidos apenas por permanecerem registrados. Não foi comprovado um vazamento que justificasse modificar o networking ou o bridge do player.

## Performance, limpeza e CSS

A melhoria estrutural concentra-se em menos reconstrução de DOM e menos consultas equivalentes. Não foi medido um ganho de FPS ou latência em produção; a economia foi demonstrada por contagem de requisições e retenção dos nós.

Removidos o bloco de reconstrução completa de cards e o cancelamento duplicado no caminho válido do editor. Nenhum módulo antigo de provider/player ou seletor CSS foi apagado sem prova de ausência de uso. Nesta passada não houve remoção de CSS órfão comprovado nem consolidação ampla da cascata.

## UX e XMB

Resultados novos de Search entram com deslocamento horizontal de 8 px, usando `--motion-standard` e `--ease-xmb`. Isso torna a chegada de conteúdo perceptível sem animar indiscriminadamente as telas. A preferência de movimento reduzido desativa a entrada.

Descobrir mantém continuidade espacial e foco entre lotes. O controle de descarte tem foco visível com o accent do tema. Falhas de atualização preservam sugestões anteriores; saída da tela libera o estado ocupado. Fallbacks de capa/foto permanecem explícitos.

## Mobile e inspeção visual

Capturadas Profile, Collection, Search, Discover e PARTY em 390, 820 e 1440 px: 15 layouts, sem overflow horizontal. Inspecionados screenshots de Discover/mobile, PARTY/mobile, Search/tablet, Profile/tablet e Collection/desktop para tipografia, densidade, espaçamento e sobreposição. Os layouts aprovados não foram substituídos.

Limitações observadas: o mini-player flutuante cobre conteúdo quando aberto em viewport estreito; a Collection com somente dois itens mantém bastante espaço livre. Não foi feita uma mudança silenciosa de apresentação desses componentes. O background aplicado pela fixture não permaneceu visível em todas as rotas após a renderização; os screenshots não comprovam todas as combinações de wallpaper/opacidade do usuário.

Screenshots principais, relativos à raiz do projeto:

- `artifacts/health-pass-2/discover-390.png`
- `artifacts/health-pass-2/search-820.png`
- `artifacts/health-pass-2/profile-820.png`
- `artifacts/health-pass-2/collection-1440.png`
- `artifacts/health-pass-2/party-390.png`
- Resultados estruturados: `artifacts/health-pass-2/report.json`.

## Verificação

- 29 testes passaram: health-pass-2, catálogo, qualidade/reserva/recuperação musical e SPACEAMP/integrações.
- Smokes de artwork, navegação e descoberta personalizada passaram.
- Browser: seis verificações de foco/lifecycle/erro/motion, 15 layouts, zero `pageerror`, um elemento audio em cada layout.
- APIs e metadados dos testes visuais foram fixtures; o estado de playback apresentado foi simulado. Não é um teste de reprodução real de áudio/YouTube nem de disponibilidade dos provedores.
- A primeira execução visual foi interrompida por uma espera incorreta no harness; após corrigi-la, a segunda concluiu. Um browser/contexto por execução, sem execuções simultâneas. A execução final foi encerrada. Nenhum processo do usuário foi encerrado.
- Não executados stress, mesh, TURN ou suíte completa WebRTC: nenhuma alteração exigia esses testes.

## Débitos restantes

### Baixo risco

- Formatação compacta de alguns módulos dificulta leitura; padronizar gradualmente, sem renomeação geral.
- Revisão adicional da cascata CSS exige rastrear seletores dinâmicos antes de remover regras.

### Médio risco

- Metadados de resolução anexados a arrays de recomendações tornam o contrato menos explícito. Evoluir localmente quando houver necessidade concreta.
- Mini-player sobreposto em mobile precisa de uma decisão de UX sobre colapso/posicionamento, preservando controles e identidade visual.
- Matching conservador pode manter artista sem foto; não substituir segurança de identidade por escolha automática do primeiro resultado.
- Cobertura real de provedores, perfis grandes, imagens ausentes e todas as combinações de aparência permanece parcial; os testes desta tarefa não representam produção.

### Alto risco

- Mudanças estruturais em room/presence/reconnect e adapters de reprodução exigem testes reais de sessão e mídia. Foram deixadas intactas porque não houve bug comprovado nesta revisão que justificasse esse alcance.

Não há evidência nesta passada que exija trocar a stack. Os problemas corrigidos eram de contratos, concorrência e atualização de UI; um framework não os resolveria automaticamente.
