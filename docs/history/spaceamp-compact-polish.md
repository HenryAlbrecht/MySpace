> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# SPACEAMP v1.6 compact polish

The previous bridge explicitly refused presentation toggles if `#music iframe` existed, disabled the expand control, and forced `.expanded` on every update. There was no observed iframe destruction on minimize: minimize was blocked by the UI itself.

The bridge now has a presentation-only function that switches `.expanded` and updates window-control labels. It invokes no playback, seek, queue, volume, iframe mounting or API lifecycle operation. The original audio, iframe, YouTube binding and SPACEAMP singleton remain unchanged. Close explicitly stops playback; minimize does not.

Compact mode is a desktop player window with the SPACEAMP titlebar/version, square window controls, artwork or music placeholder, title, artist, local elapsed/duration, previous/play/pause/next, volume and expansion. Expanded mode uses the original full controls, waveform, seek and queue inside that same shell.

For YouTube, compact mode hides only the other full-view sections. The mounted `.music-embed` stays visible, centered at 320 × 200 px. The API requires at least 200 × 200 and sufficient space for provider controls: https://developers.google.com/youtube/iframe_api_reference#Requirements. Provider controls are never covered or replaced. Real streaming/browser behavior still needs manual confirmation; the automated fixture proves identity/lifecycle, not actual YouTube delivery.

Window width transitions use `--motion-standard`; compact/full contents use fade + 8 px slide with `--motion-focus` / `--motion-fast` and `--ease-xmb`. Reduced motion disables transitions and animations.

Validation: `tests/music-polish-browser.cjs` passed in one Edge context using real WAV playback and a deterministic YouTube API fixture. Local time advances across minimize/expand, volume and queue remain unchanged; YouTube player/frame/src identities remain unchanged, only one instance exists, fixture time advances, Now Playing stays active and embed dimensions meet the minimum. The suite also verifies shared controls, source switching, routes, persistence, Media Session and reduced motion with zero page errors. The 13 focused model/integration/Collection tests passed. No PARTY/WebRTC regression suite was run.

Files for this polish: `dist/music-bridge.js`, `dist/spaceamp.css`, `tests/music-polish-browser.cjs`, this document, and the updated host description in `docs/history/music-v1.6.md`. Screenshots are in `artifacts/spaceamp-polish/` (local compact, YouTube fixture compact, full).
