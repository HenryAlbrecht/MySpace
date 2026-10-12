/* Downloads authorized media through the local server endpoint. */
(function (root) {
  function saveFile(blob, filename) {
    const originalName = String(filename || "midia").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
    const extension = originalName.match(/\.[a-z0-9]{1,8}$/i)?.[0] || "";
    const baseName = originalName
      .slice(0, extension ? -extension.length : undefined)
      .replace(/\s+/g, " ")
      .trim();
    const safeName = (baseName.slice(0, 140 - extension.length) || "midia") + extension;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function download(url, kind, cooldownSeconds = 60, metadata = {}) {
    const response = await fetch("/api/xmb/media-download", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, kind, cooldownSeconds, metadata }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const failure = Error(error.error || "Não foi possível baixar a mídia.");
      failure.retryAfterSeconds = Number(error.retryAfterSeconds || response.headers.get("Retry-After")) || 0;
      throw failure;
    }
    const blob = await response.blob();
    Object.defineProperty(blob, "albumCoverEmbedded", {
      value: response.headers.get("X-Media-Cover-Embedded") === "true",
    });
    return blob;
  }
  root.MediaDownload = { download, saveFile };
})(typeof window === "undefined" ? globalThis : window);
