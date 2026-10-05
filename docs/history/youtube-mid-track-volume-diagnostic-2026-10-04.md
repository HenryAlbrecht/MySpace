# YouTube mid-track volume investigation — 2026-10-04

Diagnostic cleanup: after the user confirmed stable real playback with the cover CSS change, the temporary audio snapshots, sampling, instance counter and public diagnostic method were removed. Commands below are historical and no longer available. The cover presentation fix and playback-volume regression test remain.

## Cover presentation experiment

User comparison: Prime Time Golden Hour dropped in cover mode at 2:13; video mode started at a lower perceived level and remained stable. Authorized minimal CSS experiment replaces cover-mode `display:none` with an absolutely positioned, normal-sized, transparent non-pointer-interactive host. It excludes the Now Playing video popover. No volume, queue or iframe lifecycle behavior changes. A single browser/context with mocked playback verifies nonzero iframe dimensions (at least 200×200) in cover mode and unchanged player/frame/context, position, volume and playback calls through cover/video presentation, including responsive layouts. This verifies presentation invariants, not real audible gain; the user must compare real playback before treating the volume issue as fixed.

User reported a volume drop during Wonderwall by Oasis at 2:16 without using the volume controls. Cause remains unresolved. An isolated real-player browser probe could not reach playback: the embedded player returned an error. No conclusion about real audio gain was drawn from that failure or from mocked playback tests.

User subsequently reported no drop when playing the identical video directly on YouTube. The supplied 64-row trace for ECwKc39xj5k spans 91.93–154.54 seconds: requested and reported volumes remain 100, mute stays false, and playback time advances continuously. This does not measure audible gain and does not cover the earlier 160-second occurrence. Source review found no halfway volume adjustment and the local audio analyser does not process YouTube audio. The diagnostic now also records adapter instance, frame connectivity, document visibility, reported player state/duration/rate, and state/error callbacks. Comparing visible-video playback against cover mode is the next isolation step; cause and fix remain unconfirmed.

The existing YouTube adapter now records at most 64 local in-memory audio snapshots. Sampling reuses timeline reads and is limited to once per second. Explicit volume writes, readiness and closure are recorded separately. Snapshots include requested volume, the player's reported volume/mute, position and playback URL. No timer, network telemetry, compensation or new audio processing was added.

After reloading, reproduce the drop and inspect before changing tracks:

```js
copy(JSON.stringify(SpaceAmpIntegrations.getYouTubeAudioDiagnostics(), null, 2))
```

A difference between requested and reported volume can distinguish provider volume drift from a SPACEAMP volume request. Equal values do not prove the audible gain is unchanged: source dynamics, player processing and OS/output handling still require investigation. The IFrame API does not expose the audio waveform or stable-volume processing controls through its documented interface.

Nine adapter/core tests and page smoke pass. Diagnostic tests cover reporting drift without issuing volume writes, copied snapshots, the 64-row bound, and closed-player handling. The production volume behavior remains unchanged.
