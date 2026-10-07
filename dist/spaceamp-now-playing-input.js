/* Owns semantic controller input and pane focus; playback stays in SPACEAMP. */
window.createSpaceampNowPlayingInput = ({
  shell, controls, progress, volume, visualMenu, uiMenu,
  wake, close, lyricsNavigation, lyricsAvailable, navigate, quickMenu, togglePlayback,
}) => {
  let lyricsPane = false;
  let playerTarget = null;
  let groupIndex = 0;
  let controlIndex = 1;
  let adjusting = false;
  let gamepadFocus = false;
  let volumeOrigin = null;

  function finishVolume() {
    const saved = volumeOrigin;
    volumeOrigin = null;
    adjusting = false;
    clearHighlight();
    if (saved.lyrics && lyricsAvailable()) lyricsNavigation.resume();
    else {
      if (saved.lyrics) {
        leaveLyrics();
        return;
      }
      const nodes = playerGroups().flatMap(group => group.nodes);
      const target = nodes.includes(saved.target) ? saved.target : nodes[0];
      if (target) {
        const groups = playerGroups();
        groupIndex = groups.findIndex(group => group.nodes.includes(target));
        controlIndex = groups[groupIndex].nodes.indexOf(target);
        target.classList.add("np-gamepad-focus");
        target.focus({preventScroll: true});
      } else shell.focus({preventScroll: true});
    }
  }

  function clearHighlight() {
    for (const node of shell.querySelectorAll(".np-gamepad-focus")) {
      node.classList.remove("np-gamepad-focus");
    }
  }

  function visible(node) {
    if (!node?.isConnected || node.disabled || node.matches(":disabled") ||
      node.closest("[hidden],[inert]")) return false;
    const closedMenu = node.closest("details:not([open])");
    if (closedMenu && node !== closedMenu.querySelector("summary")) return false;
    return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
  }

  function playerGroups() {
    return [
      {id: "transport", nodes: [...controls.querySelectorAll("button")], lyricsAtRightEdge: true},
      {id: "ranges", nodes: [progress, volume], lyricsAtRightEdge: true},
    ].map(group => ({...group, nodes: group.nodes.filter(visible)}));
  }

  function leaveLyrics(focus = true) {
    lyricsNavigation.leave();
    lyricsPane = false;
    shell.dataset.controllerSurface = "player";
    const groups = playerGroups();
    const originGroup = groups[Math.min(groupIndex, groups.length - 1)];
    const target = visible(playerTarget) ? playerTarget :
      originGroup?.nodes[Math.min(controlIndex, originGroup.nodes.length - 1)] ||
      groups.find(group => group.nodes.length)?.nodes[0];
    clearHighlight();
    if (target) {
      groupIndex = groups.findIndex(group => group.nodes.includes(target));
      controlIndex = groups[groupIndex].nodes.indexOf(target);
      if (focus) target.classList.add("np-gamepad-focus");
      if (focus) target.focus({preventScroll: true});
    } else if (focus) {
      shell.focus({preventScroll: true});
    }
    playerTarget = null;
  }

  function gamepadControls(action) {
    if (!shell.open) return;
    gamepadFocus = true;
    shell.dataset.controllerSurface = volumeOrigin ? "volume" : lyricsPane ? "lyrics" : "player";
    wake();
    if (action === "tertiary") {
      togglePlayback();
      return;
    }
    if (action === "secondary" && !volumeOrigin) {
      if (!visible(volume)) return;
      const groups = playerGroups();
      const focused = groups.flatMap(group => group.nodes).includes(document.activeElement);
      volumeOrigin = {lyrics: lyricsPane, target: lyricsPane ? null : focused ? document.activeElement : groups[groupIndex]?.nodes[controlIndex]};
      if (lyricsPane) {
        lyricsNavigation.suspend();
        lyricsNavigation.hideCursor();
      }
      clearHighlight();
      volume.classList.add("np-gamepad-focus");
      volume.focus({preventScroll: true});
      adjusting = true;
      shell.dataset.controllerSurface = "volume";
      return;
    }
    if (volumeOrigin && ["secondary", "primary", "back"].includes(action)) {
      finishVolume();
      shell.dataset.controllerSurface = lyricsPane ? "lyrics" : "player";
      return;
    }
    if (volumeOrigin && (action === "left" || action === "right")) {
      volume.value = String(Math.max(0, Math.min(1, Number(volume.value) + (action === "right" ? 0.05 : -0.05))));
      volume.dispatchEvent(new Event("input", {bubbles: true}));
      return;
    }
    if (action === "previous" || action === "next") {
      void Promise.resolve().then(() => navigate(action)).catch(() => {});
      return;
    }
    if (action === "menu") {
      // Lyrics owns its live selection; never retain a shadow row across track changes.
      const target = volumeOrigin ? volume : lyricsPane ? null : document.activeElement;
      if (lyricsPane) lyricsNavigation.suspend();
      if (!quickMenu.open({
        surface: lyricsPane && !volumeOrigin ? "lyrics" : "player",
        target,
        restoreFocus(controller) {
          wake();
          if (volumeOrigin) volume.focus({preventScroll: true});
          else if (lyricsPane) lyricsNavigation.resume(controller);
          else if (visible(target)) target.focus({preventScroll: true});
          else {
            const groups = playerGroups();
            const fallback = groups[groupIndex]?.nodes[controlIndex] || groups.flatMap(group => group.nodes)[0];
            (fallback || shell).focus({preventScroll: true});
          }
        },
      }) && lyricsPane) lyricsNavigation.resume();
      return;
    }
    if (volumeOrigin) return;
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
    const groups = playerGroups();
    if (!groups.some(group => group.nodes.length)) return;
    groupIndex = Math.max(0, Math.min(groups.length - 1, groupIndex));
    if (!groups[groupIndex].nodes.length) {
      groupIndex = groups.findIndex(group => group.nodes.length);
    }
    let group = groups[groupIndex].nodes;
    controlIndex = Math.max(0, Math.min(group.length - 1, controlIndex));
    const current = group[controlIndex];
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
      const direction = action === "down" ? 1 : -1;
      for (let next = groupIndex + direction; next >= 0 && next < groups.length; next += direction) {
        if (!groups[next].nodes.length) continue;
        groupIndex = next;
        break;
      }
      group = groups[groupIndex].nodes;
      controlIndex = Math.min(controlIndex, group.length - 1);
    } else if (action === "left" || action === "right") {
      const direction = action === "right" ? 1 : -1;
      if (adjusting && current.matches("input[type=range]")) {
        const step = current === progress ? 0.02 : 0.05;
        current.value = String(Math.max(Number(current.min), Math.min(Number(current.max), Number(current.value) + direction * step)));
        current.dispatchEvent(new Event("input", {bubbles: true}));
      } else if (action === "right" && controlIndex === group.length - 1 &&
        groups[groupIndex].lyricsAtRightEdge && lyricsNavigation.enter()) {
        playerTarget = current;
        clearHighlight();
        lyricsPane = true;
        shell.dataset.controllerSurface = "lyrics";
        return;
      } else {
        controlIndex = Math.max(0, Math.min(group.length - 1, controlIndex + direction));
      }
    }
    clearHighlight();
    const target = groups[groupIndex]?.nodes[controlIndex];
    target?.classList.add("np-gamepad-focus");
    target?.focus({preventScroll: true});
  }

  window.addEventListener("xmb:action", event => {
    if (!shell.open) return;
    event.stopImmediatePropagation();
    gamepadControls(event.detail);
  });
  window.addEventListener("xmb:inputmode", event => {
    if (event.detail !== "keyboard" && event.detail !== "pointer") return;
    gamepadFocus = false;
    if (quickMenu.isOpen()) {
      lyricsNavigation.hideCursor();
      clearHighlight();
      return;
    }
    lyricsNavigation.leave();
    lyricsPane = false;
    volumeOrigin = null;
    adjusting = false;
    shell.dataset.controllerSurface = "player";
    clearHighlight();
  });

  return {
    isGamepadFocus: () => gamepadFocus,
    reconcile() {
      if (!lyricsPane) return;
      if (!lyricsAvailable()) leaveLyrics(!quickMenu.isOpen());
      else lyricsNavigation.reconcile();
    },
    reset() {
      lyricsNavigation.leave();
      lyricsPane = false;
      shell.dataset.controllerSurface = "player";
      playerTarget = null;
      volumeOrigin = null;
      groupIndex = 0;
      controlIndex = 1;
      adjusting = false;
      gamepadFocus = false;
      clearHighlight();
    },
  };
};
