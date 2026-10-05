# YouTube Music playback source resolver — 2026-10-04

Collection continues to use Apple/iTunes identity and metadata. New music is saved immediately, then the existing MusicBridge/MusicSourceLink auto-link flow asks `/api/music/playback-source` for title, artist and optional album/duration. A confident result adds only `playbackSource`; it does not create a YouTube catalog item or start playback.

## Search and matching

- `server/youtube-music.cjs` isolates public guest shell configuration and Innertube Songs search. Only playable `MUSIC_VIDEO_TYPE_ATV` song rows are parsed. No account cookies, login, player endpoints, audio extraction or media requests are implemented.
- Client configuration is read as JSON from public `ytcfg.set` calls, cached for four hours, and never evaluated as JavaScript. A compatible guest User-Agent is required by the public shell.
- Search has an eight-second deadline covering configuration and search, a bounded 80-entry/15-minute memory cache keyed by normalized target metadata, and in-flight request/config deduplication. Failed requests are not cached as successful results.
- `server/music-playback-matcher.cjs` validates IDs/YouTube URLs and scores exact normalized title (45), artist overlap (30), song type (5), duration within 3/6/10 seconds (20/16/10), and exact album (12). A 10–20-second mismatch incurs -15; over 20 seconds is rejected. Automatic selection requires score >=90 and margin >=8 over the next eligible candidate.
- Version conflicts are directional hard rejects. Live, remix, acoustic, demo, instrumental, karaoke, sped/slowed, nightcore, remaster, radio edit, extended, version and cover qualifiers are retained. Related versions may be shown for manual choice; they cannot win automatically against an incompatible target.
- Strong but ambiguous YouTube Music results remain `choose`. Empty/ineligible results or provider failure use the existing MusicBrainz resolver. If both services fail, the saved Collection item remains available for manual linking. Direct audio suggestions remain manual choices.

The Songs filter and renderer semantics were checked against the upstream [ytmusicapi search implementation](https://github.com/sigma67/ytmusicapi/blob/master/ytmusicapi/mixins/search.py) and [parser](https://github.com/sigma67/ytmusicapi/blob/master/ytmusicapi/parsers/search.py). This internal guest API can change; its implementation and parser fixtures are isolated so fallback remains usable.

## Persistence and manual controls

- Automatic results are passed through `MusicModel.source()` and restricted to a valid YouTube source before persistence.
- Guards compare catalog/title/artist/album/duration and the current saved object revision. Deletion, metadata edits or a manual source invalidate an older automatic response. A removed item cannot be resurrected by a response or a stale link dialog.
- Existing sources skip auto-search. Existing Apple duplicate handling preserves item identity/source.
- Explicit creation opens the existing dialog for `choose`, using cached results without another request. Candidate rows show optional artwork, title, artist, album and duration. Selecting a row only marks it and fills the URL; saving is explicit.
- Retry, external YouTube search, pasted YouTube/direct audio URLs, local files and source replacement remain available.

## Validation

- Offline matcher/provider/parser/source-link/resolver tests cover confidence, album tie-breaks, version direction, malicious sources, timeout, cache/config expiry, deduplication, save/manual/edit/delete races and ambiguity.
- Collection and source-model unit tests, page smoke, syntax and diff checks pass.
- One focused browser/context verified immediate save, persisted auto-link, duplicate prevention, manual/edit races, cached choice with confirm-before-save, and metadata preservation when both providers fail. It did not start playback or test PARTY/WebRTC.
- One real guest Songs search for “The Smiths Heaven Knows I'm Miserable Now” returned the original Hatful of Hollow song, 216 seconds, video ID `10z6-vQm23w`, together with distinct remasters/covers. The normalized original meets the tested automatic matching policy. Automated tests use fixtures and mocks, not live YouTube availability.

SPACEAMP Core, queue, YouTube IFrame lifecycle, Now Playing/XMB/gamepad, lyrics, Kawarp, Media Session, artist-photo provider and editorial logic are unchanged by this pass.

## Collection form follow-up

Catalog metadata seeded the add editor as `previous` even though it had no saved item ID. `storeItem` therefore skipped the new-item automatic lookup. Unsaved seeds now use the new-item path while retaining their metadata. The focused browser test submits the actual Collection editor instead of calling `saveMusic` directly; mocked matched and ambiguous results cover the reported Pursuing My True Self / Signs Of Love workflow without asserting live matches for those songs.

## Japanese credit spacing and volume investigation

Wonderwall (Remastered) follow-up: live Songs search returned Oasis / Wonderwall, 259 seconds, with the remaster designation on the album instead of the title (including rj5wZqReXQE). Version checks now consider an album remaster designation and allow relocation of a plain parenthesized remaster title qualifier. Original, live, other-artist and incompatible-duration results remain rejected; album ties still require manual choice and explicit differing remaster title years remain distinct. Focused matcher/provider/resolver/source-link suite: 20 passing tests.

A live guest search for God knows... / 涼宮ハルヒ(CV.平野綾) returned song rows, including 涼宮ハルヒ (CV.平野 綾), 281 seconds, AYA MUSEUM, video h7RJt6eDK70. Exact artist comparison rejected the inserted space. Artist matching now removes spaces only between Japanese script characters, preserving the complete character/CV credit, Latin word boundaries, version and duration checks. Romanized names are still not assumed equivalent without verified alias evidence. Regression coverage rejects different characters, voice actors, covers and incompatible duration/version.

The reported mid-track volume drop remains unconfirmed. Source inspection found player volume writes only on readiness and explicit volume controls; a mocked adapter test confirms playback/buffering/pause/seek events do not issue additional volume writes. This does not prove live embedded player gain stays constant. YouTube's own stable-volume processing is a possible cause for some videos, but its help documentation excludes YouTube Music and official music videos, so it is not asserted as the cause. No automatic volume compensation or playback lifecycle change was added.
