> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# SPACEAMP v1.6 — presentation fixes

The legacy `.external-player` rules in `extras.css` hid the full transport button group and volume for embeds. Compact controls were also hidden in expanded presentation. Additionally, the full play button inherited a playlist UI guard that interpreted an empty local `loadedSource` as a missing file, even for YouTube.

The presentation bridge now binds that button directly to SPACEAMP play/pause and reflects confirmed core state in its label. Source-independent CSS restores the full transport group and volume. Metadata precedes transport; the official embed follows in a centered 360 × 200 viewport inside a narrower YouTube shell; privacy and playlist remain below. The unused YouTube equalizer placeholder no longer reserves space. The local waveform and seek remain intact.

The profile placeholder is now a metadata/control widget with titlebar, artwork, title, artist, local time, previous/play/pause/next, volume and open. It has no audio element or provider binding. Both profile and global controls observe the same SPACEAMP events and invoke the same controller. Missing tracks show a short empty state. Existing XMB metadata animations also apply to the profile widget, with reduced motion respected.

Minimize still changes only presentation classes around the stable host. It never reparents the iframe, modifies its source or calls destroy, seek, stop or play. Compact YouTube remains visible at 320 × 200.

Focused validation: 13 model/Collection/provider tests and `tests/music-views-browser.cjs` pass. The browser suite uses one Edge context, real WAV/IndexedDB, native Media Session registration and a deterministic YouTube API fixture. It checks profile pause/resume synchronization, visible and working full YouTube previous/next/play/pause/volume, queue/source switching, one active host, preserved iframe/player/src/time during minimize/expand, Now Playing, routes, reload and reduced motion. Zero page errors. No heavy PARTY/WebRTC suite was run.

Screenshots in `artifacts/spaceamp-views/`: `profile.png`, `local-full.png`, `youtube-full.png`, `local-compact.png`, `youtube-compact.png`. The YouTube screenshots contain the fixture viewport, not live streaming; live provider playback remains a manual validation.

Presentation files: `dist/music-bridge.js`, `dist/spaceamp.css`. Added focused suite: `tests/music-views-browser.cjs`. Existing browser suites scope compact selectors to the global dock so they do not confuse the new profile view with the global view.
