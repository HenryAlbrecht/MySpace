/* Immutable description of why a SPACEAMP playback session was started. */
(function (root) {
  const TYPES = new Set(["album", "playlist", "discovery", "search", "collection", "single"]);

  function create(value = {}) {
    const type = TYPES.has(value.type) ? value.type : "single";
    const tracks = Array.isArray(value.tracks) ? value.tracks.map((track) => ({ ...track })) : [];
    const startIndex = Math.max(
      0,
      Math.min(tracks.length - 1, Number.isInteger(value.startIndex) ? value.startIndex : 0),
    );
    return {
      type,
      sourceId: String(value.sourceId || "").slice(0, 200),
      title: String(value.title || "").slice(0, 200),
      tracks,
      startIndex,
      revision: Number.isInteger(value.revision) ? value.revision : 0,
      getNext: typeof value.getNext === "function" ? value.getNext : null,
    };
  }

  root.PlaybackContext = { create, types: [...TYPES] };
  if (typeof module !== "undefined") module.exports = root.PlaybackContext;
})(globalThis);
