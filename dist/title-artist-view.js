/* UI de artista; o compositor mantém item, rota e CORE/FULL. */
function createArtistTitleView({
  node,
  button,
  cover,
  open,
  Catalog,
  MusicPageUI,
  onRetryDiscography,
}) {
  function appendArtistSections(parent, item, includeDiscography = true) {
    if (item.discographyUnavailable) {
      const notice = node("section", "game-detail-section");
      notice.append(
        node(
          "p",
          "title-notice",
          "A discografia não respondeu. As demais informações continuam disponíveis.",
        ),
        button("tentar discografia novamente", onRetryDiscography),
      );
      parent.append(notice);
    }
    for (const [label, entries] of [
      ["músicas populares", item.topTracks],
      ["artistas similares", item.similarArtists],
    ]) {
      if (!entries?.length) continue;
      if (label === "músicas populares") {
        const section = node("section", "game-detail-section");
        section.dataset.content = JSON.stringify(entries);
        const list = MusicPageUI.tracklist(entries.slice(0, 8));
        section.append(node("h2", "", label), list);
        parent.append(section);
        MusicPageUI.supplementArtistDurations(list, item);
        continue;
      }
      const section = node("section", "game-detail-section");
      const grid = node("div", "media-related-grid");
      section.append(node("h2", "", label), grid);
      for (const entry of entries.slice(0, 8)) {
        const card = button("", () => open(entry), "discover-card");
        Catalog.intentCore(card, entry);
        card.append(
          cover(
            entry.image,
            entry.title,
            entry.imageFallback,
            "horizontal",
            entry.kind,
          ),
          node("strong", "", entry.title),
          node("small", "", Catalog.describe(entry)),
        );
        grid.append(card);
      }
      parent.append(section);
    }
    if (includeDiscography && item.topAlbums?.length) {
      const section = node("section", "game-detail-section artist-discography"),
        grid = node("div", "media-related-grid");
      const notice = node("p", "title-notice");
      let albums = item.topAlbums.slice(),
        next = item.discographyNext;
      const cards = new Map();
      const pageSize = matchMedia("(max-width: 600px)").matches ? 8 : 18;
      let visibleLimit = pageSize;
      let disclosurePointer = false;
      const windowActions = node("div", "discography-window-actions");
      const reveal = button(
        "",
        () => {
          disclosurePointer = true;
          const total = MusicPageUI.releases(
            albums,
            filterValue,
            sort.value,
          ).length;
          visibleLimit = Math.min(total, visibleLimit + pageSize);
          draw();
          if (reveal.hidden) collapse.focus({ preventScroll: true });
        },
        "text-action",
      );
      const collapse = button(
        "recolher",
        () => {
          disclosurePointer = true;
          const anchor = Math.max(
            16,
            Math.min(
              window.innerHeight - windowActions.offsetHeight - 16,
              windowActions.getBoundingClientRect().top,
            ),
          );
          visibleLimit = pageSize;
          draw();
          (reveal.hidden
            ? filter.querySelector('[data-value="' + filterValue + '"]')
            : reveal
          ).focus({ preventScroll: true });
          requestAnimationFrame(() => {
            if (!section.isConnected || visibleLimit !== pageSize) return;
            const shift = windowActions.getBoundingClientRect().top - anchor;
            if (shift) window.scrollBy({ top: shift, behavior: "instant" });
          });
        },
        "text-action",
      );
      windowActions.append(reveal, collapse);
      const filter = node("div", "discography-filter");
      filter.setAttribute("role", "group");
      filter.setAttribute("aria-label", "Tipo de lançamento");
      let filterValue = "all";
      const sort = node("select", "discography-sort");
      sort.setAttribute("aria-label", "Ordenar lançamentos");
      for (const [value, label] of [
        ["recent", "mais recentes"],
        ["old", "mais antigos"],
        ["title", "A–Z"],
      ])
        sort.append(new Option(label, value));
      for (const [value, label] of [
        ["all", "todos"],
        ["album", "álbuns"],
        ["ep", "EPs"],
        ["single", "singles"],
      ]) {
        const tab = button(
          label,
          () => {
            filterValue = value;
            visibleLimit = pageSize;
            draw();
          },
          "text-action",
        );
        tab.dataset.value = value;
        filter.append(tab);
      }
      function draw() {
        const focused = grid.contains(document.activeElement)
          ? document.activeElement
          : null;
        for (const tab of filter.children)
          tab.setAttribute(
            "aria-pressed",
            String(tab.dataset.value === filterValue),
          );
        const ordered = [];
        const filtered = MusicPageUI.releases(albums, filterValue, sort.value);
        const visible = filtered.slice(0, visibleLimit);
        // Retain a focused card temporarily even if a new order moves it outside the window.
        const focusedIndex = focused
          ? filtered.findIndex(
              (album) => album.catalogId === focused.release?.catalogId,
            )
          : -1;
        if (focusedIndex >= visible.length)
          visible.push(filtered[focusedIndex]);
        for (const album of visible) {
          let card = cards.get(album.catalogId);
          if (!card) {
            card = button("", () => open(card.release), "discover-card");
            // Expansion can place a new card under a stationary pointer. That is not intent.
            card.addEventListener("pointerenter", (event) => {
              if (disclosurePointer) event.stopImmediatePropagation();
            });
            card.addEventListener("pointermove", (event) => {
              if (disclosurePointer && (event.movementX || event.movementY)) {
                disclosurePointer = null;
                card.dispatchEvent(new PointerEvent("pointerenter"));
              }
            });
            Catalog.intentCore(card, album);
            card.append(
              cover(
                album.image,
                album.title,
                album.imageFallback,
                "horizontal",
                "album",
              ),
              node("strong", "", album.title),
              node(
                "small",
                "",
                [
                  album.releaseDate?.slice(0, 4),
                  { album: "Álbum", ep: "EP", single: "Single" }[
                    album.albumType
                  ],
                ]
                  .filter(Boolean)
                  .join(" · "),
              ),
            );
            cards.set(album.catalogId, card);
          }
          card.release = album;
          card.querySelector("small").textContent = [
            album.releaseDate?.slice(0, 4),
            { album: "Álbum", ep: "EP", single: "Single" }[album.albumType],
          ]
            .filter(Boolean)
            .join(" · ");
          ordered.push(card);
        }
        const retained = new Set(ordered);
        for (const card of [...grid.children])
          if (!retained.has(card)) card.remove();
        ordered.forEach((card, index) => {
          if (grid.children[index] !== card)
            grid.insertBefore(card, grid.children[index] || null);
        });
        if (focused?.isConnected && document.activeElement !== focused)
          focused.focus({ preventScroll: true });
        const remaining = Math.max(0, filtered.length - visibleLimit);
        reveal.textContent = "ver mais " + Math.min(pageSize, remaining);
        reveal.hidden = remaining === 0;
        collapse.hidden = visibleLimit <= pageSize;
        notice.textContent = grid.children.length
          ? filtered.length +
            " lançamentos" +
            (grid.children.length < filtered.length
              ? " · mostrando " + grid.children.length
              : "") +
            (next != null ? " · há mais" : "")
          : "Nenhum lançamento deste tipo entre os álbuns carregados.";
      }
      section.updateReleases = (entries, cursor) => {
        if (
          JSON.stringify(albums) === JSON.stringify(entries) &&
          next === cursor
        )
          return;
        albums = entries.slice();
        next = cursor;
        draw();
        more.hidden = next == null;
      };
      sort.onchange = draw;
      const more = button("carregar mais lançamentos", async () => {
        more.disabled = true;
        notice.textContent = "Carregando lançamentos…";
        try {
          const page = await Catalog.artistAlbums(item, next);
          const seen = new Set(albums.map((row) => row.catalogId));
          albums.push(...page.items.filter((row) => !seen.has(row.catalogId)));
          next = page.next;
          draw();
          more.hidden = next == null;
        } catch (error) {
          notice.textContent =
            error.message + " Os lançamentos anteriores foram mantidos.";
        } finally {
          more.disabled = false;
        }
      });
      more.hidden = next == null;
      const controls = node("div", "discography-controls");
      controls.append(filter, sort);
      section.append(
        node("h2", "", "discografia"),
        controls,
        notice,
        grid,
        windowActions,
        more,
      );
      parent.append(section);
      draw();
    }
  }

  function patch(parent, item) {
    const discography = parent.querySelector(".artist-discography");
    if (discography)
      discography.updateReleases?.(item.topAlbums || [], item.discographyNext);
    const sections = document.createDocumentFragment();
    appendArtistSections(sections, item, !discography);
    for (const candidate of [...sections.children]) {
      const label = candidate.querySelector("h2")?.textContent;
      const existing = [...parent.querySelectorAll(":scope > section")].find(
        (section) => section.querySelector("h2")?.textContent === label,
      );
      if (!existing) {
        candidate.classList.add("music-local-update");
        parent.append(candidate);
      } else if (
        label === "músicas populares" &&
        existing.dataset.content !== candidate.dataset.content
      ) {
        existing
          .querySelector(".music-tracklist")
          .replaceWith(candidate.querySelector(".music-tracklist"));
        existing.dataset.content = candidate.dataset.content;
      }
    }
  }
  return { append: appendArtistSections, patch };
}
