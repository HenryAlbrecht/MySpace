# SPACEAMP Now Playing — visual pass

Mantida a branch `feature/spaceamp-now-playing`, em JS puro, sem novas dependências e sem alterações no Core, adaptadores, mini-player ou internals do am-lyrics.

## Ambiente e paleta

Uma amostra de canvas 32 × 32 agrupa os pixels da capa em buckets e seleciona até duas cores dominantes. Pixels transparentes, quase pretos ou quase brancos são descartados. A saturação é reduzida e limitada a 38%, com luminosidades controladas para os quatro tokens locais: `--np-accent`, `--np-accent-soft`, `--np-bg-tint` e `--np-bg-deep`.

Os tokens afetam somente o dialog: base misturada ao fundo do sistema, wash radial, focos, ranges e stroke/glow do visualizer. A artwork ampliada e desfocada fica sob um scrim escuro; com Lyrics OFF ela ganha presença. O texto e o highlight das lyrics preservam as cores existentes. Falhas de CORS, leitura de canvas ou imagem voltam à paleta neutra, sem afetar playback. O cache é limitado a 32 capas; revisões descartam resultados atrasados.

## Motion

O helper Artwork existente continua retendo pixels prontos durante o carregamento. Após a nova capa carregar, uma cópia decorativa da anterior faz crossfade com deslocamento de 8 px, mantendo a caixa fixa. O fundo usa a mesma transição. Metadata e a região pública de lyrics entram com deslocamentos de 6/5 px. Não se mantém letra antiga para simular a transição.

As animações usam `--motion-standard` e `--ease-xmb`. Os tokens de cor interpolam por CSS, sem loop extra. Transições antigas são canceladas/limpas em trocas rápidas, fechamento ou ativação de reduced motion. O fundo ampliado fica em uma camada recortada para não gerar overflow.

## Validação

- 20 testes unitários de SPACEAMP/Now Playing/integrations/Artwork/XMB.
- Um browser/context com fixtures: próxima, anterior, avanço automático local, paletas quente/fria, tema global preservado, saturação limitada, caixa da artwork estável, leitura de canvas falhando, trocas rápidas, lyrics ON/OFF, quatro modos do visualizer, persistência, Hide UI, XMB e reduced motion.
- Capturas e ausência de overflow em 390, 820 e 1440 px. Inspeção visual de desktop sem lyrics e mobile com lyrics.
- Nove smokes, syntax/static e diff check.

Playback/provider e letras são simulados na validação de navegador; nenhum provider real, WebRTC pesado, TURN, mesh ou screen share foi executado.
