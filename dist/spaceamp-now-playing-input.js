/* Owns semantic controller input and pane focus; playback stays in SPACEAMP. */
window.createSpaceampNowPlayingInput = ({
  shell, quick, controls, progress, volume, visualMenu, uiMenu,
  wake, close, lyricsNavigation, lyricsAvailable,
}) => {
  let lyricsPane = false;
  let playerTarget = null;
  let groupIndex = 1;
  let controlIndex = 1;
  let adjusting = false;
  let gamepadFocus = false;

  function clearHighlight() {
    for (const node of shell.querySelectorAll(".np-gamepad-focus")) {
      node.classList.remove("np-gamepad-focus");
    }
  }

  function leaveLyrics() {
    lyricsNavigation.leave();
    lyricsPane = false;
    if (playerTarget?.isConnected) {
      playerTarget.classList.add("np-gamepad-focus");
      playerTarget.focus({preventScroll: true});
    }
  }

  function gamepadControls(action) {
    if (!shell.open) return;
    gamepadFocus = true;
    wake();
    if (lyricsPane) {
      if (action === "left" || action === "back" || !lyricsAvailable()) {
        leaveLyrics();
      } else if (action === "up" || action === "down") {
        lyricsNavigation.move(action === "down" ? 1 : -1);
      } else if (action === "primary") {
        lyricsNavigation.activate();
      }
      return;
    }
    if (action === "back") {
      if (visualMenu.open || uiMenu.open) {
        visualMenu.open = false;
        uiMenu.open = false;
        return;
      }
      close();
      return;
    }
    const visible = node => !node.hidden && !node.disabled &&
      node.getClientRects().length && getComputedStyle(node).visibility !== "hidden";
    const groups = [
      [...quick.querySelectorAll("button,summary,select")].filter(visible),
      [...controls.querySelectorAll("button")].filter(visible),
      [progress, volume].filter(visible),
    ].filter(group => group.length);
    if (!groups.length) return;
    groupIndex = Math.max(0, Math.min(groups.length - 1, groupIndex));
    let group = groups[groupIndex];
    controlIndex = Math.max(0, Math.min(group.length - 1, controlIndex));
    const current = group[controlIndex];
    if (action === "right" && !adjusting && lyricsNavigation.enter()) {
      playerTarget = current;
      clearHighlight();
      lyricsPane = true;
      return;
    }
    if (action === "primary") {
      if (current.matches("input[type=range]")) {
        adjusting = !adjusting;
      } else if (current.tagName === "SELECT") {
        current.selectedIndex = (current.selectedIndex + 1) % current.options.length;
        current.dispatchEvent(new Event("change", {bubbles: true}));
      } else {
        current.click();
      }
    } else if (action === "up" || action === "down") {
      adjusting = false;
      groupIndex = Math.max(0, Math.min(groups.length - 1, groupIndex + (action === "down" ? 1 : -1)));
      group = groups[groupIndex];
      controlIndex = Math.min(controlIndex, group.length - 1);
    } else if (action === "left" || action === "right") {
      const direction = action === "right" ? 1 : -1;
      if (adjusting && current.matches("input[type=range]")) {
        const step = current === progress ? 0.02 : 0.05;
        current.value = String(Math.max(Number(current.min), Math.min(Number(current.max), Number(current.value) + direction * step)));
        current.dispatchEvent(new Event("input", {bubbles: true}));
      } else {
        controlIndex = (controlIndex + direction + group.length) % group.length;
      }
    }
    clearHighlight();
    const target = groups[groupIndex]?.[controlIndex];
    target?.classList.add("np-gamepad-focus");
    target?.focus({preventScroll: true});
  }

  window.addEventListener("xmb:action", event => {
    if (!shell.open) return;
    event.stopImmediatePropagation();
    gamepadControls(event.detail);
  });
  window.addEventListener("xmb:inputmode", event => {
    if (event.detail !== "keyboard") return;
    gamepadFocus = false;
    lyricsNavigation.leave();
    lyricsPane = false;
    clearHighlight();
  });

  return {
    isGamepadFocus: () => gamepadFocus,
    reconcile() {
      if (!lyricsPane) return;
      if (!lyricsAvailable()) leaveLyrics();
      else lyricsNavigation.reconcile();
    },
    reset() {
      lyricsNavigation.leave();
      lyricsPane = false;
      playerTarget = null;
      groupIndex = 1;
      controlIndex = 1;
      adjusting = false;
      gamepadFocus = false;
      clearHighlight();
    },
  };
};
