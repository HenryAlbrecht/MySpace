/* Shared presentation only; catalog identity and ranking stay in Catalog. */
(() => {
  function resultTarget(items, container) {
    const names = new Map(), groups = new Map();
    const key = item => item.title.normalize('NFC').trim().toLowerCase();
    for (const item of items) if (item.kind === 'artist') names.set(key(item), (names.get(key(item)) || 0) + 1);
    return item => {
      if (item.kind !== 'artist' || names.get(key(item)) < 2) return container;
      const name = key(item);
      if (!groups.has(name)) {
        const group = document.createElement('details'), heading = document.createElement('summary');
        group.className = 'artist-result-group';
        heading.textContent = item.title + ' · ' + names.get(name) + ' artistas com este nome';
        group.append(heading); container.append(group); groups.set(name, group);
      }
      return groups.get(name);
    };
  }
  window.CatalogUI = { resultTarget };
})();
