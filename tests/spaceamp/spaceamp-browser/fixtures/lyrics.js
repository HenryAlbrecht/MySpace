"use strict";

customElements.define("am-lyrics", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({
      mode: "open"
    });
    this.render("synced");
  }
  connectedCallback() {
    this.initialOptions = {
      romanization: this.showRomanization,
      translation: this.showTranslation
    };
    this.render("synced");
  }
  async toggleRomanization() {
    await this.toggleOption("romanization");
  }
  async toggleTranslation() {
    await this.toggleOption("translation");
  }
  async toggleOption(id) {
    const flag = id === "romanization" ? "showRomanization" : "showTranslation";
    this[flag] = !this[flag];
    if (this.loadingOptions) {
      this.render("loading");
      await new Promise(resolve => setTimeout(resolve, 150));
      this.render("synced");
    } else {
      const button = this.shadowRoot.querySelector("button[aria-label=\"Toggle " + id + "\"]");
      button.setAttribute("aria-pressed", String(!!this[flag]));
      const container = this.shadowRoot.querySelector(".lyrics-container");
      if (this.redrawOptions) {
        const scroll = container.scrollTop;
        for (const row of [...container.children]) {
          const fresh = row.cloneNode(true);
          fresh.style.height = this[flag] ? "120px" : "80px";
          row.replaceWith(fresh);
        }
        container.scrollTop = scroll;
      }
    }
  }
  render(mode) {
    this.shadowRoot.innerHTML = "<style>.lyrics-container{height:240px;overflow:auto}.lyrics-line{height:80px}</style><div class=\"lyrics-container\"></div>";
    const container = this.shadowRoot.querySelector(".lyrics-container");
    if (["loading", "empty", "error"].includes(mode)) return;
    for (const label of ["romanization", "translation"]) {
      const button = document.createElement("button");
      button.setAttribute("aria-label", "Toggle " + label);
      button.setAttribute("aria-pressed", String(!!this[label === "romanization" ? "showRomanization" : "showTranslation"]));
      button.textContent = label;
      button.onclick = () => {
        const flag = label === "romanization" ? "showRomanization" : "showTranslation";
        this[flag] = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(this[flag]));
        if (this.redrawOptions) {
          const scroll = container.scrollTop;
          const enlarged = button.getAttribute("aria-pressed") === "true";
          for (const row of [...container.children]) {
            const fresh = row.cloneNode(true);
            fresh.style.height = enlarged ? "120px" : "80px";
            row.replaceWith(fresh);
          }
          container.scrollTop = scroll;
        }
      };
      this.shadowRoot.append(button);
    }
    for (let i = 0; i < 12; i++) {
      const line = document.createElement("div");
      line.className = "lyrics-line";
      line.textContent = "Line " + i;
      line.tabIndex = mode === "synced" ? 0 : -1;
      line.setAttribute("role", mode === "synced" ? "button" : "paragraph");
      if (i === 1) {
        line.setAttribute("aria-current", "true");
        line.classList.add("active");
      }
      line.dataset.startTime = String((i + 1) * 20000);
      const activate = () => {
        if (mode === "synced") this.dispatchEvent(new CustomEvent("line-click", {
          detail: {
            timestamp: (i + 1) * 20000
          }
        }));
      };
      line.onclick = activate;
      line.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") activate();
      };
      container.append(line);
    }
  }
});
