/* Native registry owns grants. This owner only mirrors authorized IDs for the desktop UI. */
window.DesktopFolders = (() => {
  function create({ listFolders, authorizeFolders, revokeFolder, discoverSteam, discoverMusic, games }) {
    let state = { music: [], games: [], error: "" };
    let busy = false;
    let revision = 0;
    function assertCategory(category) {
      if (!["music", "games"].includes(category)) throw new Error("Categoria inválida.");
    }
    async function refresh() {
      const token = ++revision;
      try {
        const folders = await listFolders();
        if (token !== revision) return;
        state = {
          music: folders.filter((folder) => folder.category === "music"),
          games: folders.filter((folder) => folder.category === "games"),
          error: "",
        };
        games?.grants(state.games);
      } catch (error) {
        if (token !== revision) return;
        state.error = "Não foi possível carregar as autorizações: " + String(error);
        games?.grants(state.games.map((folder) => ({ ...folder, state: "unavailable" })));
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
        revision++;
        state[category] = state[category].filter((folder) => folder.id !== id);
        games?.grants(state.games);
      },
      async discover(id) {
        if (!state.games.some((folder) => folder.id === id)) throw new Error("Pasta de jogos não autorizada.");
        const token = games?.begin(id);
        try {
          const report = await discoverSteam(id);
          games?.complete(id, token, report);
          return report;
        } catch (error) {
          games?.fail(id, token);
          throw error;
        }
      },
      async discoverMusic(id) {
        if (!state.music.some((folder) => folder.id === id)) throw new Error("Pasta de músicas não autorizada.");
        return discoverMusic(id);
      },
    };
  }
  return { create };
})();
