# Referências visuais do Xora

Recursos copiados do checkout indicado pelo usuário em `C:/Projetos/xora-master`:

- `wave_black.mp4`: `app/src/main/assets/music/wave_black.mp4`.
- `wallpaper_dim.png`: `feature/home/src/main/res/drawable-nodpi/wallpaper_dim.png`.
- `vita_bubble_glass.png`, `vita_peel_tip.png` e `vita_peel_under.png`:
  `feature/home/src/main/res/drawable-nodpi/`.
- `vita_peel_boundary.png`: contorno da folha no mesmo diretório.

Comportamento consultado em `MusicCategoryBackdrop.kt`, `XoraHomeXmbPane.kt`,
`HomeWallpaper.kt`, `MusicEditorPane.kt` e `HomeViewModel.kt`.
O vídeo é uma máscara Multiply, não um segundo player musical. Dim segue a
opacidade de 8% do HomeWallpaper. O CRT em CSS é uma adaptação contextual:
este checkout contém referências ao tratamento CRT nos comentários, mas não
uma implementação de shader CRT ou um toggle com esse nome para copiar.
