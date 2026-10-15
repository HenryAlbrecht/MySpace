
/* Mantém apenas o destaque do controle XMB.
   O am-lyrics cuida das animações, blur e scroll nativos. */
window.createSpaceampLyricsProfile = ({ isCurrent }) => {
  let activeStyle = null;

  async function apply(component) {
    await customElements.whenDefined("am-lyrics");
    await component.updateComplete;

    const root = component.shadowRoot;

    if (
      !isCurrent(component) ||
      !component.isConnected ||
      !root ||
      root.getElementById("spaceamp-lyrics-motion-profile")
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = "spaceamp-lyrics-motion-profile";

    style.textContent = `
      .lyrics-line.spaceamp-controller-selected {
        opacity: 1 !important;
        filter: none !important;
      }

      .lyrics-line.spaceamp-controller-selected::before {
        opacity: 1;
        background: color-mix(
          in srgb,
          var(--lyplus-text-primary) 7%,
          transparent
        );
        box-shadow: inset 3px 0
          color-mix(
            in srgb,
            var(--lyplus-text-primary) 65%,
            transparent
          );
        transform: scale(1);
      }
    `;

    root.append(style);
    activeStyle = style;
  }

  return {
    apply,
    clear: () => {
      activeStyle?.remove();
      activeStyle = null;
    },
  };
};
