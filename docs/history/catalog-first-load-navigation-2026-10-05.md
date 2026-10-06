# First-load details and lyrics continuity

Mini-player artwork follow-up: global mini cover and profile albumImage still assigned remote Google URLs directly, bypassing the restricted local delivery used by detail covers. Both now use Artwork.set/clear with decode/error callbacks. Browser regression loaded and decoded the mini cover via /api/music/artwork with direct Google image requests blocked, including after reload; seven artwork/SPACEAMP unit tests passed.

Title detail enrichment retains the decoded cover DOM node when item identity and source are unchanged instead of rebuilding it and hiding it for a second decode. Failed artwork can still be retried. Artist detail no longer overwrites incoming catalog photo metadata with saved banner metadata before the existing custom-image selection checks.

Title navigation remembers which routes were opened internally and uses browser history for their Back button. Nested artist/album/song/recommendation visits return to the preceding page; direct entry retains the existing fallback destination.

Playback enrichment now rechecks old MusicBrainz identifiers (lookup version before 11), not just missing identifiers. Queue conversion retains identifier provenance/version and background refresh persists verified lrc.red replacements to Collection. Manual identifiers and already-verified identifiers remain unchanged. This fixes a gap between server-side discovery and previously saved playback metadata.

Live Kokudouslope metadata and TTML endpoints both returned HTTP 200. Thirty-one focused unit tests passed. Browser fixtures verified stale YouTube catalog metadata → refreshed ISRC → official am-lyrics source lrc.red → persistence/reload, and decoded cover node retention plus artist-to-artist Back navigation. These fixtures do not reproduce Zen networking: cold startup still needs remote image delivery and optional metadata, but unchanged decoded images no longer reload on detail completion.
