# Artwork presentation and Wonderwall edition

Follow-up network evidence: the user's Zen screenshot shows `NS_ERROR_DOM_NETWORK_ERR` on a yt3.googleusercontent.com image. It confirms request failure, without identifying whether browser protection, connectivity or CDN behavior caused it. Equivalent asset URLs on lh3.googleusercontent.com returned HTTP 200 image/jpeg for live Wonderwall results. Newly normalized primary images now use lh3 while preserving the provider's original yt3 thumbnail as fallback; asset identity, resize options and existing image-error handlers are retained. No image proxy or arbitrary remote fetch endpoint was added. Verification in the user's Zen remains needed.

Oasis artist browse supplies a horizontal banner (`w2880-h1200`), displayed in a square cover with `object-fit:contain`. The artist title-page photo now uses `object-fit:cover` to fill that authored square. This does not change video iframe framing or playback.

Google resizable artwork results now also retain the original provider thumbnail in imageFallback. The existing search/detail image error handlers already use this field, so an unavailable enlarged asset can fall back without discarding artwork. In an isolated Edge browser/context, all 39 real Wonderwall search/Oasis album artwork URLs loaded. The user's remaining Zen failures were not reproduced; request status/error was requested to distinguish browser blocking, CDN failures and missing parsed URLs. No claim of complete resolution for that issue is made.

Wonderwall: YouTube Music credits the title as Wonderwall and the album as `(What's The Story) Morning Glory? (Remastered)`. lrc.red titles the recording `Wonderwall (Remastered)` and labels the same album with brackets. Previously exact title comparison rejected it, while the broad match response exceeded the eight-candidate bound with unrelated live/mixed results.

The edition resolver now permits a plain trailing remaster designation in the candidate title only when the target's album explicitly says remastered and the normalized albums are identical. It filters discovery hits by compatible title/duration before the bounded metadata fetch. Original/other albums and live versions remain rejected. Live verification resolved `GBQCP1400149`. Negative lookup revision increased to 9.

26 artwork/catalog/ISRC tests passed; syntax/diff checks passed. No iframe or audio lifecycle changes were made. Square artwork in a YouTube track's 16:9 video can be letterboxed; this alone is not evidence of a mobile player.
