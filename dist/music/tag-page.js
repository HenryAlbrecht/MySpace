/* A tag is an exploration surface, never a collection title. */
(() => {
  const make = (tag, text = "", cls = "") => {
    const n = document.createElement(tag);
    n.textContent = text;
    n.className = cls;
    return n;
  };
  const page = make("section", "", "page-view panel title-page music-tag-page");
  page.id = "tagPage";
  page.hidden = true;
  document.querySelector("main").insertBefore(page, document.querySelector("footer"));
  let controller,
    revision = 0,
    last = "",
    origin = "#descobrir";
  const valid = (value) =>
    typeof value === "string" &&
    value.trim() &&
    value.trim().length <= 80 &&
    !/[\x00-\x1f\x7f<>]/.test(value);
  async function route() {
    const hash = location.hash;
    page.hidden = !hash.startsWith("#tag/");
    if (page.hidden) {
      if (!hash.startsWith("#tag/")) origin = hash || "#descobrir";
      controller?.abort();
      last = "";
      return;
    }
    if (last === hash) return;
    last = hash;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal,
      token = ++revision;
    page.replaceChildren();
    let tag;
    try {
      tag = decodeURIComponent(hash.slice(5));
    } catch {}
    if (!valid(tag)) {
      page.append(make("p", "Tag inválida.", "empty"));
      return;
    }
    const head = make("div", "", "section-head"),
      back = make("button", "← voltar");
    back.type = "button";
    back.onclick = () => {
      if (history.length > 1) history.back();
      else location.hash = origin;
    };
    head.append(back);
    page.append(head);
    const body = make("div", "", "title-about");
    page.append(body);
    body.append(make("span", "explorar", "title-kind"), make("h1", tag));
    const reading = make("div", "", "summary-reading"),
      summary = make("p", "Carregando a história…", "title-summary"),
      more = make("button", "ler mais ↓", "summary-read-more text-action");
    more.type = "button";
    more.hidden = true;
    more.setAttribute("aria-expanded", "false");
    more.onclick = () => {
      const open = more.getAttribute("aria-expanded") !== "true";
      more.setAttribute("aria-expanded", String(open));
      reading.classList.toggle("expanded", open);
      more.textContent = open ? "recolher ↑" : "ler mais ↓";
    };
    reading.append(summary, more);
    body.append(
      make("h2", "sobre"),
      reading,
      make("p", "Dados: Last.fm · catálogo: YouTube Music.", "title-notice"),
    );
    const request = async (section, p = 1) => {
      const response = await fetch(
        "/api/music/tag?" + new URLSearchParams({ tag, section, page: p }),
        { signal },
      );
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error || "Dados indisponíveis.");
      return payload;
    };
    try {
      const info = await request("info");
      if (token !== revision || signal.aborted) return;
      summary.textContent =
        MusicPageUI.plainText(info.summary) || "Não há uma descrição para esta tag.";
      more.hidden = summary.textContent.length <= 700;
      reading.classList.toggle("short", more.hidden);
    } catch (error) {
      if (signal.aborted) return;
      summary.textContent = error.message;
    }
    for (const [kind, label] of [
      ["music", "músicas populares"],
      ["album", "álbuns populares"],
      ["artist", "artistas em destaque"],
    ]) {
      if (signal.aborted || token !== revision) return;
      const section = make("section", "", "game-detail-section"),
        status = make("p", "Carregando…", "title-notice"),
        content = make("div"),
        load = make("button", "carregar mais");
      load.type = "button";
      load.hidden = true;
      section.append(make("h2", label), status, content, load);
      body.append(section);
      let next = 1;
      const seen = new Set();
      const draw = async () => {
        load.disabled = true;
        try {
          const result = await request(kind, next);
          if (signal.aborted || token !== revision) return;
          for (const item of result.items || []) {
            if (seen.has(item.catalogId)) continue;
            seen.add(item.catalogId);
            if (kind === "music") {
              if (!content.firstChild) content.append(MusicPageUI.tracklist([]));
              content.firstChild.append(MusicPageUI.trackRow(item, seen.size - 1));
            } else {
              content.className = "media-related-grid";
              const card = make("button", "", "discover-card");
              card.dataset.kind = kind;
              card.type = "button";
              card.onclick = () => TitlePages.open(item);
              const cover = make("div", "", "title-cover"),
                img = make("img");
              img.alt = item.title;
              Artwork.set(img, item.image);
              cover.append(img);
              card.append(cover, make("strong", item.title));
              const secondary = kind === "artist" ? item.subscriberText || "" : item.artist || "";
              if (secondary && secondary !== item.title) card.append(make("small", secondary));
              content.append(card);
            }
          }
          next = result.next;
          load.hidden = !next;
          status.textContent = result.partial
            ? "Alguns resultados não puderam ser identificados com segurança."
            : seen.size
              ? ""
              : "Nenhum resultado disponível agora.";
        } catch (error) {
          if (!signal.aborted) status.textContent = error.message;
        } finally {
          load.disabled = false;
        }
      };
      load.onclick = draw;
      await draw();
    }
    try {
      const result = await request("related");
      if (signal.aborted || token !== revision) return;
      const tags = [...new Set((result.tags || []).filter(valid).map((name) => name.trim()))];
      if (!tags.length) return;
      const section = make("section", "", "game-detail-section");
      section.append(make("h2", "tags relacionadas"));
      for (const name of tags) section.append(MusicPageUI.tagLink(name));
      body.append(section);
    } catch {}
  }
  window.addEventListener("hashchange", route);
  route();
})();
