# YouTube Music primary catalog

Implemented on `feature/spaceamp-now-playing`, preserving the existing SPACEAMP iframe playback engine.

## Reference reading

Studied the public [BitChord repository](https://github.com/kushagrasinghx/BitChord): `data/YtMusicRepository.kt`, `data/innertube/Innertube.kt`, `data/innertube/InnertubeParser.kt`, `data/model/Models.kt` and `data/sources/YouTubeSource.kt`.

Conceptual references: separate filtered searches, guest request context, video versus browse identity, renderer normalization and exact identity deduplication. Album play overlays must not make an album look like a song. Our JavaScript provider/parser were implemented independently; no Kotlin files or substantial code were copied. Native stream selection, account/login and audio architecture were not adopted.

## Behavior and identity

`/api/music/search` uses YouTube Music first, with Songs / Albums / Artists filters. Empty useful results, timeout or provider errors use the existing Apple search. Results are not combined by default. Explicit `provider=itunes` remains supported.

IDs:

- Songs: `ytmusic:video:<videoId>` (11 validated characters).
- Albums: `ytmusic:album:<MPRE… browseId>`.
- Artists: `ytmusic:artist:<UC… browseId>`.

The guest context, shell configuration, filters and POST search/browse requests are encapsulated in `server/youtube-music.cjs`; renderer details are isolated in `server/youtube-music-parser.cjs`. Requests time out after 8 seconds. Configuration lasts 4 hours; normalized results/entities last 15 minutes, with 80-entry bounds and identical requests shared while in flight. Only normalized metadata is cached.

Song results and album tracks include a canonical validated YouTube playbackSource, videoId, duration in seconds where present, and HTTPS artwork selected at the largest supplied resolution. Search rejects generic user-uploaded videos. Album track shelves additionally accept official music videos, since a real album can use them (Republic's Regret is one example). Recommendations outside the album shelves are excluded from its tracklist. Artists expose available top tracks, albums and singles/EP category information for the existing UI. Provider artwork is preferred; the existing Deezer artist-photo fallback and Last.fm editorial enrichment remain available.

New YouTube Music songs save with their source and skip autoLink. The editor now preserves non-form music metadata before validation: previously normalizing form values alone inserted a null playbackSource and erased the seeded source. The existing play action still passes MusicModel.queueTrack into SPACEAMP.

Old Apple routes, IDs, local files, manual playback links, backups and the automatic resolver remain compatible. No destructive migration runs. A YouTube browse failure propagates as an unavailable detail request; its ID is never passed to Apple and its entity is never silently substituted. Song details after cache expiry can search metadata hints, accepting only the exact original videoId.

## Conservative recording deduplication

Exact local/provider identity remains MusicModel.sameItem. Work-level display matching remains separate from recording deduplication. New YouTube Music songs may enrich an existing item from another provider when there is one unambiguous match: same source identity, then matching ISRC without edition conflicts, then exact normalized title/artist plus matching album and duration within 3 seconds. Missing evidence, edition conflicts and multiple equal candidates keep separate items. Different YouTube Music video IDs are not merged by metadata alone.

An existing item's local ID, Apple catalogId, status, edits and chosen playbackSource survive. The new YouTube identity is retained in metadataSources.youtubeMusicId. A manual local or YouTube playback choice wins over catalog playback.

## Files

Created: provider parser, `tests/youtube-music-catalog.test.cjs`, focused `tests/youtube-music-catalog-browser.cjs`, this history note.

Updated runtime: `server/youtube-music.cjs`, `server/music-catalog.cjs`, `server.cjs`, `dist/catalog.js`, `dist/music-model.js`, `dist/extras.js`, `dist/title-pages.js`. Existing Apple-specific tests now inject an unavailable/empty YouTube provider so their fallback assertions remain deterministic: apple-canonical, artist-search-photos, music-search-quality, music-unified-search and music-flow-http-smoke.

## Validation

62 focused tests passed, covering filters, identity, isolated caches/in-flight dedup, timeout recovery, search fallback, browse failure, safe artwork, durations, edition ambiguity, old Apple/local data and the unchanged resolver. Collection and Catalog tests were included. The HTTP Apple fallback smoke passed. Syntax and git diff whitespace checks passed.

The browser smoke uses one browser/context per run. The first run exposed the editor source-loss bug; the corrected run passed search/details → seeded editor → persisted source with zero resolver calls, existing play-action boundary, preserved Apple ID/status/manual local link, reload persistence and Apple fallback. Actual YouTube audio playback was not exercised by this smoke; no PARTY/WebRTC regression ran.

Public live metadata smoke: New Order Regret returned a playable validated song ID; Republic returned 11 tracks beginning with Regret; New Order details returned 5 top tracks and 20 album entries with provider artwork.

## Limits

Artwork follow-up: search's largest supplied thumbnail can still be only 120×120. New catalog results request the same Google image-CDN asset at 800×800, retaining larger sizes and other URL options. Fixed YouTube video thumbnails stay unchanged. Existing Collection images are not migrated, as requested. Ten provider/artwork regression tests passed; a real Prime Time Golden Hour Show image response measured 800×800.

This is an unofficial guest metadata provider. Renderer shapes, filters, availability, region and rate limits can change. Search/browse expose the first available page (search limit 40, album tracks bounded at 200); continuation/typeahead UI is not implemented in this pass. Album browse IDs are deliberately constrained to MPRE, artist IDs to UC. A cold song detail lookup can remain unavailable if metadata search does not contain its exact video ID; saved playback is retained. Validated playback sources do not guarantee that YouTube permits embedding, that a video stays available, or instant playback. Apple fallback can add the provider timeout to search latency. Existing Last.fm recommendations continue resolving through Apple; this pass changes the primary search/catalog path.
