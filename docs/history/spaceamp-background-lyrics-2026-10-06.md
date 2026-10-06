# SPACEAMP: artwork dinâmica e perfil de lyrics

Branch `mudanca_search`, working tree atual. Sem commit. Recommendation engine e vendor am-lyrics intactos.

## Background: causa medida

O search público atual retornou Thanatos (Kinokoteikoku), Wonderwall (Oasis) e 国道スロープ - Kokudouslope (Kinokoteikoku). As três artworks vieram de **lh3.googleusercontent.com**, não ggpht. GET direto retornou JPEG 200 e Access-Control-Allow-Origin: *. A hipótese de host ausente na allowlist não se confirmou nesses casos.

Exemplo Thanatos:

Metadata original, item.image, queue.album e state.artwork:

```
https://lh3.googleusercontent.com/C0pyv-JdS3yRopGnHFJP4RQznKGBFSz3mY9_u6Gr1TtMErZYaXtUKE7FKTFTbbJNMXXYTmcFHnSleu0b=w800-h800-l90-rj
```

Artwork.url() e request efetivamente usado pela palette/texture:

```
/api/music/artwork?url=https%3A%2F%2Flh3.googleusercontent.com%2FC0pyv-JdS3yRopGnHFJP4RQznKGBFSz3mY9_u6Gr1TtMErZYaXtUKE7FKTFTbbJNMXXYTmcFHnSleu0b%3Dw800-h800-l90-rj
```

A capa e a palette já conseguiam carregar pela segunda URL. Mas dynamicArtwork comparava `image.getAttribute('src')`, contendo a URL do proxy, com `artworkKey`, contendo a URL original. A comparação falhava e o adapter retornava antes de setArtwork. Isso explica capa visível, palette extraída e atmosphere=static sem erro de decode/WebGL: **não era falha de CORS nesses assets**.

Corrigidas as duas guardas para comparar com Artwork.url(artworkKey), inclusive após import assíncrono. A identidade original permanece na metadata/queue; capa e fundo usam a mesma entrega canônica. Não houve substituição por video thumbnail, alteração de parser, normalização de hostname ou ampliação de allowlist. HTTPS, ausência de credentials/redirects, limite 2 MiB, tipos JPEG/PNG/WebP, timeout e cache permanecem iguais.

## Medições posteriores

O browser percorreu search → música → tocar agora → Now Playing dinâmico. O search e as capas/lyrics da variante live vieram dos serviços públicos atuais. O IFrame API/clock foi controlado no harness para reproduzir estados de forma determinística; a gravação não certifica streaming de áudio remoto.

Nas três músicas: metadata original preservada, image.decode OK, canvas draw/getImageData OK, createImageBitmap OK, Kawarp.loadImageElement invocado e atmosphere=kawarp, sem page/decode errors. Thanatos e Wonderwall produziram palette=artwork. Kokudouslope preservou o fallback cromático permitido pelo extrator; a imagem ainda foi entregue ao Kawarp. Não forcei palette artificial para ultrapassar seus limiares.

Comparações: artwork Apple pública de Wonderwall em is1-ssl.mzstatic.com e artwork local profile-art.png também receberam texture e atmosphere=kawarp. O teste determinístico bloqueia requests diretos aos hosts Google e usa o endpoint real /api/music/artwork, com fetcher controlado e imagem PNG de 26 KiB: testa a allowlist/limites/cache do servidor, não bypass do endpoint.

## Lyrics: causa comprovada e limite da reprodução

Não reproduzi o desaparecimento global do blur no Edge isolado. Após fetch e três trocas, o style #spaceamp-lyrics-motion-profile permanecia no shadowRoot, a container mantinha blur-inactive-enabled e não encontrei user-scrolling/touch-scrolling presos. Portanto não atribuí a falha a lifecycle ou timers sem evidência.

Encontrei um conflito real de pintura: upstream progressive-unblur escreve filter inline com !important, prevalecendo sobre o CSS do perfil. Medi próxima inactive com blur(0.68px) e pre-active com blur(0.0102px), apesar da regra pre-active filter:none. Também confirmei que a regra far tinha mais especificidade que a exceção de scroll manual.

O adapter agora deixa o stylesheet controlar o filter de linhas, removendo o filtro inline concorrente após atualizações do upstream. Um observer acompanha somente atributos das próprias linhas; outro acompanha mudanças de estrutura e reinsere o style se necessário. Não observa os estilos de centenas de chars nem modifica timing, transforms, métodos ou vendor. Ambos são desconectados na troca/fechamento; respostas antigas não instalam perfil numa instância substituída. A regra de interação agora inclui wheel-scrolling e tem especificidade suficiente para far-line.

Computed styles verificados depois:

| Papel | filter | opacity |
|---|---|---|
| active | none | 1 |
| pre-active | none | .72 |
| inactive próxima | blur(1.2px) | .48 |
| far | blur(1.8px) | .48 |
| scroll manual | none | perfil existente |

O harness carrega a resposta de lyrics depois do primeiro updateComplete, verifica instâncias A/B/C e trocas sem fechar Now Playing, testa perda/reinserção do style, wheel real e recuperação pelo timeout upstream, click-to-seek, seek e reduced motion. O blur retorna após o scroll. No live, as três faixas tiveram active=none e linhas inactive borradas, registradas em screenshots. Isso estabiliza o perfil medido; não prova que o desaparecimento geral observado no Zen tinha exatamente essa mesma causa.

## Verificação

16 testes unitários passaram: artwork/music-artwork, SPACEAMP core, integrations, ISRC e Now Playing clock contracts. Syntax e git diff --check passaram.

Passaram os browsers: spaceamp-regressions-browser (determinístico e live), spaceamp-lyrics-motion-browser, spaceamp-lyrics-clock-browser, spaceamp-youtube-browser, spaceamp-video-browser, spaceamp-timeline-browser e spaceamp-navigation-browser (reexecução isolada). Glyph geometry neutra, drift horizontal <0.5px, paint temporal, pause/resume, seek, clock, buffering, local audio, vídeo e layouts responsivos continuam cobertos.

spaceamp-now-playing-browser mantém uma falha anterior: exige currentTime exatamente 12500 enquanto o clock já interpola, produzindo valores como 12525–12555. Reproduzi no código original de HEAD (12534). Num probe temporário com tolerância de clock, a asserção antiga de foco XMB também falhou no original e no modificado. Não alterei o teste ou o foco nesta rodada. O teste de navegação apresentou uma diferença transitória de requests quando rodado em paralelo; passou isolado, assim como seu baseline.

## Arquivos e artefatos

Implementação: dist/spaceamp-now-playing.js. Novos testes: tests/spaceamp-artwork-live.cjs, tests/spaceamp-regressions-browser.cjs, tests/fixtures/spaceamp-youtube-artwork.json e tests/fixtures/spaceamp-palette.png.

Em artifacts/spaceamp-regressions/: live-artwork.json (payloads/hosts/status/CORS), live-report.json e regression-report.json (queue/state/delivery/pixels/bitmap/texture/filter/classes), legacy-artwork.json, live-0.png, live-1.png, live-2.png e live.mp4. A gravação usa capas e letras reais, com transport controlado, e mostra active nítida/inactive borrada junto ao fundo dinâmico.
