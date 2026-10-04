# am-lyrics 1.7.4

Upstream: https://github.com/binimum/am-lyrics
Package: @uimaxbai/am-lyrics@1.7.4, jsDelivr dist/src/am-lyrics.min.js.
License: MPL-2.0 (see am-lyrics-LICENSE.txt).

Local change: character emphasis scale is multiplied by --am-lyrics-character-emphasis (default 1). Now Playing sets 0 to prevent glyph scale reset at line completion. The default retains upstream behavior. No provider, parsing, clock or scrolling changes. Preserve this change when updating the pinned bundle.

Additional presentation change: exiting persisted highlight captures glyph/syllable transforms before cleanup and settles to their idle transforms in 320 ms with cubic-bezier(.22,1,.36,1). Skips reduced motion, disconnected and newly active lines. Resets cancel when character motion restarts. Now Playing no longer disables native character emphasis/lift.

Seek reset also uses the settle path. Public smoothSeek() captures glyph transforms before a host-driven seek and interpolates changed transforms afterward; respects reduced motion and disconnected nodes.
