/* Native registry owns grants. This owner only mirrors authorized IDs for the desktop UI. */
window.DesktopFolders = (() => {
  function create({ listFolders, authorizeFolders, revokeFolder, discoverSteam }) {
    let state = { music: [], games: [], error: "" };
    let busy = false;
    function assertCategory(category) {
      if (!["music", "games"].includes(category)) throw new Error("Categoria inválida.");
    }
    async function refresh() {
      try {
        const folders = await listFolders();
        state = {
          music: folders.filter((folder) => folder.category === "music"),
          games: folders.filter((folder) => folder.category === "games"),
          error: "",
        };
      } catch (error) {
        state.error = "Não foi possível carregar as autorizações: " + String(error);
        throw error;
      }
    }
    return {
      getState: () => ({ music: state.music.map((folder) => ({ ...folder })), games: state.games.map((folder) => ({ ...folder })), error: state.error }),
      refresh,
      async add(category) {
        assertCategory(category);
        if (busy) throw new Error("Aguarde o seletor de pastas.");
        busy = true;
        try {
          const added = await authorizeFolders(category);
          if (added === null) return { cancelled: true, added: 0 };
          await refresh();
          return { cancelled: false, added };
        } finally {
          busy = false;
        }
      },
      async remove(category, id) {
        assertCategory(category);
        if (!state[category].some((folder) => folder.id === id)) throw new Error("Autorização não registrada.");
        await revokeFolder(id);
        state[category] = state[category].filter((folder) => folder.id !== id);
      },
      async discover(id) {
        if (!state.games.some((folder) => folder.id === id)) throw new Error("Pasta de jogos não autorizada.");
        return discoverSteam(id);
      },
    };
  }
  return { create };
})();
