/* Title gallery presentation and banner selection, preserving the detail view position. */
function createTitleGallery({ node, button, getDetailPage, drawDetail }) {
  const galleryDialog = node("dialog", "gallery-viewer");
  galleryDialog.setAttribute("aria-label", "Galeria de imagens");
  const galleryTitle = node("h2"),
    galleryImage = node("img"),
    galleryStatus = node("p", "title-notice");
  const galleryTools = node("div", "gallery-viewer-tools");
  let galleryEntries = [],
    galleryIndex = 0,
    galleryItem = null,
    galleryOrigin = null;
  function drawGallery() {
    const src = galleryEntries[galleryIndex];
    galleryImage.src = Artwork.url(src);
    galleryImage.alt = galleryItem.title + " · imagem " + (galleryIndex + 1);
    galleryTitle.textContent =
      galleryItem.title + " · " + (galleryIndex + 1) + " / " + galleryEntries.length;
    const selected = TitleBanner.get(galleryItem).image === src;
    gallerySet.textContent = selected ? "✓ banner selecionado" : "definir como banner";
    gallerySet.disabled = selected;
    galleryStatus.textContent = "";
    galleryPrevious.disabled = galleryNext.disabled = galleryEntries.length < 2;
  }
  function setGalleryBanner(item, src) {
    const folds = Array.from(getDetailPage().querySelectorAll(".title-fold"))
      .filter((fold) => fold.open)
      .map((fold) => fold.querySelector("summary")?.textContent);
    const y = window.scrollY || 0,
      hash = location.hash;
    TitleBanner.setImage(item, src);
    drawDetail(item);
    for (const fold of getDetailPage().querySelectorAll(".title-fold"))
      if (folds.includes(fold.querySelector("summary")?.textContent)) {
        fold.open = true;
        fold.ontoggle?.();
      }
    window.requestAnimationFrame?.(() => {
      if (location.hash === hash) window.scrollTo?.({ top: y, behavior: "instant" });
    });
  }
  function moveGallery(delta) {
    galleryIndex = (galleryIndex + delta + galleryEntries.length) % galleryEntries.length;
    drawGallery();
  }
  const galleryPrevious = button("← anterior", () => moveGallery(-1), "gallery-previous");
  const galleryNext = button("próxima →", () => moveGallery(1), "gallery-next");
  const gallerySet = button(
    "definir como banner",
    () => {
      try {
        setGalleryBanner(galleryItem, galleryEntries[galleryIndex]);
        drawGallery();
        galleryClose.focus({ preventScroll: true });
      } catch (error) {
        galleryStatus.textContent = error.message;
      }
    },
    "primary gallery-set-banner",
  );
  const galleryClose = button("fechar ×", () => galleryDialog.close(), "gallery-close");
  galleryImage.onerror = () => {
    galleryStatus.textContent = "Não foi possível carregar esta imagem.";
  };
  galleryTools.append(galleryPrevious, galleryNext, gallerySet, galleryClose);
  galleryDialog.append(galleryTitle, galleryImage, galleryTools, galleryStatus);
  document.body.append(galleryDialog);
  galleryDialog.onkeydown = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveGallery(event.key === "ArrowLeft" ? -1 : 1);
    }
  };
  galleryDialog.onclose = () => {
    if (galleryOrigin?.isConnected) galleryOrigin.focus({ preventScroll: true });
    else getDetailPage().querySelector("h1")?.focus({ preventScroll: true });
  };
  function imageGallery(item, images, label) {
    const entries = images.filter((src) => safeUrl(src)).slice(0, 30),
      grid = node("div", "game-screenshots");
    entries.forEach((src, index) => {
      const card = node("div", "game-gallery-card");
      const preview = button(
        "",
        () => {
          galleryEntries = entries;
          galleryIndex = index;
          galleryItem = item;
          galleryOrigin = preview;
          drawGallery();
          galleryDialog.showModal();
        },
        "gallery-preview",
      );
      preview.setAttribute(
        "aria-label",
        "Ampliar " + label + " " + (index + 1) + " de " + item.title,
      );
      const image = node("img");
      image.dataset.deferredSrc = src;
      image.alt = label + " · " + item.title + " · " + (index + 1);
      image.loading = "lazy";
      preview.append(image);
      const selected = TitleBanner.get(item).image === src;
      const choose = button(
        selected ? "✓" : "▧",
        () => {
          try {
            setGalleryBanner(item, src);
          } catch (error) {
            toast(error.message);
          }
        },
        "gallery-banner-action",
      );
      choose.setAttribute(
        "aria-label",
        selected ? "Imagem selecionada como banner" : "Usar imagem " + (index + 1) + " como banner",
      );
      choose.setAttribute("aria-pressed", String(selected));
      choose.title = selected ? "Banner selecionado" : "Definir como banner";
      card.append(preview, choose);
      grid.append(card);
    });
    return grid;
  }
  return { imageGallery };
}
