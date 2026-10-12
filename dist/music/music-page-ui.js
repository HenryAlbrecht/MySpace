/* Music rows share catalog navigation and the existing playlist controller. */
(() => {
  const node = (tag, text = "", cls = "") => {
    const n = document.createElement(tag);
    n.textContent = text;
    n.className = cls;
    return n;
  };
  const plainText = (value) =>
    String(value || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li)>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(
        /&(amp|lt|gt|quot|apos|nbsp);/g,
        (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity],
      )
      .replace(/&#(\d+);/g, (_, code) =>
        Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : "",
      )
      .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
      .trim()
      .slice(0, 30000);
  const clock = (value) =>
    Number.isFinite(value) && value > 0
      ? Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0")
      : "";
  function playingRow(row, state) {
    row.classList.toggle(
      "is-playing-track",
      !!state?.playing && !!row.dataset.playbackUrl && row.dataset.playbackUrl === state.sourceUrl,
    );
  }
  for (const event of ["spaceamp:trackchange", "spaceamp:playstate"])
    window.addEventListener?.(event, () => {
      const state = SPACEAMP.getPlaybackState();
      for (const row of document.querySelectorAll(".music-track-row[data-playback-url]"))
        playingRow(row, state);
    });
  function tagLink(value) {
    const a = node("a", plainText(value), "music-tag-link");
    a.href = "#tag/" + encodeURIComponent(value.trim());
    return a;
  }
  function contextLink(value, kind, id) {
    if (!id || !MusicModel.validCatalogId(kind, id)) return node("span", value);
    const a = node("a", value);
    a.href = "#titulo/" + kind + "/" + encodeURIComponent(id);
    a.onclick = (e) => {
      e.preventDefault();
      TitlePages.open({
        kind,
        catalogId: id,
        title: value,
        source: id.startsWith("ytmusic:") ? "YouTube Music" : "iTunes",
      });
    };
    return a;
  }
  function trackRow(item, index, { artwork = true, context = true } = {}) {
    const row = node("li", "", "music-track-row"),
      number = node("span", String(index + 1).padStart(2, "0"), "music-track-number");
    if (!context) row.classList.add("music-track-no-context");
    if (MusicBridge.canPlay(item)) {
      try {
        row.dataset.playbackUrl = MusicModel.source(item.playbackSource)?.url || "";
      } catch {}
      playingRow(row, SPACEAMP.getPlaybackState());
      const play = node("button", "", "music-track-play");
      play.type = "button";
      play.setAttribute("aria-label", "Tocar " + item.title);
      play.append(number, node("span", "▶", "music-track-play-icon"));
      play.onclick = () =>
        Promise.resolve()
          .then(() => MusicBridge.play(item))
          .catch((error) => toast(error.message));
      row.append(play);
    } else row.append(number);
    const link = node("a", "", "music-track-main");
    if (item.catalogId) {
      row.dataset.catalogId = item.catalogId;
      link.href = "#titulo/music/" + encodeURIComponent(item.catalogId);
      link.onclick = (e) => {
        e.preventDefault();
        TitlePages.open(item);
      };
    } else link.removeAttribute("href");
    if (artwork) {
      const img = node("img");
      img.alt = "";
      Artwork.set(img, item.image);
      link.append(img);
    }
    link.append(node("span", item.title, "music-track-title"));
    row.append(link);
    Catalog.intentCore(link, item, (core) => {
      if (core?.trackDuration)
        row.querySelector(".music-track-duration").textContent = clock(core.trackDuration);
    });
    if (context)
      row.append(
        node(
          "small",
          [item.artist, item.albumTitle].filter(Boolean).join(" · "),
          "music-track-context",
        ),
      );
    row.append(node("span", clock(item.trackDuration), "music-track-duration"));
    if (MusicBridge.canPlay(item)) row.append(MusicBridge.playlistButton(item));
    return row;
  }
  function tracklist(items, options) {
    const list = node("ol", "", "music-tracklist");
    items.forEach((item, index) => list.append(trackRow(item, index, options)));
    return list;
  }
  const artistDurationLookups = new Map();
  function supplementArtistDurations(list, artist) {
    if (
      !artist.catalogId?.startsWith("ytmusic:artist:") ||
      !artist.topTracks?.some((track) => !clock(track.trackDuration))
    )
      return;
    // Run after insertion, once per artist. An unrelated edition never supplies a clock.
    setTimeout(async () => {
      if (!list.isConnected) return;
      if (!artistDurationLookups.has(artist.catalogId)) {
        artistDurationLookups.set(
          artist.catalogId,
          Catalog.search("music", artist.title).catch(() => []),
        );
        if (artistDurationLookups.size > 60)
          artistDurationLookups.delete(artistDurationLookups.keys().next().value);
      }
      const matches = await artistDurationLookups.get(artist.catalogId);
      if (!list.isConnected) return;
      const clocks = new Map(
        matches
          .filter((track) => clock(track.trackDuration))
          .map((track) => [track.catalogId, track.trackDuration]),
      );
      for (const row of list.querySelectorAll(".music-track-row")) {
        const slot = row.querySelector(".music-track-duration");
        if (!slot.textContent && clocks.has(row.dataset.catalogId))
          slot.textContent = clock(clocks.get(row.dataset.catalogId));
      }
    }, 0);
  }
  function releases(items, filter = "all", sort = "recent") {
    return items
      .filter((item) => filter === "all" || item.albumType === filter)
      .slice()
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (!a.releaseDate || !b.releaseDate)
          return a.releaseDate ? -1 : b.releaseDate ? 1 : a.title.localeCompare(b.title);
        return (
          (sort === "old" ? 1 : -1) * a.releaseDate.localeCompare(b.releaseDate) ||
          a.title.localeCompare(b.title)
        );
      });
  }
  function collectionGenreMatches(current, items) {
    const tags = (item) =>
      new Set(
        (item.genres || [])
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.normalize("NFKC").trim().toLowerCase())
          .filter(Boolean),
      );
    const own = tags(current);
    if (!own.size) return [];
    return items
      .filter((item) => item.kind === current.kind && !MusicModel.sameWork(item, current))
      .map((item) => ({ item, count: [...tags(item)].filter((tag) => own.has(tag)).length }))
      .filter((row) => row.count)
      .sort(
        (a, b) =>
          b.count - a.count ||
          Number(!!b.item.featured) - Number(!!a.item.featured) ||
          Number(b.item.score ?? -1) - Number(a.item.score ?? -1) ||
          Number(b.item.updated || 0) - Number(a.item.updated || 0),
      )
      .map((row) => row.item);
  }
  const recommendationKey = (item) => item.kind + ":" + item.catalogId;
  function recommendationWindow(
    pool,
    { saved = [], visible = [], seen = new Set(), rotate = false, rotation = 0 } = {},
  ) {
    const isSaved = (entry) =>
      saved.some((item) => MusicModel.sameWork(item, entry) || MusicModel.sameItem(item, entry));
    const limit = Math.min(12, pool.length),
      savedLimit = Math.max(2, limit - pool.filter((entry) => !isSaved(entry)).length);
    const selected = [],
      used = new Set();
    let savedCount = 0;
    const append = (entries) => {
      for (const entry of entries) {
        const key = recommendationKey(entry);
        if (selected.length >= limit) break;
        if (used.has(key) || (isSaved(entry) && savedCount >= savedLimit)) continue;
        selected.push(entry);
        used.add(key);
        if (isSaved(entry)) savedCount++;
      }
    };
    const preferNew = (entries) => [
      ...entries.filter((entry) => !isSaved(entry)),
      ...entries.filter(isSaved),
    ];
    if (rotate) {
      const current = new Set(visible.map(recommendationKey)),
        unseen = pool.filter((entry) => !seen.has(recommendationKey(entry)));
      // Four anchors leave room for eight alternatives, in source ranking order.
      append(preferNew(visible).slice(0, 4));
      append(preferNew(unseen));
      const others = pool.filter((entry) => !current.has(recommendationKey(entry)));
      const cursor = others.length ? (rotation * 4) % others.length : 0;
      append(preferNew([...others.slice(cursor), ...others.slice(0, cursor)]));
      append(preferNew(pool));
    } else {
      append(
        pool
          .filter((entry) => !isSaved(entry))
          .slice(0, Math.max(0, limit - Math.min(2, pool.filter(isSaved).length))),
      );
      append(pool.filter(isSaved));
      append(pool.filter((entry) => !isSaved(entry)));
    }
    return selected;
  }
  window.MusicPageUI = {
    plainText,
    tagLink,
    contextLink,
    trackRow,
    tracklist,
    clock,
    releases,
    supplementArtistDurations,
    recommendationWindow,
    recommendationKey,
    collectionGenreMatches,
  };
})();
