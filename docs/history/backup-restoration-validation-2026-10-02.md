# Validação de backup e restauração — 2026-10-02

Registro histórico; o contrato vigente está em [backup e restauração](../backup-restoration.md). O artifact citado é evidência local daquela rodada, não requisito para clones novos.

Validação em 2026-10-02: exportação pelo botão real e importação em contexto Edge vazio, independente do contexto de origem; perfil, capa, coleção, notas/favoritos, registro legado, playlist/ordem, links, aparência e preferências; igualdade exata dos bytes locais após restauração; persistência depois de recarregar; zero pageerrors. Smoke tests cobrem arquivos ausentes, arquivo corrompido, restauração/rollback e whitelist das preferências. O arquivo binário usado no teste comprova integridade, não qualidade de reprodução de mídia real.

Artefato de teste: `artifacts/backup-review/roundtrip.myspace` (dados fictícios). Testes: `tests/backup-roundtrip-browser.cjs`, `tests/media-package-smoke.cjs`, `tests/title-preferences-smoke.cjs`.
