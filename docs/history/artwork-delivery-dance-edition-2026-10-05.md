# Artwork delivery and Dance! edition

Artist photo follow-up: live Kinokoteikoku search supplies a square 800 × 800 image, while browse can supply a horizontal banner. Artist browse now uses the exact-ID search photo; old Google banner metadata no longer overrides it in detail presentation. Explicit cover selection and custom images remain preferred. Live search → details verified the same photo URL. No natural-ratio layout change was applied.

Presentation follow-up: the initial artist detail load no longer labels its reserved image box as unavailable before metadata finishes. When a search photo exists, it stays primary after detail enrichment; a different banner is fallback rather than an automatic replacement. Artist images use contain so complete images are not center-cropped. Ten Catalog/artwork tests and syntax/diff checks passed for this adjustment.

After both Google CDN host variants still failed in Zen, catalog artwork now loads through `/api/music/artwork`. The server fetcher allows only HTTPS lh3/yt3.googleusercontent.com opaque image paths, rejects ports/credentials/query/hash and redirects, permits JPEG/PNG/WebP only, times out at 6 seconds and limits bodies to 2 MiB. It caches up to 24 images for 15 minutes and shares identical requests in flight. Artwork.set and catalog-picker images route Google assets through this endpoint; metadata URLs and stored items remain unchanged. No general-purpose proxy, cookies or media-stream extraction was introduced.

Artist details preserve the photo supplied by search: it remains primary if the detail response has no image, and becomes fallback when details return a different banner. Real Duran Duran search and detail images both fetched successfully through the restricted delivery module.

One Edge browser/context decoded 19 live artist/album images (Kinokoteikoku and Shihoko Hirata) through the local endpoint while direct external browser requests were blocked. Restricted-host, size, content-type and cache tests passed. Zen confirmation remains user-side.

Dance! (3:29) exposes an edition issue rather than artist-spacing failure: MusicBrainz returned JPK651500201, whereas public lrc.red metadata verifies compatible catalog-release edition JPK651669301. A unique MusicBrainz recording code is now checked against release metadata; a unique compatible verified edition can replace it. If none is verified, the recording code is retained. No code is hardcoded. Live complete Catalog details now returns JPK651669301 from lrc.red.

Lookup revision 10 retries older MusicBrainz detail results. MusicBridge can persist a verified lrc.red replacement for an older MusicBrainz ISRC when reopening details, preserving playback source and item identity. User/manual identifiers are not replaced by this rule. Unit tests cover edition selection/preservation and artist search-photo fallback; syntax/diff checks passed. Audio/video lifecycle is unchanged.
