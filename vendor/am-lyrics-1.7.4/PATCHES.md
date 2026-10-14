# MySpace patches

The upstream source snapshot and commit are recorded in [UPSTREAM.md](UPSTREAM.md).
The local TypeScript source carries these changes:

- **`src/AmLyrics.ts`:** pass the current component lifecycle's `AbortSignal`
  through provider discovery, metadata lookup and TTML downloads. Abort fetches
  on disconnect or track change, stop fallback after cancellation, and preserve
  completed lyrics across disconnect/reconnect.
- **`src/AmLyrics.ts`:** omit credentials and Referer from requests; restrict
  Binimum `lyricsUrl` values to HTTPS `lrc.red` and `lyrics-api.binimum.org`,
  with redirects rejected.
- **`src/AmLyrics.ts`:** avoid requesting the canonical LyricsPlus server twice
  during a single provider search.
- **`src/AmLyrics.ts`:** accept supplied TTML as an explicit source and prevent
  internal providers from running when that payload is empty or invalid.
- **`src/AmLyrics.ts`:** remove the upstream version/"Star me on GitHub"
  self-promotion from the rendered lyrics footer; upstream licensing and
  attribution remain in `LICENSE` and `dist/vendor/am-lyrics-NOTICE.md`.
- **`src/AmLyrics.ts` and `src/GoogleService.ts`:** deduplicate concurrent
  translation/romanization, cancel retries and delays with the component
  lifecycle, and omit lyric content from romanization error messages.

Rendering, animation timing, parsing, scrolling and source-selection behavior
remain based on upstream 1.7.4. The app build remains a standalone ESM bundle;
Lit and TypeScript are not runtime requirements outside this vendor file.
