/* Controller selection only; am-lyrics owns timing, activation and autoscroll. */
window.createSpaceampLyricsNavigation = ({ getComponent, isAvailable }) => {
  let component = null;
  let selected = null;
  let active = false;
  let observer = null;

  function snapshot() {
    const next = getComponent();
    if (next !== component) {
      observer?.disconnect();
      component = next;
      selected = null;
      observer = null;
    }
    const root = component?.isConnected ? component.shadowRoot : null;
    if (root && !observer) {
      observer = new MutationObserver(() => {
        if (active) reconcile();
      });
      observer.observe(root, { childList: true, subtree: true });
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
    line.focus({ preventScroll: true });
  }

  function reconcile() {
    const state = snapshot();
    if (!active || !isAvailable()) return state;
    if (!state.lines.includes(selected)) {
      selected = state.lines.find(line => line.getAttribute("aria-current") === "true") ||
        state.lines.find(line => line.classList.contains("active")) ||
        state.lines.find(line => line.getBoundingClientRect().bottom >= state.container.getBoundingClientRect().top) ||
        state.lines[0] || null;
      if (selected) reveal(state.container, selected);
    }
    return state;
  }

  function enter() {
    const state = snapshot();
    if (!isAvailable() || (!state.lines.length && !state.readable)) return false;
    active = true;
    selected = null;
    reconcile();
    return true;
  }

  function move(direction) {
    const { container, lines } = reconcile();
    if (!container || !isAvailable()) return;
    if (!lines.length) {
      container.dispatchEvent(new WheelEvent("wheel", {deltaY: direction * 48}));
      container.scrollBy({ top: direction * Math.max(48, container.clientHeight * 0.25), behavior: "instant" });
      return;
    }
    selected = lines[Math.max(0, Math.min(lines.length - 1, lines.indexOf(selected) + direction))];
    reveal(container, selected);
  }

  function leave() {
    active = false;
    selected?.blur();
    selected = null;
    observer?.disconnect();
    observer = null;
    component = null;
  }

  return {
    enter,
    move,
    leave,
    reconcile,
    activate() {
      const { lines } = reconcile();
      if (isAvailable() && lines.includes(selected)) selected.click();
    },
  };
};
