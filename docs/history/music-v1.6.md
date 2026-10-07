> Registro histórico de uma etapa concluída. Não representa, sozinho, o contrato atual; consulte [arquitetura vigente](../architecture.md) e [comandos de validação](../../tests/README.md).

# PARTY / SPACEAMP v1.6

`window.SPACEAMP` is the single controller and event source. Its existing local audio element and YouTube API binding remain the playback adapters. Collection, playlist, expanded player, global mini-player and Media Session invoke this controller. PARTY continues consuming its confirmed playback events and short Now Playing metadata. There is no new backend, player element, polling loop or presence protocol.

The persisted SPACEAMP playlist remains the listening queue (`myspace-extras-v1.tracks`). Collection remains the library (`items`). Sending a library item to the queue reuses its `collectionId` and explicit source. Queue snapshots are exposed by the controller; changing routes never reconstructs the playback element. The expanded view uses the original SPACEAMP DOM. After compact-mode polish, an attached YouTube iframe remains visible in both presentations: minimizing changes surrounding layout and its dimensions without moving or replacing the playback host.

Music items retain their catalog metadata, artist, album title and artwork. `metadataSources` stores known Deezer/Last.fm URLs and catalog identifiers separately from `playbackSource`. Sources are validated YouTube/YouTube Music URLs or IndexedDB local `fileRef` values; legacy direct audio URLs remain supported. A catalog URL is never inferred to be a playable full track. Items without sources remain valid and offer “vincular reprodução”. Existing manually saved `myspace.trackVideo` links are reused lazily; no old URL is invented. There is no YouTube search resolver in this project, so linking is manual, without scraping or automatic matching.

“Tocar agora” selects the source through the existing playlist adapter. “Adicionar à fila” retains the source without starting it. “Salvar na Collection” preserves the source and known metadata, and reuses existing library entries. Local files stay in IndexedDB; package backup includes files referenced solely by the library. Removing a queue item does not delete a file still referenced by the library.

The global dock provides previous, play/pause, next, volume and expansion. Pause retains controls; stopping retracts the collapsed dock. The full player keeps its seek controls. All Media Session handlers are registered once and call the same controller. PARTY music privacy affects only Now Playing publication, not playback or Media Session. YouTube publication still requires actual IFrame API PLAYING events; pause/end/error clear publication. External YouTube tabs cannot be controlled.

Dock entry/exit, expansion and artwork/metadata changes use short fade/slide transitions with existing `--motion-fast`, `--motion-focus`, `--motion-standard` and `--ease-xmb` tokens. Reduced motion disables them.

## Focused validation

- `node --test --experimental-test-isolation=none tests/music-v16.test.cjs tests/spaceamp.test.cjs tests/spaceamp-integrations.test.cjs tests/collection.test.cjs`
- `node tests/media-package-smoke.cjs`
- `node tests/music-playback-browser.cjs full` (runner vigente; substitui o alias histórico removido)

Browser verification uses one Edge context, real local WAV playback and IndexedDB, native Media Session registration with captured action callbacks, and a deterministic YouTube API event fixture. It covers Collection button playback, no-source UI, source linking, queue/library deduplication, route continuity, mini-player pause, shared volume, Media Session, privacy, source switching/disposal, next/previous, stop/end, persistence after reload and reduced motion. The fixture verifies API integration, not real YouTube streaming, sound quality or physical OS media buttons. No PARTY/WebRTC regression suite is run; room, chat, ICE/TURN, signaling, avatar and screen-share implementations are unchanged.

Screenshot: `artifacts/party-v16/global.png`.

## Files

- `dist/spaceamp.js`, `dist/app.js`, `dist/spaceamp-integrations.js`: controller and playback adapters.
- `dist/music-model.js`, `dist/music-bridge.js`: metadata/source validation, library actions, linking and global view.
- `dist/playlist.js`, `dist/extras.js`, `dist/collection.js`: queue and library persistence.
- `dist/collection-view.js`, `dist/title-pages.js`: library views use the shared player.
- `dist/index.html`, `dist/spaceamp.css`: loading and global dock styling.
- `dist/media-package.js`: include local library files in package backups.
- `tests/music-v16.test.cjs`, `tests/music-v16-browser.cjs`, `tests/media-package-smoke.cjs`: focused validation.
- `docs/history/music-v1.6.md`, `artifacts/party-v16/global.png`: documentation and visual evidence.
