/* Chat DOM, message reconciliation and unread presentation; voice/chat owns transport/state. */
function createPartyChatUI({
  root,
  el,
  button,
  getChat,
  getContext,
  onContextChange,
  getRoomName,
  onToggle,
}) {
  const doc = typeof document === "undefined" ? null : document;
  const chatPanel = el("aside", "spacevoice-chat"),
    chatHeading = el("h3", "", "// chat · geral");
  chatPanel.setAttribute("aria-label", "Chat da sala");
  const chatLog = el("div", "spacevoice-chat-log");
  chatLog.setAttribute("role", "log");
  chatLog.setAttribute("aria-live", "off");
  chatLog.setAttribute("aria-label", "Mensagens da sala");
  chatLog.tabIndex = 0;
  const chatTyping = el("p", "spacevoice-chat-typing"),
    chatError = el("p", "spacevoice-chat-error");
  chatError.setAttribute("role", "status");
  const chatInput = el("textarea", "spacevoice-chat-input");
  chatInput.rows = 2;
  chatInput.placeholder = "mensagem…";
  chatInput.setAttribute("aria-label", "Mensagem para a sala");
  const chatCounter = el("span", "spacevoice-chat-counter");
  const chatSend = button("[ enviar ]", () => getChat().submit());
  const chatForm = el("div", "spacevoice-chat-compose");
  chatForm.append(chatInput, chatCounter, chatSend);
  const chatNew = button("[ novas mensagens ]", () => {
    chatLog.scrollTop = chatLog.scrollHeight;
    getChat().viewport(getContext().visible, true);
  });
  const chatInner = el("div", "spacevoice-chat-inner");
  chatInner.append(chatHeading, chatLog, chatNew, chatTyping, chatForm, chatError);
  chatPanel.append(chatInner);
  let title = doc?.title || "",
    lastChatTitle = title;
  const chatRows = new Map(),
    timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  const chatToggle = button("[ chat ]", onToggle);
  chatToggle.className = "party-chat-toggle";
  function render(state, reason) {
    // Only contextual presentation changes; media nodes remain untouched.
    onContextChange();
    const { open: chatOpen } = getContext();
    chatPanel.inert = !chatOpen;
    chatPanel.setAttribute("aria-hidden", String(!chatOpen));
    root.dataset.chatOpen = String(chatOpen);
    chatHeading.textContent = "// chat · " + getRoomName();
    chatLog.dataset.empty = String(!state.messages.length);
    if (["message", "history", "lifecycle"].includes(reason)) {
      const scroll = chatLog.scrollTop || 0,
        shouldScroll = state.visible && state.nearBottom;
      const ids = new Set(state.messages.map((m) => m.id));
      for (const [id, row] of chatRows)
        if (!ids.has(id)) {
          row.remove();
          chatRows.delete(id);
        }
      for (const m of state.messages) {
        let row = chatRows.get(m.id);
        if (!row) {
          row = el("div", "spacevoice-chat-line");
          row.dataset.messageId = m.id;
          row.dataset.authorId = m.authorId;
          row.dataset.createdAt = String(m.createdAt);
          const timestamp = el(
            "time",
            "spacevoice-chat-time",
            "[" + timeFormat.format(new Date(m.createdAt)) + "]",
          );
          timestamp.dateTime = new Date(m.createdAt).toISOString();
          row.append(
            timestamp,
            el("span", "spacevoice-chat-author", m.authorName + ": "),
            el("span", "spacevoice-chat-text", m.text),
          );
          chatRows.set(m.id, row);
        }
        chatLog.append(row);
      }
      chatLog.scrollTop = shouldScroll ? chatLog.scrollHeight : scroll;
    }
    const names = state.typing.map((t) => t.name);
    chatTyping.textContent =
      names.length > 2
        ? "* " + names.length + " pessoas estão digitando…"
        : names.length
          ? "* " + names.join(" e ") + (names.length === 1 ? " está" : " estão") + " digitando…"
          : "";
    chatError.textContent = state.error;
    chatError.hidden = !state.error;
    if (chatInput.value !== state.draft) chatInput.value = state.draft;
    chatInput.disabled = !state.roomId;
    chatSend.disabled = !state.connected || !state.draft.trim() || state.draft.length > 2000;
    chatCounter.textContent = state.draft.length + "/2000";
    chatCounter.dataset.overLimit = String(state.draft.length > 2000);
    chatToggle.textContent =
      "[ chat" + (state.unread ? " · " + state.unread : "") + (chatOpen ? " <" : " >") + " ]";
    chatToggle.setAttribute("aria-expanded", String(chatOpen));
    chatToggle.setAttribute("aria-pressed", String(chatOpen));
    chatNew.textContent = "[ " + state.unread + " novas mensagens ]";
    chatNew.hidden = !state.unread;
    if (doc) {
      if (doc.title !== lastChatTitle) title = doc.title;
      doc.title = state.unread ? "(" + state.unread + ") " + title : title;
      lastChatTitle = doc.title;
    }
  }
  return { panel: chatPanel, log: chatLog, input: chatInput, toggle: chatToggle, render };
}
