/* Recommendation presentation; Catalog owns requests, MusicPageUI owns selection. */
function createMusicDiscoveryView({
  node,
  button,
  cover,
  open,
  Catalog,
  MusicPageUI,
  CollectionActions,
  MusicModel,
}) {
  function appendMusicalDiscovery(parent, item) {
    const section = node("section", "game-detail-section"),
      grid = node(
        item.kind === "music" ? "ol" : "div",
        item.kind === "music"
          ? "music-tracklist discovery-grid"
          : "media-related-grid discovery-grid",
      );
    section.dataset.titleDiscovery = "";
    const status = node("p", "title-notice"),
      basis = node(
        "p",
        "title-notice",
        item.kind === "music"
          ? "Rádio da faixa no YouTube Music."
          : item.kind === "album"
            ? { single: "Singles relacionados.", ep: "EPs relacionados." }[
                item.albumType
              ] || "Álbuns relacionados."
            : "",
      );
    const key = MusicPageUI.recommendationKey;
    let pool = [],
      visible = [],
      seen = new Set(),
      rotation = 0,
      partial = false,
      sourceReserve = true,
      sourceExhausted = false;
    const saved = (entry) =>
      CollectionActions.getItems().some(
        (row) =>
          MusicModel.sameWork(row, entry) || MusicModel.sameItem(row, entry),
      );
    const patchSaved = (element, entry) => {
      let badge = element.querySelector(".recommendation-saved");
      if (saved(entry) && !badge) {
        badge = node("small", "recommendation-saved", "✓ na coleção");
        (entry.kind === "music"
          ? element.querySelector(".music-track-title")
          : element
        ).append(badge);
      }
      if (badge) badge.hidden = !saved(entry);
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
      animations = new Map();
    const cancelMotion = () => {
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
    };
    const onReduced = () => {
      if (reduced.matches) cancelMotion();
    };
    reduced.addEventListener("change", onReduced);
    window.addEventListener(
      "hashchange",
      () => {
        cancelMotion();
        reduced.removeEventListener("change", onReduced);
      },
      { once: true },
    );
    function animateRecommendationReconcile(before) {
      cancelMotion();
      if (reduced.matches || !grid.children[0]?.animate) return;
      const styles = getComputedStyle(document.documentElement),
        duration =
          parseFloat(styles.getPropertyValue("--motion-focus")) ||
          parseFloat(styles.getPropertyValue("--motion-standard"));
      const easing = styles.getPropertyValue("--ease-xmb").trim();
      for (const element of grid.children) {
        const old = before.get(element.dataset.catalogId),
          after = element.getBoundingClientRect();
        let frames;
        if (old) {
          const dx = old.left - after.left,
            dy = old.top - after.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
          frames = [
            { transform: "translate(" + dx + "px," + dy + "px)" },
            { transform: "translate(0,0)" },
          ];
        } else
          frames = [
            {
              opacity: 0,
              transform:
                "translateY(" + (item.kind === "music" ? 2 : 4) + "px)",
            },
            { opacity: 1, transform: "translateY(0)" },
          ];
        const animation = element.animate(frames, {
          duration,
          easing,
          fill: "none",
        });
        animations.set(element, animation);
        animation.finished
          .catch(() => {})
          .finally(() => {
            if (animations.get(element) === animation)
              animations.delete(element);
          });
      }
    }
    function render() {
      const before = new Map(
        [...grid.children].map((element) => [
          element.dataset.catalogId,
          element.getBoundingClientRect(),
        ]),
      );
      const old = new Map(
          [...grid.children].map((element) => [
            element.dataset.catalogId,
            element,
          ]),
        ),
        retained = new Set();
      const focused = grid.contains(document.activeElement)
        ? document.activeElement
        : null;
      visible.forEach((entry, index) => {
        let element = old.get(entry.catalogId);
        if (!element) {
          if (entry.kind === "music")
            element = MusicPageUI.trackRow(entry, index);
          else {
            element = button("", () => open(entry), "discover-card");
            element.dataset.kind = entry.kind;
            element.append(
              cover(
                entry.image,
                entry.title,
                entry.imageFallback,
                entry.coverLayout,
                entry.kind,
              ),
              node("strong", "", entry.title),
            );
            if (entry.kind === "album")
              element.append(
                node(
                  "small",
                  "",
                  [
                    { album: "Álbum", ep: "EP", single: "Single" }[
                      entry.albumType
                    ],
                    entry.releaseDate?.slice(0, 4),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                ),
              );
            Catalog.intentCore(element, entry);
          }
          element.dataset.catalogId = entry.catalogId;
        }
        patchSaved(element, entry);
        const number = element.querySelector(".music-track-number");
        if (number) number.textContent = String(index + 1).padStart(2, "0");
        retained.add(element);
        if (grid.children[index] !== element)
          grid.insertBefore(element, grid.children[index] || null);
      });
      for (const element of old.values())
        if (!retained.has(element)) element.remove();
      if (before.size) animateRecommendationReconcile(before);
      if (focused?.isConnected && document.activeElement !== focused)
        focused.focus({ preventScroll: true });
      else if (focused && !focused.isConnected)
        load.focus({ preventScroll: true });
      status.textContent = partial
        ? "Algumas sugestões ainda estão pendentes. Os resultados disponíveis foram mantidos."
        : visible.length
          ? ""
          : "Não há recomendações disponíveis para este título agora.";
      load.textContent = partial
        ? "tentar novamente"
        : "ver outras recomendações";
    }
    const merge = (entries) => {
      const ids = new Set([item.catalogId]);
      const normalize = (value) =>
        String(value || "")
          .normalize("NFKC")
          .toLowerCase()
          .trim();
      let own = 0;
      pool = [...pool, ...entries]
        .filter((entry) => {
          if (
            !entry.catalogId ||
            ids.has(entry.catalogId) ||
            entry.kind !== item.kind ||
            (item.kind === "album" &&
              item.albumType &&
              entry.albumType !== item.albumType)
          )
            return false;
          ids.add(entry.catalogId);
          const same =
            item.kind !== "artist" &&
            (item.artistCatalogId && entry.artistCatalogId
              ? item.artistCatalogId === entry.artistCatalogId
              : !!item.artist &&
                normalize(item.artist) === normalize(entry.artist));
          return !same || ++own <= 2;
        })
        .slice(0, 48);
    };
    const load = button(
      "ver outras recomendações",
      async () => {
        const route = location.hash,
          started = section.dataset.started === "true";
        section.dataset.started = "true";
        load.disabled = true;
        section.setAttribute("aria-busy", "true");
        try {
          // Rotation consumes unseen reserve before consulting deterministic providers again.
          const nextWindow = MusicPageUI.recommendationWindow(pool, {
            saved: CollectionActions.getItems(),
            visible,
            seen,
            rotate: true,
            rotation: rotation + 1,
          });
          const reserve = nextWindow.filter(
            (entry) => !seen.has(key(entry)),
          ).length;
          if (
            !started ||
            (reserve < 6 && !(item.kind === "artist" && sourceExhausted))
          ) {
            status.textContent = "Buscando sugestões…";
            const fresh = await Catalog.recommendations(item, {
              force: started,
              localPool: true,
            });
            if (!section.isConnected || location.hash !== route) return;
            partial = !!fresh.resolution?.failures;
            sourceReserve = !!fresh.reserveAvailable;
            sourceExhausted = fresh.sourceExhausted === true;
            merge(fresh);
          }
          if (started) rotation++;
          visible = MusicPageUI.recommendationWindow(pool, {
            saved: CollectionActions.getItems(),
            visible,
            seen,
            rotate: started,
            rotation,
          });
          visible.forEach((entry) => seen.add(key(entry)));
          render();
        } catch (error) {
          console.warn("Recommendations unavailable", error);
          status.textContent = pool.length
            ? "Os resultados foram mantidos. Tente novamente."
            : "Não foi possível carregar recomendações agora.";
          load.textContent = "tentar novamente";
        } finally {
          load.hidden =
            item.kind === "artist" &&
            !partial &&
            !sourceReserve &&
            pool.length <= visible.length;
          load.disabled = false;
          section.setAttribute("aria-busy", "false");
        }
      },
      "text-action",
    );
    section.patchCollectionState = () => {
      for (const entry of visible) {
        const element = [...grid.children].find(
          (row) => row.dataset.catalogId === entry.catalogId,
        );
        if (element) patchSaved(element, entry);
      }
    };
    const heading = node("div", "discovery-heading");
    heading.append(
      node(
        "h2",
        "",
        item.kind === "artist" ? "artistas similares" : "para descobrir",
      ),
      load,
    );
    load.hidden = true;
    section.append(heading, basis, status, grid);
    parent.append(section);
    if (window.IntersectionObserver) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (
            entries.some((entry) => entry.isIntersecting) &&
            section.isConnected &&
            section.dataset.started !== "true"
          ) {
            observer.disconnect();
            load.click();
          }
        },
        { rootMargin: "200px" },
      );
      observer.observe(section);
      window.addEventListener("hashchange", () => observer.disconnect(), {
        once: true,
      });
    } else
      requestAnimationFrame(() => {
        if (section.isConnected && section.dataset.started !== "true")
          load.click();
      });
  }
  return { appendMusicalDiscovery };
}
