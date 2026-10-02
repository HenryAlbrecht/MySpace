# SPACEAMP — profile first

The full, original SPACEAMP is again displayed at the profile's music slot, with artwork, equalizer, transport, seek, privacy and playlist. There is no simplified profile widget or second footer window on the profile. Away from the profile, the same host shows compact controls; its profile button returns to the profile instead of opening another expanded overlay.

The playback DOM stays mounted under the body. Profile presentation positions the host at the reserved profile slot and reserves its measured height; outside presentation positions it in the bottom-right corner. Route changes update CSS/layout only: they never reparent or recreate the iframe or audio element. Existing core, queue, adapters, Media Session and PARTY integrations remain unchanged.

Desktop compact dimensions are 480 × 244 px for both local and YouTube. The right-side 200 × 200 area contains local artwork or the visible official YouTube embed. This keeps provider controls available and avoids a source-dependent increase in window size. On smaller viewports width adapts. The profile view uses the profile column width for either source. The full YouTube embed is subordinate to metadata and universal controls.

Existing XMB fade/slide, metadata animations and reduced-motion support remain. The undo notification is positioned above the compact window rather than over the provider controls.

`tests/music-routes-browser.cjs` passed in one Edge context: profile anchoring, compact only outside, equal local/YouTube compact dimensions after transitions, identical iframe/player across route changes, local playback, queue, volume, Media Session, privacy, stop, persistence and reduced motion. Zero page errors. YouTube uses an API fixture, not real streaming. Screenshots: `artifacts/spaceamp-routes/profile.png`, `local-compact.png`, `youtube-compact.png`.

This route-specific browser test supersedes earlier tests that expected an expanded footer on the profile or a separate profile widget.

User-controlled compact visibility: outside the profile, × hides the entire window for both local and YouTube sources. A small “♫ SPACEAMP” button restores it. This session preference survives route and track changes; returning to the profile still shows the full player. Visibility changes do not invoke playback operations or remove/reparent the audio or iframe. The close control is absent on the full profile view. XMB transitions remain.

`tests/music-compact-visibility-browser.cjs` passed with one Edge context and zero page errors: local currentTime advances while hidden; the YouTube fixture retains the same player, iframe and PLAYING state while hidden and after reopening. Real YouTube background playback still requires manual confirmation, as the fixture does not verify provider/browser behavior.

Automatic opening now requires confirmed playback when entering another route. Pausing a compact player that already opened keeps its controls accessible; navigating while already paused does not open it. The full profile view remains available regardless of playback. The persisted checkbox “mostrar SPACEAMP nas outras abas”, inside the full player, can hide both compact and reopen button without changing playback, Media Session or PARTY publication.

Collection previews invoke `SPACEAMP.preview`, using the same audio adapter through a transient selection. They never insert a queue row or change the persisted active track, and ending a preview stops it without advancing the queue. Preview playback is explicitly marked and cannot accidentally save the previously selected queue entry into Collection. Normal track selection clears the preview marker.

`tests/music-preferences-browser.cjs` passed in one Edge context with zero page errors: paused route entry, automatic appearance during playback, persisted visibility preference, hidden launcher, continued playback, preview queue invariance and no advance on end, plus existing local/YouTube lifecycle and shared-control checks. The 13 focused unit tests also passed.
