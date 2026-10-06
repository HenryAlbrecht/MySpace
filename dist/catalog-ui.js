/* Shared presentation only; catalog identity and ranking stay in Catalog. */
(() => {
  function resultTarget(items, container, { incremental = false } = {}) {
    const names = new Map(),
      groups = new Map();
    const key = (item) => item.title.normalize("NFC").trim().toLowerCase();
    for (const item of items)
      if (item.kind === "artist")
        names.set(key(item), (names.get(key(item)) || 0) + 1);
    const target = (item) => {
      if (item.kind !== "artist" || names.get(key(item)) < 2) return container;
      const name = key(item);
      if (!groups.has(name)) {
        let group = incremental
          ? [...container.querySelectorAll(".artist-result-group")].find(
              (group) => group.dataset.artistName === name,
            )
          : null;
        const heading =
          group?.querySelector("summary") || document.createElement("summary");
        if (!group) group = document.createElement("details");
        group.className = "artist-result-group";
        group.dataset.artistName = name;
        heading.textContent =
          item.title + " · " + names.get(name) + " artistas com este nome";
        if (!heading.parentNode) group.append(heading);
        if (!group.parentNode) {
          const prior =
            incremental &&
            [...container.children].find((card) =>
              items.some(
                (row) =>
                  row.kind === "artist" &&
                  row.catalogId === card.dataset.catalogId &&
                  key(row) === name,
              ),
            );
          container.insertBefore(group, prior || null);
          if (prior) group.open = true;
        }
        groups.set(name, group);
      }
      return groups.get(name);
    };
    if (incremental)
      for (const item of items) {
        if (item.kind !== "artist" || names.get(key(item)) < 2) continue;
        const parent = target(item);
        const card = [...container.querySelectorAll(".discover-card")].find(
          (card) => card.dataset.catalogId === item.catalogId,
        );
        if (card && card.parentNode !== parent) parent.append(card);
        const description = card?.querySelector("small");
        if (
          description &&
          !description.textContent.includes(item.catalogId.split(":").at(-1))
        )
          description.textContent +=
            " · " + item.source + " " + item.catalogId.split(":").at(-1);
      }
    return target;
  }
  window.CatalogUI = { resultTarget };
})();
