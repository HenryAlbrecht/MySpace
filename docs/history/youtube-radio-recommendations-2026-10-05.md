# YouTube Music track radio

Music recommendations with a bound YouTube video ID now use the guest YouTube Music next endpoint and the RDAMVM radio mix. The frontend passes the catalog video ID or linked playback video ID from both title discovery and collection discovery. The primary path makes no Last.fm similarity request and no per-result catalog search.

The bounded radio parser accepts up to 40 identified songs with title and artist metadata, excludes the seed, duplicate IDs and unavailable rows, and preserves catalog/playback IDs, album references, duration and artwork. Existing discovery filters continue excluding Collection items and dismissed suggestions. Guest-client TTL cache and in-flight sharing apply to radio requests. UI text identifies the radio source.

Artist/album discovery and tracks without a bound video ID retain complementary Last.fm recommendations resolved to YouTube catalog entries. No Google account, history reporting, autoplay behavior, audio extraction or playback engine changes were added. No external source code was copied.

One live cold guest radio query for Kokudouslope returned 40 suggestions in approximately 1.8 seconds; a subsequent cached call measured below 1 ms. This is a single observation, not a controlled comparison or latency guarantee. Fourteen focused tests passed, including parser exclusions, shared next requests, correct source attribution and bypassing Last.fm for bound tracks. Browser verification confirmed the recommendation button forwards videoId and displays the radio response, alongside existing cover-continuity/navigation checks.
