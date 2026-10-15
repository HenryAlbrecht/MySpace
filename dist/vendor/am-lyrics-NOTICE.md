# am-lyrics 1.7.4

Distribution built from the vendored TypeScript snapshot in
`vendor/am-lyrics-1.7.4/`, based on upstream commit
`4676f22044bb16a9e548b1f0085b03ad747725c9` (version 1.7.4):
https://github.com/binimum/am-lyrics/tree/4676f22044bb16a9e548b1f0085b03ad747725c9

Upstream: https://github.com/binimum/am-lyrics
License: MPL-2.0, preserved in am-lyrics-LICENSE.txt.

Local changes are recorded in `vendor/am-lyrics-1.7.4/UPSTREAM.md` and
`vendor/am-lyrics-1.7.4/PATCHES.md`:
- Propagate AbortSignal through lyric providers, metadata lookup, and Google
  translation/romanization; abort pending work when the component disconnects.
- Reject third-party lyricsUrl values unless they are HTTPS URLs on the exact
  lrc.red or lyrics-api.binimum.org hosts, with no credentials or custom port.
- Reject redirects for lyricsUrl fetches; omit credentials and Referer for all
  provider requests.
- Avoid repeating the LyricsPlus canonical fallback when that server was
  already queried, and avoid duplicate concurrent translation/romanization.
- Reuse completed lyrics when the detached component is reconnected, and omit
  lyric text from romanization error logs.
- Treat any explicitly supplied `ttml` value (including empty/invalid TTML) as
  the selected source and never fall through to vendor providers.

The upstream 1.7.4 rendering, motion, TTML/LRC parsers, provider order, and
SPACEAMP integration remain in the source. Only the bundle in this folder is
served by the app; rebuild it from source with the pinned `pnpm-lock.yaml`.
