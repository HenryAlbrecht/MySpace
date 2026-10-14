# Backup e restauração

`exportar backup` gera JSON com perfil, coleção, notas/favoritos, histórico, playlist e ordem, links de reprodução, aparência, capas/banners personalizados e preferências de interface. Arquivos locais de áudio/vídeo não entram no JSON.

`backup com arquivos` gera um pacote `.myspace` com os mesmos dados e arquivos locais referenciados pela playlist, coleção ou vídeo em destaque. Arquivos compartilhados por várias referências entram uma vez. Limites atuais: 200 MB por arquivo, manifesto de até 50 MB e pacote de até 2 GB. Arquivos ausentes são informados; não é possível exportar bytes que já não existem no navegador.

`verificar arquivos locais` informa quantidade, tamanho disponível e referências ausentes antes da exportação. Links externos permanecem links; vídeos/áudio de serviços não são baixados para o pacote.

Na importação, há confirmação antes de substituir os dados. O pacote restaura arquivos no IndexedDB; preferências, mídia e perfil têm rollback nos casos de falha previstos pela implementação. A restauração usa o formato atual de playlists, Collection, featured media e artwork, sem conversão automática de formatos antigos.

Preferências incluídas: mostrar música na PARTY, mostrar compacto nas outras abas, capa/vídeo YouTube e coleção em lista/capas. Credenciais, `.env`, caches de API e estado de chamadas não são exportados.

Testes focados: `node tests/backup/backup-roundtrip-browser.cjs`, `node tests/media/media-package-smoke.cjs` e `node tests/catalog/title-preferences-smoke.cjs`. A [validação de 2026-10-02](history/backup-restoration-validation-2026-10-02.md) é histórica.
