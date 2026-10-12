/* Spatial navigation complements the existing collection list/XMB controls. */
(() => {
  const groups =
    ".shelf:not(.list),.shelf-media-grid,.discovery-grid,.media-related-grid,.discover-results";
  const cards = "button.shelf-cover,button.discover-card";
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey ||
      document.querySelector("dialog[open]")
    )
      return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const current = event.target.closest?.(cards),
      group = current?.closest(groups);
    if (!group || current.closest("[hidden],.xmb-active")) return;
    const entries = [...group.querySelectorAll(cards)].filter(
      (card) => !card.disabled && card.getClientRects().length,
    );
    const origin = current.getBoundingClientRect(),
      x = origin.left + origin.width / 2,
      y = origin.top + origin.height / 2;
    const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const candidates = entries
      .filter((card) => card !== current)
      .map((card) => {
        const rect = card.getBoundingClientRect(),
          dx = rect.left + rect.width / 2 - x,
          dy = rect.top + rect.height / 2 - y;
        return {
          card,
          ahead: (horizontal ? dx : dy) * direction,
          cross: Math.abs(horizontal ? dy : dx),
        };
      })
      .filter((row) => row.ahead > 1)
      .sort((a, b) => a.ahead + a.cross * 4 - (b.ahead + b.cross * 4));
    event.preventDefault();
    candidates[0]?.card.focus({ preventScroll: true });
    candidates[0]?.card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  });

  // Native dialogs handle Escape and trapping focus; remember their opener.
  const openers = new WeakMap();
  document.addEventListener(
    "beforetoggle",
    (event) => {
      if (event.target instanceof HTMLDialogElement && event.newState === "open")
        openers.set(event.target, document.activeElement);
    },
    true,
  );
  document.addEventListener(
    "close",
    (event) => {
      if (!(event.target instanceof HTMLDialogElement)) return;
      const opener = openers.get(event.target);
      openers.delete(event.target);
      if (opener?.isConnected && !document.querySelector("dialog[open]"))
        opener.focus({ preventScroll: true });
    },
    true,
  );
})();
