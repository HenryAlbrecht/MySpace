# am-lyrics 1.7.4

Distribution derived from @uimaxbai/am-lyrics@1.7.4 and locally modified:
https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics@1.7.4/dist/src/am-lyrics.min.js

Upstream: https://github.com/binimum/am-lyrics
License: MPL-2.0, preserved in am-lyrics-LICENSE.txt.

Local changes are limited to request lifecycle and privacy controls:
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

Rendering, motion, TTML/LRC parsing, provider ordering, and SPACEAMP playback
integration remain otherwise unchanged.
