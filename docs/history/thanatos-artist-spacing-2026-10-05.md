# Thanatos artist spacing

YouTube Music credits `Kinokoteikoku`; lrc.red credits `Kinoko Teikoku`. The artist-constrained match returned no hits. A title-only search was paginated and therefore correctly rejected by the existing ambiguity guard.

When constrained matching and verified aliases yield no hits, the edition resolver now tries title + album. Romanized ASCII artist names can differ only in spacing if the album also matches exactly. Exact title, duration within 1.5 seconds, valid ISRC and unique compatible edition remain required. Different artists, albums, live titles, incompatible durations and multiple compatible editions are rejected. No band-specific alias or ISRC is hardcoded.

Live confirmation: Thanatos / Kinokoteikoku / Time Lapse / 279 seconds resolves to `JPPO01803515`; public lrc.red metadata reports 278.28 seconds and line-synced lyrics. Lookup revision increased from 7 to 8 so negative cached detail results can be retried. Existing playback and artwork are unchanged.

Validation: 22 focused edition/ISRC/catalog tests passed, real resolver request passed, syntax and diff checks passed.
