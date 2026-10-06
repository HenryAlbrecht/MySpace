/* Owns Shadow DOM paint and observers; timing and scrolling remain upstream. */
window.createSpaceampLyricsProfile = ({ isCurrent }) => {
  let lyricsProfileCleanup = () => {};
  // Paint-only emphasis; upstream row transforms still drive vertical scroll.
  async function applySpaceampLyricsMotionProfile(component) {
    await customElements.whenDefined("am-lyrics");
    await component.updateComplete;
    const root = component.shadowRoot;
    if (
      !isCurrent(component) ||
      !component.isConnected ||
      !root ||
      root.getElementById("spaceamp-lyrics-motion-profile")
    )
      return;
    const style = document.createElement("style");
    style.id = "spaceamp-lyrics-motion-profile";
    style.textContent = `
      .lyrics-line-container, .main-vocal-container, .background-vocal-wrap,
      .lyrics-word, .lyrics-syllable-wrap, .lyrics-syllable, .char-motion, .char {
        transform: none !important;
        translate: none !important;
        scale: none !important;
        rotate: none !important;
      }
      .lyrics-line-container {
        transition: color 350ms ease, background-color 350ms ease !important;
      }
      :host .lyrics-container .lyrics-line:not(.lyrics-gap) { opacity: .48 !important; filter: blur(1.2px) !important; }
      :host .lyrics-container .lyrics-line.far-line:not(.lyrics-gap) { filter: blur(1.8px) !important; }
      :host .lyrics-container:is(.user-scrolling,.touch-scrolling,.wheel-scrolling) .lyrics-line:not(.lyrics-gap) { filter: none !important; }
      :host .lyrics-container .lyrics-line.pre-active:not(.lyrics-gap) { opacity: .72 !important; filter: none !important; }
      :host .lyrics-container .lyrics-line.active:not(.lyrics-gap) { opacity: 1 !important; filter: none !important; }
      :host .lyrics-container .lyrics-line[role="button"]:focus { opacity: 1 !important; filter: none !important; }
      .lyrics-line[role="button"]:focus:before {
        opacity: 1;
        box-shadow: 0 0 0 2px color-mix(in srgb,var(--lyplus-text-primary)72%,transparent);
        transform: scale(1);
      }
      @keyframes spaceamp-lyrics-focus-paint { from { opacity: .92; } to { opacity: 1; } }
      .lyrics-line.active:not(.lyrics-gap) .lyrics-line-container {
        animation: spaceamp-lyrics-focus-paint 140ms var(--ease-xmb, cubic-bezier(.16, 1, .3, 1)) both;
      }
      @media (prefers-reduced-motion: reduce) {
        .lyrics-line.active:not(.lyrics-gap) .lyrics-line-container { animation: none; }
      }

    `;
    root.append(style);
    // Upstream progressive-unblur writes an inline !important filter after fetch/time
    // updates. The adapter owns line paint; retain upstream timing and scrolling.
    const reconcileLine = (line) => {
      if (line.style.getPropertyValue("filter"))
        line.style.removeProperty("filter");
    };
    const paintObserver = new MutationObserver((records) => {
      for (const line of new Set(records.map((record) => record.target)))
        reconcileLine(line);
    });
    const reconcileLayout = () => {
      if (!component.isConnected) return;
      if (!style.isConnected) root.append(style);
      paintObserver.disconnect();
      // Observe rows only: glyph highlighting can mutate hundreds of char styles.
      for (const line of root.querySelectorAll(".lyrics-line")) {
        reconcileLine(line);
        paintObserver.observe(line, {
          attributes: true,
          attributeFilter: ["class", "style"],
        });
      }
    };
    const layoutObserver = new MutationObserver(reconcileLayout);
    layoutObserver.observe(root, { childList: true, subtree: true });
    reconcileLayout();
    lyricsProfileCleanup = () => {
      paintObserver.disconnect();
      layoutObserver.disconnect();
    };
  }

  return {
    apply: applySpaceampLyricsMotionProfile,
    clear: () => lyricsProfileCleanup(),
  };
};
