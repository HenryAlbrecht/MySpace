/* Owns desktop folder references, never media collection entries or filesystem contents. */
window.DesktopFolders = (() => {
  const KEY = "myspace-desktop-folders-v1";
  const categories = ["music", "games"];
  function identity(path) {
    return path.replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase();
  }
  function valid(path) {
    return typeof path === "string" && path.length <= 32767 &&
      !/[\x00-\x1f]/.test(path) && /^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i.test(path);
  }
  function create({ storage, pickFolders, checkFolders }) {
    let state = { music: [], games: [] };
    let loadError = "";
    let busy = false;
    try {
      const raw = storage.getItem(KEY);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !categories.every((category) => Array.isArray(saved[category]))) {
          throw new Error("Formato de pastas inválido.");
        }
        for (const category of categories) {
          const seen = new Set();
          for (const path of saved[category]) {
            if (!valid(path)) throw new Error("Caminho salvo inválido.");
            if (!seen.has(identity(path))) state[category].push(path);
            seen.add(identity(path));
          }
        }
      }
    } catch (error) {
      loadError = "Não foi possível carregar as pastas: " + String(error);
    }
    function assertCategory(category) {
      if (!categories.includes(category)) throw new Error("Categoria inválida.");
      if (loadError) throw new Error(loadError);
    }
    function save(next) {
      storage.setItem(KEY, JSON.stringify({ version: 1, ...next }));
      state = next;
    }
    return {
      getState: () => ({ music: [...state.music], games: [...state.games], error: loadError }),
      async add(category) {
        assertCategory(category);
        if (busy) throw new Error("Aguarde o seletor de pastas.");
        busy = true;
        try {
          const selected = await pickFolders();
          if (selected === null || (Array.isArray(selected) && !selected.length)) {
            return { cancelled: true, added: 0 };
          }
          if (!Array.isArray(selected) || !selected.every(valid)) throw new Error("Seleção de pastas inválida.");
          const paths = [...state[category]];
          const seen = new Set(paths.map(identity));
          for (const path of selected) {
            if (seen.has(identity(path))) continue;
            paths.push(path);
            seen.add(identity(path));
          }
          const added = paths.length - state[category].length;
          if (added) save({ ...state, [category]: paths });
          return { cancelled: false, added };
        } finally {
          busy = false;
        }
      },
      remove(category, path) {
        assertCategory(category);
        const paths = state[category].filter((entry) => identity(entry) !== identity(path));
        save({ ...state, [category]: paths });
      },
      async check(category) {
        assertCategory(category);
        const paths = [...state[category]];
        const result = [];
        for (let index = 0; index < paths.length; index += 100) {
          result.push(...await checkFolders(paths.slice(index, index + 100)));
        }
        return new Map(paths.map((path, index) => [path, result[index] || "unknown"]));
      },
    };
  }
  return { create };
})();
