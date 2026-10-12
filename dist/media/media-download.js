/* Downloads authorized media through the local server endpoint. */
(function (root) {
  let activeController;
  function progressView(kind, cancel) {
    const dialog = document.createElement("dialog");
    dialog.className = "music-link-dialog media-download-progress";
    const title = document.createElement("h2");
    title.textContent = kind === "audio" ? "Baixando áudio" : "Baixando vídeo";
    const status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    const progress = document.createElement("progress");
    progress.max = 100;
    progress.setAttribute("aria-label", "Progresso do download");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "cancelar download";
    const stop = () => {
      button.disabled = true;
      status.textContent = "Cancelando download…";
      cancel();
    };
    button.onclick = stop;
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      stop();
    });
    dialog.append(title, status, progress, button);
    document.body.append(dialog);
    dialog.showModal();
    return {
      update({ phase, percent }) {
        status.textContent = {
          download: "Baixando da fonte autorizada…",
          processing: "Preparando arquivo, capa e metadados…",
          transfer: "Recebendo arquivo…",
        }[phase] || "Preparando download…";
        if (Number.isFinite(percent)) {
          progress.value = percent;
          status.textContent += " " + Math.floor(percent) + "%";
        } else progress.removeAttribute("value");
      },
      close() {
        dialog.close();
        dialog.remove();
      },
    };
  }
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

  async function download(url, kind, cooldownSeconds = 60, metadata = {}, options = {}) {
    if (activeController) throw Error("Já existe um download em andamento.");
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.throwIfAborted();
    options.signal?.addEventListener("abort", cancel, { once: true });
    activeController = controller;
    const downloadId = crypto.randomUUID();
    let view;
    let timer;
    let finished = false;
    let pollController;
    async function poll() {
      pollController = new AbortController();
      try {
        const response = await fetch("/api/xmb/media-download-progress?id=" + downloadId, {
          signal: pollController.signal,
          credentials: "same-origin",
        });
        if (response.ok && !finished && !controller.signal.aborted)
          view?.update(await response.json());
      } catch {}
      if (!finished && !controller.signal.aborted) timer = setTimeout(poll, 700);
    }
    try {
      view = progressView(kind, cancel);
      view.update({ phase: "download" });
      timer = setTimeout(poll, 300);
      const response = await fetch("/api/xmb/media-download", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ url, kind, cooldownSeconds, metadata, downloadId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const failure = Error(error.error || "Não foi possível baixar a mídia.");
        failure.retryAfterSeconds = Number(error.retryAfterSeconds || response.headers.get("Retry-After")) || 0;
        throw failure;
      }
      finished = true;
      clearTimeout(timer);
      pollController?.abort();
      const total = Number(response.headers.get("Content-Length"));
      const chunks = [];
      let received = 0;
      const reader = response.body?.getReader();
      let blob;
      if (reader) {
        try {
          while (true) {
            controller.signal.throwIfAborted();
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.byteLength;
            view.update({ phase: "transfer", ...(total > 0 ? { percent: received / total * 100 } : {}) });
          }
        } finally {
          reader.releaseLock();
        }
        blob = new Blob(chunks, { type: response.headers.get("Content-Type") || "application/octet-stream" });
      } else blob = await response.blob();
      controller.signal.throwIfAborted();
      Object.defineProperty(blob, "albumCoverEmbedded", {
        value: response.headers.get("X-Media-Cover-Embedded") === "true",
      });
      return blob;
    } catch (error) {
      if (controller.signal.aborted) {
        const cancelled = Error("Download cancelado.");
        cancelled.name = "AbortError";
        throw cancelled;
      }
      throw error;
    } finally {
      finished = true;
      clearTimeout(timer);
      pollController?.abort();
      options.signal?.removeEventListener("abort", cancel);
      view?.close();
      activeController = undefined;
    }
  }
  root.MediaDownload = { download, saveFile };
})(typeof window === "undefined" ? globalThis : window);
