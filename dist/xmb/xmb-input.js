/* Semantic input only. XMB and Now Playing own behavior. */
(function (root) {
  function createSampler(emit) {
    let faces = [],
      direction = null,
      nextRepeat = 0,
      padId = null;
    return function sample(pad, now) {
      if (!pad || pad.mapping !== "standard") {
        faces = [];
        direction = null;
        padId = null;
        return;
      }
      if (padId !== pad.index) {
        faces = [];
        direction = null;
        padId = pad.index;
      }
      const pressed = (i) => !!(pad.buttons[i]?.pressed || pad.buttons[i]?.value > 0.5);
      for (const [i, action] of [
        [0, "primary"],
        [1, "back"],
        [2, "secondary"],
        [3, "tertiary"],
        [4, "previous"],
        [5, "next"],
        [9, "menu"],
      ]) {
        const value = pressed(i);
        if (value && !faces[i]) emit(action);
        faces[i] = value;
      }
      let wanted = pressed(12)
        ? "up"
        : pressed(13)
          ? "down"
          : pressed(14)
            ? "left"
            : pressed(15)
              ? "right"
              : null;
      if (!wanted) {
        const x = pad.axes[0] || 0,
          y = pad.axes[1] || 0;
        if (Math.max(Math.abs(x), Math.abs(y)) > 0.55)
          wanted = Math.abs(y) >= Math.abs(x) ? (y > 0 ? "down" : "up") : x > 0 ? "right" : "left";
      }
      if (wanted !== direction) {
        direction = wanted;
        nextRepeat = now + 280;
        if (wanted) emit(wanted);
      } else if (wanted && now >= nextRepeat) {
        nextRepeat = now + 105;
        emit(wanted);
      }
    };
  }
  if (typeof document === "undefined") {
    module.exports = { createSampler };
    return;
  }
  let mode = "keyboard";
  function setMode(next) {
    if (mode === next) return;
    mode = next;
    root.dispatchEvent(new CustomEvent("xmb:inputmode", { detail: next }));
  }
  const sampler = createSampler((action) => {
    setMode("gamepad");
    root.dispatchEvent(new CustomEvent("xmb:action", { detail: action }));
  });
  let timer;
  function poll(now) {
    timer = undefined;
    if (document.hidden) {
      sampler(null, now);
      return;
    }
    let pads = [];
    try {
      pads = Array.from(navigator.getGamepads?.() || []).filter(
        (p) => p && p.mapping === "standard",
      );
    } catch {
      /* Browser policy may disable gamepads; keyboard remains available. */
    }
    const pad =
      pads.find(
        (p) => p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) > 0.55),
      ) || pads[0];
    sampler(pad, now);
    timer = root.requestAnimationFrame(poll);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !timer) timer = root.requestAnimationFrame(poll);
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (!event.ctrlKey && !event.altKey && !event.metaKey) setMode("keyboard");
    },
    true,
  );
  document.addEventListener("pointerdown", () => setMode("pointer"), true);
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.isTrusted) setMode("pointer");
    },
    true,
  );
  if (root.requestAnimationFrame) timer = root.requestAnimationFrame(poll);
  root.XmbInput = { createSampler, getMode: () => mode };
  if (typeof module !== "undefined") module.exports = { createSampler };
})(typeof window === "undefined" ? { addEventListener() {} } : window);
