/* Arquivos binários locais. Nenhuma dependência do player ou da interface. */
(function (root) {
  let connection;
  function open() {
    if (!connection)
      connection = new Promise((resolve, reject) => {
        if (!root.indexedDB) {
          reject(Error("Armazenamento de arquivos indisponível."));
          return;
        }
        const request = root.indexedDB.open("myspace-media", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("audio");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    return connection;
  }
  async function transact(mode, id, value, remove = false) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("audio", mode),
        store = transaction.objectStore("audio");
      let result;
      const request =
        mode === "readonly"
          ? store.get(id)
          : remove
            ? store.delete(id)
            : store.put(value, id);
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  root.MediaStorage = {
    putMany: async entries => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('audio', 'readwrite'), store = transaction.objectStore('audio');
        for (const [id, file] of entries) file === undefined ? store.delete(id) : store.put(file, id);
        transaction.oncomplete = resolve;
        transaction.onerror = transaction.onabort = () => reject(transaction.error || Error('Não foi possível guardar os arquivos.'));
      });
    },
    get: (id) => transact("readonly", id),
    put: (id, file) => transact("readwrite", id, file),
    remove: (id) => transact("readwrite", id, undefined, true),
  };
})(typeof window === "undefined" ? globalThis : window);
