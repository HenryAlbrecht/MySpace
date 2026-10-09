/* Appearance editor and application of profile/XMB preferences. Persistence remains in extras. */
function createProfileAppearance({
  getData,
  save,
  openResource,
  schemaField,
  prepareImage,
  resource,
  button,
  bannerProfile,
  profileInner,
}) {
  function xmbAppearance(a) {
    const legacy = a.xmbBackground;
    return {
      backgroundSource:
        legacy === "desktop" ? "inherit" : legacy === "solid" ? "custom" : "artwork",
      customBackground: null,
      customBackgroundMode: "cover",
      customBackgroundColor: null,
      panelOpacity: null,
      artworkIntensity: 50,
      ghostArtworkEnabled: true,
      ...a.xmb,
      gamePresentation: a.xmb?.gamePresentation === "pill" ? "pill" : "vertical",
      // One-time compatibility default matches the formerly coupled intensity.
      ghostArtworkOpacity:
        a.xmb?.ghostArtworkOpacity ??
        75 - 0.5 * Math.max(0, Math.min(100, Number(a.xmb?.artworkIntensity ?? 50))),
      // .035 was the old contextual default, not a user-facing intensity choice.
      artworkOpacity:
        a.xmb?.artworkOpacity == null || a.xmb.artworkOpacity === 0.035 ? 1 : a.xmb.artworkOpacity,
    };
  }
  function wallpaperRecipe(background, mode) {
    const url = safeUrl(background, true);
    return {
      image: url ? `url(${JSON.stringify(url)})` : "none",
      size: mode === "tile" ? "auto" : mode === "contain" ? "contain" : "cover",
      repeat: mode === "tile" ? "repeat" : "no-repeat",
    };
  }
  function editAppearance() {
    const data = getData();
    const a = { avatarBorder: true, profileWindowBorder: true, ...data.appearance };
    const x = xmbAppearance(a);
    const transparency = Number(
      (x.panelOpacity == null ? 100 - (a.opacity ?? 100) * 0.92 : 100 - x.panelOpacity).toFixed(1),
    );
    Object.assign(a, {
      xmbSource: x.backgroundSource,
      xmbMode: x.customBackgroundMode,
      xmbColor:
        x.customBackgroundColor || getComputedStyle(document.body).getPropertyValue("--bg").trim(),
      xmbUseColor: !!x.customBackgroundColor,
      xmbTransparency: transparency,
      xmbArtworkIntensity: x.artworkIntensity,
      xmbGhostEnabled: x.ghostArtworkEnabled,
      xmbGhostOpacity: x.ghostArtworkOpacity,
      xmbGamePresentation: x.gamePresentation,
    });
    openResource({
      title: "aparência",
      item: a,
      fields: [
        schemaField("backgroundUrl", "Link do fundo (aceita GIF)", "url"),
        schemaField("backgroundFile", "Ou envie uma imagem / GIF", "file", {
          accept: "image/*",
        }),
        schemaField("clearBackground", "Remover fundo", "checkbox"),
        schemaField("backgroundMode", "Como mostrar o fundo", "select", {
          options: {
            tile: "Repetir (textura)",
            cover: "Preencher a tela",
            contain: "Centralizar",
          },
        }),
        schemaField("xmbSource", "Fundo do XMB", "select", {
          options: {
            artwork: "Artwork do item",
            inherit: "Usar aparência global",
            custom: "Personalizar XMB",
          },
        }),
        schemaField("xmbGamePresentation", "Apresentação dos jogos no XMB", "select", {
          options: { vertical: "Capa vertical", pill: "Pílula horizontal" },
        }),
        schemaField("xmbUrl", "Link do wallpaper XMB (aceita GIF)", "url"),
        schemaField("xmbFile", "Ou envie uma imagem / GIF", "file", { accept: "image/*" }),
        schemaField("xmbClear", "Remover wallpaper XMB", "checkbox"),
        schemaField("xmbMode", "Modo do wallpaper XMB", "select", {
          options: {
            tile: "Repetir (textura)",
            cover: "Preencher a tela",
            contain: "Centralizar",
          },
        }),
        schemaField("xmbUseColor", "Usar cor de fundo própria no XMB", "checkbox"),
        schemaField("xmbColor", "Cor de fundo XMB", "color"),
        schemaField("xmbGhostEnabled", "Mostrar artwork fantasma", "checkbox"),
        schemaField("xmbGhostOpacity", "Intensidade da artwork fantasma", "range", {
          min: 0,
          max: 100,
          default: 50,
          step: 0.1,
        }),
        schemaField(
          "xmbArtworkIntensity",
          "Tratamento do fundo artwork (0: mais arte · 100: mais UI)",
          "range",
          { min: 0, max: 100, default: 50 },
        ),
        schemaField("xmbTransparency", "Transparência da interface XMB (%)", "range", {
          min: 0,
          max: 100,
          step: 0.1,
        }),
        schemaField("profileLayout", "Posição do perfil", "select", {
          options: { window: "Janela na lateral", banner: "Avatar e perfil no banner" },
        }),
        schemaField("avatarShape", "Formato do avatar", "select", {
          options: { square: "Quadrado", round: "Redondo" },
        }),
        schemaField("avatarBorder", "Mostrar borda do avatar", "checkbox"),
        schemaField("profileWindowBorder", "Mostrar borda da janela do perfil", "checkbox"),
        schemaField("layoutWidth", "Largura do site", "select", {
          options: { original: "Original", wide: "Amplo", full: "Expandido (tela toda)" },
        }),
        schemaField("cornerRadius", "Arredondamento das bordas (px)", "number", {
          min: 0,
          max: 24,
          default: 0,
        }),
        schemaField("font", "Fonte", "select", {
          options: {
            original: "Atual",
            mono: "Monoespaçada",
            verdana: "Verdana",
            serif: "Georgia",
          },
        }),
        schemaField("borderStyle", "Bordas", "select", {
          options: {
            solid: "Sólida",
            dashed: "Tracejada",
            double: "Dupla",
            none: "Sem borda",
          },
        }),
        schemaField("opacity", "Opacidade dos blocos (%)", "range", {
          min: 45,
          max: 100,
          default: 100,
        }),
        schemaField("bannerHeight", "Altura do banner (px)", "number", {
          min: 180,
          max: 600,
          default: 287,
        }),
        schemaField("useColors", "Usar minhas próprias cores", "checkbox"),
        schemaField("backgroundColor", "Fundo", "color", {
          default: getComputedStyle(document.body).getPropertyValue("--bg").trim(),
        }),
        schemaField("panelColor", "Blocos", "color", {
          default: getComputedStyle(document.body).getPropertyValue("--panel").trim(),
        }),
        schemaField("textColor", "Texto", "color", {
          default: getComputedStyle(document.body).getPropertyValue("--text").trim(),
        }),
        schemaField("accentColor", "Destaques", "color", {
          default: getComputedStyle(document.body).getPropertyValue("--accent").trim(),
        }),
        schemaField("borderColor", "Bordas", "color", {
          default: getComputedStyle(document.body).getPropertyValue("--border").trim(),
        }),
      ],
      onSave: async (v) => {
        let background = a.background || "";
        if (v.clearBackground) background = "";
        else if (v.backgroundFile) background = await prepareImage(v.backgroundFile, 1800, true);
        else if (v.backgroundUrl) background = safeUrl(v.backgroundUrl);
        let customBackground = x.customBackground;
        if (v.xmbClear) customBackground = null;
        else if (v.xmbFile) customBackground = await prepareImage(v.xmbFile, 1800, true);
        else if (v.xmbUrl) customBackground = safeUrl(v.xmbUrl);
        const next = {
          ...getData().appearance,
          ...v,
          xmb: {
            ...x,
            gamePresentation: v.xmbGamePresentation === "pill" ? "pill" : "vertical",
            backgroundSource: v.xmbSource,
            customBackground,
            ghostArtworkEnabled: v.xmbGhostEnabled,
            ghostArtworkOpacity: Math.max(0, Math.min(100, Number(v.xmbGhostOpacity))),
            artworkIntensity: Math.max(0, Math.min(100, Number(v.xmbArtworkIntensity))),
            customBackgroundMode: v.xmbMode,
            customBackgroundColor: v.xmbUseColor ? v.xmbColor : null,
            panelOpacity:
              Number(v.xmbTransparency) === transparency
                ? x.panelOpacity
                : 100 - Number(v.xmbTransparency),
          },
          background,
          opacity: Number(v.opacity),
          bannerHeight: Number(v.bannerHeight),
          cornerRadius: Number(v.cornerRadius),
        };
        for (const key of [
          "xmbSource",
          "xmbUrl",
          "xmbFile",
          "xmbClear",
          "xmbMode",
          "xmbUseColor",
          "xmbColor",
          "xmbTransparency",
          "xmbArtworkIntensity",
          "xmbGhostEnabled",
          "xmbGhostOpacity",
          "xmbGamePresentation",
        ])
          delete next[key];
        delete next.backgroundFile;
        delete next.clearBackground;
        if (next.bannerHeight < 180 || next.bannerHeight > 600)
          throw Error("Use uma altura entre 180 e 600 px.");
        if (!Number.isFinite(next.cornerRadius) || next.cornerRadius < 0 || next.cornerRadius > 24)
          throw Error("Use um arredondamento entre 0 e 24 px.");
        if (!save({ ...getData(), appearance: next }))
          throw Error("Não foi possível salvar o fundo. Tente um arquivo menor.");
        applyAppearance();
      },
    });
    const reset = button(
      "usar aparência do tema",
      () => {
        if (save({ ...getData(), appearance: {} })) {
          applyAppearance();
          resource.close();
        }
      },
      "small appearance-reset",
    );
    resource.querySelector(".form-actions").prepend(reset);
    window.EditorUI?.decorateAppearance(resource.querySelector("form"));
  }
  function applyAppearance() {
    const a = getData().appearance || {},
      style = document.body.style;
    const x = xmbAppearance(a);
    document.body.dataset.xmbBackground =
      x.backgroundSource === "inherit"
        ? "desktop"
        : x.backgroundSource === "custom"
          ? "custom"
          : "artwork";
    const wallpaper = wallpaperRecipe(x.customBackground, x.customBackgroundMode);
    for (const [key, value] of Object.entries(wallpaper))
      style.setProperty("--xmb-wallpaper-" + key, value);
    style.setProperty(
      "--xmb-background-color",
      /^#[0-9a-f]{6}$/i.test(x.customBackgroundColor || "") ? x.customBackgroundColor : "var(--bg)",
    );
    style.setProperty(
      "--xmb-artwork-opacity",
      String(Math.max(0, Math.min(1, Number(x.artworkOpacity) || 0))),
    );
    const intensity = Number.isFinite(Number(x.artworkIntensity))
      ? Math.max(0, Math.min(100, Number(x.artworkIntensity))) / 100
      : 0.5;
    style.setProperty("--xmb-artwork-blur", 8 + 32 * intensity + "px");
    style.setProperty("--xmb-atmosphere-opacity", String(0.5 - 0.3 * intensity));
    document.body.dataset.xmbGhostArtwork = String(x.ghostArtworkEnabled !== false);
    const ghostIntensity = Number.isFinite(Number(x.ghostArtworkOpacity))
      ? Math.max(0, Math.min(100, Number(x.ghostArtworkOpacity)))
      : 50;
    style.setProperty("--xmb-ghost-opacity", String(ghostIntensity * 0.0016));
    if (x.panelOpacity == null) style.removeProperty("--xmb-panel-opacity");
    else
      style.setProperty(
        "--xmb-panel-opacity",
        Math.max(0, Math.min(100, Number(x.panelOpacity))) + "%",
      );
    const onBanner = a.profileLayout === "banner";
    document.body.dataset.layoutWidth = ["wide", "full"].includes(a.layoutWidth)
      ? a.layoutWidth
      : "original";
    const radius = Number(a.cornerRadius);
    style.setProperty(
      "--corner-radius",
      (Number.isFinite(radius) ? Math.max(0, Math.min(24, radius)) : 0) + "px",
    );
    document.body.dataset.avatarShape = a.avatarShape === "round" ? "round" : "square";
    document.body.dataset.avatarBorder = String(a.avatarBorder !== false);
    document.body.dataset.profileWindowBorder = String(a.profileWindowBorder !== false);
    $("profile").hidden = onBanner;
    bannerProfile.hidden = !onBanner;
    if (onBanner && profileInner.parentElement !== bannerProfile)
      bannerProfile.append(profileInner);
    if (!onBanner && profileInner.parentElement !== $("profile"))
      $("profile").insertBefore(profileInner, $("profile").querySelector(".profile-footer"));
    for (const name of [
      "--bg",
      "--panel",
      "--text",
      "--accent",
      "--border",
      "--panel2",
      "--muted",
      "--sans",
      "--display",
      "--panel-opacity",
    ])
      style.removeProperty(name);
    if (a.useColors) {
      for (const [key, name] of Object.entries({
        backgroundColor: "--bg",
        panelColor: "--panel",
        textColor: "--text",
        accentColor: "--accent",
        borderColor: "--border",
      }))
        if (/^#[0-9a-f]{6}$/i.test(a[key] || "")) style.setProperty(name, a[key]);
      style.setProperty("--panel2", "color-mix(in srgb,var(--panel) 85%,var(--text))");
      style.setProperty("--muted", "color-mix(in srgb,var(--text) 70%,var(--panel))");
    }
    const fonts = {
      mono: '"Courier New",monospace',
      verdana: "Verdana,sans-serif",
      serif: "Georgia,serif",
    };
    if (fonts[a.font]) {
      style.setProperty("--sans", fonts[a.font]);
      style.setProperty("--display", fonts[a.font]);
    }
    document.body.classList.toggle("custom-panels", a.opacity !== undefined && a.opacity < 100);
    style.setProperty("--panel-opacity", Math.max(45, Math.min(100, a.opacity ?? 100)) + "%");
    const bg = safeUrl(a.background, true);
    if (bg) {
      image(document.body, bg);
      const wallpaper = wallpaperRecipe(a.background, a.backgroundMode);
      style.backgroundSize = wallpaper.size;
      style.backgroundRepeat = wallpaper.repeat;
      style.backgroundPosition = "center";
      style.backgroundAttachment = "fixed";
    } else {
      for (const p of [
        "background-image",
        "background-size",
        "background-repeat",
        "background-position",
        "background-attachment",
      ])
        style.removeProperty(p);
    }
    for (const panel of document.querySelectorAll(".panel")) {
      panel.style.borderStyle = ["solid", "dashed", "double", "none"].includes(a.borderStyle)
        ? a.borderStyle
        : "";
      panel.style.borderWidth = a.borderStyle === "double" ? "3px" : "";
    }
    $("banner").style.height = a.bannerHeight
      ? Math.min(600, Math.max(180, a.bannerHeight)) + "px"
      : "";
  }
  return { edit: editAppearance, apply: applyAppearance };
}
