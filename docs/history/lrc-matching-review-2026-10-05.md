# lrc.red matching review

Reviewed discovery, edition verification, catalog cache invalidation and playback metadata enrichment. No song-name or ISRC exceptions were added to runtime code.

Mixed Japanese/Latin titles separated by a spaced dash now expose both catalog-provided names to discovery and verification. Ordinary Latin subtitles and live/remix/remaster/version labels are not split. Unrelated fuzzy hits no longer block this transcription fallback. Final metadata still requires compatible artist credits, duration within 1.5 seconds, and a unique edition; joined/spaced Latin artist names require the same album. Pagination and ambiguous editions still fail conservatively.

Lookup version 11 invalidates older session metadata lacking a verified identifier. Background playback enrichment now accepts validated YouTube Music catalog IDs as well as Apple IDs, allowing saved tracks without an ISRC to be enriched when played, without awaiting metadata before playback. Successful enrichment persists identifier provenance and lookup version. Manually supplied identifiers remain unchanged.

Live full catalog enrichment for 国道スロープ - Kokudouslope returned JPB451202866, source lrc.red; public metadata uses Kokudouslope, Kinoko Teikoku, Eureka, 249.76 seconds against the catalog's 250 seconds. Thirty-one focused matching, catalog, identifier persistence and SPACEAMP tests passed. New negative cases cover wrong artist, album, duration, live/remix, arbitrary Latin subtitles and ambiguous editions. No browser visual verification was performed in this pass; lyrics vendor, scroll and playback timing were unchanged.

Remaining limitations: arbitrary transliteration is not guessed, localized artist aliases require identity evidence, incomplete paginated searches and multiple compatible ISRCs are not automatically selected. This pass reduces recurring metadata-format failures without promising every provider record can be resolved.
