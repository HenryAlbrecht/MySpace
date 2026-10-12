/* Downloads authorized media through the local server endpoint. */
(function (root) {
  async function download(url, kind, cooldownSeconds = 60) {
    const response = await fetch("/api/xmb/media-download", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, kind, cooldownSeconds }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw Error(error.error || "Não foi possível baixar a mídia.");
    }
    return response.blob();
  }
  root.MediaDownload = { download };
})(typeof window === "undefined" ? globalThis : window);
