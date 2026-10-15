/* Vita shortcuts are a presentation of Collection games, never a second library. */
(function (root) {
  const PAGE_SIZE = 10;
  function peelGeometry(width, height, depth) {
    const k = Math.max(0, Math.min(width + height, depth));
    const corners = [[0, 0], [width, 0], [width, height], [0, height]];
    const distance = ([x, y]) => x - y - width + k;
    function clip(lifted) {
      const points = [];
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % corners.length];
        const da = distance(a);
        const db = distance(b);
        const insideA = lifted ? da >= 0 : da <= 0;
        const insideB = lifted ? db >= 0 : db <= 0;
        if (insideA) points.push(a);
        if (insideA !== insideB) {
          const t = da / (da - db);
          points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      if (points.length < 3) return "polygon(0px 0px, 0px 0px, 0px 0px)";
      return "polygon(" + points.map(([x, y]) => `${x.toFixed(3)}px ${y.toFixed(3)}px`).join(", ") + ")";
    }
    return { stuck: clip(false), lifted: clip(true), size: k };
  }
  function pageRows(count, page) {
    if (page < 0) return [];
    let cursor = page * PAGE_SIZE;
    const end = Math.min(cursor + PAGE_SIZE, count);
    const rows = [];
    for (const capacity of [3, 4, 3]) {
      if (cursor >= end) break;
      const length = Math.min(capacity, end - cursor);
      rows.push(Array.from({ length }, (_, i) => cursor + i));
      cursor += length;
    }
    return rows;
  }
  function neighbour(count, from, direction) {
    const page = Math.floor(from / PAGE_SIZE);
    const rows = pageRows(count, page);
    const rowIndex = rows.findIndex((row) => row.includes(from));
    if (rowIndex < 0) return from;
    const row = rows[rowIndex];
    const col = row.indexOf(from);
    if (direction === "left" || direction === "right")
      return row[col + (direction === "right" ? 1 : -1)] ?? from;
    const delta = direction === "down" ? 1 : -1;
    let target = rows[rowIndex + delta];
    if (!target) {
      const next = pageRows(count, page + delta);
      target = delta > 0 ? next[0] : next[next.length - 1];
    }
    if (!target) return from;
    const mapped = row.length <= 1 ? 0 : Math.round(col / (row.length - 1) * (target.length - 1));
    return target[mapped];
  }
  if (typeof document === "undefined") {
    module.exports = { pageRows, neighbour, peelGeometry };
    return;
  }
  root.createXmbVita = function ({ host, getItems, el, button, imageNode, onClose, onLaunch, clock }) {
    const panel = el("section", "xmb-vita");
    panel.hidden = true;
    panel.setAttribute("aria-label", "Atalhos PS Vita");
    const controls = el("header", "xmb-vita-controls");
    const back = button("Voltar · B / Esc", () => action("back"));
    const edit = button("Editar · Select / S", () => action("select"));
    controls.append(back, edit);
    const stage = el("div", "xmb-vita-stage");
    const dots = el("nav", "xmb-vita-dots");
    dots.setAttribute("aria-label", "Páginas de atalhos");
    const field = el("div", "xmb-vita-field");
    const live = el("section", "xmb-vita-live");
    live.hidden = true;
    const hints = el("p", "xmb-vita-hints");
    hints.setAttribute("role", "status");
    stage.append(dots, field, live);
    panel.append(controls, stage, hints);
    host.append(panel);
    let opened = false;
    let mode = "browse";
    let ids = [];
    let focus = 0;
    let moving = null;
    let snapshot = null;
    let picker = false;
    let pickerPlatform = "";
    let launchId = null;
    let timer;
    let holdTimer;
    let revision = 0;
    let cleanupMedia = () => {};
    let held = false;
    let renderedPage = -1;
    let iconRequest;
    let swipeStart;
    let lastPageTurn = 0;
    let peelFrame;
    let peelTo = () => {};
    const games = () => getItems().filter((item) => item.kind === "game" && !item.xmbHidden);
    const game = (id) => games().find((item) => item.id === id);
    const reduced = () => root.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    function pinned() {
      return games().filter((item) => Number.isInteger(item.xmbVitaOrder) && item.xmbVitaOrder >= 0)
        .sort((a, b) => a.xmbVitaOrder - b.xmbVitaOrder).map((item) => item.id);
    }
    function persist(next) {
      try {
        if (root.CollectionActions.setVitaShortcuts(next) === false) throw Error("Não foi possível salvar os atalhos.");
        ids = next;
        return true;
      } catch (error) {
        root.toast?.(error.message);
        return false;
      }
    }
    function clearWork() {
      revision++;
      root.clearTimeout(timer);
      root.clearTimeout(holdTimer);
      root.cancelAnimationFrame(peelFrame);
      peelFrame = undefined;
      iconRequest?.abort();
      cleanupMedia();
      cleanupMedia = () => {};
    }
    function focusButton() {
      const target = picker && focus < 0
        ? field.querySelector("select") : field.querySelector(`[data-slot="${focus}"]`);
      target?.focus({ preventScroll: true });
      if (picker) target?.scrollIntoView({ block: "nearest" });
    }
    function render() {
      if (!opened) return;
      ids = ids.filter((id) => game(id));
      panel.dataset.mode = mode;
      back.textContent = "Voltar · B / Esc";
      panel.dataset.moving = String(moving !== null);
      field.replaceChildren();
      dots.replaceChildren();
      if (picker) {
        const available = games().filter((item) => !ids.includes(item.id));
        const choices = available.filter((item) => !pickerPlatform || (item.platform || "Outros") === pickerPlatform)
          .sort((a, b) => a.title.localeCompare(b.title));
        field.classList.add("xmb-vita-picker");
        hints.textContent = "Escolha um jogo da coleção para adicionar · B / Esc volta";
        focus = Math.max(-1, Math.min(focus, choices.length - 1));
        const platforms = el("select", "xmb-vita-platforms");
        platforms.setAttribute("aria-label", "Plataforma dos jogos");
        for (const name of ["", ...new Set(available.map((item) => item.platform || "Outros"))]) {
          const option = el("option", "", name || "Todas as plataformas");
          option.value = name;
          option.selected = pickerPlatform === name;
          platforms.append(option);
        }
        platforms.addEventListener("change", () => {
          pickerPlatform = platforms.value;
          focus = -1;
          render();
        });
        platforms.addEventListener("focus", () => {
          focus = -1;
          for (const node of field.querySelectorAll(".xmb-vita-choice"))
            node.setAttribute("aria-pressed", "false");
        });
        field.append(platforms);
        choices.forEach((item, index) => {
          const choice = button(item.title, () => {
            if (persist([...ids, item.id])) {
              picker = false;
              focus = ids.length - 1;
              render();
            }
          }, "xmb-vita-choice");
          choice.dataset.slot = String(index);
          choice.setAttribute("aria-pressed", String(focus === index));
          choice.addEventListener("focus", () => {
            focus = index;
            for (const node of field.querySelectorAll(".xmb-vita-choice"))
              node.setAttribute("aria-pressed", String(node === choice));
          });
          choice.append(imageNode(item.xmbArt?.bubble || item.xmbArt?.image || item.image, "", { variant: "thumb" }));
          field.append(choice);
        });
        if (!choices.length) field.append(el("p", "", "Nenhum outro jogo disponível. Adicione jogos à coleção."));
        focusButton();
        return;
      }
      field.classList.remove("xmb-vita-picker");
      const count = ids.length + (mode === "edit" || !ids.length ? 1 : 0);
      focus = Math.max(0, Math.min(focus, count - 1));
      const page = Math.floor(focus / PAGE_SIZE);
      field.dataset.turn = String(renderedPage >= 0 && page !== renderedPage);
      field.style.setProperty("--vita-page-direction", page > renderedPage ? 1 : -1);
      field.dataset.landing = String(page !== renderedPage);
      renderedPage = page;
      const rows = pageRows(count, page);
      panel.style.setProperty("--vita-rows", rows.length);
      for (let i = 0; i < Math.ceil(count / PAGE_SIZE); i++) {
        const dot = button(`Página ${i + 1}`, () => {
          focus = i * PAGE_SIZE;
          render();
        }, "xmb-vita-dot");
        dot.disabled = moving !== null;
        dot.setAttribute("aria-current", i === page ? "page" : "false");
        dots.append(dot);
      }
      rows.forEach((row, r) => row.forEach((index, c) => {
        const item = game(ids[index]);
        const bubble = button("", () => {
          if (held) {
            held = false;
            return;
          }
          focus = index;
          action("primary");
        }, "xmb-vita-bubble");
        bubble.dataset.slot = String(index);
        bubble.dataset.moving = String(moving === index);
        bubble.setAttribute("aria-label", item?.title || "Adicionar atalho");
        bubble.setAttribute("aria-pressed", String(focus === index));
        bubble.style.setProperty("--vita-x", String((c - (row.length - 1) / 2) * 379));
        bubble.style.setProperty("--vita-y", String((r - (rows.length - 1) / 2) * 253));
        bubble.style.setProperty("--vita-delay", `${(index % PAGE_SIZE) * 25}ms`);
        const icon = el("span", "xmb-vita-icon");
        if (item) icon.append(imageNode(item.xmbArt?.bubble || item.xmbArt?.image || item.image, "", { variant: "thumb" }));
        else icon.textContent = "+";
        bubble.append(icon, el("span", "xmb-vita-name", item?.title || "Adicionar"));
        bubble.addEventListener("focus", () => {
          focus = index;
          for (const node of field.querySelectorAll(".xmb-vita-bubble"))
            node.setAttribute("aria-pressed", String(node === bubble));
        });
        bubble.addEventListener("pointerdown", (event) => {
          if (!item || event.button !== 0) return;
          held = false;
          const x = event.clientX;
          const y = event.clientY;
          bubble._holdStart = { x, y };
          root.clearTimeout(holdTimer);
          holdTimer = root.setTimeout(() => {
            held = true;
            focus = index;
            mode = "edit";
            beginMove();
            panel.setPointerCapture?.(event.pointerId);
          }, 550);
        });
        bubble.addEventListener("pointermove", (event) => {
          const start = bubble._holdStart;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10)
            root.clearTimeout(holdTimer);
        });
        field.append(bubble);
      }));
      edit.textContent = mode === "edit" ? "Ícone · Select / S" : "Editar · Select / S";
      hints.textContent = moving !== null
        ? "Direções: mover · A / Enter: colocar · B / Esc: cancelar"
        : mode === "edit" ? "A / Enter: mover ou adicionar · Select / S: editar ícone · B / Esc: concluir"
          : "Direções: selecionar · ↑ / ↓: páginas · A / Enter: abrir · Select / S: editar · V / Y: fechar";
      focusButton();
    }
    function beginMove() {
      if (!game(ids[focus])) return;
      snapshot = [...ids];
      moving = focus;
      render();
    }
    function cancelMove() {
      if (snapshot) {
        const id = ids[moving];
        ids = snapshot;
        focus = Math.max(0, ids.indexOf(id));
      }
      snapshot = null;
      moving = null;
    }
    function iconEditor() {
      const item = game(ids[focus]);
      if (!item) {
        picker = true;
        focus = 0;
        render();
        return;
      }
      mode = "icon";
      panel.dataset.mode = mode;
      const token = ++revision;
      field.replaceChildren();
      dots.replaceChildren();
      field.classList.add("xmb-vita-picker");
      field.append(el("h2", "", item.title));
      const file = el("input", "");
      file.type = "file";
      file.accept = "image/*";
      file.setAttribute("aria-label", "Escolher ícone da bolha");
      const saveIcon = async (source, stored = false) => {
        try {
          if (!opened || mode !== "icon" || token !== revision) {
            if (stored) void root.XmbArtworkStorage.remove(source);
            return;
          }
          const fresh = game(item.id);
          if (!fresh) throw Error("O jogo não está mais na coleção.");
          const art = { ...fresh.xmbArt };
          const old = art.bubble;
          if (source) art.bubble = source;
          else delete art.bubble;
          if (root.CollectionActions.updateItem(item.id, { xmbArt: art }) === false)
            throw Error("Não foi possível salvar o ícone.");
          if (old && root.XmbArtworkStorage?.isReference(old) &&
            !getItems().some((row) => Object.values(row.xmbArt || {}).flat().includes(old)))
            void root.XmbArtworkStorage.remove(old);
          if (opened && mode === "icon") {
            mode = "edit";
            render();
          }
        } catch (error) {
          if (stored) void root.XmbArtworkStorage.remove(source);
          root.toast?.(error.message);
        }
      };
      const search = button("Buscar ícones no SteamGridDB", async () => {
        iconRequest?.abort();
        iconRequest = new AbortController();
        search.disabled = true;
        const results = el("div", "xmb-vita-icon-results");
        field.querySelector(".xmb-vita-icon-results")?.remove();
        field.append(results);
        results.textContent = "Buscando ícones…";
        try {
          const params = new URLSearchParams({ title: item.title, slot: "bubble", mode: "choose" });
          const response = await fetch("/api/xmb/game-art?" + params, { signal: iconRequest.signal });
          const result = await response.json();
          if (!response.ok) throw Error(result.error || "Não foi possível buscar ícones.");
          if (!opened || mode !== "icon" || token !== revision) return;
          results.replaceChildren();
          const candidates = result.items || (result.url ? [result] : []);
          for (const candidate of candidates) {
            if (!/^https:\/\//i.test(candidate.url || "")) continue;
            const choice = button(candidate.title || "Usar ícone", () => void saveIcon(candidate.url));
            choice.append(imageNode(candidate.url, "", { variant: "thumb" }));
            results.append(choice);
          }
          if (!results.children.length) results.textContent = "Nenhum ícone disponível.";
        } catch (error) {
          if (error.name !== "AbortError" && opened && token === revision)
            results.textContent = error.message;
        } finally { search.disabled = false; }
      });
      file.addEventListener("change", async () => {
        const chosen = file.files?.[0];
        if (!chosen || !chosen.type.startsWith("image/")) return;
        file.disabled = true;
        try {
          const source = await root.XmbArtworkStorage.store(chosen);
          await saveIcon(source, true);
        } catch (error) { root.toast?.(error.message); }
        finally { file.disabled = false; }
      });
      field.append(file, search,
        button("Restaurar ícone padrão", () => void saveIcon("")),
        button("Remover atalho", () => {
          if (persist(ids.filter((id) => id !== item.id))) {
            mode = "edit";
            render();
          }
        }),
        button("Voltar", () => {
          clearWork();
          mode = "edit";
          render();
        }));
      hints.textContent = "O ícone da bolha é independente da capa e do fundo do jogo.";
      file.focus({ preventScroll: true });
    }
    function showLive(item) {
      if (!item) {
        render();
        return;
      }
      clearWork();
      launchId = item.id;
      mode = "depart";
      panel.dataset.mode = mode;
      const selected = field.querySelector(`[data-slot="${focus}"]`);
      selected?.classList.add("xmb-vita-depart");
      const token = revision;
      timer = root.setTimeout(() => {
        if (!opened || token !== revision) return;
        mode = "live";
        panel.dataset.mode = mode;
        back.textContent = "B / Esc · Voltar aos atalhos";
        live.replaceChildren();
        live.hidden = false;
        const art = item.xmbArt || {};
        const source = art.background || art.image || item.image;
        const wallpaper = art.backgroundVideo && art.background
          ? el("video", "xmb-vita-wallpaper") : imageNode(source, "", { variant: "wallpaper" });
        wallpaper.className = "xmb-vita-wallpaper";
        const percent = (value) => (Math.max(-1, Math.min(1, Number(value) || 0)) + 1) * 50;
        wallpaper.style.objectPosition = `${percent(art.backgroundX)}% ${percent(art.backgroundY)}%`;
        if (wallpaper.tagName === "VIDEO") {
          wallpaper.muted = true;
          wallpaper.loop = true;
          wallpaper.playsInline = true;
          Promise.resolve(root.XmbArtworkStorage?.resolve(source, "wallpaper") || source).then((url) => {
            if (!opened || token !== revision) return;
            wallpaper.src = url;
            void wallpaper.play().catch(() => {});
          }).catch(() => {});
          cleanupMedia = () => {
            wallpaper.pause();
            wallpaper.removeAttribute("src");
            wallpaper.load();
          };
        }
        const sheet = el("div", "xmb-vita-sheet");
        const plate = button("", () => action("primary"), "xmb-vita-plate");
        plate.setAttribute("aria-label", "Abrir " + item.title);
        const cover = imageNode(art.image || item.image, "", { variant: "display" });
        cover.style.objectPosition = `${percent(art.x)}% ${percent(art.y ?? 1)}%`;
        plate.append(cover);
        const copy = el("div", "xmb-vita-live-copy");
        copy.append(el("strong", "", item.title), el("span", "", item.platform || "Jogo"));
        const tip = el("img", "xmb-vita-peel-tip");
        tip.src = "xmb-media/vita_peel_tip.png";
        tip.alt = "";
        tip.draggable = false;
        const fold = el("div", "xmb-vita-fold");
        fold.setAttribute("aria-hidden", "true");
        fold.append(tip);
        sheet.append(plate, copy);
        let currentDepth = 0;
        const restDepth = () => sheet.getBoundingClientRect().width * 170 / 1792;
        const paintPeel = (depth) => {
          const bounds = sheet.getBoundingClientRect();
          const geometry = peelGeometry(bounds.width, bounds.height, depth);
          currentDepth = geometry.size;
          live.style.setProperty("--vita-stuck", geometry.stuck);
          live.style.setProperty("--vita-lifted", geometry.lifted);
          live.style.setProperty("--vita-fold-size", `${geometry.size}px`);
          live.dataset.peelDepth = String(geometry.size);
        };
        peelTo = (launch, done = () => {}) => {
          root.cancelAnimationFrame(peelFrame);
          const bounds = sheet.getBoundingClientRect();
          const target = launch ? bounds.width + bounds.height : restDepth();
          const from = currentDepth;
          const token = revision;
          const began = performance.now();
          const duration = reduced() ? 0 : launch ? 620 : 420;
          const frame = (now) => {
            if (!opened || token !== revision) return;
            const progress = duration ? Math.min(1, (now - began) / duration) : 1;
            const eased = progress * progress * (3 - 2 * progress);
            paintPeel(from + (target - from) * eased);
            if (progress < 1) peelFrame = root.requestAnimationFrame(frame);
            else {
              peelFrame = undefined;
              done();
            }
          };
          frame(began);
        };
        let start;
        live.onpointerdown = (event) => {
          if (event.button !== 0 || mode !== "live") return;
          const bounds = sheet.getBoundingClientRect();
          if (event.clientX < bounds.right - bounds.width * 0.22 || event.clientY > bounds.top + bounds.height * 0.22) return;
          event.preventDefault();
          root.cancelAnimationFrame(peelFrame);
          start = { x: event.clientX, y: event.clientY, size: bounds.width + bounds.height, depth: currentDepth };
          live.setPointerCapture(event.pointerId);
        };
        live.onpointermove = (event) => {
          if (!start) return;
          event.preventDefault();
          paintPeel(start.depth + event.clientY - start.y - event.clientX + start.x);
        };
        live.onpointerup = () => {
          if (!start) return;
          const commit = currentDepth > start.size * 0.32;
          start = null;
          if (commit) action("primary");
          else peelTo(false);
        };
        live.onpointercancel = () => {
          start = null;
          if (mode === "live") peelTo(false);
        };
        live.append(wallpaper, sheet, fold);
        paintPeel(restDepth());
        const resizePeel = () => {
          if (mode === "live" && !start) paintPeel(restDepth());
        };
        root.addEventListener("resize", resizePeel);
        const previousCleanup = cleanupMedia;
        cleanupMedia = () => {
          previousCleanup();
          root.removeEventListener("resize", resizePeel);
          live.onpointerdown = null;
          live.onpointermove = null;
          live.onpointerup = null;
          live.onpointercancel = null;
        };
        hints.textContent = "A / Enter: abrir · Arraste o canto superior direito para descolar · B / Esc: atalhos";
        plate.focus({ preventScroll: true });
      }, reduced() ? 0 : 1000);
    }
    function action(command) {
      if (!opened) return false;
      if (command === "tab" || command === "tabback") {
        const controls = [...panel.querySelectorAll("button,input,select")]
          .filter((node) => !node.disabled && node.getClientRects().length);
        const index = controls.indexOf(document.activeElement);
        const delta = command === "tab" ? 1 : -1;
        controls[(index + delta + controls.length) % controls.length]?.focus({ preventScroll: true });
        return true;
      }
      if (command === "vita") {
        close();
        return true;
      }
      if (mode === "depart" || mode === "launch") {
        if (command === "back" && mode === "depart") {
          clearWork();
          mode = "browse";
          render();
        }
        return true;
      }
      if (mode === "live") {
        if (command === "back") {
          clearWork();
          launchId = null;
          live.hidden = true;
          mode = "browse";
          render();
        } else if (command === "primary") {
          const item = game(launchId);
          if (!item) {
            close();
            return true;
          }
          mode = "launch";
          panel.dataset.mode = mode;
          const token = revision;
          peelTo(true, () => {
            if (!opened || token !== revision) return;
            close();
            onLaunch(item);
          });
        }
        return true;
      }
      if (command === "back") {
        if (moving !== null) cancelMove();
        else if (picker) {
          picker = false;
          focus = Math.max(0, ids.length - 1);
        }
        else if (mode === "icon") {
          clearWork();
          mode = "edit";
        }
        else if (mode === "edit") mode = "browse";
        else {
          close();
          return true;
        }
        render();
      } else if (command === "select") {
        if (mode === "icon") {
          clearWork();
          mode = "edit";
          render();
        }
        else if (mode === "edit" && moving === null && !picker) iconEditor();
        else if (moving === null && !picker) {
          mode = "edit";
          render();
        }
      } else if (mode === "icon") {
        const controls = [...field.querySelectorAll("button,input")];
        const index = controls.indexOf(document.activeElement);
        if (command === "primary") controls[index]?.click();
        else if (["up", "down", "left", "right"].includes(command))
          controls[Math.max(0, Math.min(controls.length - 1, index + (["up", "left"].includes(command) ? -1 : 1)))]?.focus();
      } else if (command === "primary") {
        if (picker) {
          if (focus < 0) {
            focus = 0;
            focusButton();
          } else field.querySelector(`[data-slot="${focus}"]`)?.click();
        }
        else if (moving !== null) {
          if (persist([...ids])) {
            moving = null;
            snapshot = null;
            render();
          }
        } else if (focus >= ids.length) {
          picker = true;
          pickerPlatform = "";
          focus = -1;
          render();
        }
        else if (mode === "edit") beginMove();
        else showLive(game(ids[focus]));
      } else if (["left", "right", "up", "down"].includes(command)) {
        if (picker) {
          const platforms = field.querySelector("select");
          if (["left", "right"].includes(command)) {
            platforms.selectedIndex = Math.max(0, Math.min(platforms.options.length - 1,
              platforms.selectedIndex + (command === "right" ? 1 : -1)));
            pickerPlatform = platforms.value;
            focus = -1;
            render();
            return true;
          }
          focus = Math.max(-1, Math.min(field.querySelectorAll("button").length - 1,
            focus + (["left", "up"].includes(command) ? -1 : 1)));
          focusButton();
        } else {
          const count = ids.length + (mode === "edit" || !ids.length ? 1 : 0);
          const target = neighbour(count, focus, command);
          if (moving !== null && target < ids.length) {
            const next = [...ids];
            next.splice(target, 0, next.splice(moving, 1)[0]);
            ids = next;
            moving = target;
            focus = target;
          } else if (moving === null) focus = target;
          if (moving !== null || Math.floor(focus / PAGE_SIZE) !== renderedPage) render();
          else focusButton();
        }
      }
      return true;
    }
    function close() {
      if (!opened) return;
      clearWork();
      if (moving !== null) cancelMove();
      opened = false;
      panel.dataset.exiting = "true";
      live.hidden = true;
      live.style.removeProperty("--vita-peel");
      live.replaceChildren();
      field.replaceChildren();
      host.dataset.vitaOpen = "false";
      onClose();
      timer = root.setTimeout(() => {
        if (!opened) panel.hidden = true;
      }, reduced() ? 0 : 300);
    }
    panel.addEventListener("pointermove", (event) => {
      if (!held || moving === null) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".xmb-vita-bubble");
      if (!target) return;
      const index = Number(target.dataset.slot);
      if (!Number.isInteger(index) || index === moving || index >= ids.length) return;
      const next = [...ids];
      next.splice(index, 0, next.splice(moving, 1)[0]);
      ids = next;
      focus = index;
      moving = index;
      render();
    });
    panel.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button,input") || mode === "live") return;
      swipeStart = { x: event.clientX, y: event.clientY };
    });
    panel.addEventListener("pointerup", (event) => {
      root.clearTimeout(holdTimer);
      if (swipeStart) {
        const dy = event.clientY - swipeStart.y;
        const dx = event.clientX - swipeStart.x;
        swipeStart = null;
        if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx)) turnPage(dy < 0 ? 1 : -1);
      }
      if (held && moving !== null && persist([...ids])) {
        moving = null;
        snapshot = null;
        render();
      }
      if (held) root.setTimeout(() => { held = false; }, 0);
    });
    panel.addEventListener("pointercancel", () => {
      root.clearTimeout(holdTimer);
      swipeStart = null;
      held = false;
      if (moving !== null) {
        cancelMove();
        render();
      }
    });
    function turnPage(delta) {
      if (mode === "live" || mode === "depart" || mode === "launch" || picker || mode === "icon" || moving !== null) return;
      const count = ids.length + (mode === "edit" || !ids.length ? 1 : 0);
      const next = Math.max(0, Math.min(Math.ceil(count / PAGE_SIZE) - 1, Math.floor(focus / PAGE_SIZE) + delta));
      focus = next * PAGE_SIZE;
      render();
    }
    panel.addEventListener("wheel", (event) => {
      if (mode === "live" || mode === "depart" || mode === "launch" || picker || mode === "icon" || moving !== null) return;
      event.preventDefault();
      if (Math.abs(event.deltaY) < 20) return;
      const now = Date.now();
      if (now - lastPageTurn < 250) return;
      lastPageTurn = now;
      turnPage(Math.sign(event.deltaY));
    }, { passive: false });
    return {
      open() {
        if (opened) return;
        clearWork();
        opened = true;
        if (clock) controls.append(clock);
        ids = pinned();
        mode = "browse";
        picker = false;
        pickerPlatform = "";
        launchId = null;
        renderedPage = -1;
        held = false;
        panel.dataset.exiting = "false";
        panel.hidden = false;
        host.dataset.vitaOpen = "true";
        render();
      },
      close,
      action,
      isOpen: () => opened,
    };
  };
})(typeof window === "undefined" ? globalThis : window);
