// Small guest-catalog parser. Renderer details never leave this module.
(function (root) {
  const MusicModel = root.MusicModel || (typeof require === "function" ? require("./music-model.js") : null);
  const VIDEO = /^[\w-]{11}$/;
  const validBrowse = (kind, id) =>
    typeof id === "string" && (kind === "album" ? /^MPRE[\w-]{4,120}$/ : /^UC[\w-]{8,80}$/).test(id);
  const text = (value) =>
    String(value?.simpleText || value?.runs?.map((run) => run.text || "").join("") || "").trim();
  function collect(root, name) {
    const results = [];
    let visited = 0;
    function visit(value, depth) {
      if (!value || typeof value !== "object" || depth > 32 || ++visited > 20000) return;
      if (value[name]) results.push(value[name]);
      for (const child of Object.values(value)) visit(child, depth + 1);
    }
    visit(root, 0);
    return results;
  }
  function image(value, resize = true) {
    const thumbnails = collect(value, "thumbnails")
      .flat()
      .filter((row) =>
        /^https:\/\/(?:[\w-]+\.)*(?:ytimg\.com|googleusercontent\.com|ggpht\.com)\//.test(
          row.url || "",
        ),
      );
    const selected = thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || "";
    // Music artwork uses Google's resizable image CDN. Search often supplies
    // only w120-h120; request the same asset at cover size.
    if (resize && /^https:\/\/(?:[\w-]+\.)*(?:googleusercontent\.com|ggpht\.com)\//.test(selected))
      return selected
        .replace(/^https:\/\/yt3\.googleusercontent\.com\//, "https://lh3.googleusercontent.com/")
        .replace(
          /=w(\d+)-h(\d+)(?=-|$)/,
          (_, w, h) => "=w" + Math.max(800, Number(w)) + "-h" + Math.max(800, Number(h)),
        );
    return selected;
  }
  function duration(value) {
    if (!/^\d+(?::[0-5]\d){1,2}$/.test(value || "")) return undefined;
    const result = value.split(":").reduce((sum, n) => sum * 60 + Number(n), 0);
    return result > 0 && result <= 86400 ? result : undefined;
  }
  function durationFromText(value) {
    return [value?.simpleText, ...(value?.runs || []).map((run) => run.text)]
      .map((value) => duration(typeof value === "string" ? value.trim() : ""))
      .find((value) => value != null);
  }
  function twoRowArtwork(row, resize = true) {
    return image(row.thumbnailRenderer || row.thumbnail || row, resize);
  }
  function watchEndpoint(row) {
    return (
      row.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
        ?.playNavigationEndpoint?.watchEndpoint || row.navigationEndpoint?.watchEndpoint
    );
  }
  function musicVideoType(row) {
    return watchEndpoint(row)?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
      ?.musicVideoType;
  }
  function thumbnailDimensions(thumbnail) {
    const width = Number(thumbnail?.width),
      height = Number(thumbnail?.height);
    if (width > 0 && height > 0) return { width, height };
    const dimensions = String(thumbnail?.url || "").match(/[=/?&]w(\d+)-h(\d+)(?:[-&?]|$)/i);
    return dimensions
      ? { width: Number(dimensions[1]), height: Number(dimensions[2]) }
      : null;
  }
  function allowedThumbnail(thumbnail) {
    return /^https:\/\/(?:[\w-]+\.)*(?:ytimg\.com|googleusercontent\.com|ggpht\.com)\//.test(
      thumbnail?.url || "",
    );
  }
  function trackThumbnails(row) {
    const primary =
      row.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail ||
      row.thumbnail?.musicThumbnailRenderer?.thumbnail;
    const dedicated = collect(primary || {}, "thumbnails").flat();
    const candidates = [
      ...dedicated,
      ...collect(row.thumbnailRenderer || row.thumbnail || row, "thumbnails").flat(),
    ].filter(
      (thumbnail, index, values) =>
        allowedThumbnail(thumbnail) &&
        values.findIndex((candidate) => candidate.url === thumbnail.url) === index,
    );
    return { dedicated, candidates };
  }
  function mediaType(row) {
    const type = musicVideoType(row);
    if (type && type !== "MUSIC_VIDEO_TYPE_ATV") return "video";
    const description = [
      text(row.longBylineText || row.shortBylineText),
      ...(row.flexColumns || []).slice(1).map((column) =>
        text(column.musicResponsiveListItemFlexColumnRenderer?.text),
      ),
    ].join(" • ");
    if (/(?:^| • )(?:video|music video)(?: • |$)|\b[\d.,]+[KMB]?\s+(?:views|likes)\b/i.test(description))
      return "video";
    const thumbnails = trackThumbnails(row).candidates;
    const largest = thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    const size = thumbnailDimensions(largest);
    if (size && (size.width / size.height < 0.85 || size.width / size.height > 1.15))
      return "video";
    return "audio";
  }
  function trackArtwork(row, resize = true) {
    const { candidates } = trackThumbnails(row);
    const square = candidates
      .filter((thumbnail) => {
        const size = thumbnailDimensions(thumbnail);
        return size && size.width / size.height >= 0.85 && size.width / size.height <= 1.15;
      })
      .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    const noDimensions = (thumbnail) => !thumbnailDimensions(thumbnail);
    const selected =
      square || candidates.filter(noDimensions).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    // The entity classifier excludes video rows from music search. Missing
    // dimensions alone do not prove that an audio track's artwork is a clip.
    return selected ? image({ thumbnails: [selected] }, resize) : "";
  }
  function releaseType(metadata) {
    const words = text(metadata);
    return /\bsingle\b/i.test(words)
      ? "single"
      : /\bEP\b/i.test(words)
        ? "ep"
        : /\balbum\b/i.test(words)
          ? "album"
          : undefined;
  }
  function artistBanner(header) {
    const rows = [header.background, header.thumbnail, header.foregroundThumbnail].flatMap((value) =>
      collect(value || {}, "thumbnails").flat(),
    );
    const valid = rows.filter(
      (row) =>
        /^https:\/\/(?:[\w-]+\.)*(?:ytimg\.com|googleusercontent\.com|ggpht\.com)\//.test(
          row.url || "",
        ) &&
        row.width >= 600 &&
        row.height > 0 &&
        row.width / row.height >= 1.5,
    );
    return valid.sort((a, b) => b.width - a.width)[0]?.url || "";
  }
  function endpointKind(endpoint) {
    const type =
      endpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    return type === "MUSIC_PAGE_TYPE_ALBUM"
      ? "album"
      : type === "MUSIC_PAGE_TYPE_ARTIST"
        ? "artist"
        : "";
  }
  function credits(runs) {
    const names = [],
      result = {};
    for (const run of runs || []) {
      const endpoint = run.navigationEndpoint?.browseEndpoint,
        browseId = endpoint?.browseId,
        kind = endpointKind(endpoint);
      if (kind === "artist" || browseId?.startsWith("UC")) {
        names.push(run.text);
        if (validBrowse("artist", browseId)) result.artistCatalogId ||= "ytmusic:artist:" + browseId;
      } else if (kind === "album" || browseId?.startsWith("MPRE")) {
        result.albumTitle = run.text;
        if (validBrowse("album", browseId)) result.albumCatalogId = "ytmusic:album:" + browseId;
      }
    }
    if (names.length) result.artist = [...new Set(names)].join(" · ");
    return result;
  }
  function song(row, fallback = {}) {
    // An album can carry a play-video overlay; classify browse entities first.
    if (row.navigationEndpoint?.browseEndpoint) return null;
    if (row.musicItemRendererDisplayPolicy === "MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT")
      return null;
    const watch = watchEndpoint(row);
    const videoId = row.playlistItemData?.videoId || watch?.videoId;
    if (!VIDEO.test(videoId || "")) return null;
    const columns = row.flexColumns || [],
      column = (i) => columns[i]?.musicResponsiveListItemFlexColumnRenderer?.text;
    const title = text(column(0));
    const runs = columns
      .slice(1)
      .flatMap((c) => c.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []);
    const metadata = { ...fallback, ...credits(runs) };
    const year = runs
      .filter((run) => !run.navigationEndpoint)
      .map((run) => String(run.text || "").trim())
      .find((value) => /^(?:19|20)\d{2}$/.test(value));
    if (!title || !metadata.artist) return null;
    const type = mediaType(row);
    const clock = [
      ...columns.slice(1).map((c) => c.musicResponsiveListItemFlexColumnRenderer?.text),
      ...(row.fixedColumns || []).map((c) => c.musicResponsiveListItemFixedColumnRenderer?.text),
    ]
      .map(durationFromText)
      .find((value) => value != null);
    return {
      kind: "music",
      catalogId: "ytmusic:video:" + videoId,
      videoId,
      mediaType: type,
      source: "YouTube Music",
      title,
      artist: metadata.artist,
      albumTitle: metadata.albumTitle || "",
      ...(metadata.albumArtist ? { albumArtist: metadata.albumArtist } : {}),
      ...(metadata.trackNumber ? { trackNumber: metadata.trackNumber } : {}),
      artistCatalogId: metadata.artistCatalogId || "",
      albumCatalogId: metadata.albumCatalogId || "",
      ...(year || metadata.releaseDate ? { releaseDate: year || metadata.releaseDate } : {}),
      image:
        fallback.image || (type === "audio" ? trackArtwork(row) : image(row.thumbnail, false)) || "",
      imageFallback:
        fallback.imageFallback ||
        fallback.image ||
        (type === "audio" ? trackArtwork(row, false) : image(row.thumbnail, false)) || "",
      ...(clock != null ? { trackDuration: clock } : {}),
      url: "https://music.youtube.com/watch?v=" + videoId,
      description: [metadata.artist, metadata.albumTitle].filter(Boolean).join(" · "),
      ...(type === "audio"
        ? {
            playbackSource: MusicModel.source({
              type: "youtube",
              videoId,
              url: "https://music.youtube.com/watch?v=" + videoId,
            }),
          }
        : {}),
      metadataSources: { youtubeMusicId: videoId },
    };
  }
  function browseRow(row, fallback = {}) {
    const endpoint = row.navigationEndpoint?.browseEndpoint,
      kind = endpointKind(endpoint),
      id = endpoint?.browseId;
    if (!kind || !validBrowse(kind, id)) return null;
    const title = text(
      row.title || row.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text,
    );
    const subtitle =
      row.subtitle || row.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text;
    if (!title) return null;
    const credit = { ...fallback, ...credits(subtitle?.runs) };
    const words = text(subtitle),
      year = words.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/)?.[1];
    return {
      kind,
      catalogId: "ytmusic:" + kind + ":" + id,
      browseId: id,
      source: "YouTube Music",
      title,
      artist: kind === "artist" ? title : credit.artist || "",
      artistCatalogId: credit.artistCatalogId || "",
      image: twoRowArtwork(row),
      imageFallback: twoRowArtwork(row, false),
      description: words,
      url: "https://music.youtube.com/browse/" + id,
      ...(year ? { releaseDate: year } : {}),
      ...(kind === "album" && releaseType(subtitle) ? { albumType: releaseType(subtitle) } : {}),
    };
  }
  function unique(rows, limit = 40) {
    const seen = new Set();
    return rows
      .filter((row) => row && !seen.has(row.catalogId) && seen.add(row.catalogId))
      .slice(0, limit);
  }
  const SECTION_LIMITS = Object.freeze({
    pages: 10,
    items: 1000,
    tokenLength: 4096,
  });
  function sectionToken(value) {
    return typeof value === "string" &&
      value.length > 0 &&
      value.length <= SECTION_LIMITS.tokenLength &&
      !/[\x00-\x1f]/.test(value)
      ? value
      : undefined;
  }
  function sectionContinuation(container) {
    const next = container?.continuations?.find((value) => value.nextContinuationData)
      ?.nextContinuationData?.continuation;
    if (next !== undefined) return next;
    const items = container?.contents || container?.items || container?.continuationItems || [];
    const entry = items.find((value) => value.continuationItemRenderer)?.continuationItemRenderer;
    return entry?.continuationEndpoint?.continuationCommand?.token;
  }
  function artistSections(payload) {
    const result = {};
    for (const shelf of [
      ...collect(payload, "musicShelfRenderer"),
      ...collect(payload, "musicCarouselShelfRenderer"),
    ]) {
      const header = shelf.header?.musicCarouselShelfBasicHeaderRenderer;
      const title = text(shelf.title || header?.title);
      const section = /^(?:top )?songs$/i.test(title)
        ? "songs"
        : /^albums$/i.test(title)
          ? "albums"
          : /^(?:singles|eps)(?:\s*&\s*eps)?$/i.test(title)
            ? "singles"
            : /^(?:fans might also like|related artists)$/i.test(title)
              ? "related"
              : /^videos$/i.test(title)
                ? "videos"
                : null;
      if (!section) continue;
      const endpoint =
        header?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint ||
        (shelf.title || header?.title)?.runs?.find((run) => run.navigationEndpoint?.browseEndpoint)
          ?.navigationEndpoint.browseEndpoint ||
        shelf.bottomEndpoint?.browseEndpoint;
      const continuation = sectionToken(sectionContinuation(shelf));
      result[section] = {
        title,
        previewCount: (shelf.contents || []).length,
        ...(endpoint?.browseId ? { browseId: endpoint.browseId } : {}),
        ...(sectionToken(endpoint?.params) ? { params: endpoint.params } : {}),
        ...(continuation ? { continuation } : {}),
      };
    }
    return result;
  }
  function parseArtistSection(section, payload, fallback = {}) {
    const containers = [
      "gridRenderer",
      "musicCarouselShelfRenderer",
      "musicShelfRenderer",
      "musicPlaylistShelfRenderer",
    ].flatMap((name) => collect(payload.contents || {}, name));
    // Guest playlist pagination returns appendContinuationItemsAction, not a browse header.
    containers.push(
      ...collect(payload.onResponseReceivedActions || [], "appendContinuationItemsAction"),
    );
    if (!containers.length) throw Error("YouTube Music section unavailable");
    const rows = containers.flatMap((container) => {
      const content = container.items || container.contents || container.continuationItems || [];
      if (section === "songs")
        return collect(content, "musicResponsiveListItemRenderer").map((row) => song(row, fallback));
      return [
        ...collect(content, "musicTwoRowItemRenderer"),
        ...collect(content, "musicResponsiveListItemRenderer"),
      ].map((row) => browseRow(row, fallback));
    });
    const kind = section === "songs" ? "music" : section === "related" ? "artist" : "album";
    const rawContinuation = containers.map(sectionContinuation).find((value) => value !== undefined);
    return {
      items: unique(
        rows.filter((row) => row?.kind === kind),
        SECTION_LIMITS.items,
      ),
      continuation: sectionToken(rawContinuation),
      truncated: rows.filter((row) => row?.kind === kind).length > SECTION_LIMITS.items,
      invalidContinuation: rawContinuation !== undefined && !sectionToken(rawContinuation),
    };
  }
  function parseSearchMedia(payload) {
    return unique(collect(payload, "musicResponsiveListItemRenderer").map((row) => song(row)));
  }
  function parseVideoSearch(payload) {
    return parseSearchMedia(payload)
      .filter((row) => row.mediaType === "video")
      .map((row) => ({ ...row, kind: "video", catalogId: "youtube:video:" + row.videoId }));
  }
  function parseSearch(kind, payload) {
    const rows = collect(payload, "musicResponsiveListItemRenderer").map((row) =>
      kind === "music" ? song(row) : browseRow(row),
    );
    if (kind !== "music")
      rows.push(...collect(payload, "musicTwoRowItemRenderer").map((row) => browseRow(row)));
    return unique(
      rows.filter((row) => row?.kind === kind && (kind !== "music" || row.mediaType === "audio")),
    );
  }
  function parseSearchTracks(payload) {
    return parseSearch("music", payload)
      .filter((row) => row.playbackSource?.type === "youtube")
      .slice(0, 20)
      .map((row) => ({
        title: row.title,
        artist: row.artist,
        album: row.albumTitle,
        duration: row.trackDuration,
        videoId: row.videoId,
        url: row.url,
        image: row.image,
        resultType: "song",
      }));
  }
  function parseSearchPage(kind, payload) {
    const containers = [
      ...collect(payload, "musicShelfRenderer"),
      ...collect(payload, "musicShelfContinuation"),
      ...collect(payload, "appendContinuationItemsAction"),
    ];
    const continuation = containers.map(sectionContinuation).find((value) => value !== undefined);
    return { items: parseSearch(kind, payload), next: continuation ?? null };
  }
  function parseBrowse(kind, id, payload) {
    if (!validBrowse(kind, id)) throw Error("Invalid YouTube Music browse identity");
    const header = [
      "musicResponsiveHeaderRenderer",
      "musicDetailHeaderRenderer",
      "musicImmersiveHeaderRenderer",
      "musicVisualHeaderRenderer",
    ].flatMap((name) => collect(payload, name))[0];
    const title = text(header?.title);
    if (!title) throw Error("YouTube Music details unavailable");
    const headerRuns = [...(header.subtitle?.runs || []), ...(header.straplineTextOne?.runs || [])];
    const metadata = credits(headerRuns),
      thumbnail = header.thumbnail || header.foregroundThumbnail || header,
      artwork = kind === "album" ? trackArtwork({ thumbnail }) : image(thumbnail);
    const result = {
      kind,
      catalogId: "ytmusic:" + kind + ":" + id,
      browseId: id,
      source: "YouTube Music",
      title,
      image: artwork,
      imageFallback:
        kind === "album" ? trackArtwork({ thumbnail }, false) : image(thumbnail, false),
      artist: kind === "artist" ? title : metadata.artist || "",
      artistCatalogId: metadata.artistCatalogId || "",
      url: "https://music.youtube.com/browse/" + id,
    };
    if (kind === "artist") {
      const banner = artistBanner(header);
      if (banner) result.bannerImage = banner;
      const subscribers = text(
        header.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText ||
          header.subscriberCountText,
      );
      if (subscribers) result.subscriberText = subscribers;
    }
    const year = text(header.subtitle).match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/)?.[1];
    if (year) result.releaseDate = year;
    if (kind === "album" && releaseType(header.subtitle))
      result.albumType = releaseType(header.subtitle);
    const fallback =
      kind === "album"
        ? {
            artist: result.artist,
            albumArtist: result.artist,
            artistCatalogId: result.artistCatalogId,
            albumTitle: title,
            albumCatalogId: result.catalogId,
            image: artwork,
            releaseDate: result.releaseDate,
          }
        : { artist: title, artistCatalogId: result.catalogId };
    const shelves = [
      ...collect(payload, "musicPlaylistShelfRenderer"),
      ...collect(payload, "musicShelfRenderer"),
    ];
    const tracks = unique(
      shelves
        .flatMap((shelf) => collect(shelf.contents, "musicResponsiveListItemRenderer"))
        .map((row, index) => song(row, kind === "album" ? {
          ...fallback,
          trackNumber: Number(text(row.index)) || index + 1,
        } : fallback)),
      kind === "album" ? 200 : 40,
    );
    if (kind === "album") {
      result.albumTracks = tracks;
      result.trackNames = tracks.map((row) => row.title);
      result.total = tracks.length;
      result.unit = "faixas";
      result.relatedAlbums = unique(
        collect(payload, "musicCarouselShelfRenderer")
          .flatMap((shelf) =>
            collect(shelf.contents, "musicTwoRowItemRenderer").map((row) => browseRow(row)),
          )
          .filter((row) => row?.kind === "album" && row.catalogId !== result.catalogId),
      );
    } else {
      result.artistSections = artistSections(payload);
      result.topTracks = tracks.filter((row) => row.mediaType === "audio").slice(0, 8);
      result.musicVideos = tracks.filter((row) => row.mediaType === "video");
      result.relatedArtists = unique(
        collect(payload, "musicCarouselShelfRenderer")
          .flatMap((shelf) =>
            collect(shelf.contents, "musicTwoRowItemRenderer").map((row) => browseRow(row)),
          )
          .filter((row) => row?.kind === "artist" && row.catalogId !== result.catalogId),
      );
      result.topAlbums = unique(
        collect(payload, "musicCarouselShelfRenderer").flatMap((shelf) => {
          const label = text(shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title);
          return collect(shelf.contents, "musicTwoRowItemRenderer").map((row) => {
            const album = browseRow(row, fallback);
            if (
              album?.kind === "album" &&
              /singles|eps/i.test(label) &&
              !(/singles/i.test(label) && /eps/i.test(label))
            )
              album.albumType = /eps/i.test(label) ? "ep" : "single";
            if (album?.kind === "album" && !album.albumType && /\balbums\b/i.test(label))
              album.albumType = "album";
            return album;
          });
        }),
      ).filter((row) => row.kind === "album");
      const albumsById = new Map(result.topAlbums.map((album) => [album.catalogId, album]));
      for (const track of result.topTracks)
        if (!track.releaseDate && albumsById.get(track.albumCatalogId)?.releaseDate)
          track.releaseDate = albumsById.get(track.albumCatalogId).releaseDate;
    }
    return result;
  }
  function parseWatchQueue(payload) {
    return unique(
      collect(payload, "playlistPanelVideoRenderer").map((row) => {
        const videoId = row.videoId;
        if (!VIDEO.test(videoId || "") || row.unplayableText) return null;
        const type = mediaType(row);
        const title = text(row.title),
          metadata = credits((row.longBylineText || row.shortBylineText)?.runs);
        if (!title || !metadata.artist) return null;
        const seconds = duration(text(row.lengthText));
        return {
          kind: "music",
          catalogId: "ytmusic:video:" + videoId,
          videoId,
          mediaType: type,
          title,
          ...metadata,
          source: "YouTube Music",
          image: type === "audio" ? trackArtwork(row) : image(row.thumbnail, false),
          imageFallback: type === "audio" ? trackArtwork(row, false) : image(row.thumbnail, false),
          ...(seconds ? { trackDuration: seconds } : {}),
          url: "https://music.youtube.com/watch?v=" + videoId,
          ...(type === "audio"
            ? {
                playbackSource: MusicModel.source({
                  type: "youtube",
                  videoId,
                  url: "https://music.youtube.com/watch?v=" + videoId,
                }),
              }
            : {}),
          metadataSources: { youtubeMusicId: videoId },
        };
      }),
      40,
    );
  }
  function parseRadio(payload, seed) {
    return parseWatchQueue(payload).filter(
      (row) => row.videoId !== seed && row.mediaType === "audio",
    );
  }
  const parser = {
    parseSearch,
    parseSearchMedia,
    parseVideoSearch,
    parseSearchTracks,
    parseSearchPage,
    parseBrowse,
    parseRadio,
    parseWatchQueue,
    parseArtistSection,
    SECTION_LIMITS,
    sectionToken,
    validBrowse,
    duration,
    durationFromText,
  };
  root.YouTubeMusicParser = parser;
  if (typeof module !== "undefined" && module.exports) module.exports = parser;
})(typeof window !== "undefined" ? window : globalThis);
