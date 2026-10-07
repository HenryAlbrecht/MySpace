/* Controller selection only; am-lyrics owns timing, activation and autoscroll. */
window.createSpaceampLyricsNavigation = ({ getComponent, isAvailable, getPreferences, optionsChanged }) => {
  let component = null;
  let selected = null;
  let active = false;
  let observer = null;
  let suspended = false;
  let cursorVisible = true;
  let anchor = null;
  let anchorFrame = null;
  let applying = null;
  const boundRoots = new WeakSet();
  const options = [
    {id: "romanization", key: "romanizationEnabled", flag: "showRomanization", method: "toggleRomanization"},
    {id: "translation", key: "translationEnabled", flag: "showTranslation", method: "toggleTranslation"},
  ];

  function clearAnchor() {
    cancelAnimationFrame(anchorFrame);
    anchorFrame = null;
    anchor = null;
  }

  function restoreAnchor(state) {
    if (!anchor || anchor.component !== component) return false;
    const line = [...(state.container?.querySelectorAll(".lyrics-line[data-start-time]") || [])]
      .find(row => row.dataset.startTime === anchor.timestamp);
    if (!line) return true;
    const delta = line.getBoundingClientRect().top - state.container.getBoundingClientRect().top - anchor.offset;
    if (delta) {
      state.container.dispatchEvent(new WheelEvent("wheel", {deltaY: delta}));
      state.container.scrollBy({top: delta, behavior: "instant"});
    }
    if (active && state.lines.includes(line)) select(line);
    return true;
  }

  function select(line) {
    selected?.classList.remove("spaceamp-controller-selected");
    selected = line;
    if (cursorVisible) selected?.classList.add("spaceamp-controller-selected");
  }

  function snapshot() {
    const next = getComponent();
    if (next !== component) {
      clearAnchor();
      observer?.disconnect();
      component = next;
      select(null);
      observer = null;
    }
    const root = component?.isConnected ? component.shadowRoot : null;
    if (root && !observer) {
      if (!boundRoots.has(root)) root.addEventListener("click", event => {
        const button = event.composedPath().find(node => node instanceof HTMLButtonElement);
        const option = options.find(option => button?.getAttribute("aria-label")?.toLowerCase() === "toggle " + option.id);
        const current = getComponent();
        if (option && root === current?.shadowRoot) optionsChanged({[option.key]: !!current[option.flag]});
      });
      boundRoots.add(root);
      observer = new MutationObserver(() => {
        if (active) reconcile();
        window.dispatchEvent(new Event("spaceamp:lyricsoptionschange"));
      });
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "disabled", "hidden"] });
    }
    const container = root?.querySelector(".lyrics-container");
    const lines = container ? [...container.querySelectorAll(".lyrics-line[tabindex=\"0\"][role=\"button\"]")] : [];
    const readable = container?.querySelector(".lyrics-line:not(.lyrics-gap):not(.lyrics-footer)");
    return { container, lines, readable };
  }

  function reveal(container, line) {
    const pane = container.getBoundingClientRect();
    const row = line.getBoundingClientRect();
    const delta = row.top < pane.top ? row.top - pane.top : row.bottom > pane.bottom ? row.bottom - pane.bottom : 0;
    // Reuse upstream wheel/user-scroll timing before manual scrolling.
    if (delta) container.dispatchEvent(new WheelEvent("wheel", {deltaY: delta}));
    if (delta) container.scrollBy({ top: delta, behavior: "instant" });
    if (!suspended) line.focus({ preventScroll: true });
  }

  function reconcile() {
    const state = snapshot();
    if (!active || !isAvailable()) return state;
    if (restoreAnchor(state)) return state;
    if (!state.lines.includes(selected)) {
      select(state.lines.find(line => line.getAttribute("aria-current") === "true") ||
        state.lines.find(line => line.classList.contains("active")) ||
        state.lines.find(line => line.getBoundingClientRect().bottom >= state.container.getBoundingClientRect().top) ||
        state.lines[0] || null);
      if (selected) reveal(state.container, selected);
    }
    return state;
  }

  function enter() {
    const state = snapshot();
    if (!isAvailable() || (!state.lines.length && !state.readable)) return false;
    active = true;
    cursorVisible = true;
    select(null);
    suspended = false;
    reconcile();
    return true;
  }

  function move(direction) {
    cursorVisible = true;
    const { container, lines } = reconcile();
    if (!container || !isAvailable()) return;
    if (!lines.length) {
      container.dispatchEvent(new WheelEvent("wheel", {deltaY: direction * 48}));
      container.scrollBy({ top: direction * Math.max(48, container.clientHeight * 0.25), behavior: "instant" });
      return;
    }
    select(lines[Math.max(0, Math.min(lines.length - 1, lines.indexOf(selected) + direction))]);
    reveal(container, selected);
  }

  function leave() {
    clearAnchor();
    active = false;
    select(null);
    suspended = false;
    observer?.disconnect();
    observer = null;
    component = null;
  }

  async function changeOption(target, option) {
    clearAnchor();
    const state = snapshot();
    const line = state.lines.includes(selected) ? selected :
      state.container?.querySelector('.lyrics-line[aria-current="true"], .lyrics-line.active');
    if (line?.dataset.startTime) {
      anchor = {component, timestamp: line.dataset.startTime,
        offset: line.getBoundingClientRect().top - state.container.getBoundingClientRect().top};
    }
    // The native async command owns generation/loading; desired state belongs to Now Playing.
    try {
      await target[option.method]();
    } finally {
      if (target !== getComponent()) return;
      let frames = 0;
      const settle = () => {
        const current = snapshot();
        if (!anchor || !isAvailable()) { clearAnchor(); return; }
        restoreAnchor(current);
        if (++frames < 4) anchorFrame = requestAnimationFrame(settle);
        else clearAnchor();
      };
      if (anchor) anchorFrame = requestAnimationFrame(settle);
    }
  }

  function applyOptions() {
    const target = getComponent();
    snapshot();
    if (!target?.isConnected || applying === target) return;
    if (!options.every(option => typeof target[option.method] === "function")) return;
    applying = target;
    void (async () => {
      try {
        // Re-read desired values after each native async operation, including rapid toggles.
        while (target === getComponent() && target.isConnected) {
          const option = options.find(option => !!target[option.flag] !== getPreferences()[option.key]);
          if (!option) break;
          await changeOption(target, option);
        }
      } catch { /* Native generation failure leaves the saved preference intact. */ }
      finally { if (applying === target) applying = null; }
    })();
  }

  return {
    initializeOptions(target) {
      for (const option of options) target[option.flag] = getPreferences()[option.key];
    },
    applyOptions,
    enter,
    move,
    leave,
    reconcile,
    suspend() { suspended = true; },
    hideCursor() {
      cursorVisible = false;
      selected?.classList.remove("spaceamp-controller-selected");
    },
    resume(controller = true) {
      cursorVisible = controller;
      selected?.classList.toggle("spaceamp-controller-selected", cursorVisible);
      suspended = false;
      const { container } = reconcile();
      if (container && selected) reveal(container, selected);
    },
    activate() {
      cursorVisible = true;
      selected?.classList.add("spaceamp-controller-selected");
      const { lines } = reconcile();
      if (isAvailable() && lines.includes(selected)) selected.click();
    },
  };
};
