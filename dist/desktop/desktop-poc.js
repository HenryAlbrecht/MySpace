/* Optional desktop diagnostic. Existing browser boot and data owners stay unchanged. */
(() => {
  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) return;
  document.documentElement.dataset.runtime = "tauri";
  const dialog = document.createElement("dialog");
  dialog.className = "desktop-poc";
  dialog.setAttribute("aria-labelledby", "desktopPocTitle");
  const heading = document.createElement("h2");
  heading.id = "desktopPocTitle";
  heading.textContent = "MySpace Desktop — PoC";
  const info = document.createElement("p");
  info.textContent = "Interface local em Tauri 2, sem servidor Node. Os providers online ainda estão em migração.";
  const storage = document.createElement("p");
  storage.textContent = "Este aplicativo tem armazenamento separado do navegador. Para trazer coleção e mídias, exporte um pacote .myspace no navegador e importe-o aqui pelo fluxo de backup existente.";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const picker = document.createElement("button");
  picker.type = "button";
  picker.textContent = "Testar seletor nativo de arquivo";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Continuar para o MySpace";
  close.onclick = () => dialog.close();
  picker.onclick = async () => {
    picker.disabled = true;
    try {
      const path = await tauri.core.invoke("plugin:dialog|open", {
        options: { title: "MySpace Desktop — selecionar arquivo", multiple: false, directory: false },
      });
      status.textContent = path ? "Arquivo selecionado: " + path : "Seleção cancelada.";
    } catch (error) {
      status.textContent = "Não foi possível abrir o seletor nativo: " + String(error);
    } finally {
      picker.disabled = false;
    }
  };
  dialog.append(heading, info, storage, picker, close, status);
  document.body.append(dialog);
  let opener;
  dialog.addEventListener("close", () => opener?.focus({ preventScroll: true }));
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    dialog.showModal();
  }
  document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || !event.shiftKey || event.code !== "KeyD") return;
    event.preventDefault();
    event.stopPropagation();
    open();
  });
  void tauri.core.invoke("plugin:app|version").then((version) => {
    heading.textContent += " · " + version;
  }).catch(() => {});
  open();
})();
