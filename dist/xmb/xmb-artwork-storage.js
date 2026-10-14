/* Imagens locais do XMB e da aparência: referências no perfil, originais no IndexedDB. */
(() => {
  const PREFIXES = {
    xmb: "xmb-art:",
    appearance: "appearance-art:",
  };
  const VARIANTS = {
    thumb: { suffix: ":thumb", maxEdge: 384 },
    display: { suffix: ":display", maxEdge: 1280 },
    wallpaper: { suffix: ":wallpaper", maxEdge: 2560 },
  };
  const objectUrls = new Map();

  function isReference(value) {
    return (
      typeof value === "string" && Object.values(PREFIXES).some((prefix) => value.startsWith(prefix))
    );
  }

  function createReference(namespace = "xmb") {
    const id =
      globalThis.crypto?.randomUUID?.() ||
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    return (PREFIXES[namespace] || PREFIXES.xmb) + id;
  }

  function variantKey(reference, variant) {
    return reference + (VARIANTS[variant]?.suffix || "");
  }

  async function canvasBlob(bitmap, maxEdge, mime, quality) {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: mime !== "image/jpeg" });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  }

  async function prepare(file, reference = createReference()) {
    const entries = [[reference, file]];
    if (
      !globalThis.createImageBitmap ||
      !file.type?.startsWith("image/") ||
      file.type === "image/gif" ||
      file.type === "image/webp"
    )
      return { reference, entries };

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
      const quality = mime === "image/jpeg" ? 0.9 : undefined;
      for (const [variant, config] of Object.entries(VARIANTS)) {
        const blob = await canvasBlob(bitmap, config.maxEdge, mime, quality);
        if (blob) entries.push([variantKey(reference, variant), blob]);
      }
    } catch {
      // The original remains usable if this browser cannot build a display derivative.
    } finally {
      bitmap?.close();
    }
    return { reference, entries };
  }

  async function store(file, namespace = "xmb") {
    const prepared = await prepare(file, createReference(namespace));
    await MediaStorage.putMany(prepared.entries);
    return prepared.reference;
  }

  function cacheUrl(key, blob) {
    const cached = objectUrls.get(key);
    if (cached) {
      objectUrls.delete(key);
      objectUrls.set(key, cached);
      return cached;
    }
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
    while (objectUrls.size > 72) {
      const [oldKey, oldUrl] = objectUrls.entries().next().value;
      objectUrls.delete(oldKey);
      URL.revokeObjectURL(oldUrl);
    }
    return url;
  }

  async function resolve(reference, variant = "display") {
    if (!isReference(reference)) return reference;
    if (!VARIANTS[variant]) variant = "display";
    const key = variantKey(reference, variant);
    const cached = objectUrls.get(key);
    if (cached) return cacheUrl(key);
    const blob = (await MediaStorage.get(key)) || (await MediaStorage.get(reference));
    return blob ? cacheUrl(key, blob) : "";
  }

  async function resolveOriginal(reference) {
    if (!isReference(reference)) return reference;
    const cached = objectUrls.get(reference);
    if (cached) return cacheUrl(reference);
    const blob = await MediaStorage.get(reference);
    return blob ? cacheUrl(reference, blob) : "";
  }

  async function mediaType(reference) {
    if (!isReference(reference)) return "";
    const blob = await MediaStorage.get(reference);
    return blob?.type || "";
  }

  async function remove(reference) {
    if (!isReference(reference)) return;
    const refs = [reference, ...variantReferences(reference)];
    await MediaStorage.putMany(refs.map((key) => [key, undefined]));
    for (const key of refs) {
      const url = objectUrls.get(key);
      if (url) URL.revokeObjectURL(url);
      objectUrls.delete(key);
    }
  }

  function variantReferences(reference) {
    return Object.values(VARIANTS).map(({ suffix }) => reference + suffix);
  }

  window.XmbArtworkStorage = {
    isReference,
    hasUrl: (reference, variant) => objectUrls.has(variantKey(reference, variant)),
    createReference,
    prepare,
    store,
    resolve,
    resolveOriginal,
    mediaType,
    remove,
    variantReferences,
    variantKey,
  };
})();
