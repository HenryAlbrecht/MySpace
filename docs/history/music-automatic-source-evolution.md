> Histórico: decisões e validações de fases anteriores. O contrato atual está em [music](../music/apple-canonical-catalog.md) e [vínculo de reprodução](../music/music-automatic-source.md).

# Automatic music links without a YouTube API key

New music library entries without playbackSource invoke an asynchronous lookup after the entry is saved. The existing frontend server exposes `/api/music/playback-source?title=…&artist=…`, using the existing MusicBrainz catalog client and its queue/cache. No API key, package, scraping, extraction or new server is required.

Lookup matches recording title and credited artist exactly after case/accent/punctuation normalization. It reads recording URL relationships, accepts only YouTube URLs supported by the current playback adapter, deduplicates video IDs and refuses an automatic choice for multiple URLs or disambiguated versions. A single compatible source for a recording without disambiguation is saved automatically. Catalog metadata remains unchanged; direct catalog and preview URLs never become playback sources.

While the lookup runs, the library displays a short status. No result or failure retains manual linking. The linking dialog offers “buscar reprodução”, selectable candidates, an editable URL and local file selection. Lookup results never overwrite a source added manually while a request was pending, nor a renamed/deleted item. Existing entries can use the dialog to search; startup does not automatically scan the library.

MusicBrainz is a community catalog, not a full streaming/search index. Coverage of recording URL relationships is limited. A live request for “Nobody's Fool” / Avril Lavigne succeeded but returned no compatible link; that entry therefore needs manual linking. The API is keyless, but not guaranteed to find a playback source for every song. Deezer/Last.fm references remain metadata. Returned YouTube links continue using the existing YouTube playback adapter, without invoking YouTube search API.

Validation: 4 resolver tests cover exact match, cache, mismatched artist, absent/unsafe/catalog URLs, ambiguity, version and errors. The 13 existing focused tests passed. `tests/music-auto-source-browser.cjs` passed in one Edge context with zero page errors, using deterministic lookup responses to verify automatic linking, metadata preservation, manual override, fallback and candidate selection, plus shared playback controls and preferences. The real MusicBrainz query verifies service access, not a successful universal match.

Files: `server/musicbrainz.cjs`, `server/music-catalog.cjs`, `server.cjs`, `dist/extras.js`, `dist/music-bridge.js`, `dist/spaceamp.css`, `tests/music-auto-source.test.cjs`, `tests/music-auto-source-browser.cjs`. Playback architecture and PARTY/WebRTC remain unchanged.

## Search and dialog review

Live diagnosis found Deezer's first results for Wonderwall were covers, while Last.fm and iTunes returned Oasis. Auto mode no longer stops at the first nonempty provider. Music search merges these three catalogs, deduplicates title/artist matches, borrows artwork/album metadata, preserves provider references and ranks exact titles with listener counts and provider relevance. Explicit provider selection remains supported. One unavailable provider does not remove other providers' results.

The playback resolver previously inspected only the first three recording results. The official Britney Spears video appeared fourth. It now considers a wider search, prioritizes official video and standard recording versions, then inspects up to four recordings through the existing rate-limited client. Standard album/single/original/official-video labels may auto-match; live/remix and other ambiguous versions still require selection. Multiple distinct compatible URLs still require selection.

Live checks after the fixes: Wonderwall / Oasis is first in automatic search; Oops!...I Did It Again / Britney Spears resolves to `https://www.youtube.com/watch?v=CduA0TULnow`. These results come from providers, not hardcoded overrides. Playback of that real video itself was not automated.

The linking dialog now has a desktop titlebar and close control, padded content, song/artist hierarchy, labeled URL/file fields, a compact search button, bounded candidate list, readable status and adjacent cancel/save footer buttons. Screenshot: `artifacts/music-search-review/link-dialog.png`.

Regression coverage: `tests/music-search-review.test.cjs` verifies cross-provider original discovery and the official video beyond the first three records; the browser suite checks manual editing/selection with the new dialog. No playback core or PARTY/WebRTC changes are made in this review.
