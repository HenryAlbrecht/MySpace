/* Local Collection reconciliation; no persisted state or playback ownership. */
function createMusicCollectionMatches({
  node,
  button,
  cover,
  open,
  getActiveItem,
  MusicPageUI,
  CollectionActions,
}) {
  function patchCollectionGenreMatches(section, item) {
    const matches = MusicPageUI.collectionGenreMatches(
      item,
      CollectionActions.getItems(),
    );
    section.hidden = !matches.length;
    const expanded = section.dataset.expanded === "true",
      preview = expanded ? matches : matches.slice(0, 3);
    if (!section.firstChild) {
      section.append(
        node("h2", "", "na sua coleção · gêneros em comum"),
        node(
          item.kind === "music" ? "ol" : "div",
          item.kind === "music" ? "music-tracklist" : "media-related-grid",
        ),
      );
    }
    const focused = document.activeElement,
      focusedRow = focused?.closest("[data-collection-key]"),
      focusKey = focusedRow?.dataset.collectionKey,
      focusIndex = focusedRow
        ? [...focusedRow.querySelectorAll("a,button")].indexOf(focused)
        : -1;
    const list = section.children[1],
      existing = new Map(
        [...list.children].map((row) => [row.dataset.collectionKey, row]),
      );
    const nodes = preview.map((entry, index) => {
      const key = entry.id || entry.catalogId,
        signature = JSON.stringify(entry);
      let row = existing.get(key);
      if (!row || row.dataset.collectionSignature !== signature) {
        if (entry.kind === "music") row = MusicPageUI.trackRow(entry, index);
        else {
          row = button("", () => open(entry), "discover-card");
          row.dataset.kind = entry.kind;
          row.append(
            cover(
              entry.image,
              entry.title,
              entry.imageFallback,
              entry.coverLayout,
              entry.kind,
            ),
            node("strong", "", entry.title),
          );
          if (entry.kind === "album")
            row.append(
              node(
                "small",
                "",
                [
                  { album: "Álbum", ep: "EP", single: "Single" }[
                    entry.albumType
                  ],
                  entry.releaseDate?.slice(0, 4),
                ]
                  .filter(Boolean)
                  .join(" · "),
              ),
            );
        }
        row.dataset.collectionKey = key;
        row.dataset.collectionSignature = signature;
      }
      const number = row.querySelector(".music-track-number");
      if (number) number.textContent = String(index + 1).padStart(2, "0");
      return row;
    });
    for (const row of [...list.children])
      if (!nodes.includes(row)) row.remove();
    nodes.forEach((row, index) => {
      if (list.children[index] !== row)
        list.insertBefore(row, list.children[index] || null);
    });
    let toggle = section.querySelector("[data-collection-genre-toggle]");
    if (matches.length > 3) {
      if (!toggle) {
        toggle = button(
          "",
          () => {
            const top = window.scrollY;
            section.dataset.expanded = String(
              section.dataset.expanded !== "true",
            );
            patchCollectionGenreMatches(section, getActiveItem());
            section
              .querySelector("[data-collection-genre-toggle]")
              ?.focus({ preventScroll: true });
            window.scrollTo({ top, behavior: "instant" });
          },
          "text-action",
        );
        toggle.dataset.collectionGenreToggle = "";
        section.append(toggle);
      }
      toggle.textContent = expanded
        ? "recolher ↑"
        : "ver todos (" + matches.length + ") →";
      toggle.setAttribute("aria-expanded", String(expanded));
    } else toggle?.remove();
    if (focusKey && !focused.isConnected) {
      const replacement = nodes.find(
        (row) => row.dataset.collectionKey === focusKey,
      );
      (
        replacement?.querySelectorAll("a,button")[focusIndex] ||
        replacement ||
        toggle
      )?.focus({ preventScroll: true });
    }
  }
  return { patchCollectionGenreMatches };
}
