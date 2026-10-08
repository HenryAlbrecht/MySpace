/* Streaming Blob package: JSON manifest followed by the original media bytes. */
(() => {
  const magic = "MYSPACE2";
  const ids = (payload) => [
    ...new Set(
      [
        ...(payload.extras?.tracks || [])
          .filter((track) => track.local || track.fileName)
          .map((track) => track.fileRef || track.id),
        ...(payload.extras?.items || [])
          .filter((item) => item.kind === "music" && item.playbackSource?.type === "local")
          .map((item) => item.playbackSource.fileRef),
        payload.extras?.featuredVideo?.localId,
      ].filter(Boolean),
    ),
  ];
  async function inspect(payload) {
    const keys = ids(payload),
      missing = [];
    let totalBytes = 0;
    for (const id of keys) {
      const file = await MediaStorage.get(id);
      if (file) totalBytes += file.size;
      else missing.push(id);
    }
    return { count: keys.length, missing, totalBytes };
  }
  async function create(payload, progress = () => {}) {
    const files = [],
      media = [],
      missing = [],
      keys = ids(payload);
    for (const id of keys) {
      const file = await MediaStorage.get(id);
      if (file) {
        if (file.size > 200 * 1024 * 1024)
          throw Error("Um arquivo ultrapassa 200 MB: " + (file.name || id));
        files.push(file);
        media.push({
          id,
          size: file.size,
          type: file.type || "application/octet-stream",
          name: file.name || id,
        });
      } else missing.push(id);
      progress(media.length + missing.length, keys.length);
    }
    const manifest = new TextEncoder().encode(JSON.stringify({ ...payload, media }));
    if (manifest.length > 50 * 1024 * 1024)
      throw Error("As imagens do perfil ultrapassam o limite de 50 MB.");
    const size = new Uint8Array(4);
    new DataView(size.buffer).setUint32(0, manifest.length, true);
    const blob = new Blob([magic, size, manifest, ...files], { type: "application/octet-stream" });
    if (blob.size > 2 * 1024 ** 3) throw Error("O pacote ultrapassa 2 GB.");
    return { blob, missing };
  }
  async function read(file) {
    if (file.size < 12 || file.size > 2 * 1024 ** 3)
      throw Error("Pacote inválido ou maior que 2 GB.");
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (new TextDecoder().decode(header.slice(0, 8)) !== magic)
      throw Error("Este arquivo não é um pacote MySpace.");
    const length = new DataView(header.buffer).getUint32(8, true);
    if (!length || length > 50 * 1024 * 1024 || length + 12 > file.size)
      throw Error("Manifesto inválido.");
    const payload = JSON.parse(await file.slice(12, 12 + length).text());
    if (!Array.isArray(payload.media) || payload.media.length > 1001)
      throw Error("Lista de arquivos inválida.");
    let offset = 12 + length;
    const files = [],
      seen = new Set(),
      allowed = new Set(ids(payload));
    for (const entry of payload.media) {
      if (
        !entry ||
        !allowed.has(entry.id) ||
        seen.has(entry.id) ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        entry.size > 200 * 1024 * 1024 ||
        typeof entry.type !== "string" ||
        entry.type.length > 100 ||
        offset + entry.size > file.size
      )
        throw Error("Arquivo inválido no pacote.");
      seen.add(entry.id);
      files.push([entry.id, file.slice(offset, offset + entry.size, entry.type)]);
      offset += entry.size;
    }
    if (offset !== file.size) throw Error("O tamanho do pacote não corresponde aos arquivos.");
    return { payload, files };
  }
  async function restore(files) {
    if (!files.length) return async () => {};
    const previous = [];
    for (const [id] of files) previous.push([id, await MediaStorage.get(id)]);
    await MediaStorage.putMany(files);
    return () => MediaStorage.putMany(previous);
  }
  window.MediaPackage = { create, read, restore, inspect };
})();
