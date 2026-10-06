# Working-set / agent-efficiency refactor — 2026-10-06

Working tree na branch `refactor/organization-v2`, referência `093104a70c0d284179d8b03c9dd116b9ed7f5277`. Sem commit/push. Baseline local de working set em `artifacts/working-set-baseline.json`; logs deste pass em `artifacts/working-set-*.log`.

| Tarefa representativa após AGENTS → module-map | Antes | Depois / focado |
|---|---|---|
| Alterar UI da discografia | `title-pages.js` (também shell/rotas/game/media), `music-page-ui.js` | `title-artist-view.js`, `music-page-ui.js` se necessário → `artist-discography-window-browser.cjs`; TitlePages somente para CORE/FULL/lifecycle |
| Alterar top 8/badges/gallery/blocos | `extras.js` (também dados/Collection/playlist/PARTY/backup) | `profile-extras-view.js` → `profile-extras-browser.cjs` / `boot-performance-browser.cjs`; extras somente para persistência/rota/editor compartilhado |
| Alterar lifecycle Collection | `collection-view.js` | Mesmo owner → `boot-performance-browser.cjs`; nenhum movimento da view |

ProfileExtras mantém UI/edição/ordem/visibilidade e um único dirty flag de Gallery. Dados/save/histórico, CollectionActions, CRUD, rotas, composição, PARTY e backup continuam em extras. O editor compartilhado e callbacks de arquivos de vídeo pertencem ao compositor; a view não grava storage diretamente. Artist View recebe sete dependências, expõe append/patch e reconcilia o item já fundido; retry devolve controle ao coordenador. Não monta discografia temporária durante patch da seção existente. Ambos os scripts têm top-level somente de definição da factory.

Dado secundário: extras 52.715 bytes / 1.219 linhas → 33.869 bytes / 810 linhas; TitlePages 82.249 / 1.371 → 72.150 / 1.137. Os coordenadores permanecem grandes porque persistence/route/CRUD e shell/CORE/FULL/Navigation continuam coesos; não houve extrações fora do escopo.

Boot: scripts 59 → 61; código JS total medido ~686 → 690 KB (+0,7%, incluindo formatação das extrações). Perfil DOM total 586 → 588, exclusivamente pelos dois novos elementos script; excluindo scripts, 527 → 527. Collection 1.244 → 1.244 e PARTY/deep link 719 → 719 pelo mesmo critério. Collection/Gallery no perfil continuam 0 renders; entrada direta Collection 1; PARTY no perfil 0 e primeira entrada/reentrada mantém 1 instância. Gallery oculta invalidada por edição renderiza uma vez na entrada e reutiliza no retorno. Os 61 scripts revalidaram por 304; sem loader, CSS ou mudança de produto. Tempos de browser são diagnósticos, sem promessa de aceleração neste pass.

Validação: quick antes PASS (37 arquivos / 194 testes). Focados de ownership/Collection (14 testes), page smoke, boot/Gallery/dirty/reuso/cache, profile extras/vídeo local, Collection/Navigation, backup, discografia completa/progressiva desktop/mobile/legacy, music-core-hydration, title-detail-continuity, recomendações atuais e gêneros PASS.

Aceite final na ordem focado → quick → smoke → syntax: PASS. Quick 37 arquivos / 194 testes, guard sem fetch externo; smoke 9 arquivos; syntax/static 70 assets HTML / 61 scripts / 138 links Markdown / 374 requires locais; `git diff --check` PASS.

Limites: a primeira tentativa de quick recebeu EACCES ao conectar localhost; organization e o baseline passaram com permissão de rede local. O harness adicional `music-recommendation-browser.cjs`, já marcado para revisão no inventário, espera “atualizar recomendações”; o HEAD já usa “ver outras recomendações”. Não foi alterado nem usado como aceite; `music-final-recommendations-browser.cjs` validou o fluxo vigente. Providers/CSS/playback/WebRTC/XMB não foram alterados. AGENTS permaneceu igual porque as regras arquiteturais não mudaram.
