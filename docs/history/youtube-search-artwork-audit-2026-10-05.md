# Musical search and artwork audit

New default music, album and artist searches now use YouTube Music exclusively. Empty results and provider errors no longer silently fall back to Apple. Explicit legacy iTunes provider access and details/discography for saved Apple IDs remain available without migrating stored identities.

Last.fm continues supplying recommendation seeds, but their catalog resolution now queries YouTube Music, verifies kind/title/artist and accepts only a unique candidate. Request sharing and bounded concurrency remain. This removes the iTunes-only recommendation resolver from the discovery path.

Collection editor previews now use Artwork.set/clear, including custom-file blob URLs. Remaining catalog-related direct assignments were routed through Artwork.url: playback-source choice thumbnails, embedded media posters, title gallery/banner images, Now Playing outgoing artwork and palette/WebGL input. Only supported Google artwork hosts use local delivery; other image URLs retain existing behavior and stored metadata URLs remain original.

Fifteen focused catalog, recommendation and image lifecycle tests passed. Browser regression loaded both the mini-player artwork and collection editor preview via /api/music/artwork with direct Google requests blocked. Syntax and diff checks passed. Earlier history/test assumptions about automatic Apple fallback describe the previous policy, superseded by the user's request for all new musical searches to use YouTube Music.
